// license-gate.js - Om Software: 7-day trial + one-time license key pool (Firestore single-use, local fallback)
(function () {
  var LS = localStorage, DAY = 86400000;
  var CFG = { apiKey: "AIzaSyAHEMISEIDSzZz-m2OQT5EPyhTRF-mXqjQ", authDomain: "bfc-gym-215ae.firebaseapp.com", projectId: "bfc-gym-215ae", storageBucket: "bfc-gym-215ae.firebasestorage.app", messagingSenderId: "886920088571", appId: "1:886920088571:web:c4bc478d246a2700b0d95e" };
  var KEYS = [["X8K9",365],["M2P4",365],["L7W1",365],["K9Q3",365],["H4N6",365],["R5Y8",90],["B3V2",90],["J1C7",30],["D8F5",30],["T6Z2",30]];
  function J(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function getOrg() { return J("om_org_profile", {}); }
  function saveOrg(o) {
    LS.setItem("om_org_profile", JSON.stringify(o));
    // License/trial cloud me bhi save: logout-login ke baad wapas mil jaye, trial dobara shuru na ho
    try {
      var d = getDb(); if (!d || !o.orgId) return;
      d.collection("orgs").doc(o.orgId).set({ createdAt: o.createdAt || null, licenseKey: o.licenseKey || null, licensePlanDays: o.licensePlanDays || null, licenseAmount: o.licenseAmount || null, licenseBoughtAt: o.licenseBoughtAt || null, licenseExpiry: o.licenseExpiry || null }, { merge: true }).catch(function () {});
    } catch (e) {}
  }
  function getPool() {
    var p = J("om_license_pool", null);
    if (!Array.isArray(p) || p.length < 1) {
      p = KEYS.map(function (k) { return { key: "OM-BFC-2026-" + k[0], used: false, durationDays: k[1] }; });
      LS.setItem("om_license_pool", JSON.stringify(p));
    }
    return p;
  }
  function status() {
    var o = getOrg(), now = Date.now(), created = o.createdAt ? new Date(o.createdAt).getTime() : now;
    var trialEnd = created + 7 * DAY, lic = o.licenseExpiry ? new Date(o.licenseExpiry).getTime() : 0;
    return { org: o, trialActive: now < trialEnd, trialDays: Math.max(0, Math.ceil((trialEnd - now) / DAY)), licenseValid: now < lic, licenseDays: Math.max(0, Math.ceil((lic - now) / DAY)), licenseKey: o.licenseKey || "" };
  }
  window.omLicenseStatus = status;
  function getDb() { try { if (!window.firebase) return null; if (!firebase.apps.length) firebase.initializeApp(CFG); return firebase.firestore(); } catch (e) { return null; } }
  function activate(days, keyObj) {
    var o = getOrg(); o.licenseKey = keyObj.key; o.licensePlanDays = days; o.licenseAmount = keyObj.amount || ""; o.licenseBoughtAt = new Date().toISOString(); o.licenseExpiry = new Date(Date.now() + days * DAY).toISOString(); saveOrg(o);
  }
  // Ek fresh key uthao -> Used mark (Firestore transaction => dusre device ko wahi key nahi milegi)
  async function claimKey(days, extra) {
    var pool = getPool(), o = getOrg(), who = o.orgId || o.phone || "user", db = getDb();
    for (var i = 0; i < pool.length; i++) {
      var k = pool[i]; if (k.used) continue;
      if (db) {
        try {
          var ref = db.collection("license_pool").doc(k.key);
          var ok = await db.runTransaction(async function (t) {
            var s = await t.get(ref); if (s.exists && s.data().used) return false;
            t.set(ref, { used: true, allocatedTo: who, days: days, at: new Date().toISOString() }); return true;
          });
          if (!ok) { k.used = true; k.allocatedTo = "other"; LS.setItem("om_license_pool", JSON.stringify(pool)); continue; }
        } catch (e) { /* offline / rules: local pool par chalo */ }
      }
      k.used = true; k.allocatedTo = who; k.days = days; k.at = new Date().toISOString();
      for (var x in (extra || {})) k[x] = extra[x];
      LS.setItem("om_license_pool", JSON.stringify(pool));
      return k;
    }
    return null;
  }
  function msg(t, c) { var m = document.getElementById("upgradeMsg"); if (m) { m.style.color = c; m.innerHTML = t; } }
  function planDays() { var r = document.querySelector('input[name="subPlan"]:checked'); return r ? { amt: +r.value.split("|")[0], days: +r.value.split("|")[1] } : { amt: 500, days: 30 }; }

  async function grant(mode, utr) {
    var p = planDays(), k = await claimKey(p.days, { mode: mode, utr: utr || "", amount: p.amt });
    if (!k) { msg("⚠️ सभी keys allot हो चुकी हैं। Admin से संपर्क करें!", "#e74c3c"); return; }
    activate(p.days, k);
    msg("🎉 Payment " + (mode === "test" ? "(Test) " : "") + "सफल! आपकी Unique License Key: <b>" + k.key + "</b><br>एप reload हो रहा है…", "#2ecc71");
    if (mode === "utr") {
      var o = getOrg();
      try { window.open("https://wa.me/919990954574?text=" + encodeURIComponent("🔔 New Upgrade Payment (Om Software)\nOrg: " + (o.orgName || o.gymName || "Gym") + "\nPhone: " + (o.phone || "N/A") + "\nUTR: " + utr + "\nKey: " + k.key + "\nPlan: " + p.days + " days / ₹" + p.amt), "_blank"); } catch (e) {}
    }
    setTimeout(function () { location.reload(); }, 2500);
  }
  window.submitPaymentAndRequestKey = function () {
    var utr = (document.getElementById("paymentUtrInput").value || "").trim();
    if (utr.length < 6) { msg("कृपया सही UTR / UPI Reference नंबर दर्ज करें!", "#e74c3c"); return; }
    grant("utr", utr);
  };
  window.fakePaymentTest = function () { grant("test", ""); };
  window.activateDirectKey = async function () {
    var el = document.getElementById("directLicenseKeyInput") || document.getElementById("lockedLicenseKeyInput");
    var key = (el && el.value || "").trim().toUpperCase();
    if (!key) { msg("कृपया License Key दर्ज करें!", "#e74c3c"); return; }
    var pool = getPool(), o = getOrg(), who = o.orgId || o.phone || "user", f = pool.filter(function (k) { return k.key === key; })[0];
    if (!f) { msg("❌ अमान्य Key!", "#e74c3c"); var lm = document.getElementById("lockedMsg"); if (lm) { lm.style.color = "#e74c3c"; lm.innerText = "❌ अमान्य Key!"; } return; }
    if (f.used && f.allocatedTo && f.allocatedTo !== who && f.allocatedTo !== "other") { msg("❌ यह Key किसी और को दी जा चुकी है!", "#e74c3c"); return; }
    if (f.allocatedTo === "other") { msg("❌ यह Key इस्तेमाल हो चुकी है!", "#e74c3c"); return; }
    f.used = true; f.allocatedTo = who; LS.setItem("om_license_pool", JSON.stringify(pool));
    activate(f.days || f.durationDays || 30, f);
    msg("🎉 Key Activate हो गई! Reload…", "#2ecc71"); var lm2 = document.getElementById("lockedMsg"); if (lm2) { lm2.style.color = "#2ecc71"; lm2.innerText = "🎉 Activate हो गया! Reload…"; }
    setTimeout(function () { location.reload(); }, 1200);
  };
  window.verifyLockedKey = window.activateDirectKey;
  window.openUpgradeModal = function () { var m = document.getElementById("upgradeModal"); if (!m) buildModal(); m = document.getElementById("upgradeModal"); if (m) m.style.display = "flex"; };
  window.closeUpgradeModal = function () { var m = document.getElementById("upgradeModal"); if (m) m.style.display = "none"; };

  function planRow(v, t, price, on) { return '<label style="background:#0b0b0d;border:1.5px solid #2c2c35;padding:10px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;cursor:pointer"><span><input type="radio" name="subPlan" value="' + v + '"' + (on ? " checked" : "") + ' onchange="omQr()"> <b>' + t + '</b></span><b style="color:#2ecc71">' + price + '</b></label>'; }
  window.omQr = function () {
    var i = document.getElementById("upiQrImg"); if (i) i.src = "https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=" + encodeURIComponent("upi://pay?pa=9140417259@okbizaxis&pn=OmSoftware&am=" + planDays().amt);
  };
  function buildModal() {
    if (document.getElementById("upgradeModal") || !document.body) return;
    var d = document.createElement("div"); d.id = "upgradeModal";
    d.style.cssText = "display:none;position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:999999;justify-content:center;align-items:flex-start;padding:16px;overflow-y:auto";
    d.innerHTML = '<div style="background:#16161a;border:2px solid #ffcc00;border-radius:18px;padding:20px;max-width:420px;width:100%;box-sizing:border-box;color:#fff;position:relative;margin:auto;font-family:Segoe UI,Arial,sans-serif">' +
      '<button onclick="closeUpgradeModal()" style="position:absolute;top:12px;right:14px;background:none;border:0;color:#ffcc00;font-size:20px;cursor:pointer;font-weight:bold">✖</button>' +
      '<div style="text-align:center;margin-bottom:12px"><div style="background:#ffcc00;color:#000;font-size:9px;font-weight:900;padding:2px 8px;border-radius:10px;display:inline-block;margin-bottom:6px">OM SOFTWARE UPGRADE</div><h3 style="color:#ffcc00;margin:0;font-size:18px">अपना Plan चुनें</h3></div>' +
      '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:12px">' + planRow("500|30", "1 Month", "₹500", 1) + planRow("1200|90", "3 Months", "₹1,200") + planRow("2000|180", "6 Months", "₹2,000") + planRow("4000|365", "12 Months (Best Value)", "₹4,000") + "</div>" +
      '<div style="background:#0b0b0d;border:1px dashed #ffcc00;padding:10px;border-radius:10px;text-align:center;margin-bottom:10px"><div style="font-size:11px;color:#ccc;margin-bottom:6px">PhonePe / GPay / Paytm से Pay करें</div><div style="background:#fff;display:inline-block;padding:6px;border-radius:8px"><img id="upiQrImg" style="width:110px;height:110px;display:block"></div><div style="font-size:11px;color:#ffcc00;font-weight:bold;margin-top:4px">UPI ID: 9140417259@okbizaxis</div></div>' +
      '<input id="paymentUtrInput" placeholder="UTR / UPI Ref नंबर (12 digit)" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:11px;border-radius:8px;font-size:12px;box-sizing:border-box;margin-bottom:8px">' +
      '<button onclick="submitPaymentAndRequestKey()" style="width:100%;background:#ffcc00;color:#000;font-weight:900;padding:12px;border:0;border-radius:8px;cursor:pointer;font-size:13px">Submit Payment &amp; Get Key 🚀</button>' +
      '<div id="upgradeMsg" style="margin-top:8px;font-size:12px;text-align:center;min-height:14px"></div>' +
      '<div style="margin-top:10px;border-top:1px dashed #2c2c35;padding-top:10px"><div style="font-size:11px;color:#aaa;margin-bottom:6px;text-align:center">पहले से License Key है?</div><input id="directLicenseKeyInput" placeholder="OM-BFC-2026-XXXX" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:10px;border-radius:8px;font-size:12px;box-sizing:border-box;margin-bottom:6px"><button onclick="activateDirectKey()" style="width:100%;background:#2ecc71;color:#000;font-weight:900;padding:10px;border:0;border-radius:8px;cursor:pointer;font-size:12px">Key Activate करें ✔</button></div>' +
      '<div style="margin-top:14px;text-align:center"><button onclick="fakePaymentTest()" style="background:none;border:1px dashed #666;color:#aaa;padding:7px 12px;border-radius:8px;font-size:10.5px;cursor:pointer">🧪 Test / Fake Payment (Instant Success)</button></div></div>';
    document.body.appendChild(d); omQr();
  }
  function lockIfExpired() {
    var s = status(); if (s.trialActive || s.licenseValid || !s.org.orgId) return;
    document.body.innerHTML = '<div style="background:#0b0b0d;color:#f0f0f5;font-family:Segoe UI,sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;padding:20px;box-sizing:border-box"><div style="max-width:420px;width:100%;background:#16161a;border:2px solid #e74c3c;border-radius:18px;padding:24px;text-align:center"><div style="background:#e74c3c;color:#fff;font-size:10px;font-weight:900;padding:3px 10px;border-radius:10px;display:inline-block;margin-bottom:10px">TRIAL ENDED</div><h2 style="color:#ffcc00;margin:0 0 8px;font-size:20px">Om Software Locked</h2><p style="color:#9999a8;font-size:12px;margin:0 0 16px;line-height:1.5">आपका 7 दिन का फ्री ट्रायल समाप्त हो गया है। जारी रखने के लिए Plan लें या License Key डालें।</p><button onclick="openUpgradeModal()" style="width:100%;background:#ffcc00;color:#000;font-weight:900;padding:13px;border:0;border-radius:8px;font-size:14px;margin-bottom:12px">Upgrade Plan</button><input id="lockedLicenseKeyInput" placeholder="OM-BFC-2026-XXXX" style="width:100%;background:#0b0b0d;border:1.5px solid #2c2c35;color:#fff;padding:12px;border-radius:8px;font-size:13px;box-sizing:border-box"><button onclick="verifyLockedKey()" style="width:100%;background:#2ecc71;color:#000;font-weight:900;padding:12px;border:0;border-radius:8px;font-size:13px;margin-top:8px">Key Activate करें</button><div id="lockedMsg" style="margin-top:10px;font-size:12px"></div></div></div>';
  }
  function cleanStrayBanner() { // koi bhi purana trial banner jo side me peela column bana raha ho
    var b = document.body; if (!b || !b.querySelector(".dash-container")) return;
    Array.prototype.slice.call(b.children).forEach(function (e) {
      if (e.classList.contains("dash-container") || e.tagName === "SCRIPT" || e.classList.contains("ov") || e.id === "upgradeModal") return;
      if (/Free Trial/i.test(e.textContent || "")) e.remove();
    });
  }
  window.addEventListener("DOMContentLoaded", function () { lockIfExpired(); buildModal(); cleanStrayBanner(); setTimeout(cleanStrayBanner, 800); });
})();
