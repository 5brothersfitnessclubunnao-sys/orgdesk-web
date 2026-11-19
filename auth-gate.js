// auth-gate.js - Session & Back Navigation Lock
(function () {
  var LS = localStorage;

  window.bfcLogin = async function () {
    var storedPin = LS.getItem("om_admin_pin") || "1234";
    var pin = prompt("Admin PIN darj karein (default 1234):", "");
    if (pin === null) return false;
    if (pin.trim() === storedPin) return true;
    alert("Galat PIN!");
    return false;
  };

  window.bfcIsAdmin = async function () {
    return true;
  };

  window.omLogoutNow = function () {
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch(function () {});
      }
    } catch (e) {}

    ["om_org_profile", "bfc_org_profile", "bfc_org_id", "bfc_role", "bfc_active_staff", "bfc_admin_logged_in"].forEach(function (k) {
      LS.removeItem(k);
    });

    window.location.replace("login.html?logout=1");
  };

  function setupBackLock() {
    var p = window.location.pathname.toLowerCase();
    var isAuthPage = p.endsWith("login.html") || p.endsWith("reset.html");
    var isPublicJoin = p.endsWith("join.html") || p.endsWith("join10000.html");
    var orgId = LS.getItem("bfc_org_id") || ((JSON.parse(LS.getItem("om_org_profile") || "{}") || {}).orgId);

    if (!orgId && !isAuthPage && !isPublicJoin) {
      window.location.replace("login.html");
      return;
    }

    if (orgId && isAuthPage && !window.location.search.includes("logout=1")) {
      window.location.replace("index.html");
      return;
    }

    if (orgId && !isAuthPage && window.history && window.history.pushState) {
      window.history.pushState({ locked: true }, "", window.location.href);
      window.onpopstate = function () {
        window.history.pushState({ locked: true }, "", window.location.href);
      };
    }
  }

  window.addEventListener("DOMContentLoaded", setupBackLock);
})();
