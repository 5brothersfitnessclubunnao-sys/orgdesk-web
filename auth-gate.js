// Om Software ERP — 1-Min Background / Rapid Switch Auto-Logout & Anti-Capture Sentinel
(function initAuthGate() {
  const ONE_MIN_MS = 60 * 1000; // 1 minute auto-logout when in background or idle/cycled
  const role = (localStorage.getItem("bfc_role") || "owner").toLowerCase();

  function markBgTime() {
    localStorage.setItem("om_bg_timestamp", String(Date.now()));
  }

  function enforceOneMinAutoLogout() {
    const loggedUser = localStorage.getItem("om_logged_user");
    if (!loggedUser) return;

    const bgTs = Number(localStorage.getItem("om_bg_timestamp") || Date.now());
    const lastAct = Number(localStorage.getItem("om_last_active_time") || Date.now());
    const now = Date.now();

    // Track rapid login/logout cycling
    const cycleCount = Number(localStorage.getItem("om_rapid_cycle_cnt") || "0");
    if (cycleCount >= 3 || (now - bgTs >= ONE_MIN_MS) || (now - lastAct >= ONE_MIN_MS)) {
      localStorage.setItem("om_last_session_info", JSON.stringify({
        user: loggedUser,
        role: role,
        savedAt: new Date().toLocaleString("en-IN")
      }));
      localStorage.removeItem("om_logged_user");
      localStorage.removeItem("om_rapid_cycle_cnt");
      if (!location.pathname.endsWith("login.html")) {
        location.replace("login.html");
      }
    }
  }

  // Increment cycle counter if page loads repeatedly within seconds
  const prevLoad = Number(localStorage.getItem("om_last_load_ts") || "0");
  const nowTs = Date.now();
  if (nowTs - prevLoad < 5000) {
    const c = Number(localStorage.getItem("om_rapid_cycle_cnt") || "0") + 1;
    localStorage.setItem("om_rapid_cycle_cnt", String(c));
  } else {
    localStorage.setItem("om_rapid_cycle_cnt", "0");
  }
  localStorage.setItem("om_last_load_ts", String(nowTs));

  document.addEventListener("visibilitychange", function() {
    if (document.hidden) {
      markBgTime();
    } else {
      enforceOneMinAutoLogout();
      markBgTime();
    }
  });

  window.addEventListener("blur", markBgTime);
  window.addEventListener("focus", function() {
    enforceOneMinAutoLogout();
    markBgTime();
  });

  ["click", "touchstart", "keydown", "scroll"].forEach(ev => {
    window.addEventListener(ev, () => {
      localStorage.setItem("om_last_active_time", String(Date.now()));
    }, { passive: true });
  });

  setInterval(enforceOneMinAutoLogout, 10000);
  enforceOneMinAutoLogout();

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
