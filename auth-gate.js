// auth-gate.js - Universal Navigation Lock & Bulletproof Session
(function () {
  var LS = localStorage;

  // Universal Admin PIN check (Default 1234)
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

  // Direct 100% Working Logout
  window.omLogoutNow = function () {
    if (!confirm("क्या आप वाकई Logout करना चाहते हैं?")) return;
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch(function () {});
      }
    } catch (e) {}

    ['om_org_profile', 'bfc_org_profile', 'bfc_org_id', 'bfc_role', 'bfc_active_staff', 'bfc_admin_logged_in'].forEach(function (k) {
      LS.removeItem(k);
    });

    window.location.replace("login.html?logout=1");
  };

  // Asynchronous Bulletproof Guard (NO BOUNCE LOOP)
  function initGuard() {
    var p = window.location.pathname.toLowerCase();
    var isAuthPage = p.endsWith('login.html') || p.endsWith('reset.html');
    var isPublicJoin = p.endsWith('join.html') || p.endsWith('join10000.html');

    if (window.firebase && firebase.auth) {
      firebase.auth().onAuthStateChanged(function (user) {
        if (user) {
          // User is authenticated - ensure orgId is saved
          LS.setItem('bfc_org_id', user.uid);
          var prof = JSON.parse(LS.getItem('om_org_profile') || '{}');
          if (!prof.orgId) {
            prof.orgId = user.uid;
            LS.setItem('om_org_profile', JSON.stringify(prof));
          }

          // If on login page and logged in, forward to index.html
          if (isAuthPage && !window.location.search.includes('logout=1')) {
            window.location.replace("index.html");
          }
        } else {
          // No user logged in
          if (!isAuthPage && !isPublicJoin) {
            window.location.replace("login.html");
          }
        }
      });
    }

    // Hardware/Browser Back Lock (Prevent exiting session accidentally)
    if (!isAuthPage && window.history && window.history.pushState) {
      window.history.pushState({ appLocked: true }, '', window.location.href);
      window.onpopstate = function () {
        window.history.pushState({ appLocked: true }, '', window.location.href);
      };
    }
  }

  window.addEventListener('DOMContentLoaded', initGuard);
})();
