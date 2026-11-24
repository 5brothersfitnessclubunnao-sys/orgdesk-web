/* OM ERP secure page gate. Trust Firebase Auth + tenant-access.js, never localStorage alone. */
(function () {
  'use strict';
  async function waitForSession(timeoutMs) {
    var end = Date.now() + (timeoutMs || 12000);
    while (Date.now() < end) {
      if (window.omSecureSession && window.omSecureSession.uid) return window.omSecureSession;
      await new Promise(function (r) { setTimeout(r, 150); });
    }
    return null;
  }
  window.bfcIsAdmin = async function () {
    var s = await waitForSession();
    if (!s) return false;
    if (s.isMasterAdmin) return true;
    return s.role === 'owner' || s.role === 'manager';
  };
  window.bfcLogin = window.bfcIsAdmin;
  window.bfcLogout = function () {
    try { if (window.firebase && firebase.auth) return firebase.auth().signOut(); } catch (e) {}
    location.replace('login.html');
  };
})();
