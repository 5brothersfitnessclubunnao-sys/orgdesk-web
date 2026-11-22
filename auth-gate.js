/* auth-gate.js  (naya, simple version)
 * Firebase Email+Password login. Admin = koi bhi logged-in user.
 * Functions: bfcLogin(), bfcLogout(), bfcIsAdmin(), bfcNotify(), bfcNotifyPhoto()
 * Page ka firebase.initializeApp(...) pehle ho chuka hona chahiye (login ke waqt tak ho jaata hai).
 */
(function () {
  function auth() {
    try { if (window.firebase && firebase.apps && firebase.apps.length) return firebase.auth(); } catch (e) {}
    return null;
  }
  function ready() {
    return new Promise(function (res) {
      var a = auth();
      if (!a) return res(null);
      var off = a.onAuthStateChanged(function (u) { try { off(); } catch (e) {} res(u || null); });
    });
  }
  function msgOf(e) {
    var c = (e && e.code) || "";
    if (/wrong-password|invalid-credential|user-not-found|invalid-login/.test(c)) return "Email ya password galat hai.";
    if (/invalid-email/.test(c)) return "Email sahi likho.";
    if (/too-many/.test(c)) return "Bahut try ho gaye, thodi der baad try karo.";
    if (/network/.test(c)) return "Internet check karo.";
    if (/api-key/.test(c)) return "Firebase API key galat hai.";
    if (/unauthorized-domain/.test(c)) return "Firebase > Authentication > Settings > Authorized domains me apna domain add karo.";
    return "Login nahi hua (" + (c || (e && e.message) || "error") + ")";
  }

  window.bfcIsAdmin = async function () { return !!(await ready()); };

  window.bfcLogin = function () {
    return new Promise(async function (resolve) {
      var a = auth();
      if (!a) { alert("Firebase load nahi hua. Page refresh karo."); return resolve(false); }
      if (await ready()) return resolve(true);

      var ov = document.createElement("div");
      ov.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.92);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'Segoe UI',Roboto,sans-serif";
      ov.innerHTML =
        '<div style="background:#111;border:2px solid #ffcc00;border-radius:14px;max-width:380px;width:100%;padding:20px;color:#fff;text-align:center">' +
        '<div style="font-size:34px">🔒</div>' +
        '<h3 style="color:#ffcc00;margin:6px 0 12px">Admin Login</h3>' +
        '<input id="bfcAgEmail" type="email" placeholder="Email" autocomplete="username" style="width:100%;box-sizing:border-box;background:#000;border:1.5px solid #444;color:#fff;padding:12px;border-radius:8px;font-size:14px;margin-bottom:8px">' +
        '<input id="bfcAgPass" type="password" placeholder="Password" autocomplete="current-password" style="width:100%;box-sizing:border-box;background:#000;border:1.5px solid #444;color:#fff;padding:12px;border-radius:8px;font-size:14px;margin-bottom:8px">' +
        '<div id="bfcAgErr" style="color:#ff6666;font-size:12px;min-height:16px;margin-bottom:8px"></div>' +
        '<div style="display:flex;gap:8px"><button id="bfcAgCancel" style="flex:1;background:#222;color:#bbb;border:1px solid #444;padding:12px;border-radius:8px;font-weight:700;cursor:pointer">Cancel</button>' +
        '<button id="bfcAgOk" style="flex:2;background:#ffcc00;color:#000;border:none;padding:12px;border-radius:8px;font-weight:900;cursor:pointer">Login</button></div></div>';
      document.body.appendChild(ov);
      var $ = function (id) { return ov.querySelector("#" + id); };
      function done(v) { try { document.body.removeChild(ov); } catch (e) {} resolve(v); }
      $("bfcAgCancel").onclick = function () { done(false); };
      async function go() {
        var em = $("bfcAgEmail").value.trim(), pw = $("bfcAgPass").value;
        if (!em || !pw) { $("bfcAgErr").textContent = "Email aur password dono likho."; return; }
        $("bfcAgOk").disabled = true; $("bfcAgOk").textContent = "...";
        try { await a.signInWithEmailAndPassword(em, pw); done(true); }
        catch (e) { $("bfcAgErr").textContent = msgOf(e); $("bfcAgOk").disabled = false; $("bfcAgOk").textContent = "Login"; }
      }
      $("bfcAgOk").onclick = go;
      $("bfcAgPass").addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
      setTimeout(function () { try { $("bfcAgEmail").focus(); } catch (e) {} }, 50);
    });
  };

  window.bfcLogout = async function () {
    try { var a = auth(); if (a) await a.signOut(); } catch (e) {}
    return true;
  };

  /* ===================== TELEGRAM NOTIFICATIONS =====================
   * Neeche 3 cheezein bharo (BotFather se token, aur admin/manager ki chat ID).
   * Khali chhodoge to notification chup-chaap band rahegi (app chalta rahega).
   */
  var TG = {
    TOKEN:   "",   // BotFather wala naya bot token
    ADMIN:   "",   // Admin ki chat ID
    MANAGER: ""    // Manager ki chat ID
  };

  /* Kisko kya jaayega:
   *  fees        -> Admin + Manager
   *  member_att  -> sirf Manager   (member present / absent)
   *  manager_att -> sirf Admin     (manager ki apni attendance)
   *  staff_att   -> sirf Manager   (staff ki attendance)
   *  baaki sab   -> Admin + Manager
   */
  function targets(kind) {
    var both = [TG.ADMIN, TG.MANAGER];
    var map = { fees: both, member_att: [TG.MANAGER], manager_att: [TG.ADMIN], staff_att: [TG.MANAGER] };
    var list = map[kind] || both;
    var out = [];
    list.forEach(function (c) { c = String(c || "").trim(); if (c && out.indexOf(c) < 0) out.push(c); });
    return out;
  }
  function api(method) { return "https://api.telegram.org/bot" + TG.TOKEN + "/" + method; }

  function toBlob(img) {
    if (img && typeof img === "object" && img.size != null) return img;
    var p = String(img || "").split(","), bin = atob(p[1] || ""), u8 = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return new Blob([u8], { type: "image/jpeg" });
  }

  window.bfcNotify = async function (text, kind) {
    if (!TG.TOKEN) return true;
    var ids = targets(kind), ok = true;
    text = String(text == null ? "" : text);
    for (var i = 0; i < ids.length; i++) {
      try {
        var r = await fetch(api("sendMessage"), { method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: ids[i], text: text.slice(0, 4000) }) });
        var j = await r.json(); if (!(j && j.ok)) ok = false;
      } catch (e) { ok = false; }
    }
    return ok;
  };

  window.bfcNotifyPhoto = async function (img, caption, kind) {
    if (!TG.TOKEN) return true;
    var ids = targets(kind), ok = true, blob;
    try { blob = toBlob(img); } catch (e) { return window.bfcNotify(caption, kind); }
    for (var i = 0; i < ids.length; i++) {
      try {
        var fd = new FormData();
        fd.append("chat_id", ids[i]);
        fd.append("caption", String(caption || "").slice(0, 1000));
        fd.append("photo", blob, "photo.jpg");
        var r = await fetch(api("sendPhoto"), { method: "POST", body: fd });
        var j = await r.json(); if (!(j && j.ok)) ok = false;
      } catch (e) { ok = false; }
    }
    return ok;
  };
})();
