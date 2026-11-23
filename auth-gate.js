// Om Software ERP — 10-Min Inactivity Logout & Back Confirmation Sentinel
(function initAuthGate() {
  const TEN_MIN_MS = 10 * 60 * 1000;
  const role = (localStorage.getItem("bfc_role") || "owner").toLowerCase();

  function touchActivity() {
    localStorage.setItem("om_last_active_time", String(Date.now()));
  }

  ["click", "touchstart", "keydown", "scroll", "mousemove"].forEach(ev => {
    window.addEventListener(ev, touchActivity, { passive: true });
  });

  function checkTenMinInactivity() {
    const loggedUser = localStorage.getItem("om_logged_user");
    const lastAct = Number(localStorage.getItem("om_last_active_time") || Date.now());
    const now = Date.now();

    if (now - lastAct >= TEN_MIN_MS) {
      if (loggedUser) {
        localStorage.setItem("om_last_session_info", JSON.stringify({
          user: loggedUser,
          role: role,
          savedAt: new Date().toLocaleString("en-IN")
        }));
        localStorage.removeItem("om_logged_user");
      }
      if (!location.pathname.endsWith("login.html")) {
        location.replace("login.html");
      }
    }
  }

  setInterval(checkTenMinInactivity, 15000);

  // Back button confirmation prompt (Yes / No)
  try {
    history.pushState({ omGuard: true }, "", location.href);
    window.addEventListener("popstate", function () {
      const wantLogout = confirm("Kya aap Logout karna chahte hain? (OK = Yes, Cancel = No)");
      if (wantLogout) {
        const loggedUser = localStorage.getItem("om_logged_user");
        if (loggedUser) {
          localStorage.setItem("om_last_session_info", JSON.stringify({
            user: loggedUser,
            role: role,
            savedAt: new Date().toLocaleString("en-IN")
          }));
        }
        localStorage.removeItem("om_logged_user");
        location.replace("login.html");
      } else {
        history.pushState({ omGuard: true }, "", location.href);
      }
    });
  } catch (e) {}

  if (role === "owner" || role === "admin") return;

  const st = document.createElement("style");
  st.textContent = `* { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
    .om-blackout { position: fixed; inset: 0; background: #000; z-index: 9999999; display: none; align-items: center; justify-content: center; color: #FB7185; font-weight: 800; }`;
  document.head.appendChild(st);

  const guard = document.createElement("div");
  guard.className = "om-blackout";
  guard.textContent = "SCREEN CAPTURE BLOCKED FOR NON-ADMIN";
  document.body.appendChild(guard);

  const setGuard = on => { guard.style.display = on ? "flex" : "none"; };
  window.addEventListener("blur", () => setGuard(true));
  window.addEventListener("focus", () => setGuard(false));
  document.addEventListener("visibilitychange", () => setGuard(document.hidden));
  document.addEventListener("contextmenu", e => e.preventDefault());
})();
