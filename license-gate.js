// license-gate.js - Om Software License & 7-Day Free Trial Enforcement
(function() {
  const org = JSON.parse(localStorage.getItem("om_org_profile") || "{}");
  
  // If not logged in or setup not done, skip
  if (!org.orgId) return;

  const now = new Date().getTime();
  let createdAt = org.createdAt ? new Date(org.createdAt).getTime() : now;
  const trialDurationDays = 7;
  const trialExpiryTime = createdAt + (trialDurationDays * 24 * 60 * 60 * 1000);
  
  const licenseExpiry = org.licenseExpiry ? new Date(org.licenseExpiry).getTime() : 0;
  
  const isTrialActive = now < trialExpiryTime;
  const isLicenseValid = now < licenseExpiry;

  if (!isTrialActive && !isLicenseValid) {
    // Lock screen if trial expired and no active license
    window.addEventListener("DOMContentLoaded", () => {
      document.body.innerHTML = `
        <div style="background:#0b0b0d;color:#f0f0f5;font-family:Segoe UI,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;">
          <div style="max-width:420px;width:100%;background:#16161a;border:2px solid #e74c3c;border-radius:18px;padding:24px;text-align:center;box-shadow:0 0 30px rgba(231,76,60,0.2);">
            <div style="background:#e74c3c;color:#fff;font-size:10px;font-weight:900;padding:3px 10px;border-radius:10px;display:inline-block;margin-bottom:10px;">LICENCE EXPIRED / TRIAL ENDED</div>
            <h2 style="color:#ffcc00;margin:0 0 8px;font-size:20px;">Om Software Locked</h2>
            <p style="color:#9999a8;font-size:12px;margin:0 0 20px;line-height:1.5;">आपका 7 दिन का फ्री ट्रायल समाप्त हो गया है। सॉफ्टवेयर का पूर्ण उपयोग जारी रखने के लिए कृपया अपनी वैध <b>License Key</b> दर्ज करें।</p>
            
            <div style="margin-bottom:12px;text-align:left;">
              <label style="display:block;font-size:11px;color:#ccc;margin-bottom:4px;font-weight:600;">Enter License Key *</label>
              <input type="text" id="userLicenseKeyInput" placeholder="e.g. OM-KEY-2026-XXXX" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:12px;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
            
            <button onclick="verifyAndActivateKey()" style="width:100%;background:#ffcc00;color:#000;font-weight:900;padding:13px;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-top:4px;">Activate License Key 🚀</button>
            <div id="licenseMsg" style="margin-top:10px;font-size:11.5px;"></div>
          </div>
        </div>
      `;
    });
  } else {
    // Show active trial countdown banner
    window.addEventListener("DOMContentLoaded", () => {
      if (isTrialActive && !isLicenseValid) {
        const daysLeft = Math.ceil((trialExpiryTime - now) / (1000 * 60 * 60 * 24));
        const banner = document.createElement("div");
        banner.style.cssText = "background:#ffcc00;color:#000;text-align:center;font-size:11.5px;font-weight:800;padding:6px;position:sticky;top:0;z-index:99999;";
        banner.innerHTML = `🔥 Om Software: 7-Day Free Trial Active (${daysLeft} Days remaining). <a href="#" onclick="alert('To upgrade or purchase a license key, contact admin.');return false;" style="color:#000;text-decoration:underline;">Upgrade Plan</a>`;
        document.body.prepend(banner);
      }
    });
  }

  window.verifyAndActivateKey = function() {
    const key = document.getElementById("userLicenseKeyInput").value.trim();
    const msg = document.getElementById("licenseMsg");
    if (!key) {
      msg.style.color = "#e74c3c";
      msg.innerText = "कृपया वैध लाइसेंस की (License Key) दर्ज करें!";
      return;
    }

    // Key activation check
    if (key.startsWith("OM-") || key.length >= 8) {
      const oneYearTime = now + (365 * 24 * 60 * 60 * 1000);
      org.licenseKey = key;
      org.licenseExpiry = new Date(oneYearTime).toISOString();
      localStorage.setItem("om_org_profile", JSON.stringify(org));
      
      msg.style.color = "#2ecc71";
      msg.innerText = "🎉 License Activated Successfully! Reloading...";
      setTimeout(() => { location.reload(); }, 1200);
    } else {
      msg.style.color = "#e74c3c";
      msg.innerText = "❌ अमान्य लाइसेंस की (Invalid Key)। कृपया सही की दर्ज करें।";
    }
  };
})();
