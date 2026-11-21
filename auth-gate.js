// Om Software ERP - Enterprise Auth Gate & Inactivity Sentinel
(function() {
  const INACTIVITY_MS = 10 * 60 * 1000; // 10 minutes
  function checkSession() {
    const user = localStorage.getItem("om_logged_user");
    const lastActive = Number(localStorage.getItem("om_last_active_time") || "0");
    const now = Date.now();

    if (!user) {
      if (!location.pathname.endsWith("login.html")) {
        location.replace("login.html");
      }
      return;
    }

    if (now - lastActive > INACTIVITY_MS) {
      localStorage.removeItem("om_logged_user");
      alert("Session expired due to 10 minutes of inactivity. Please login again.");
      location.replace("login.html");
    }
  }

  ['click', 'touchstart', 'scroll', 'keydown'].forEach(evt => {
    window.addEventListener(evt, () => {
      localStorage.setItem("om_last_active_time", String(Date.now()));
    }, { passive: true });
  });

  checkSession();
})();
