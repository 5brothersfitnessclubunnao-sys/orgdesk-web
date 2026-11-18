// backup.js - raat 11 baje auto backup (page khula ho to) + catch-up + manual download
(function () {
  var LS = localStorage;
  var CFG = { apiKey: "AIzaSyAHEMISEIDSzZz-m2OQT5EPyhTRF-mXqjQ", authDomain: "bfc-gym-215ae.firebaseapp.com", projectId: "bfc-gym-215ae", storageBucket: "bfc-gym-215ae.firebasestorage.app", messagingSenderId: "886920088571", appId: "1:886920088571:web:c4bc478d246a2700b0d95e" };
  function J(k, d) { try { var v = JSON.parse(LS.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function iso(d) { d = d || new Date(); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  function getDb() { try { if (!window.firebase) return null; if (!firebase.apps.length) firebase.initializeApp(CFG); return firebase.firestore(); } catch (e) { return null; } }
  function collect(day) {
    var mp = {};
    ["5BFC_MEMBERS", "bbf_master_records_v4", "5bfc_admissions"].forEach(function (k) {
      J(k, []).forEach(function (r) { if (r && r.name) { var c = Object.assign({}, mp[r.id || r.phone] || {}, r); delete c.memberPhoto; delete c.memberIdImg; mp[r.id || r.phone] = c; } });
    });
    var members = Object.keys(mp).map(function (k) { return mp[k]; });
    var adm = members.filter(function (m) { return String(m.admittedAt || m.joinDate || "").slice(0, 10) === day; });
    var log = J("om_fee_log", []).filter(function (x) { return x.date === day; });
    var sum = function (a, f) { return a.reduce(function (t, x) { return t + (Number(f(x)) || 0); }, 0); };
    return {
      date: day, createdAt: new Date().toISOString(), org: J("om_org_profile", {}),
      summary: { totalMembers: members.length, admissionsToday: adm.length, admissionFeesToday: sum(adm, function (m) { return m.amount; }), duesCollectedToday: sum(log, function (x) { return x.amount; }), totalDue: sum(members, function (m) { return m.dueAmount; }) },
      members: members, staff: J("bfc_staff_list", []), feeLog: log,
      attendanceMembers: J("5bfc_attendance_" + day, {}), attendanceStaff: J("5bfc_staff_attendance_" + day, {})
    };
  }
  window.omBackup = async function (day) {
    day = day || iso(); var data = collect(day), org = data.org.orgId || "org", db = getDb(), cloud = false;
    if (db) {
      try {
        var id = org + "_" + day, parts = [], size = 200;
        for (var i = 0; i < data.members.length; i += size) parts.push(data.members.slice(i, i + size));
        var head = { orgId: org, date: day, createdAt: data.createdAt, summary: data.summary, staff: JSON.stringify(data.staff), feeLog: JSON.stringify(data.feeLog), attendanceMembers: JSON.stringify(data.attendanceMembers), attendanceStaff: JSON.stringify(data.attendanceStaff), parts: parts.length };
        await db.collection("backups").doc(id).set(head);
        for (var p = 0; p < parts.length; p++) await db.collection("backups").doc(id).collection("parts").doc(String(p)).set({ json: JSON.stringify(parts[p]) });
        cloud = true;
      } catch (e) { console.warn("cloud backup", e); }
    }
    LS.setItem("om_last_backup", JSON.stringify({ date: day, at: new Date().toISOString(), cloud: cloud, members: data.members.length }));
    return { data: data, cloud: cloud };
  };
  window.omBackupDownload = async function () {
    var r = await omBackup(), b = new Blob([JSON.stringify(r.data, null, 1)], { type: "application/json" }), a = document.createElement("a");
    a.href = URL.createObjectURL(b); a.download = "Gym_Backup_" + r.data.date + ".json"; a.click(); return r;
  };
  window.omLastBackupText = function () { var l = J("om_last_backup", null); return l ? new Date(l.at).toLocaleString("en-IN") + (l.cloud ? " (Cloud ✔)" : " (सिर्फ इस फोन में)") + " • " + l.members + " members" : "अभी तक नहीं"; };
  function tick() {
    var now = new Date(), l = J("om_last_backup", null), today = iso(), y = iso(new Date(Date.now() - 864e5));
    var due = (now.getHours() >= 23 && (!l || l.date !== today)) || (!l || l.date < y);
    if (due && J("om_org_profile", {}).orgId) omBackup(now.getHours() >= 23 ? today : y).catch(function () {});
  }
  setTimeout(tick, 4000); setInterval(tick, 60000);
})();
