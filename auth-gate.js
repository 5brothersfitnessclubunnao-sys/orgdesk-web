// Om Software ERP — Anti-Screenshot & Screen-Recording Sentinel (Role-Gated)
(function initAntiCaptureSentinel() {
  const role = localStorage.getItem("bfc_role") || "guest";

  // ADMIN / OWNER is 100% EXEMPT — Admin can take screenshots and recordings freely
  if (role === "owner" || role === "admin") {
    console.log("Admin session detected: Anti-capture protection bypassed for Admin.");
    return;
  }

  // 1. CSS Injection to block text selection, dragging, and context callouts
  const style = document.createElement("style");
  style.id = "om-anti-capture-style";
  style.innerHTML = `
    * {
      -webkit-user-select: none !important;
      -moz-user-select: none !important;
      -ms-user-select: none !important;
      user-select: none !important;
      -webkit-touch-callout: none !important;
    }
    .om-screen-blackout {
      position: fixed !important;
      inset: 0 !important;
      background: #000000 !important;
      z-index: 9999999 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      color: #FB7185 !important;
      font-size: 16px !important;
      font-weight: 800 !important;
      letter-spacing: 0.5px !important;
    }
  `;
  document.head.appendChild(style);

  // 2. Blackout overlay container
  const blackoutEl = document.createElement("div");
  blackoutEl.id = "omBlackoutGuard";
  blackoutEl.className = "om-screen-blackout";
  blackoutEl.style.display = "none";
  blackoutEl.innerHTML = "⚠️ SCREEN CAPTURE BLOCKED (SECURITY POLICY)";
  document.body.appendChild(blackoutEl);

  // 3. Window Blur & Visibility Change (Triggers on Screen Recorder, Split Screen, or App Switch)
  function triggerBlackout(show) {
    if (blackoutEl) {
      blackoutEl.style.display = show ? "flex" : "none";
    }
  }

  window.addEventListener("blur", () => triggerBlackout(true));
  window.addEventListener("focus", () => triggerBlackout(false));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) triggerBlackout(true);
    else triggerBlackout(false);
  });

  // 4. Block PrintScreen & Common Screenshot Key Combinations
  window.addEventListener("keyup", (e) => {
    if (e.key === "PrintScreen" || e.keyCode === 44) {
      triggerBlackout(true);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText("Screenshots are disabled on Om Software ERP.");
      }
      setTimeout(() => triggerBlackout(false), 1500);
      alert("Security Alert: Screenshots are disabled for staff / non-admin users.");
    }
  });

  window.addEventListener("keydown", (e) => {
    // Windows: Win+Shift+S, Mac: Cmd+Shift+3/4/5, Ctrl+P (Print)
    if (
      (e.ctrlKey && e.key.toLowerCase() === "p") ||
      (e.metaKey && e.shiftKey) ||
      (e.ctrlKey && e.shiftKey && (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "s"))
    ) {
      e.preventDefault();
      triggerBlackout(true);
      setTimeout(() => triggerBlackout(false), 1200);
    }
  });

  // 5. Block Right Click (Inspect / Save image)
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  // 6. Native Android App instructions (FLAG_SECURE)
  console.log("Anti-Capture Sentinel active: Non-admin users restricted from capturing screen.");
})();
