// auth-gate.js - Universal Navigation Lock & Clean Logout
(function () {
  var LS = localStorage;

  // Simple Universal PIN verify
  window.bfcLogin = async function () {
    var storedPin = LS.getItem("om_admin_pin") || "1234";
    var pin = prompt("🔐 Admin PIN दर्ज करें (डिफ़ॉल्ट 1234):", "");
    if (pin === null) return false;
    if (pin.trim() === storedPin) return true;
    alert("❌ गलत PIN!");
    return false;
  };

  window.bfcIsAdmin = async function () {
    return true;
  };

  // Direct Working Logout
  window.omLogoutNow = function () {
    if (!confirm("क्या आप वाकई Logout करना चाहते हैं?")) return;
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch(function () {});
      }
    } catch (e) {}

    var keys = [
      'om_org_profile', 'bfc_org_profile', 'bfc_org_id', 'bfc_role',
      'bfc_active_staff', 'bfc_admin_logged_in'
    ];
    keys.forEach(function (k) { LS.removeItem(k); });

    window.location.replace("login.html?logout=1");
  };

  // Back button lock: authenticated session ke dauran login page par na jaaye
  function setupBackLock() {
    var p = window.location.pathname.toLowerCase();
    var isAuthPage = p.endsWith('login.html') || p.endsWith('reset.html');
    var isPublicJoin = p.endsWith('join.html') || p.endsWith('join10000.html');
    var orgId = LS.getItem('bfc_org_id') || (JSON.parse(LS.getItem('om_org_profile') || '{}') || {}).orgId;

    if (!orgId && !isAuthPage && !isPublicJoin) {
      window.location.replace("login.html");
      return;
    }

    if (orgId && isAuthPage && !window.location.search.includes('logout=1')) {
      window.location.replace("index.html");
      return;
    }

    if (orgId && !isAuthPage && window.history && window.history.pushState) {
      window.history.pushState({ locked: true }, '', window.location.href);
      window.onpopstate = function () {
        window.history.pushState({ locked: true }, '', window.location.href);
      };
    }
  }

  window.addEventListener('DOMContentLoaded', setupBackLock);
})();
