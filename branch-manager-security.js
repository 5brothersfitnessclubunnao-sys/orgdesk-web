(function() {
  const LS = localStorage;

  const DEFAULT_BRANCH_MANAGERS = {
    "001": {
      branchCode: "001",
      branchName: "5 Brother's Fitness Club - Akrampur / Unnao",
      city: "Unnao",
      staffCode: "STF-001-OPS",
      employeeCode: "EMP-001-MGR",
      managerName: "Branch Manager 001"
    },
    "002": {
      branchCode: "002",
      branchName: "5 Brother's Fitness Club - Kanpur",
      city: "Kanpur",
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
      showFullScreenGate(bc, entry);
    }
  }

  function showFullScreenGate(branchCode, entry) {
    if (document.getElementById("omDualCodeGate")) return;

    const overlay = document.createElement("div");
    overlay.id = "omDualCodeGate";
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;z-index:2147483647;background:#070B14;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:clamp(16px, 3vw, 40px);box-sizing:border-box;overflow-y:auto;font-family:'Plus Jakarta Sans','Segoe UI',sans-serif;color:#F8FAFC;";

    overlay.innerHTML = `
      <div style="width:100%;max-width:1100px;min-height:min(680px, 92vh);background:radial-gradient(1000px 500px at 50% -10%, #152244 0%, #0D1527 60%, #070B14 100%);border:2px solid #FFB800;border-radius:24px;padding:clamp(20px, 4vw, 48px);box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between;box-shadow:0 0 60px rgba(255,184,0,0.22);">
        
        <!-- Header -->
        <div>
          <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;border-bottom:1.5px dashed rgba(51,78,129,0.6);padding-bottom:16px;margin-bottom:24px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:44px;height:44px;background:#FFB800;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:22px;color:#000;">🏋️</div>
              <div>
                <h1 style="font-size:clamp(18px, 2.2vw, 26px);font-weight:900;color:#FFFFFF;margin:0;letter-spacing:0.5px;">OM SOFTWARE • STAFF PORTAL</h1>
                <div style="font-size:12px;color:#8494B2;margin-top:2px;">Branch <b>${branchCode}</b> &bull; Dual-Code Staff &amp; Manager Security</div>
              </div>
            </div>
            <div style="background:rgba(255,184,0,0.15);border:1px solid #FFB800;color:#FFB800;padding:6px 14px;border-radius:999px;font-size:11.5px;font-weight:800;letter-spacing:0.8px;">
              STAFF SIGN IN ONLY
            </div>
          </div>

          <p style="font-size:clamp(13px, 1.3vw, 15px);color:#CBD5E1;line-height:1.6;margin:0 0 24px;">
            Is branch mein login karne ke liye apna <b>Staff Code</b> (<code>STF-</code>) aur <b>Employee Code</b> (<code>EMP-</code>) darj karein. Verification ke baad sirf <b>Admission Form</b>, <b>Pay Fees Desk</b>, aur <b>Staff Joining &amp; Attendance</b> open hoga.
          </p>

          <div id="gateMsg" style="display:none;padding:14px 18px;border-radius:12px;font-size:13.5px;margin-bottom:20px;line-height:1.5;"></div>

          <!-- Dual Code Inputs (Full-width grid on tablet/PC) -->
          <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(320px, 1fr));gap:clamp(16px, 2.5vw, 28px);margin-bottom:28px;">
            
            <div style="background:#0F172A;border:1.5px solid #23355C;border-radius:16px;padding:clamp(16px, 2vw, 22px);">
              <label style="display:block;font-size:13px;font-weight:800;color:#FFB800;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">
                1. Staff Login Code *
              </label>
              <input id="gateStaffCode" type="text" value="STF-${branchCode}-" placeholder="STF-${branchCode}-CODE" 
                style="width:100%;padding:clamp(12px, 1.5vw, 16px);border-radius:12px;border:1.5px solid #334E81;background:#070B14;color:#FFFFFF;font-size:clamp(15px, 1.4vw, 18px);font-weight:800;letter-spacing:1px;box-sizing:border-box;outline:none;">
              <div style="font-size:11px;color:#8494B2;margin-top:7px;">Prefix <code>STF-${branchCode}-</code> pre-filled hai, aage ka code likhein.</div>
            </div>

            <div style="background:#0F172A;border:1.5px solid #23355C;border-radius:16px;padding:clamp(16px, 2vw, 22px);">
              <label style="display:block;font-size:13px;font-weight:800;color:#FFB800;text-transform:uppercase;letter-spacing:0.6px;margin-bottom:8px;">
                2. Manager Employee Code *
              </label>
              <input id="gateEmpCode" type="text" value="EMP-${branchCode}-" placeholder="EMP-${branchCode}-MGR" 
                style="width:100%;padding:clamp(12px, 1.5vw, 16px);border-radius:12px;border:1.5px solid #334E81;background:#070B14;color:#FFFFFF;font-size:clamp(15px, 1.4vw, 18px);font-weight:800;letter-spacing:1px;box-sizing:border-box;outline:none;">
              <div style="font-size:11px;color:#8494B2;margin-top:7px;">Prefix <code>EMP-${branchCode}-</code> pre-filled hai, aage ka code likhein.</div>
            </div>

          </div>
        </div>

        <!-- Buttons Area -->
        <div style="display:flex;gap:14px;flex-wrap:wrap;padding-top:16px;border-top:1px solid rgba(51,78,129,0.5);">
          <button type="button" id="gateLoginBtn" 
            style="flex:2 1 240px;padding:clamp(14px, 1.6vw, 18px);border-radius:14px;border:none;background:#FFB800;color:#070B14;font-weight:900;font-size:clamp(15px, 1.3vw, 17px);cursor:pointer;letter-spacing:0.5px;transition:transform 0.15s ease;">
            🔓 Verify &amp; Open Staff App
          </button>
          <button type="button" id="gateExitBtn" 
            style="flex:1 1 140px;padding:clamp(14px, 1.6vw, 18px);border-radius:14px;border:1.5px solid #334E81;background:#162340;color:#FFFFFF;font-weight:800;font-size:clamp(13px, 1.1vw, 15px);cursor:pointer;">
            ⬅️ Main Login
          </button>
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
      box.style.background = "rgba(239,68,68,0.18)";
      box.style.border = "1.5px solid #EF4444";
      box.style.color = "#FCA5A5";
      box.textContent = text;
    }

    document.getElementById("gateLoginBtn").addEventListener("click", function() {
      const stf = normCode(stfInp.value);
      const emp = normCode(empInp.value);

      if (!stf || stf.endsWith("-") || !emp || emp.endsWith("-")) {
        setGateErr("Staff Code aur Employee Code dono poore dalna zaroori hai.");
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
