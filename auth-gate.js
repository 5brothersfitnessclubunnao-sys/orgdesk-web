// auth-gate.js - Universal Navigation Lock & Admin Pin Integration
(function() {
  var LS = localStorage;

  // Universal PIN check for all pages (pay.html, attendance.html, index.html)
  window.bfcLogin = async function() {
    var storedPin = LS.getItem("om_admin_pin") || "1234";
    var pin = prompt("🔐 Admin PIN दर्ज करें (डिफ़ॉल्ट 1234):", "");
    if (pin === null) return false;
    if (pin.trim() === storedPin) return true;
    alert("❌ गलत PIN!");
    return false;
  };

  window.bfcIsAdmin = async function() {
    return true;
  };

  // Explicit App Logout Only
  window.omLogoutNow = function() {
    if (!confirm("क्या आप वाकई Logout करना चाहते हैं?")) return;
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch(function(){});
      }
    } catch(e) {}
    ['om_org_profile', 'bfc_org_profile', 'bfc_org_id', 'bfc_role', 'bfc_active_staff', 'bfc_admin_logged_in'].forEach(function(k) {
      LS.removeItem(k);
    });
    window.location.replace("login.html?logout=1");
  };

  // Trapping Android Hardware / Browser Back button
  function trapBack() {
    var p = window.location.pathname.toLowerCase();
    if (p.endsWith('login.html') || p.endsWith('reset.html')) return;

    var orgId = LS.getItem('bfc_org_id') || (JSON.parse(LS.getItem('om_org_profile') || '{}') || {}).orgId;
    if (!orgId) {
      if (!p.endsWith('join.html') && !p.endsWith('join10000.html')) {
        window.location.replace("login.html");
      }
      return;
    }

    if (window.history && window.history.pushState) {
      window.history.pushState({ appLocked: true }, '', window.location.href);
      window.addEventListener('popstate', function() {
        window.history.pushState({ appLocked: true }, '', window.location.href);
        var openModals = document.querySelectorAll('.ov.show, [id$="Modal"][style*="display: block"], [id$="Modal"][style*="display: flex"]');
        if (openModals.length > 0) {
          openModals.forEach(function(m) {
            m.classList.remove('show');
            if (m.id && m.id.endsWith('Modal')) m.style.display = 'none';
          });
        }
      });
    }
  }

  window.addEventListener('DOMContentLoaded', trapBack);
})();
