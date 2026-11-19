// cloud-sync.js - Om Software
// Kaam: phone ka data (members, staff, attendance, PIN) Firestore me orgs/{orgId}/store/* me save karta hai.
// Logout ke baad bhi data cloud me safe rehta hai, login par wapas aa jata hai.
// Load order: firebase scripts -> auth-gate.js -> cloud-sync.js
(function () {
  if (window.__omSync) return; window.__omSync = true;
  var CFG = { apiKey: "AIzaSyAHEMISEIDSzZz-m2OQT5EPyhTRF-mXqjQ", authDomain: "bfc-gym-215ae.firebaseapp.com", projectId: "bfc-gym-215ae", storageBucket: "bfc-gym-215ae.firebasestorage.app", messagingSenderId: "886920088571", appId: "1:886920088571:web:c4bc478d246a2700b0d95e" };
  var LS = localStorage;
  var origSet = Storage.prototype.setItem, origRemove = Storage.prototype.removeItem;
  var SYNC_KEYS = ['5BFC_MEMBERS', '5bfc_admissions', 'bfc_staff_list', 'om_admin_pin'];
  var MEMBER_KEYS = ['5BFC_MEMBERS', 'bbf_master_records_v4'];
  var muted = false, timers = {}, latest = {};

  function J(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function orgId() { return LS.getItem('bfc_org_id') || (J('om_org_profile', {}) || {}).orgId || ''; }
  function cloudKey(k) {
    if (MEMBER_KEYS.indexOf(k) > -1) return '5BFC_MEMBERS';
    if (SYNC_KEYS.indexOf(k) > -1 || /^om_att_/.test(k)) return k;
    return null;
  }
  function rawSet(k, v) { origSet.call(LS, k, v); }
  function getDb() {
    try { if (!window.firebase) return null; if (!firebase.apps.length) firebase.initializeApp(CFG); return firebase.firestore(); } catch (e) { return null; }
  }
  window.omDb = getDb;
  var userP = null;
  function authReady() {
    if (userP) return userP;
    userP = new Promise(function (res) {
      try {
        if (!window.firebase) return res(null);
        if (!firebase.apps.length) firebase.initializeApp(CFG);
        var done = false, t = setTimeout(function () { if (!done) { done = true; res(firebase.auth().currentUser || null); } }, 8000);
        var un = firebase.auth().onAuthStateChanged(function (u) { if (done) return; done = true; clearTimeout(t); try { un(); } catch (e) {} res(u || null); });
      } catch (e) { res(null); }
    });
    return userP;
  }

  function getDirty() { return J('om_sync_dirty', []); }
  function setDirty(a) { rawSet('om_sync_dirty', JSON.stringify(a)); }
  function markDirty(ck) { var d = getDirty(); if (d.indexOf(ck) < 0) { d.push(ck); setDirty(d); } schedule(ck); }
  function clearDirty(ck) { setDirty(getDirty().filter(function (x) { return x !== ck; })); }
  function schedule(ck) { clearTimeout(timers[ck]); timers[ck] = setTimeout(function () { pushKey(ck); }, 1200); }

  function localValue(ck) {
    if (ck === '5BFC_MEMBERS') return LS.getItem('5BFC_MEMBERS') || LS.getItem('bbf_master_records_v4');
    return LS.getItem(ck);
  }
  function pushKey(ck) {
    clearTimeout(timers[ck]);
    var oid = orgId();
    if (!oid) return Promise.resolve(false);
    return authReady().then(function (u) {
      var db = getDb(); if (!u || !db) return false;
      var v = localValue(ck); if (v == null) { clearDirty(ck); return true; }
      if (v.length > 950000) { window.omSyncError = 'Data bahut bada hai (' + ck + ')'; return false; }
      return db.collection('orgs').doc(oid).collection('store').doc(ck).set({ v: v, t: new Date().toISOString(), by: u.uid }).then(function () {
        clearDirty(ck); window.omSyncError = ''; return true;
      });
    }).catch(function (e) { window.omSyncError = (e && e.message) || 'sync error'; console.warn('cloud-sync push failed', ck, e); return false; });
  }
  function flush() {
    var d = getDirty();
    if (!d.length) return Promise.resolve(true);
    return Promise.all(d.map(pushKey)).then(function (r) { return r.every(Boolean) && getDirty().length === 0; });
  }

  // localStorage.setItem hook: sync-wale keys ko dirty mark karo
  Storage.prototype.setItem = function (k, v) {
    origSet.apply(this, arguments);
    if (this === LS && !muted) {
      var ck = cloudKey(k);
      if (ck) {
        if (ck === '5BFC_MEMBERS') { muted = true; try { MEMBER_KEYS.forEach(function (m) { if (m !== k) origSet.call(LS, m, v); }); } finally { muted = false; } }
        markDirty(ck);
      }
    }
  };

  function allSyncLocalKeys() {
    var out = {};
    for (var i = 0; i < LS.length; i++) { var ck = cloudKey(LS.key(i)); if (ck) out[ck] = 1; }
    return Object.keys(out);
  }
  function hasData(ck) { var v = localValue(ck); return v != null && v !== '' && v !== '[]' && v !== '{}'; }
  function wipeLocal() {
    var del = [];
    for (var i = 0; i < LS.length; i++) { var k = LS.key(i); if (cloudKey(k) || k === 'om_sync_dirty' || k === 'om_sync_org' || /^om_photo_/.test(k)) del.push(k); }
    del.forEach(function (k) { origRemove.call(LS, k); });
  }

  async function pull() {
    var oid = orgId(); if (!oid) return { changed: false };
    var u = await authReady(); var db = getDb(); if (!u || !db) return { changed: false };
    var prev = LS.getItem('om_sync_org');
    if (prev && prev !== oid) wipeLocal();
    rawSet('om_sync_org', oid);
    var snap = await db.collection('orgs').doc(oid).collection('store').get();
    var dirty = getDirty(), inCloud = {}, changed = false;
    muted = true;
    try {
      snap.forEach(function (d) {
        var ck = d.id, v = (d.data() || {}).v; inCloud[ck] = 1;
        if (dirty.indexOf(ck) > -1 || typeof v !== 'string') return; // local naya hai, pehle upload hoga
        if (ck === '5BFC_MEMBERS') {
          if (localValue(ck) !== v) { MEMBER_KEYS.forEach(function (m) { origSet.call(LS, m, v); }); changed = true; }
        } else if (LS.getItem(ck) !== v) { origSet.call(LS, ck, v); changed = true; }
      });
    } finally { muted = false; }
    // Cloud me jo nahi hai par phone me hai (purana data) -> upload
    allSyncLocalKeys().forEach(function (ck) { if (!inCloud[ck] && hasData(ck)) markDirty(ck); });
    await flush();
    return { changed: changed };
  }

  window.omSyncPull = function () { return pull().catch(function (e) { window.omSyncError = (e && e.message) || 'pull error'; console.warn('cloud-sync pull failed', e); return { changed: false, error: true }; }); };
  window.omSyncFlush = flush;

  // Safe logout: pehle cloud me save, phir hi phone se data hatao
  window.omLogoutNow = async function () {
    var ok = false; try { ok = await flush(); } catch (e) {}
    if (!ok && !confirm('⚠️ कुछ डेटा cloud में save नहीं हो पाया।\nफिर भी Logout करें? (डेटा इस फोन में रहेगा, पर नए Login पर cloud वाला version आएगा)')) return;
    if (ok) wipeLocal();
    try { await firebase.auth().signOut(); } catch (e) {}
    location.replace('login.html?logout=1');
  };

  // Har page par auto-pull (login page par nahi; wahan login.html khud call karta hai)
  if (!/login\.html$/.test(location.pathname)) {
    var last = +(sessionStorage.getItem('om_last_pull') || 0);
    if (Date.now() - last > 180000) {
      sessionStorage.setItem('om_last_pull', String(Date.now()));
      window.omSyncReady = window.omSyncPull().then(function (r) {
        if (r && r.changed) {
          var rk = 'om_reload_' + location.pathname;
          if (Date.now() - +(sessionStorage.getItem(rk) || 0) > 180000) { sessionStorage.setItem(rk, String(Date.now())); location.reload(); }
        }
      });
    }
  }
})();
