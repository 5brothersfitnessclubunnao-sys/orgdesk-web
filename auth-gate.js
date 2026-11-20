// auth-gate.js - Session Lock, Role Enforcement, Last-Session Tracker & Clean Logout
(function () {
  var LS = localStorage;
  var IDLE_MS = 60 * 1000; // 1 minute inactivity timeout
  var idleTimer = null;

  window.bfcLogin = async function () {
    var storedPin = LS.getItem("om_admin_pin") || "1234";
    var pin = prompt("Admin PIN darj karein (default 1234):", "");
    if (pin === null) return false;
    if (pin.trim() === storedPin) return true;
    alert("Galat PIN!");
    return false;
  };

  window.bfcIsAdmin = async function () {
    return (LS.getItem("bfc_role") || "owner") !== "staff";
  };

  function clearSessionAndGoLogin() {
    try {
      if (window.firebase && firebase.auth) {
        firebase.auth().signOut().catch(function () {});
      }
    } catch (e) {}

    ["om_org_profile", "bfc_org_profile", "bfc_org_id", "bfc_role", "bfc_active_staff", "bfc_admin_logged_in", "om_staff_session", "om_last_active_url"].forEach(function (k) {
      LS.removeItem(k);
    });

    var p = window.location.pathname.toLowerCase();
    if (!p.endsWith("login.html") && !p.endsWith("reset.html")) {
      window.location.replace("login.html?logout=1");
    }
  }

  window.omLogoutNow = function () {
    clearSessionAndGoLogin();
  };

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    var p = window.location.pathname.toLowerCase();
    var isAuthPage = p.endsWith("login.html") || p.endsWith("reset.html");
    var isPublicDocView = window.location.search.includes("doc=");
    if (isAuthPage || isPublicDocView) return;

    var orgId = LS.getItem("bfc_org_id") || ((JSON.parse(LS.getItem("om_org_profile") || "{}") || {}).orgId);
    if (!orgId) return;

    idleTimer = setTimeout(function () {
      clearSessionAndGoLogin();
    }, IDLE_MS);
  }

  function bindActivityListeners() {
    ["click", "touchstart", "mousemove", "keydown", "scroll"].forEach(function (ev) {
      window.addEventListener(ev, resetIdleTimer, { passive: true });
    });
    resetIdleTimer();
  }

  function setupBackLock() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("role") === "staff") {
      LS.setItem("bfc_role", "staff");
      if (!LS.getItem("bfc_org_id")) LS.setItem("bfc_org_id", "staff_link_org");
      if (!LS.getItem("om_staff_session")) {
        LS.setItem("om_staff_session", JSON.stringify({
          code: params.get("code") || "STF-LINK",
          branchCode: params.get("branch") || "001",
          role: "Staff"
        }));
      }
    }

    var p = window.location.pathname.toLowerCase();
    var isAuthPage = p.endsWith("login.html") || p.endsWith("reset.html");
    var isPublicJoin = p.endsWith("join.html") || p.endsWith("join10000.html") || window.location.search.includes("doc=");
    var orgId = LS.getItem("bfc_org_id") || ((JSON.parse(LS.getItem("om_org_profile") || "{}") || {}).orgId);

    if (!orgId && !isAuthPage && !isPublicJoin) {
      window.location.replace("login.html");
      return;
    }

    if (orgId && !isAuthPage) {
      var curFile = window.location.pathname.split("/").pop() || "index.html";
      LS.setItem("om_last_active_url", curFile + window.location.search);
    }

    // Prevent back button from leaving system without explicit logout
    if (orgId && !isAuthPage && window.history && window.history.pushState) {
      window.history.pushState({ locked: true }, "", window.location.href);
      window.onpopstate = function () {
        window.history.pushState({ locked: true }, "", window.location.href);
      };
    }

    bindActivityListeners();
  }

  window.addEventListener("DOMContentLoaded", setupBackLock);
})();
