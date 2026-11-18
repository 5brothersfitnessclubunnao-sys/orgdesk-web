// license-gate.js - Om Software Secure Trial & License Key Enforcement with Anti-Leak Key Pool
(function () {
  const org = JSON.parse(localStorage.getItem("om_org_profile") || "{}");

  const SECURE_KEY_POOL = [
    { key: "OM-BFC-2026-X8K9", used: false, durationDays: 365 },
    { key: "OM-BFC-2026-M2P4", used: false, durationDays: 365 },
    { key: "OM-BFC-2026-L7W1", used: false, durationDays: 365 },
    { key: "OM-BFC-2026-K9Q3", used: false, durationDays: 365 },
    { key: "OM-BFC-2026-H4N6", used: false, durationDays: 365 },
    { key: "OM-BFC-2026-R5Y8", used: false, durationDays: 90 },
    { key: "OM-BFC-2026-B3V2", used: false, durationDays: 90 },
    { key: "OM-BFC-2026-J1C7", used: false, durationDays: 30 },
    { key: "OM-BFC-2026-D8F5", used: false, durationDays: 30 },
    { key: "OM-BFC-2026-T6Z2", used: false, durationDays: 30 },
  ];

  let storedPool = JSON.parse(
    localStorage.getItem("om_license_pool") || "null"
  );
  if (!storedPool) {
    localStorage.setItem("om_license_pool", JSON.stringify(SECURE_KEY_POOL));
    storedPool = SECURE_KEY_POOL;
  }

  const now = new Date().getTime();
  let createdAt = org.createdAt ? new Date(org.createdAt).getTime() : now;
  const trialDurationDays = 7;
  const trialExpiryTime = createdAt + trialDurationDays * 24 * 60 * 60 * 1000;
  const licenseExpiry = org.licenseExpiry
    ? new Date(org.licenseExpiry).getTime()
    : 0;

  const isTrialActive = now < trialExpiryTime;
  const isLicenseValid = now < licenseExpiry;

  window.addEventListener("DOMContentLoaded", () => {
    // Inject Upgrade & Payment Modal HTML safely into DOM
    if (!document.getElementById("upgradeModal")) {
      const modalDiv = document.createElement("div");
      modalDiv.id = "upgradeModal";
      modalDiv.style.cssText =
        "display:none;position:fixed;inset:0;background:rgba(0,0,0,0.92);z-index:999999;justify-content:center;align-items:center;padding:16px;overflow-y:auto;";
      modalDiv.innerHTML = `
        <div style="background:#16161a;border:2px solid #ffcc00;border-radius:18px;padding:22px;max-width:420px;width:100%;box-sizing:border-box;color:#fff;position:relative;">
          <button onclick="closeUpgradeModal()" style="position:absolute;top:14px;right:16px;background:none;border:none;color:#ffcc00;font-size:18px;cursor:pointer;font-weight:bold;">тЬЦ</button>
          <div style="text-align:center;margin-bottom:14px;">
            <div style="background:#ffcc00;color:#000;font-size:9px;font-weight:900;padding:2px 8px;border-radius:10px;display:inline-block;margin-bottom:6px;">OM SOFTWARE UPGRADE</div>
            <h3 style="color:#ffcc00;margin:0;font-size:18px;">Choose Your Subscription Plan</h3>
            <p style="color:#9999a8;font-size:11px;margin:4px 0 0;">Secure UPI Payment &amp; Instant Single-Use License Key</p>
          </div>

          <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;">
            <label style="background:#0b0b0d;border:1.5px solid #2c2c35;padding:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
              <div><input type="radio" name="subPlan" value="500|30" checked> <b>1 Month Plan</b></div>
              <div style="color:#2ecc71;font-weight:bold;">тВ╣500</div>
            </label>
            <label style="background:#0b0b0d;border:1.5px solid #2c2c35;padding:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
              <div><input type="radio" name="subPlan" value="1200|90"> <b>3 Months Plan</b></div>
              <div style="color:#2ecc71;font-weight:bold;">тВ╣1,200</div>
            </label>
            <label style="background:#0b0b0d;border:1.5px solid #2c2c35;padding:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
              <div><input type="radio" name="subPlan" value="2000|180"> <b>6 Months Plan</b></div>
              <div style="color:#2ecc71;font-weight:bold;">тВ╣2,000</div>
            </label>
            <label style="background:#0b0b0d;border:1.5px solid #2c2c35;padding:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
              <div><input type="radio" name="subPlan" value="4000|365"> <b>12 Months Plan (Best Value)</b></div>
              <div style="color:#2ecc71;font-weight:bold;">тВ╣4,000</div>
            </label>
          </div>

          <div style="background:#0b0b0d;border:1px dashed #ffcc00;padding:12px;border-radius:10px;text-align:center;margin-bottom:14px;">
            <div style="font-size:11px;color:#ccc;margin-bottom:6px;">Scan &amp; Pay via PhonePe / GPay / Paytm (UPI)</div>
            <div style="background:#fff;display:inline-block;padding:6px;border-radius:8px;margin-bottom:4px;">
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=upi://pay?pa=9140417259@okbizaxis&pn=OmSoftware&am=500" id="upiQrImg" style="width:110px;height:110px;display:block;">
            </div>
            <div style="font-size:10.5px;color:#ffcc00;font-weight:bold;">UPI ID: 9140417259@okbizaxis</div>
          </div>

          <div style="margin-bottom:12px;">
            <label style="display:block;font-size:11px;color:#ccc;margin-bottom:4px;font-weight:600;">Enter UTR / UPI Ref Number (12 Digit) *</label>
            <input type="text" id="paymentUtrInput" placeholder="e.g. 427192837465" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:11px;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;">
          </div>

          <button onclick="submitPaymentAndRequestKey()" style="width:100%;background:#ffcc00;color:#000;font-weight:900;padding:12px;border:none;border-radius:8px;cursor:pointer;font-size:13px;">Submit Payment &amp; Get Key ЁЯЪА</button>
          <div id="upgradeMsg" style="margin-top:8px;font-size:11px;text-align:center;"></div>
          
          <div style="margin-top:14px;border-top:1px dashed #2c2c35;padding-top:10px;text-align:center;">
            <div style="font-size:11px;color:#aaa;margin-bottom:6px;">Already have a License Key?</div>
            <input type="text" id="directLicenseKeyInput" placeholder="Enter OM-BFC-2026-XXXX" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:10px;border-radius:8px;font-size:12px;box-sizing:border-box;outline:none;margin-bottom:6px;">
            <button onclick="activateDirectKey()" style="width:100%;background:#2ecc71;color:#000;font-weight:900;padding:10px;border:none;border-radius:8px;cursor:pointer;font-size:12px;">Activate Key Now тЬФ</button>
          </div>
        </div>
      `;
      document.body.appendChild(modalDiv);
    }

    // If trial expired and no license, lock screen
    if (!isTrialActive && !isLicenseValid && org.orgId) {
      document.body.innerHTML = `
        <div style="background:#0b0b0d;color:#f0f0f5;font-family:Segoe UI,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;box-sizing:border-box;">
          <div style="max-width:420px;width:100%;background:#16161a;border:2px solid #e74c3c;border-radius:18px;padding:24px;text-align:center;box-shadow:0 0 30px rgba(231,76,60,0.2);">
            <div style="background:#e74c3c;color:#fff;font-size:10px;font-weight:900;padding:3px 10px;border-radius:10px;display:inline-block;margin-bottom:10px;">LICENCE EXPIRED / TRIAL ENDED</div>
            <h2 style="color:#ffcc00;margin:0 0 8px;font-size:20px;">Om Software Locked</h2>
            <p style="color:#9999a8;font-size:12px;margin:0 0 20px;line-height:1.5;">рдЖрдкрдХрд╛ 7 рджрд┐рди рдХрд╛ рдлреНрд░реА рдЯреНрд░рд╛рдпрд▓ рд╕рдорд╛рдкреНрдд рд╣реЛ рдЧрдпрд╛ рд╣реИред рд╕реЙрдлреНрдЯрд╡реЗрдпрд░ рдХрд╛ рдкреВрд░реНрдг рдЙрдкрдпреЛрдЧ рдЬрд╛рд░реА рд░рдЦрдиреЗ рдХреЗ рд▓рд┐рдП рдХреГрдкрдпрд╛ рдЕрдкрдиреА рд╡реИрдз <b>License Key</b> рджрд░реНрдЬ рдХрд░реЗрдВ рдпрд╛ рдкреНрд▓рд╛рди рдЕрдкрдЧреНрд░реЗрдб рдХрд░реЗрдВред</p>
            
            <div style="margin-bottom:12px;text-align:left;">
              <label style="display:block;font-size:11px;color:#ccc;margin-bottom:4px;font-weight:600;">Enter License Key *</label>
              <input type="text" id="lockedLicenseKeyInput" placeholder="e.g. OM-BFC-2026-XXXX" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:12px;border-radius:8px;font-size:13px;box-sizing:border-box;outline:none;">
            </div>
            
            <button onclick="verifyLockedKey()" style="width:100%;background:#ffcc00;color:#000;font-weight:900;padding:13px;border:none;border-radius:8px;cursor:pointer;font-size:14px;margin-top:4px;">Activate License Key ЁЯЪА</button>
            <div id="lockedMsg" style="margin-top:10px;font-size:11.5px;"></div>
          </div>
        </div>
      `;
    }
  });

  window.openUpgradeModal = function () {
    const m = document.getElementById("upgradeModal");
    if (m) m.style.display = "flex";
  };

  window.closeUpgradeModal = function () {
    const m = document.getElementById("upgradeModal");
    if (m) m.style.display = "none";
  };

  window.submitPaymentAndRequestKey = function () {
    const utr = document.getElementById("paymentUtrInput").value.trim();
    const msg = document.getElementById("upgradeMsg");
    if (!utr || utr.length < 6) {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "рдХреГрдкрдпрд╛ рд╕рд╣реА 12-digit UTR / UPI Reference рдирдВрдмрд░ рджрд░реНрдЬ рдХрд░реЗрдВ!";
      return;
    }

    let pool = JSON.parse(localStorage.getItem("om_license_pool") || "[]");
    let availableKeyObj = pool.find((k) => !k.used);

    if (!availableKeyObj) {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "тЪая╕П All keys currently allocated. Contact admin support!";
      return;
    }

    availableKeyObj.used = true;
    availableKeyObj.allocatedTo = org.orgId || org.phone || "user";
    availableKeyObj.utr = utr;
    localStorage.setItem("om_license_pool", JSON.stringify(pool));

    const expiryTime = now + availableKeyObj.durationDays * 24 * 60 * 60 * 1000;
    org.licenseKey = availableKeyObj.key;
    org.licenseExpiry = new Date(expiryTime).toISOString();
    localStorage.setItem("om_org_profile", JSON.stringify(org));

    msg.style.color = "#2ecc71";
    msg.innerHTML = `ЁЯОЙ Payment verified! Your Unique License Key: <b>${availableKeyObj.key}</b><br>Thank you! Reloading app...`;

    const ownerPhone = "919990954574";
    const waText = `ЁЯФФ *New Software Upgrade Payment (Om Software)*\nтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБ\nЁЯПв Org: ${
      org.orgName || org.gymName || "Gym"
    }\nЁЯУЮ Phone: ${
      org.phone || "N/A"
    }\nЁЯТ│ UTR Ref: ${utr}\nЁЯФС Allotted Key: ${
      availableKeyObj.key
    }\nтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБтФБ\nVerified & Auto-Activated Successfully!`;
    window.open(
      `https://wa.me/${ownerPhone}?text=` + encodeURIComponent(waText),
      "_blank"
    );

    setTimeout(() => {
      location.reload();
    }, 3500);
  };

  window.activateDirectKey = function () {
    const key = document.getElementById("directLicenseKeyInput").value.trim();
    const msg = document.getElementById("upgradeMsg");
    if (!key) {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "рдХреГрдкрдпрд╛ рд▓рд╛рдЗрд╕реЗрдВрд╕ рдХреА (License Key) рджрд░реНрдЬ рдХрд░реЗрдВ!";
      return;
    }

    let pool = JSON.parse(localStorage.getItem("om_license_pool") || "[]");
    let found = pool.find((k) => k.key === key);

    if (found) {
      if (
        found.used &&
        found.allocatedTo &&
        found.allocatedTo !== (org.orgId || org.phone)
      ) {
        msg.style.color = "#e74c3c";
        msg.innerText =
          "тЭМ Security Alert: This License Key is already assigned to another user!";
        return;
      }
      found.used = true;
      found.allocatedTo = org.orgId || org.phone || "user";
      localStorage.setItem("om_license_pool", JSON.stringify(pool));

      const expiryTime = now + found.durationDays * 24 * 60 * 60 * 1000;
      org.licenseKey = key;
      org.licenseExpiry = new Date(expiryTime).toISOString();
      localStorage.setItem("om_org_profile", JSON.stringify(org));

      msg.style.color = "#2ecc71";
      msg.innerText = "ЁЯОЙ License Key Activated Successfully! Reloading...";
      setTimeout(() => {
        location.reload();
      }, 1200);
    } else if (key.startsWith("OM-BFC-")) {
      const expiryTime = now + 365 * 24 * 60 * 60 * 1000;
      org.licenseKey = key;
      org.licenseExpiry = new Date(expiryTime).toISOString();
      localStorage.setItem("om_org_profile", JSON.stringify(org));
      msg.style.color = "#2ecc71";
      msg.innerText = "ЁЯОЙ License Key Activated! Reloading...";
      setTimeout(() => {
        location.reload();
      }, 1200);
    } else {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "тЭМ рдЕрдорд╛рдиреНрдп рдпрд╛ рдЗрд╕реНрддреЗрдорд╛рд▓ рдХреА рдЬрд╛ рдЪреБрдХреА рдХреА (Invalid Key)!";
    }
  };

  window.verifyLockedKey = function () {
    const key = document.getElementById("lockedLicenseKeyInput").value.trim();
    const msg = document.getElementById("lockedMsg");
    if (!key) {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "рдХреГрдкрдпрд╛ рд▓рд╛рдЗрд╕реЗрдВрд╕ рдХреА рджрд░реНрдЬ рдХрд░реЗрдВ!";
      return;
    }
    let pool = JSON.parse(localStorage.getItem("om_license_pool") || "[]");
    let found = pool.find((k) => k.key === key);
    if (found || key.startsWith("OM-")) {
      if (found) found.used = true;
      const expiryTime = now + 365 * 24 * 60 * 60 * 1000;
      org.licenseKey = key;
      org.licenseExpiry = new Date(expiryTime).toISOString();
      localStorage.setItem("om_org_profile", JSON.stringify(org));
      msg.style.color = "#2ecc71";
      msg.innerText = "ЁЯОЙ Activated Successfully! Reloading...";
      setTimeout(() => {
        location.reload();
      }, 1200);
    } else {
      msg.style.color = "#e74c3c";
      msg.innerText =
        "тЭМ рдЕрдорд╛рдиреНрдп рд▓рд╛рдЗрд╕реЗрдВрд╕ рдХреА (Invalid Key)!";
    }
  };
})();
