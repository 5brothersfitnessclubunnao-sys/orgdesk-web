(function() {
  const LS = localStorage;

  const DEFAULT_BRANCH_MANAGERS = {
    "001": {
      branchCode: "001",
      branchName: "Branch 001",
      city: "Main Branch",
      staffCode: "STF-001-MAIN",
      employeeCode: "EMP-001-MGR",
      managerName: "Branch Manager 001",
      managerEmail: ""
    },
    "002": {
      branchCode: "002",
      branchName: "Branch 002",
      city: "City Branch 002",
      staffCode: "STF-002-CITY",
      employeeCode: "EMP-002-MGR",
      managerName: "Branch Manager 002",
      managerEmail: ""
    }
  };

  function normCode(v) {
    return String(v || "").trim().toUpperCase();
  }

  function normBranch(b) {
    const m = String(b || "").trim().match(/(\d{1,4})/);
    if (m && m[1]) return m[1].padStart(3, "0");
    return "001";
  }

  function getRegistry() {
    try {
      const raw = JSON.parse(LS.getItem("om_branch_emp_registry_v1") || "null");
      if (raw && typeof raw === "object") {
        return Object.assign({}, DEFAULT_BRANCH_MANAGERS, raw);
      }
    } catch (e) {}
    return Object.assign({}, DEFAULT_BRANCH_MANAGERS);
  }

  function saveRegistry(reg) {
    try { LS.setItem("om_branch_emp_registry_v1", JSON.stringify(reg)); } catch (e) {}
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) {
        firebase.firestore().collection("system_config").doc("branch_employee_registry")
          .set({ registry: reg, updatedAt: new Date().toISOString() }, { merge: true }).catch(function(){});
      }
    } catch (e) {}
  }

  function ensureBranchEntry(branchCode, extra) {
    const bc = normBranch(branchCode);
    const reg = getRegistry();
    if (!reg[bc]) {
      reg[bc] = {
        branchCode: bc,
        branchName: (extra && extra.branchName) || ("Branch " + bc),
        city: (extra && extra.city) || "Branch " + bc,
        staffCode: normCode((extra && extra.staffCode) || ("STF-" + bc + "-OPS")),
        employeeCode: normCode((extra && extra.employeeCode) || ("EMP-" + bc + "-" + Math.random().toString(36).slice(2, 6).toUpperCase())),
        managerName: (extra && extra.managerName) || ("Manager " + bc),
        managerEmail: (extra && extra.managerEmail) || ""
      };
      saveRegistry(reg);
    } else if (extra) {
      reg[bc] = Object.assign({}, reg[bc], extra);
      saveRegistry(reg);
    }
    return reg[bc];
  }

  function generateEmployeeCodeForBranch(branchCode, customPrefix) {
    const bc = normBranch(branchCode);
    const prefix = normCode(customPrefix || ("EMP-" + bc));
    const randPart = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${randPart}`;
    const entry = ensureBranchEntry(bc, { employeeCode: code });
    return entry.employeeCode;
  }

  function getAuditLogs() {
    try {
      const arr = JSON.parse(LS.getItem("om_manager_login_audit_v1") || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function pushAuditLog(entry) {
    const logs = getAuditLogs();
    logs.unshift(Object.assign({
      id: "LOG-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
      at: new Date().toISOString(),
      device: navigator.userAgent || "Unknown Device"
    }, entry));
    const trimmed = logs.slice(0, 100);
    try { LS.setItem("om_manager_login_audit_v1", JSON.stringify(trimmed)); } catch (e) {}
    try {
      if (window.firebase && firebase.apps && firebase.apps.length) {
        firebase.firestore().collection("manager_login_audit").add(trimmed[0]).catch(function(){});
      }
    } catch (e) {}
    return trimmed[0];
  }

  async function queueVerificationEmail(managerEmail, branchCode, staffCode, employeeCode, otpCode) {
    const cleanEmail = String(managerEmail || "").trim();
    const subject = `Om Software Login Verification Code: ${otpCode} (Branch ${branchCode})`;
    const bodyText = `Login attempt for Branch ${branchCode} using Staff Code (${staffCode}) and Employee Code (${employeeCode}). Your 6-digit verification code is: ${otpCode}. If you did not initiate this login, do not share this code and alert Admin immediately.`;

    const payload = {
      to: cleanEmail || "admin-verification-queue",
      branchCode: branchCode,
      staffCode: staffCode,
      employeeCode: employeeCode,
      otpCode: otpCode,
      type: "MANAGER_DUAL_CODE_LOGIN_VERIFY",
      subject: subject,
      body: bodyText,
      message: {
        subject: subject,
        text: bodyText,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>Om Software — Login Verification</h3><p><b>Branch:</b> ${branchCode}<br><b>Staff Code:</b> ${staffCode}<br><b>Employee Code:</b> ${employeeCode}</p><p style="font-size:20px;font-weight:bold;letter-spacing:3px">Verification Code: ${otpCode}</p><p style="color:#666;font-size:12px">Agar yeh login aapne nahi kiya hai to is code ko kisi se share na karein.</p></div>`
      },
      createdAt: new Date().toISOString()
    };

    try { LS.setItem("om_pending_mgr_otp_" + branchCode, JSON.stringify(payload)); } catch (e) {}

    if (window.firebase && firebase.apps && firebase.apps.length) {
      const db = firebase.firestore();
      if (cleanEmail) {
        try { await db.collection("email_notifications").add(payload); } catch (e) {}
      }
      try {
        await db.collection("security_alerts").add(Object.assign({}, payload, {
          alertType: "MANAGER_LOGIN_VERIFICATION_REQUEST"
        }));
      } catch (e) {}
    }
  }

  function isVerifiedForBranch(branchCode, staffCode, employeeCode) {
    const bc = normBranch(branchCode);
    try {
      const v = JSON.parse(LS.getItem("om_verified_mgr_session_" + bc) || "null");
      if (!v || !v.verifiedAt) return false;
      // Session valid for 12 hours
      const ageMs = Date.now() - new Date(v.verifiedAt).getTime();
      if (ageMs > 12 * 60 * 60 * 1000) return false;
      if (staffCode && normCode(v.staffCode) !== normCode(staffCode)) return false;
      if (employeeCode && normCode(v.employeeCode) !== normCode(employeeCode)) return false;
      return true;
    } catch (e) {
      return false;
    }
  }

  function markVerifiedForBranch(branchCode, staffCode, employeeCode, managerEmail) {
    const bc = normBranch(branchCode);
    const sess = {
      branchCode: bc,
      staffCode: normCode(staffCode),
      employeeCode: normCode(employeeCode),
      managerEmail: String(managerEmail || "").trim(),
      verifiedAt: new Date().toISOString()
    };
    try {
      LS.setItem("om_verified_mgr_session_" + bc, JSON.stringify(sess));
      LS.setItem("bfc_role", "staff");
      LS.setItem("bfc_org_id", "staff_org_" + bc);
      LS.setItem("om_staff_session", JSON.stringify({
        code: sess.staffCode,
        employeeCode: sess.employeeCode,
        branchCode: bc,
        role: "staff",
        verifiedEmail: sess.managerEmail,
        loggedInAt: sess.verifiedAt
      }));
    } catch (e) {}

    pushAuditLog({
      status: "VERIFIED_LOGIN",
      branchCode: bc,
      staffCode: sess.staffCode,
      employeeCode: sess.employeeCode,
      managerEmail: sess.managerEmail
    });
  }

  function applyStrictStaffUrlLock() {
    const params = new URLSearchParams(window.location.search || "");
    const urlRole = String(params.get("role") || "").toLowerCase();
    const urlBranch = params.get("branch");
    const isStaffMode = (urlRole === "staff" || urlRole === "manager" || LS.getItem("bfc_role") === "staff" || !!LS.getItem("om_staff_session"));

    if (!isStaffMode) return;

    const bc = normBranch(urlBranch || (function() {
      try {
        const s = JSON.parse(LS.getItem("om_staff_session") || "{}");
        return s.branchCode || "001";
      } catch (e) { return "001"; }
    })());

    // Immediately enforce staff role & branch scope so full owner view never leaks
    LS.setItem("bfc_role", "staff");
    LS.setItem("bfc_org_id", "staff_org_" + bc);

    const entry = ensureBranchEntry(bc);

    // Hide owner-only sections/links/buttons if present on page
    const hideSelectors = [
      'a[href*="branch-report"]',
      'a[href*="staff-salary"]',
      'button[onclick*="branch-report"]',
      'button[onclick*="staff-salary"]',
      '#ownerOnlySection',
      '#profitLossSection',
      '#revenueSection',
      '.owner-only'
    ];
    hideSelectors.forEach(function(sel) {
      document.querySelectorAll(sel).forEach(function(el) {
        el.style.display = "none";
      });
    });

    // If not yet verified with Staff Code + Manager Employee Code + OTP for this branch, show strict verification overlay
    if (!isVerifiedForBranch(bc)) {
      showVerificationGateModal(bc, entry);
    }
  }

  function showVerificationGateModal(branchCode, entry) {
    if (document.getElementById("omDualCodeGate")) return;

    const overlay = document.createElement("div");
    overlay.id = "omDualCodeGate";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(5,8,17,0.97);display:flex;align-items:center;justify-content:center;padding:16px;font-family:Arial,sans-serif;";

    overlay.innerHTML = `
      <div style="max-width:440px;width:100%;background:#111827;border:2px solid #f59e0b;border-radius:16px;padding:20px;color:#f8fafc;box-shadow:0 20px 50px rgba(0,0,0,0.75)">
        <div style="font-size:11px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.6px">Branch ${branchCode} • Dual-Code &amp; Email Verification</div>
        <h2 style="margin:6px 0 6px;font-size:18px;color:#fff">Staff &amp; Manager Employee Verification</h2>
        <p style="margin:0 0 14px;font-size:12px;color:#94a3b8;line-height:1.45">
          Sirf <b>Admission</b>, <b>Pay Fees</b> aur <b>Staff Joining &amp; Salary</b> access ke liye <b>Staff Code</b>, apna <b>Employee Code</b>, aur <b>Manager Email Verification Code</b> zaroori hai.
        </p>

        <div id="gateMsg" style="display:none;padding:9px 11px;border-radius:8px;font-size:12px;margin-bottom:11px;"></div>

        <div style="margin-bottom:10px">
          <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">1. Staff Login Code *</label>
          <input id="gateStaffCode" type="text" placeholder="e.g. ${entry.staffCode}" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
        </div>

        <div style="margin-bottom:10px">
          <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">2. Manager Employee Code (Branch ${branchCode}) *</label>
          <input id="gateEmpCode" type="text" placeholder="e.g. ${entry.employeeCode}" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
        </div>

        <div style="margin-bottom:12px">
          <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">3. Manager Email (Verification Code Bhejne Ke Liye) *</label>
          <div style="display:flex;gap:8px">
            <input id="gateMgrEmail" type="email" value="${entry.managerEmail || ""}" placeholder="manager@example.com" style="flex:1;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
            <button type="button" id="gateSendOtpBtn" style="padding:10px 12px;border-radius:9px;border:none;background:#38bdf8;color:#050811;font-weight:800;font-size:12px;cursor:pointer;white-space:nowrap">Send Code</button>
          </div>
        </div>

        <div style="margin-bottom:14px">
          <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">4. 6-Digit Email Verification Code *</label>
          <input id="gateOtpInput" type="text" maxlength="6" placeholder="6-digit code" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:14px;letter-spacing:3px;box-sizing:border-box">
        </div>

        <div style="display:flex;gap:8px">
          <button type="button" id="gateVerifyBtn" style="flex:1;padding:11px;border-radius:10px;border:none;background:#fbbf24;color:#050811;font-weight:900;font-size:13px;cursor:pointer">Verify &amp; Open Staff App</button>
          <button type="button" id="gateExitBtn" style="padding:11px 14px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f8fafc;font-weight:700;font-size:12px;cursor:pointer">Login Page</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    let generatedOtp = "";

    function setGateMsg(text, isErr) {
      const box = document.getElementById("gateMsg");
      box.style.display = "block";
      box.style.background = isErr ? "rgba(239,68,68,0.16)" : "rgba(16,185,129,0.16)";
      box.style.border = isErr ? "1px solid #ef4444" : "1px solid #10b981";
      box.style.color = isErr ? "#fca5a5" : "#6ee7b7";
      box.textContent = text;
    }

    document.getElementById("gateSendOtpBtn").addEventListener("click", async function() {
      const stf = normCode(document.getElementById("gateStaffCode").value);
      const emp = normCode(document.getElementById("gateEmpCode").value);
      const email = String(document.getElementById("gateMgrEmail").value || "").trim();

      if (!stf || !emp) {
        setGateMsg("Pehle Staff Code aur Employee Code dono bharein.", true);
        return;
      }
      if (!email || email.indexOf("@") === -1) {
        setGateMsg("Verification code bhejne ke liye sahi Manager Email likhein.", true);
        return;
      }

      // Bind email to this branch record if not yet bound or if owner/manager sets it
      const currentEntry = ensureBranchEntry(branchCode);
      if (currentEntry.managerEmail && currentEntry.managerEmail.toLowerCase() !== email.toLowerCase()) {
        pushAuditLog({
          status: "EMAIL_MISMATCH_ATTEMPT",
          branchCode: branchCode,
          staffCode: stf,
          employeeCode: emp,
          attemptedEmail: email,
          registeredEmail: currentEntry.managerEmail
        });
        setGateMsg("Yeh email is branch ke registered manager email se match nahi karta! Alert log kar diya gaya hai.", true);
        return;
      }
      if (!currentEntry.managerEmail) {
        ensureBranchEntry(branchCode, { managerEmail: email, staffCode: stf, employeeCode: emp });
      }

      generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
      await queueVerificationEmail(email, branchCode, stf, emp, generatedOtp);
      setGateMsg("Verification code " + email + " par bhej diya gaya hai (Inbox/Spam check karein). 6-digit code daal kar verify karein.", false);
    });

    document.getElementById("gateVerifyBtn").addEventListener("click", function() {
      const stf = normCode(document.getElementById("gateStaffCode").value);
      const emp = normCode(document.getElementById("gateEmpCode").value);
      const email = String(document.getElementById("gateMgrEmail").value || "").trim();
      const otpEntered = String(document.getElementById("gateOtpInput").value || "").trim();

      const currentEntry = ensureBranchEntry(branchCode);

      if (!stf || !emp) {
        setGateMsg("Staff Code aur Employee Code dono dalna zaroori hai.", true);
        return;
      }
      if (currentEntry.employeeCode && emp !== normCode(currentEntry.employeeCode)) {
        pushAuditLog({
          status: "INVALID_EMP_CODE",
          branchCode: branchCode,
          staffCode: stf,
          employeeCode: emp,
          email: email
        });
        setGateMsg("Employee Code is branch ke liye valid nahi hai! Suspicious attempt log kar liya gaya hai.", true);
        return;
      }
      if (!generatedOtp || otpEntered !== generatedOtp) {
        setGateMsg("6-digit Email Verification Code sahi nahi hai. 'Send Code' dabakar email check karein.", true);
        return;
      }

      markVerifiedForBranch(branchCode, stf, emp, email);
      overlay.remove();
    });

    document.getElementById("gateExitBtn").addEventListener("click", function() {
      window.location.href = "login.html";
    });
  }

  window.OmBranchSecurity = {
    normBranch: normBranch,
    normCode: normCode,
    getRegistry: getRegistry,
    saveRegistry: saveRegistry,
    ensureBranchEntry: ensureBranchEntry,
    generateEmployeeCodeForBranch: generateEmployeeCodeForBranch,
    getAuditLogs: getAuditLogs,
    queueVerificationEmail: queueVerificationEmail,
    isVerifiedForBranch: isVerifiedForBranch,
    markVerifiedForBranch: markVerifiedForBranch,
    applyStrictStaffUrlLock: applyStrictStaffUrlLock
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyStrictStaffUrlLock);
  } else {
    applyStrictStaffUrlLock();
  }
})();
