/* Common helpers — loaded by every page. Firebase start + small utilities. */
(function () {
  "use strict";
  var G = window.G = {};
  var cfg = window.ORG_FIREBASE || {};
  G.app = window.ORG_APP || { name: "OrgDesk" };
  if (!cfg.apiKey || /PASTE/.test(cfg.apiKey)) {
    document.addEventListener("DOMContentLoaded", function () {
      document.body.innerHTML = '<div style="padding:24px;font-family:sans-serif;color:#fff;background:#111;min-height:100vh"><b>Configuration required.</b><br><br>Open <code>firebase-config.js</code> and paste your Firebase web-app details. See SETUP.md for the steps.</div>';
    });
    return;
  }
  firebase.initializeApp(cfg);
  G.db = firebase.firestore();
  G.auth = firebase.auth();
  G.FV = firebase.firestore.FieldValue;
  G.TS = firebase.firestore.Timestamp;
  G.ok = true;

  G.esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
  // only real images (data:image) may ever be used as an image source
  G.img = function (v) { v = String(v == null ? "" : v); return /^data:image\/(?:png|jpe?g|webp|gif);base64,[A-Za-z0-9+\/=]+$/.test(v) ? v : ""; };
  G.num = function (v) { var n = Number(v); return isFinite(n) ? n : 0; };
  G.qs = function (k) { try { return new URLSearchParams(location.search).get(k) || ""; } catch (e) { return ""; } };
  G.slug = function (s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30); };
  G.money = function (n) { return "₹" + G.num(n).toLocaleString("en-IN"); };
  G.pad = function (n, w) { n = String(n); while (n.length < w) n = "0" + n; return n; };
  G.rid = function (n) { var a = "abcdefghjkmnpqrstuvwxyz23456789", o = "", i; var b = new Uint32Array(n || 10); (window.crypto || window.msCrypto).getRandomValues(b); for (i = 0; i < b.length; i++) o += a[b[i] % a.length]; return o; };

  function p2(n) { return n < 10 ? "0" + n : "" + n; }
  G.iso = function (d) { return d.getFullYear() + "-" + p2(d.getMonth() + 1) + "-" + p2(d.getDate()); };
  G.today = function () { return G.iso(new Date()); };
  G.parse = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "")); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  G.fmt = function (s) { var d = G.parse(s); return d ? p2(d.getDate()) + "-" + p2(d.getMonth() + 1) + "-" + d.getFullYear() : "—"; };
  G.fmtTs = function (ts) { var d = ts && ts.toDate ? ts.toDate() : null; return d ? G.fmt(G.iso(d)) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes()) : "—"; };
  G.addDays = function (iso, n) { var d = G.parse(iso) || new Date(); d.setDate(d.getDate() + n); return G.iso(d); };
  // last day of a plan: 15 Jan + 1 month = 14 Feb
  G.endDate = function (startIso, months) {
    var d = G.parse(startIso) || new Date();
    var last = new Date(d.getFullYear(), d.getMonth() + months + 1, 0).getDate();
    var e = new Date(d.getFullYear(), d.getMonth() + months, Math.min(d.getDate(), last));
    e.setDate(e.getDate() - 1);
    return G.iso(e);
  };
  G.daysLeft = function (expIso) { var e = G.parse(expIso), t = G.parse(G.today()); return e ? Math.round((e - t) / 86400000) : null; };
  G.endTs = function (expIso) { var e = G.parse(expIso) || new Date(); return G.TS.fromDate(new Date(e.getFullYear(), e.getMonth(), e.getDate(), 23, 59, 59)); };
  G.age = function (dobIso) { var d = G.parse(dobIso), n = new Date(); if (!d) return ""; var a = n.getFullYear() - d.getFullYear(); var m = n.getMonth() - d.getMonth(); if (m < 0 || (m === 0 && n.getDate() < d.getDate())) a--; return a >= 0 && a < 120 ? a : ""; };
  G.bmi = function (h, w) {
    h = G.num(h) / 100; w = G.num(w);
    if (!(h > 0.5 && w > 10)) return { v: "", t: "" };
    var v = Math.round(w / (h * h) * 10) / 10;
    var t = v < 18.5 ? "Underweight" : v < 25 ? "Normal" : v < 30 ? "Overweight" : "Obese";
    return { v: v, t: t };
  };
  G.ph10 = function (x) { return String(x || "").replace(/\D/g, "").slice(-10); };
  G.wa = function (phone, text) { return "https://wa.me/91" + G.ph10(phone) + "?text=" + encodeURIComponent(text); };
  G.link = function (page, params) {
    var u = new URL(page, location.href);
    Object.keys(params || {}).forEach(function (k) { u.searchParams.set(k, params[k]); });
    return u.href;
  };
  G.toast = function (msg) {
    var t = document.createElement("div"); t.className = "toast"; t.textContent = msg; document.body.appendChild(t);
    setTimeout(function () { t.remove(); }, 2800);
  };
  G.theme = function (org) {
    if (org && /^#[0-9a-fA-F]{6}$/.test(org.color || "")) document.documentElement.style.setProperty("--ac", org.color);
  };
  // Automatic search: every typed word must appear somewhere in the record text
  G.norm = function (s) { return String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9ऀ-ॿ ]+/g, " ").replace(/\s+/g, " ").trim(); };
  G.match = function (query, text) {
    var q = G.norm(query); if (!q) return true;
    var t = G.norm(text), parts = q.split(" ");
    for (var i = 0; i < parts.length; i++) if (t.indexOf(parts[i]) < 0) return false;
    return true;
  };
  G.firebaseError = function (e) {
    var c = (e && e.code) || "";
    var m = {
      "auth/email-already-in-use": "This email is already registered. Please sign in instead.",
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/weak-password": "Password is too weak. Use at least 8 characters.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/wrong-password": "Incorrect email or password.",
      "auth/user-not-found": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Please wait a few minutes and try again.",
      "auth/network-request-failed": "Network problem. Please check your internet connection.",
      "permission-denied": "You do not have permission for this action."
    };
    return m[c] || "Something went wrong. Please try again." + (c ? " (" + c + ")" : "");
  };

  // Any photo (large or small, from phone or camera) -> small data-url. Three methods are tried in turn.
  G.compress = function (file, maxW, maxH, maxLen) {
    maxLen = maxLen || 150000;
    function paint(src, w, h) {
      if (!w || !h) throw new Error("size");
      var scales = [1, 0.8, 0.64, 0.5, 0.4], qs = [0.72, 0.58, 0.45, 0.32], u = "";
      for (var si = 0; si < scales.length; si++) {
        var sc = Math.min(1, maxW / w, maxH / h) * scales[si], cw = Math.max(1, Math.round(w * sc)), ch = Math.max(1, Math.round(h * sc));
        var c = document.createElement("canvas"); c.width = cw; c.height = ch;
        var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, cw, ch); x.drawImage(src, 0, 0, cw, ch);
        for (var i = 0; i < qs.length; i++) { u = c.toDataURL("image/jpeg", qs[i]); if (u.length <= maxLen) return u; }
      }
      if (!u || u.indexOf("data:image/jpeg") !== 0) throw new Error("enc");
      throw new Error("too big");
    }
    function load(url) { return new Promise(function (res, rej) { var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { rej(new Error("img")); }; im.src = url; }); }
    var chain = [];
    if (typeof createImageBitmap === "function") chain.push(function () { return createImageBitmap(file).then(function (b) { try { return paint(b, b.width, b.height); } finally { try { b.close(); } catch (e) {} } }); });
    chain.push(function () { var u = URL.createObjectURL(file); return load(u).then(function (im) { URL.revokeObjectURL(u); return paint(im, im.naturalWidth || im.width, im.naturalHeight || im.height); }, function (e) { URL.revokeObjectURL(u); throw e; }); });
    chain.push(function () { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = function () { rej(new Error("read")); }; r.readAsDataURL(file); }).then(load).then(function (im) { return paint(im, im.naturalWidth || im.width, im.naturalHeight || im.height); }); });
    return new Promise(function (resolve) {
      if (!file) return resolve("");
      (function next(i) {
        if (i >= chain.length) return resolve("");
        var p; try { p = chain[i](); } catch (e) { return next(i + 1); }
        p.then(resolve, function () { next(i + 1); });
      })(0);
    });
  };
  // data-url -> small data-url (used for the public card thumbnail)
  G.thumb = function (dataUrl, size, q) {
    return new Promise(function (res) {
      var u = G.img(dataUrl); if (!u) return res("");
      var im = new Image();
      im.onload = function () {
        var sc = Math.min(1, size / im.width, size / im.height), w = Math.max(1, Math.round(im.width * sc)), h = Math.max(1, Math.round(im.height * sc));
        var c = document.createElement("canvas"); c.width = w; c.height = h; var x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
        res(c.toDataURL("image/jpeg", q || 0.6));
      };
      im.onerror = function () { res(""); }; im.src = u;
    });
  };

  // PWA
  G.pwa = function () {
    try { if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(function () {}); } catch (e) {}
    window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); G.installEv = e; var b = document.getElementById("installBtn"); if (b) b.classList.remove("hide"); });
  };
  G.install = function () { if (G.installEv) { G.installEv.prompt(); G.installEv = null; } else G.toast("Use the browser menu → 'Add to Home screen'"); };
})();
