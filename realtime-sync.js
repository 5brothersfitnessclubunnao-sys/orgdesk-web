(function () {
  var CFG = {
    apiKey: "AIzaSyAHEMISEIDSzZz-m2OQT5EPyhTRF-mXqjQ",
    authDomain: "bfc-gym-215ae.firebaseapp.com",
    projectId: "bfc-gym-215ae",
    storageBucket: "bfc-gym-215ae.firebasestorage.app",
    messagingSenderId: "886920088571",
    appId: "1:886920088571:web:c4bc478d246a2700b0d95e"
  };

  var MODE_KEY = "om_locked_app_mode_v1";
  var LOGGED_KEY = "om_session_active_v1";
  var TENANT_KEY = "om_active_tenant_id_v1";
  var MEMBERS_KEYS = ["bbf_master_records_v4", "5BFC_MEMBERS", "5bfc_admissions", "om_erp_mem_v2"];

  var db = null;
  var auth = null;
  try {
    if (window.firebase) {
      if (!firebase.apps.length) firebase.initializeApp(CFG);
      if (typeof firebase.firestore === "function") db = firebase.firestore();
      if (typeof firebase.auth === "function") auth = firebase.auth();
    }
  } catch (e) {}

  function getTenantId() {
    try {
      var prof = JSON.parse(localStorage.getItem("om_active_gym_profile") || "{}");
      var raw = prof.gymId || prof.email || prof.phone || prof.gymName || localStorage.getItem(TENANT_KEY) || "default_workspace";
      var clean = String(raw).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 60) || "default_workspace";
      localStorage.setItem(TENANT_KEY, clean);
      return clean;
    } catch (e) {
      return "default_workspace";
    }
  }

  function getLockedMode() {
    try {
      var m = localStorage.getItem(MODE_KEY);
      if (m === "light" || m === "full") return m;
      var legacy = localStorage.getItem("om_app_display_mode");
      if (legacy === "light" || legacy === "full") {
        localStorage.setItem(MODE_KEY, legacy);
        return legacy;
      }
    } catch (e) {}
    return "light";
  }

  function setLockedMode(mode, explicitSwitch) {
    if (!explicitSwitch) return;
    var target = (mode === "full") ? "full" : "light";
    try {
      localStorage.setItem(MODE_KEY, target);
      localStorage.setItem("om_app_display_mode", target);
      localStorage.setItem(LOGGED_KEY, "1");
    } catch (e) {}
    syncWorkspaceStateToCloud({ mode: target });
    window.dispatchEvent(new CustomEvent("om:mode-changed", { detail: { mode: target } }));
  }

  function clearSessionOnLogout() {
    try {
      localStorage.removeItem(LOGGED_KEY);
      localStorage.removeItem("om_session_active");
    } catch (e) {}
  }

  function readLocalMembers() {
    var map = new Map();
    MEMBERS_KEYS.forEach(function (k) {
      try {
        var arr = JSON.parse(localStorage.getItem(k) || "[]");
        if (!Array.isArray(arr)) return;
        arr.forEach(function (m, idx) {
          if (!m || !m.name) return;
          var id = String(m.id || m.phone || ("m_" + idx)).trim();
          var ph = String(m.phone || "").replace(/\D/g, "").slice(-10);
          var key = (ph.length === 10 ? ph : id) + "|" + String(m.name || "").trim().toLowerCase();
          if (!map.has(key)) {
            m.id = id;
            map.set(key, m);
          }
        });
      } catch (e) {}
    });
    return Array.from(map.values());
  }

  function writeLocalMembers(list, broadcast) {
    MEMBERS_KEYS.forEach(function (k) {
      try { localStorage.setItem(k, JSON.stringify(list)); } catch (e) {}
    });
    if (broadcast !== false) {
      window.dispatchEvent(new CustomEvent("om:members-synced", { detail: { members: list } }));
    }
  }

  function syncMembersToCloud(list) {
    if (!db) return;
    var tid = getTenantId();
    try {
      db.collection("workspaces").doc(tid).set({
        tenantId: tid,
        members: list,
        updatedAt: Date.now(),
        updatedIso: new Date().toISOString()
      }, { merge: true }).catch(function () {});
    } catch (e) {}
  }

  function saveMembersRealtime(list) {
    writeLocalMembers(list, true);
    syncMembersToCloud(list);
  }

  function syncWorkspaceStateToCloud(extra) {
    if (!db) return;
    var tid = getTenantId();
    var payload = Object.assign({
      tenantId: tid,
      mode: getLockedMode(),
      updatedAt: Date.now(),
      updatedIso: new Date().toISOString()
    }, extra || {});
    try {
      db.collection("workspaces").doc(tid).set(payload, { merge: true }).catch(function () {});
    } catch (e) {}
  }

  function startRealtimeWorkspaceListener() {
    if (!db) return;
    var tid = getTenantId();
    try {
      db.collection("workspaces").doc(tid).onSnapshot(function (doc) {
        if (!doc || !doc.exists) return;
        var data = doc.data() || {};
        if (Array.isArray(data.members)) {
          writeLocalMembers(data.members, true);
        }
        if (data.mode === "light" || data.mode === "full") {
          try {
            localStorage.setItem(MODE_KEY, data.mode);
            localStorage.setItem("om_app_display_mode", data.mode);
          } catch (e) {}
          window.dispatchEvent(new CustomEvent("om:mode-changed", { detail: { mode: data.mode } }));
        }
        window.dispatchEvent(new CustomEvent("om:workspace-realtime", { detail: data }));
      }, function () {});
    } catch (e) {}
  }

  // Same-device cross-tab sync
  window.addEventListener("storage", function (ev) {
    if (!ev || !ev.key) return;
    if (MEMBERS_KEYS.indexOf(ev.key) !== -1) {
      window.dispatchEvent(new CustomEvent("om:members-synced", { detail: { members: readLocalMembers() } }));
    }
    if (ev.key === MODE_KEY || ev.key === "om_app_display_mode") {
      window.dispatchEvent(new CustomEvent("om:mode-changed", { detail: { mode: getLockedMode() } }));
    }
  });

  window.addEventListener("pageshow", function () {
    var m = getLockedMode();
    window.dispatchEvent(new CustomEvent("om:mode-changed", { detail: { mode: m } }));
  });

  window.omSync = {
    db: db,
    auth: auth,
    getTenantId: getTenantId,
    getLockedMode: getLockedMode,
    setLockedMode: setLockedMode,
    clearSessionOnLogout: clearSessionOnLogout,
    readLocalMembers: readLocalMembers,
    saveMembersRealtime: saveMembersRealtime,
    syncWorkspaceStateToCloud: syncWorkspaceStateToCloud
  };

  startRealtimeWorkspaceListener();
})();
