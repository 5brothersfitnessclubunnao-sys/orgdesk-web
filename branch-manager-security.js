(function() {
  const LS = localStorage;

  const DEFAULT_BRANCH_MANAGERS = {
    "001": {
      branchCode: "001",
      branchName: "5 Brother's Fitness Club - Unnao / Akrampur",
      city: "Unnao",
      staffCode: "STF-001-NGXUS2",
      employeeCode: "EMP-001-MGR",
      managerName: "Saurabh Singh Chandel",
      managerEmail: ""
    },
    "002": {
      branchCode: "002",
      branchName: "5 Brother's Fitness Club - Kanpur",
      city: "Kanpur",
      staffCode: "STF-002-KNP01",
      employeeCode: "EMP-002-MGR",
      managerName: "Branch Manager Kanpur",
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

  // Formats inputs like STF-001-NGXUS2 or EMP-001-MGR with pre-filled prefix & auto dashes
  function formatPrefixedCode(rawVal, defaultPrefix, branchCode) {
    const bc = normBranch(branchCode || "001");
    let up = String(rawVal || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const prefixMatch = up.match(/^(STF|EMP|MGR)-?/);
    const prefix = prefixMatch ? prefixMatch[1] : defaultPrefix;
    let rest = up.replace(/^(STF|EMP|MGR)-?/, "");
    rest = rest.replace(/-/g, "");
    if (!rest) {
      return `${prefix}-${bc}-`;
    }
    const digitsMatch = rest.match(/^(\d{1,3})(.*)$/);
    if (digitsMatch) {
      const bDigits = digitsMatch[1].padEnd(3, digitsMatch[1].length === 3 ? "" : "");
      const codePart = digitsMatch[2] || "";
      if (bDigits.length === 3 && codePart) {
        return `${prefix}-${bDigits}-${codePart}`;
      }
      if (bDigits.length === 3 && up.endsWith("-")) {
        return `${prefix}-${bDigits}-`;
      }
      return `${prefix}-${bDigits}${codePart ? "-" + codePart : ""}`;
    }
    return `${prefix}-${bc}-${rest}`;
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
        employeeCode: normCode((extra && extra.employeeCode) || ("EMP-" + bc + "-MGR")),
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

  function getForgetRequests() {
    try {
      const arr = JSON.parse(LS.getItem("om_email_forget_requests_v1") || "[]");
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  async function submitForgetEmailRequestToAdmin(branchCode, staffCode, employeeCode) {
    const bc = normBranch(branchCode);
    const entry = ensureBranchEntry(bc);
    const stf = normCode(staffCode || entry.staffCode);
    const emp = normCode(employeeCode || entry.employeeCode);
    const reqObj = {
      id: "REQ-" + Date.now(),
      branchCode: bc,
      staffCode: stf,
      employeeCode: emp,
      registeredEmail: entry.managerEmail || "Not Registered Yet",
      status: "PENDING_ADMIN_VERIFY",
      requestedAt: new Date().toISOString()
    };

    const list = getForgetRequests();
    list.unshift(reqObj);
    try { LS.setItem("om_email_forget_requests_v1", JSON.stringify(list.slice(0, 50))); } catch (e) {}

    if (window.firebase && firebase.apps && firebase.apps.length) {
      try {
        await firebase.firestore().collection("email_verification_requests").doc(reqObj.id).set(reqObj, { merge: true });
        await firebase.firestore().collection("security_alerts").add(Object.assign({}, reqObj, {
          alertType: "FORGET_EMAIL_SENT_TO_ADMIN",
          message: `Forget Email ID request sent to Admin for Branch ${bc} (Staff: ${stf}, Emp: ${emp}, Registered Email: ${reqObj.registeredEmail})`
        }));
      } catch (e) {}
    }
    return reqObj;
  }

  async function queueVerificationEmail(managerEmail, branchCode, staffCode, employeeCode, otpCode, purpose) {
    const cleanEmail = String(managerEmail || "").trim();
    const tag = purpose || "LOGIN_VERIFY";
    const subject = `Om Software Verification Code: ${otpCode} (Branch ${branchCode})`;
    const bodyText = `[${tag}] Branch ${branchCode} | Staff Code: ${staffCode} | Employee Code: ${employeeCode} | 6-Digit Code: ${otpCode}`;

    const payload = {
      to: cleanEmail || "admin-verification-queue",
      branchCode: branchCode,
      staffCode: staffCode,
      employeeCode: employeeCode,
      otpCode: otpCode,
      purpose: tag,
      type: "MANAGER_DUAL_CODE_LOGIN_VERIFY",
      subject: subject,
      body: bodyText,
      message: {
        subject: subject,
        text: bodyText,
        html: `<div style="font-family:Arial,sans-serif;line-height:1.5"><h3>Om Software — Verification Code</h3><p><b>Branch:</b> ${branchCode}<br><b>Staff Code:</b> ${staffCode}<br><b>Employee Code:</b> ${employeeCode}</p><p style="font-size:20px;font-weight:bold;letter-spacing:3px">Verification Code: ${otpCode}</p></div>`
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

    LS.setItem("bfc_role", "staff");
    LS.setItem("bfc_org_id", "staff_org_" + bc);

    const entry = ensureBranchEntry(bc);

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

    if (!isVerifiedForBranch(bc)) {
      showVerificationGateModal(bc, entry);
    }
  }

  function showVerificationGateModal(branchCode, entry) {
    if (document.getElementById("omDualCodeGate")) return;

    const overlay = document.createElement("div");
    overlay.id = "omDualCodeGate";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(5,8,17,0.97);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;font-family:Arial,sans-serif;";

    const isWide = window.innerWidth >= 768;
    const cardStyle = isWide
      ? "max-width:780px;width:94%;background:#111827;border:2px solid #f59e0b;border-radius:18px;padding:24px;color:#f8fafc;box-shadow:0 24px 60px rgba(0,0,0,0.8)"
      : "max-width:440px;width:100%;background:#111827;border:2px solid #f59e0b;border-radius:16px;padding:20px;color:#f8fafc;box-shadow:0 20px 50px rgba(0,0,0,0.75)";

    const twoColGridStyle = isWide
      ? "display:grid;grid-template-columns:1fr 1fr;gap:14px"
      : "display:block";

    overlay.innerHTML = `
      <div style="${cardStyle}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">
          <div style="font-size:11px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.6px">Branch ${branchCode} • Dual-Code &amp; Official Email Verification</div>
          <button type="button" id="gateForgetEmailBtn" style="background:rgba(245,158,11,0.14);border:1px solid #f59e0b;color:#fde68a;border-radius:8px;padding:5px 10px;font-size:11px;font-weight:800;cursor:pointer">❓ Forget Email ID (Sent to Admin)</button>
        </div>
        <h2 style="margin:6px 0 6px;font-size:19px;color:#fff">Staff &amp; Manager Employee Verification</h2>
        <p style="margin:0 0 14px;font-size:12px;color:#94a3b8;line-height:1.45">
          Sirf <b>Admission</b>, <b>Pay Fees</b> aur <b>Staff Joining &amp; Salary</b> access ke liye <b>Staff Code</b> (<code>STF-</code>), <b>Employee Code</b> (<code>EMP-</code>), aur <b>Registered Official Email Verification</b> zaroori hai.
        </p>

        <div id="gateMsg" style="display:none;padding:10px 12px;border-radius:9px;font-size:12px;margin-bottom:12px;line-height:1.45"></div>

        <div style="${twoColGridStyle}">
          <div style="margin-bottom:10px">
            <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">1. Staff Login Code (Prefix STF- pre-filled) *</label>
            <input id="gateStaffCode" type="text" value="STF-${branchCode}-" placeholder="STF-${branchCode}-CODE" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
          </div>

          <div style="margin-bottom:10px">
            <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">2. Manager Employee Code (Prefix EMP- pre-filled) *</label>
            <input id="gateEmpCode" type="text" value="EMP-${branchCode}-" placeholder="EMP-${branchCode}-MGR" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
          </div>
        </div>

        <!-- Register / Verify Official Email ID For Login -->
        <div style="background:#0b1220;border:1px solid #23355c;border-radius:12px;padding:12px;margin-bottom:12px">
          <div style="font-size:11.5px;font-weight:800;color:#38bdf8;margin-bottom:6px">📧 Register / Verify Your Official Email ID For Login</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <input id="gateMgrEmail" type="email" value="${entry.managerEmail || ""}" placeholder="Enter official email ID &amp; register/verify" style="flex:1 1 220px;padding:10px;border-radius:9px;border:1px solid #334155;background:#070d19;color:#fff;font-size:13px;box-sizing:border-box">
            <button type="button" id="gateSendOtpBtn" style="padding:10px 14px;border-radius:9px;border:none;background:#38bdf8;color:#050811;font-weight:900;font-size:12px;cursor:pointer;white-space:nowrap">Send Verification Code</button>
          </div>
          <div style="font-size:10.5px;color:#94a3b8;margin-top:5px">
            First time email register/verify karte hi aapki official email ID is branch portal par register/update ho jayegi.
          </div>
        </div>

        <div style="margin-bottom:14px">
          <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">4. 6-Digit Email Verification Code *</label>
          <input id="gateOtpInput" type="text" inputmode="numeric" maxlength="6" placeholder="6-digit verification code" style="width:100%;padding:10px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:14px;letter-spacing:3px;box-sizing:border-box">
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button type="button" id="gateVerifyBtn" style="flex:1 1 200px;padding:12px;border-radius:10px;border:none;background:#fbbf24;color:#050811;font-weight:900;font-size:13px;cursor:pointer">Register/Verify &amp; Open Staff App</button>
          <button type="button" id="gateExitBtn" style="padding:12px 16px;border-radius:10px;border:1px solid #475569;background:#1e293b;color:#f8fafc;font-weight:700;font-size:12px;cursor:pointer">Login Page</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const stfInp = document.getElementById("gateStaffCode");
    const empInp = document.getElementById("gateEmpCode");

    stfInp.addEventListener("input", function() {
      stfInp.value = formatPrefixedCode(stfInp.value, "STF", branchCode);
    });
    empInp.addEventListener("input", function() {
      empInp.value = formatPrefixedCode(empInp.value, "EMP", branchCode);
    });

    let generatedOtp = "";

    function setGateMsg(text, isErr) {
      const box = document.getElementById("gateMsg");
      box.style.display = "block";
      box.style.background = isErr ? "rgba(239,68,68,0.16)" : "rgba(16,185,129,0.16)";
      box.style.border = isErr ? "1px solid #ef4444" : "1px solid #10b981";
      box.style.color = isErr ? "#fca5a5" : "#6ee7b7";
      box.textContent = text;
    }

    document.getElementById("gateForgetEmailBtn").addEventListener("click", async function() {
      const stf = normCode(stfInp.value);
      const emp = normCode(empInp.value);
      const req = await submitForgetEmailRequestToAdmin(branchCode, stf, emp);
      setGateMsg(
        "Forget Email ID request Admin ke paas bhej di gayi hai (Sent to Admin for Verifying). Admin apne app mein aapki Registered Email ID aur Staff Code check karke verify kar sakte hain. [Ref: " + req.id + "]",
        false
      );
    });

    document.getElementById("gateSendOtpBtn").addEventListener("click", async function() {
      const stf = normCode(stfInp.value);
      const emp = normCode(empInp.value);
      const email = String(document.getElementById("gateMgrEmail").value || "").trim();

      if (!stf || stf.endsWith("-") || !emp || emp.endsWith("-")) {
        setGateMsg("Pehle Staff Code (STF-...) aur Employee Code (EMP-...) dono poore likhein.", true);
        return;
      }
      if (!email || email.indexOf("@") === -1) {
        setGateMsg("Verification code bhejne ke liye apni Official Email ID likhein.", true);
        return;
      }

      generatedOtp = String(Math.floor(100000 + Math.random() * 900000));
      await queueVerificationEmail(email, branchCode, stf, emp, generatedOtp, "REGISTER_AND_VERIFY_EMAIL");
      setGateMsg("Verification code " + email + " par bhej diya gaya hai. Verify karte hi yeh Official Email ID is branch portal par register/update ho jayegi.", false);
    });

    document.getElementById("gateVerifyBtn").addEventListener("click", function() {
      const stf = normCode(stfInp.value);
      const emp = normCode(empInp.value);
      const email = String(document.getElementById("gateMgrEmail").value || "").trim();
      const otpEntered = String(document.getElementById("gateOtpInput").value || "").trim();

      const currentEntry = ensureBranchEntry(branchCode);

      if (!stf || stf.endsWith("-") || !emp || emp.endsWith("-")) {
        setGateMsg("Staff Code aur Employee Code dono dalna zaroori hai.", true);
        return;
      }
      if (!email || email.indexOf("@") === -1) {
        setGateMsg("Official Email ID dalna zaroori hai.", true);
        return;
      }
      if (currentEntry.employeeCode && !currentEntry.employeeCode.endsWith("-") && emp !== normCode(currentEntry.employeeCode)) {
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
        setGateMsg("6-digit Email Verification Code sahi nahi hai. 'Send Verification Code' dabakar email check karein.", true);
        return;
      }

      // Register / update official email ID directly on this branch entry
      ensureBranchEntry(branchCode, {
        managerEmail: email,
        staffCode: stf,
        employeeCode: emp
      });

      markVerifiedForBranch(branchCode, stf, emp, email);
      overlay.remove();
    });

    document.getElementById("gateExitBtn").addEventListener("click", function() {
      window.location.href = "login.html?role=staff&branch=" + encodeURIComponent(branchCode);
    });
  }

  window.OmBranchSecurity = {
    normBranch: normBranch,
    normCode: normCode,
    formatPrefixedCode: formatPrefixedCode,
    getRegistry: getRegistry,
    saveRegistry: saveRegistry,
    ensureBranchEntry: ensureBranchEntry,
    generateEmployeeCodeForBranch: generateEmployeeCodeForBranch,
    getAuditLogs: getAuditLogs,
    getForgetRequests: getForgetRequests,
    submitForgetEmailRequestToAdmin: submitForgetEmailRequestToAdmin,
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
