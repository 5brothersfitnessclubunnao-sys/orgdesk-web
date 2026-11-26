/** * Om Software ERP — Cloud Functions (asia-south1) * Team accounts, MPIN, password reset, master subscription control */
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

if (!admin.apps.length) {
  admin.initializeApp();
}

setGlobalOptions({ region: "asia-south1", maxInstances: 10 });

const db = admin.firestore();
const auth = admin.auth();

const BCRYPT_ROUNDS = 12;
const LOCK_MS = 15 * 60 * 1000; // 15 minutes
const MAX_FAILS = 5;
const PLAN_NAMES = {
  99: "First Plan (₹99)",
  199: "Growth Value Plan (₹199)",
  399: "Pro Business Plan (₹399)",
  499: "Advanced Audit Plan (₹499)",
  999: "Complete Enterprise ERP (₹999)",
};

// ─── helpers ───────────────────────────────────────────────

function normCode(v) {
  return String(v || "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function codeDocId(gymId, code) {
  return crypto
    .createHash("sha256")
    .update(String(gymId) + "|" + normCode(code))
    .digest("hex");
}

function requireAuth(req) {
  if (!req.auth || !req.auth.uid) {
    throw new HttpsError("unauthenticated", "Please login first.");
  }
  return req.auth;
}

async function requireOwner(uid) {
  const snap = await db.collection("owner_accounts").doc(uid).get();
  if (!snap.exists) {
    throw new HttpsError(
      "permission-denied",
      "Only the verified Gym Owner can manage team accounts."
    );
  }
  return snap.data() || {};
}

async function requirePlan(gymId, minimum) {
  const snap = await db.collection("subscriptions").doc(gymId).get();
  const p = snap.exists ? snap.data() || {} : {};
  const status = String(p.status || "").toLowerCase();
  const amount = Number(p.amount || 0);
  if (status !== "active" || amount < minimum) {
    throw new HttpsError(
      "failed-precondition",
      "Please activate the required ₹" +
        minimum +
        " plan before using this feature."
    );
  }
  return p;
}

function validatePassword(v) {
  const p = String(v || "");
  if (p.length < 8 || p.length > 128) {
    throw new HttpsError(
      "invalid-argument",
      "Password must be 8–128 characters."
    );
  }
  return p;
}

function validateEmployeeCode(code) {
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    throw new HttpsError(
      "invalid-argument",
      "Employee code must be 3–24 letters/numbers (A-Z, 0-9, _ or -)."
    );
  }
  return code;
}

// ─── createTeamAccount ─────────────────────────────────────
// Owner creates Manager / Staff login (employee code + password)

exports.createTeamAccount = onCall(async (request) => {
  const caller = requireAuth(request);
  await requireOwner(caller.uid);
  await requirePlan(caller.uid, 499);

  const d = request.data || {};
  const code = validateEmployeeCode(normCode(d.employeeCode));
  const name = String(d.name || "").trim();
  const role = String(d.role || "").toLowerCase();
  const branchId = String(d.branchId || "").trim();
  const password = validatePassword(d.password);

  if (!name) {
    throw new HttpsError("invalid-argument", "Employee name is required.");
  }
  if (!["manager", "staff"].includes(role)) {
    throw new HttpsError("invalid-argument", "Role must be manager or staff.");
  }
  if (!branchId) {
    throw new HttpsError("invalid-argument", "Branch ID is required.");
  }

  const id = codeDocId(caller.uid, code);
  const ref = db.collection("team_accounts").doc(id);
  const old = await ref.get();
  if (old.exists) {
    throw new HttpsError(
      "already-exists",
      "This Employee Code is already registered in this gym."
    );
  }

  let user;
  try {
    user = await auth.createUser({ displayName: name, disabled: false });
  } catch (e) {
    throw new HttpsError(
      "internal",
      "Could not create team Auth user. Please retry."
    );
  }

  try {
    await auth.setCustomUserClaims(user.uid, {
      role,
      gymId: caller.uid,
      branchId,
      employeeCode: code,
      name,
    });
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => {});
    throw new HttpsError(
      "internal",
      "Team security role could not be assigned."
    );
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const now = admin.firestore.FieldValue.serverTimestamp();

  const account = {
    uid: user.uid,
    gymId: caller.uid,
    branchId,
    employeeCode: code,
    name,
    role,
    passwordHash,
    mpinHash: "",
    active: true,
    failedAttempts: 0,
    lockUntil: 0,
    createdAt: now,
    createdBy: caller.uid,
  };

  try {
    const batch = db.batch();
    batch.set(ref, account);
    batch.set(db.collection("users").doc(user.uid), {
      uid: user.uid,
      gymId: caller.uid,
      branchId,
      role,
      name,
      employeeCode: code,
      active: true,
      createdAt: now,
    });
    batch.set(db.collection("staff").doc(user.uid), {
      uid: user.uid,
      gymId: caller.uid,
      branchId,
      employeeCode: code,
      id: code,
      name,
      role,
      post: role === "manager" ? "Branch Manager" : "Staff",
      active: true,
      createdAt: new Date().toISOString(),
    });
    await batch.commit();
  } catch (e) {
    await auth.deleteUser(user.uid).catch(() => {});
    throw new HttpsError(
      "internal",
      "Team account could not be saved. Please retry."
    );
  }

  return {
    success: true,
    employeeCode: code,
    role,
    gymId: caller.uid,
    branchId,
    invitePath:
      "login.html?role=" +
      encodeURIComponent(role) +
      "&gymId=" +
      encodeURIComponent(caller.uid),
  };
});

// ─── loginTeamWithCode ─────────────────────────────────────
// Staff / Manager login with employee code + password OR mpin

exports.loginTeamWithCode = onCall(async (request) => {
  const d = request.data || {};
  const gymId = String(d.gymId || "").trim();
  const code = normCode(d.employeeCode);
  const role = String(d.role || "").toLowerCase();
  const method = String(d.method || "password").toLowerCase();
  const secret = String(d.secret || "");

  if (
    !gymId ||
    !code ||
    !secret ||
    !["manager", "staff"].includes(role) ||
    !["password", "mpin"].includes(method)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Gym invite, employee code and login secret are required."
    );
  }

  const id = codeDocId(gymId, code);
  const ref = db.collection("team_accounts").doc(id);
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError(
      "unauthenticated",
      "Employee Code or password is incorrect."
    );
  }

  const a = snap.data() || {};
  if (!a.active || a.role !== role || a.gymId !== gymId) {
    throw new HttpsError(
      "permission-denied",
      "This account is inactive or this invite is not valid for the selected role."
    );
  }

  const now = Date.now();
  const lockUntil = Number(a.lockUntil || 0);
  if (lockUntil > now) {
    throw new HttpsError(
      "resource-exhausted",
      "Too many attempts. Please wait 15 minutes."
    );
  }

  const hash = method === "mpin" ? a.mpinHash : a.passwordHash;
  if (!hash) {
    throw new HttpsError(
      "failed-precondition",
      method === "mpin"
        ? "MPIN has not been set. Login with password first."
        : "Password is not configured. Contact Gym Owner."
    );
  }

  const ok = await bcrypt.compare(secret, hash);
  if (!ok) {
    const fails = Number(a.failedAttempts || 0) + 1;
    const locked = fails >= MAX_FAILS;
    await ref.update({
      failedAttempts: locked ? 0 : fails,
      lockUntil: locked ? now + LOCK_MS : 0,
    });
    throw new HttpsError(
      "unauthenticated",
      "Employee Code or password is incorrect."
    );
  }

  await ref.update({
    failedAttempts: 0,
    lockUntil: 0,
    lastLoginAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const token = await auth.createCustomToken(a.uid, {
    role: a.role,
    gymId: a.gymId,
    branchId: a.branchId,
    employeeCode: a.employeeCode,
    name: a.name,
  });

  return {
    token,
    role: a.role,
    gymId: a.gymId,
    branchId: a.branchId,
    employeeCode: a.employeeCode,
    name: a.name,
  };
});

// ─── setMyTeamMpin ─────────────────────────────────────────
// Signed-in Manager / Staff sets 4–6 digit MPIN

exports.setMyTeamMpin = onCall(async (request) => {
  const caller = requireAuth(request);
  const claims = caller.token || {};
  const role = String(claims.role || "");
  if (!["manager", "staff"].includes(role)) {
    throw new HttpsError(
      "permission-denied",
      "Only a signed-in Manager or Staff can set an MPIN."
    );
  }

  const gymId = String(claims.gymId || "");
  await requirePlan(gymId, 499);

  const mpin = String((request.data || {}).mpin || "");
  if (!/^\d{4,6}$/.test(mpin)) {
    throw new HttpsError("invalid-argument", "MPIN must be 4–6 digits.");
  }

  const id = codeDocId(gymId, claims.employeeCode);
  const ref = db.collection("team_accounts").doc(id);
  const snap = await ref.get();
  if (!snap.exists || snap.data().uid !== caller.uid) {
    throw new HttpsError(
      "permission-denied",
      "Team account verification failed."
    );
  }

  await ref.update({
    mpinHash: await bcrypt.hash(mpin, BCRYPT_ROUNDS),
    mpinUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── resetTeamPassword ─────────────────────────────────────
// Owner resets a team member's password

exports.resetTeamPassword = onCall(async (request) => {
  const caller = requireAuth(request);
  await requireOwner(caller.uid);
  await requirePlan(caller.uid, 499);

  const d = request.data || {};
  const code = validateEmployeeCode(normCode(d.employeeCode));
  const password = validatePassword(d.password);

  const ref = db.collection("team_accounts").doc(codeDocId(caller.uid, code));
  const snap = await ref.get();
  if (!snap.exists) {
    throw new HttpsError("not-found", "Employee Code not found.");
  }

  await ref.update({
    passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
    failedAttempts: 0,
    lockUntil: 0,
    passwordUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { success: true };
});

// ─── masterSetSubscription ─────────────────────────────────
// Master Admin activates / suspends gym plan

exports.masterSetSubscription = onCall(async (request) => {
  const caller = requireAuth(request);
  if (caller.token.masterAdmin !== true) {
    throw new HttpsError("permission-denied", "Master Admin only.");
  }

  const d = request.data || {};
  const gymId = String(d.gymId || "").trim();
  const action = String(d.action || "activate").toLowerCase();

  if (!gymId) {
    throw new HttpsError("invalid-argument", "Gym ID is required.");
  }

  const now = admin.firestore.FieldValue.serverTimestamp();

  if (action === "suspend") {
    await db.collection("subscriptions").doc(gymId).set(
      {
        gymId,
        status: "inactive",
        amount: 0,
        suspendedAt: now,
        suspendedBy: caller.uid,
      },
      { merge: true }
    );
    await db
      .collection("plan_requests")
      .doc(gymId)
      .set({ status: "suspended", updatedAt: now }, { merge: true });
    return { success: true, status: "inactive" };
  }

  const amount = Number(d.amount);
  if (!PLAN_NAMES[amount]) {
    throw new HttpsError("invalid-argument", "Choose a valid plan amount.");
  }

  await db.collection("subscriptions").doc(gymId).set(
    {
      gymId,
      amount,
      name: PLAN_NAMES[amount],
      status: "active",
      activatedAt: now,
      activatedBy: caller.uid,
    },
    { merge: true }
  );
  await db.collection("plan_requests").doc(gymId).set(
    {
      status: "approved",
      approvedAmount: amount,
      approvedAt: now,
    },
    { merge: true }
  );

  return {
    success: true,
    gymId,
    amount,
    name: PLAN_NAMES[amount],
  };
});
