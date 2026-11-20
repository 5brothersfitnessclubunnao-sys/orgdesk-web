(function() {
  const LS = localStorage;

  const DEFAULT_BRANCH_MANAGERS = {
    "001": {
      branchCode: "001",
      branchName: "Branch 001",
      city: "Branch 001",
      staffCode: "STF-001-OPS",
      employeeCode: "EMP-001-MGR",
      managerName: "Branch Manager 001"
    },
    "002": {
      branchCode: "002",
      branchName: "Branch 002",
      city: "Branch 002",
      staffCode: "STF-002-OPS",
      employeeCode: "EMP-002-MGR",
      managerName: "Branch Manager 002"
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

  function formatPrefixedCode(rawVal, defaultPrefix, branchCode) {
    const bc = normBranch(branchCode || "001");
    let up = String(rawVal || "").toUpperCase().replace(/[^A-Z0-9-]/g, "");
    const prefixMatch = up.match(/^(STF|EMP|MGR)-?/);
    const prefix = prefixMatch ? prefixMatch[1] : defaultPrefix;
    let rest = up.replace(/^(STF|EMP|MGR)-?/, "").replace(/-/g, "");
    if (!rest) {
      return `${prefix}-${bc}-`;
    }
    const digitsMatch = rest.match(/^(\d{1,3})(.*)$/);
    if (digitsMatch) {
      const bDigits = digitsMatch[1];
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
        city: (extra && extra.city) || ("Branch " + bc),
        staffCode: normCode((extra && extra.staffCode) || ("STF-" + bc + "-OPS")),
        employeeCode: normCode((extra && extra.employeeCode) || ("EMP-" + bc + "-MGR")),
        managerName: (extra && extra.managerName) || ("Manager " + bc)
      };
      saveRegistry(reg);
    } else if (extra) {
      reg[bc] = Object.assign({}, reg[bc], extra);
      saveRegistry(reg);
    }
    return reg[bc];
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

  function markVerifiedForBranch(branchCode, staffCode, employeeCode) {
    const bc = normBranch(branchCode);
    const sess = {
      branchCode: bc,
      staffCode: normCode(staffCode),
      employeeCode: normCode(employeeCode),
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
        loggedInAt: sess.verifiedAt
      }));
    } catch (e) {}

    pushAuditLog({
      status: "DUAL_CODE_LOGIN",
      branchCode: bc,
      staffCode: sess.staffCode,
      employeeCode: sess.employeeCode
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
      showDualCodeGateModal(bc, entry);
    }
  }

  function showDualCodeGateModal(branchCode, entry) {
    if (document.getElementById("omDualCodeGate")) return;

    const overlay = document.createElement("div");
    overlay.id = "omDualCodeGate";
    overlay.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(5,8,17,0.97);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;font-family:Arial,sans-serif;";

    const isWide = window.innerWidth >= 768;
    const cardStyle = isWide
      ? "max-width:740px;width:94%;background:#111827;border:2px solid #f59e0b;border-radius:18px;padding:24px;color:#f8fafc;box-shadow:0 24px 60px rgba(0,0,0,0.8)"
      : "max-width:440px;width:100%;background:#111827;border:2px solid #f59e0b;border-radius:16px;padding:20px;color:#f8fafc;box-shadow:0 20px 50px rgba(0,0,0,0.75)";

    const gridStyle = isWide
      ? "display:grid;grid-template-columns:1fr 1fr;gap:14px"
      : "display:block";

    overlay.innerHTML = `
      <div style="${cardStyle}">
        <div style="font-size:11px;font-weight:800;color:#fbbf24;text-transform:uppercase;letter-spacing:0.6px">Branch ${branchCode} • Staff &amp; Employee Code Login</div>
        <h2 style="margin:6px 0 6px;font-size:19px;color:#fff">Login With Staff Code &amp; Employee Code</h2>
        <p style="margin:0 0 14px;font-size:12px;color:#94a3b8;line-height:1.45">
          Login karne ke liye apna <b>Staff Code</b> (<code>STF-</code>) aur <b>Employee Code</b> (<code>EMP-</code>) dono daalein.
        </p>

        <div id="gateMsg" style="display:none;padding:10px 12px;border-radius:9px;font-size:12px;margin-bottom:12px;line-height:1.45"></div>

        <div style="${gridStyle}">
          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">1. Staff Code *</label>
            <input id="gateStaffCode" type="text" value="STF-${branchCode}-" placeholder="STF-${branchCode}-CODE" style="width:100%;padding:11px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
          </div>

          <div style="margin-bottom:12px">
            <label style="display:block;font-size:11.5px;font-weight:700;color:#cbd5e1;margin-bottom:4px">2. Employee Code *</label>
            <input id="gateEmpCode" type="text" value="EMP-${branchCode}-" placeholder="EMP-${branchCode}-MGR" style="width:100%;padding:11px;border-radius:9px;border:1px solid #334155;background:#0b1220;color:#fff;font-size:13px;box-sizing:border-box">
          </div>
        </div>

        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:4px">
          <button type="button" id="gateLoginBtn" style="flex:1 1 200px;padding:12px;border-radius:10px;border:none;background:#fbbf24;color:#050811;font-weight:900;font-size:13.5px;cursor:pointer">Login</button>
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

    function setGateErr(text) {
      const box = document.getElementById("gateMsg");
      box.style.display = "block";
      box.style.background = "rgba(239,68,68,0.16)";
      box.style.border = "1px solid #ef4444";
      box.style.color = "#fca5a5";
      box.textContent = text;
    }

    document.getElementById("gateLoginBtn").addEventListener("click", function() {
      const stf = normCode(stfInp.value);
      const emp = normCode(empInp.value);

      if (!stf || stf.endsWith("-") || !emp || emp.endsWith("-")) {
        setGateErr("Staff Code aur Employee Code dono dalna zaroori hai.");
        return;
      }

      markVerifiedForBranch(branchCode, stf, emp);
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
    getAuditLogs: getAuditLogs,
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
