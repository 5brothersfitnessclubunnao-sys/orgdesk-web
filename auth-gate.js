// Om Software ERP — Role-Gated Anti-Capture & 10-Min Inactivity Sentinel
(function initSentinel() {
  const role = (localStorage.getItem("bfc_role") || "owner").toLowerCase();
  const limitMs = 10 * 60 * 1000;

  function touch() {
    localStorage.setItem("om_last_active_time", String(Date.now()));
  }
  ["mousedown", "mousemove", "keydown", "touchstart", "scroll", "click"].forEach(ev => {
    window.addEventListener(ev, touch, { passive: true });
  });

  setInterval(() => {
    const last = Number(localStorage.getItem("om_last_active_time") || Date.now());
    if (Date.now() - last >= limitMs) {
      const modal = document.getElementById("inactivitySessionModal");
      if (modal) modal.classList.add("open");
    }
  }, 15000);

  if (role === "owner" || role === "admin") return;

  const st = document.createElement("style");
  st.textContent = `* { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }
    .om-blackout { position: fixed; inset: 0; background: #000; z-index: 9999999; display: none; align-items: center; justify-content: center; color: #FB7185; font-weight: 800; }`;
  document.head.appendChild(st);

  const guard = document.createElement("div");
  guard.className = "om-blackout";
  guard.id = "omCaptureGuard";
  guard.textContent = "SCREEN CAPTURE BLOCKED FOR NON-ADMIN";
  document.body.appendChild(guard);

  const toggleGuard = on => { guard.style.display = on ? "flex" : "none"; };
  window.addEventListener("blur", () => toggleGuard(true));
  window.addEventListener("focus", () => toggleGuard(false));
  document.addEventListener("visibilitychange", () => toggleGuard(document.hidden));
  document.addEventListener("contextmenu", e => e.preventDefault());
})();
