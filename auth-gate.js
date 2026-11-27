/* Optional auth gate — no-op when used standalone (ondemand mode). */
(function () {
  if (typeof window === "undefined") return;
  window.__omAuthGateReady = true;
})();
