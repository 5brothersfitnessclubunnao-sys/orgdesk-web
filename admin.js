/* Admin panel — sign in, dashboard, admissions desk, members, receipts, settings. */
(function () {
  "use strict";
  if (!window.G || !G.ok) return;
  var S = { tab: (function () { var h = (location.hash || "").slice(1); return ["home", "adm", "mem", "due", "rec", "set"].indexOf(h) >= 0 ? h : "home"; })(), members: [], todayPay: [], reqs: [], q: "", filter: "", rf: G.today(), rt: G.today(), pays: [] }, A = {};
  S.filter = S.tab === "adm" ? "pending" : (S.tab === "mem" ? "all" : "");
  var app = document.getElementById("app"), esc = G.esc, SUPPORT_WA = "919140417259"; /* change to your support WhatsApp number (country code + number) */
  var unsubs = [];
  var $ = function (id) { return document.getElementById(id); };
  var base = function () { return G.db.collection("orgs").doc(S.orgId); };

  /* ================= sign in ================= */
  function loginView(msg) {
    app.innerHTML = '<div class="top"><b>' + esc(G.app.name) + ' — Admin</b></div><div class="wrap"><div class="hero"><div class="bigtitle">Sign in</div><p class="mut">Use the email and password you created while setting up your organisation.</p></div><div class="card">' +
      '<label>Email</label><input class="inp" id="em" type="email" autocomplete="username"><label>Password</label><input class="inp" id="pw" type="password" autocomplete="current-password">' +
      '<div class="err" id="lerr" style="margin-top:8px">' + esc(msg || "") + '</div><button class="btn" id="lgo" style="margin-top:10px">Sign in</button>' +
      '<button class="btn sec" id="lfg" style="margin-top:8px">Forgot password</button></div><p class="ctr mut">New organisation? <a href="setup.html">Set up here</a></p></div>';
    $("lgo").onclick = function () {
      var b = $("lgo"); b.disabled = true; b.textContent = "Signing in…";
      G.auth.signInWithEmailAndPassword($("em").value.trim(), $("pw").value).catch(function (e) { b.disabled = false; b.textContent = "Sign in"; $("lerr").textContent = G.firebaseError(e); });
    };
    $("pw").onkeydown = function (e) { if (e.key === "Enter") $("lgo").click(); };
    $("lfg").onclick = function () {
      var em = $("em").value.trim(); if (!em) { $("lerr").textContent = "Enter your email first."; return; }
      G.auth.sendPasswordResetEmail(em).then(function () { $("lerr").style.color = "var(--ok)"; $("lerr").textContent = "If this email is registered, a reset link has been sent."; }).catch(function (e) { $("lerr").textContent = G.firebaseError(e); });
    };
  }
  function boot(u) {
    unsubs.forEach(function (f) { try { f(); } catch (e) {} }); unsubs = [];
    if (!u) return loginView();
    S.user = u;
    G.db.collection("users").doc(u.uid).get().then(function (s) {
      if (!s.exists) { app.innerHTML = '<div class="wrap"><div class="card ctr"><h2>No organisation linked</h2><p class="mut">This account is not linked to any organisation.</p><button class="btn sec" data-a="logout" style="margin-top:12px">Sign out</button></div></div>'; return; }
      S.ou = s.data(); S.orgId = S.ou.orgId;
      return G.db.collection("orgs").doc(S.orgId).get().then(function (o) {
        if (!o.exists) throw new Error("org");
        S.org = o.data(); S.tpl = ORG_TEMPLATES[S.org.type]; G.theme(S.org);
        shell();
        unsubs.push(base().collection("members").onSnapshot(function (q) { S.members = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); render(true); }, function () { G.toast("Could not load members"); }));
        unsubs.push(base().collection("payreqs").where("status", "==", "pending").onSnapshot(function (q) { S.reqs = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); render(true); }, function () {}));
        unsubs.push(base().collection("payments").where("date", "==", G.today()).onSnapshot(function (q) { S.todayPay = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); render(true); }));
      });
    }).catch(function () { app.innerHTML = '<div class="wrap"><div class="card ctr"><h2>Unable to load</h2><p class="mut">Please check your connection and reload.</p></div></div>'; });
  }
  G.auth.onAuthStateChanged(boot);

  /* ================= shell ================= */
  var TABS = [["home", "🏠", "Home"], ["adm", "📝", "Admissions"], ["mem", "👥", "Members"], ["due", "💰", "Dues"], ["rec", "🧾", "Reports"], ["set", "⚙️", "Settings"]];
  function shell() {
    app.innerHTML = '<div class="top"><a href="index.html" style="font-size:22px;text-decoration:none;color:var(--ac)" aria-label="Menu">⬅</a><img id="tl" class="logo hide" alt=""><b>' + esc(S.org.name) + '</b><span class="chip">' + esc(S.tpl.name) + '</span></div><div class="wrap" id="view"></div><div class="tabs" id="tabs"></div><div id="mroot"></div>';
    if (G.img(S.org.logo)) { $("tl").src = S.org.logo; $("tl").classList.remove("hide"); }
    drawTabs(); render();
  }
  function pendingCount() { return S.members.filter(function (m) { return m.status === "pending"; }).length; }
  function dueCount() { return S.members.filter(function (m) { if (m.status !== "active") return false; var x = mstate(m); return G.num(m.due) > 0 || x === "expiring" || x === "expired"; }).length; }
  function drawTabs() {
    var pc = pendingCount();
    $("tabs").innerHTML = TABS.map(function (t) { return '<button data-a="tab" data-v="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '"><i>' + t[1] + "</i>" + t[2] + (t[0] === "adm" && pc ? ' <span class="chip warn">' + pc + "</span>" : "") + (t[0] === "due" && dueCount() ? ' <span class="chip warn">' + dueCount() + "</span>" : "") + (t[0] === "rec" && S.reqs.length ? ' <span class="chip warn">' + S.reqs.length + "</span>" : "") + "</button>"; }).join("");
  }
  var rt;
  function render(soft) {
    if (!$("view")) return;
    drawTabs();
    if (soft && (S.tab === "set" || S.typing)) return;                // never wipe a form the user is editing
    clearTimeout(rt); rt = setTimeout(function () { var f = { home: home, adm: admissions, mem: members, due: dues, rec: receipts, set: settings }[S.tab]; f(); }, 30);
  }
  function mstate(m) { if (m.status !== "active") return m.status; var d = G.daysLeft(m.expiry); return d == null ? "active" : d < 0 ? "expired" : d <= 7 ? "expiring" : "active"; }
  function chip(st, m) {
    var map = { active: ["ok", "Active"], expiring: ["warn", "Expiring"], expired: ["bad", "Expired"], pending: ["warn", "Pending"], denied: ["bad", "Denied"] };
    var c = map[st] || ["", st]; var extra = m && (st === "active" || st === "expiring") ? " · " + G.daysLeft(m.expiry) + "d" : m && st === "expired" ? " · " + Math.abs(G.daysLeft(m.expiry)) + "d ago" : "";
    return '<span class="chip ' + c[0] + '">' + c[1] + extra + "</span>";
  }
  function searchText(m) { var d = m.data || {}; return [m.name, m.phone, m.code, m.batchName, m.planName, d.fatherName, d.parentName, d.email].join(" "); }
  function listRow(m, right) {
    return '<div class="li" data-a="open" data-id="' + esc(m.id) + '"><div class="av">' + esc((m.name || "?").charAt(0).toUpperCase()) + '</div><div class="m"><b>' + esc(m.name) + '</b><small>' + esc([m.code, m.phone, m.batchName].filter(Boolean).join(" · ")) + "</small></div>" + right + "</div>";
  }

  /* ================= helpers: charts, dates ================= */
  function shiftDay(s, n) { var p = String(s).split("-"), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n)); return d.toISOString().slice(0, 10); }
  function compact(v) { v = G.num(v); return v >= 100000 ? (v / 100000).toFixed(1).replace(/\.0$/, "") + "L" : v >= 1000 ? (v / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(v); }
  function statTile(n, l, c) { return '<div class="stat ' + (c || "") + '"><b>' + n + "</b><span>" + l + "</span></div>"; }
  function barChart(days, vals) {
    var mx = Math.max.apply(null, vals.concat([1])), lab = days.length <= 10;
    return '<div style="display:flex;align-items:flex-end;gap:' + (days.length > 16 ? 2 : 5) + 'px;height:130px;margin-top:10px">' + vals.map(function (v, i) {
      return '<div title="' + esc(G.fmt(days[i]) + ": " + G.money(v)) + '" style="flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center">' +
        (lab && v ? '<span style="font-size:10px;color:var(--tx,#ddd);margin-bottom:2px">' + compact(v) + "</span>" : "") +
        '<div style="width:100%;height:' + (v ? Math.max(3, Math.round(v / mx * 100)) : 0) + '%;max-height:' + (lab ? 82 : 100) + '%;background:var(--ac);border-radius:5px 5px 0 0"></div></div>';
    }).join("") + '</div><div style="display:flex;gap:' + (days.length > 16 ? 2 : 5) + 'px;font-size:10px;color:#999;margin-top:3px">' + days.map(function (d) { return '<span style="flex:1;text-align:center;overflow:hidden">' + d.slice(8) + "</span>"; }).join("") + "</div>";
  }

  /* ================= dues ================= */
  function dueRows() {
    return S.members.filter(function (m) { return m.status === "active"; }).map(function (m) {
      return { m: m, st: mstate(m), due: G.num(m.due), days: G.daysLeft(m.expiry) };
    }).filter(function (x) { return x.due > 0 || x.st === "expiring" || x.st === "expired"; });
  }
  function remindMsg(x) {
    var m = x.m, p = ["नमस्ते " + m.name + " जी, " + S.org.name + " की ओर से याद दिलाना चाहते हैं।"];
    if (x.due > 0) p.push("आपकी " + G.money(x.due) + " फीस बाकी है।");
    if (x.st === "expired") p.push("आपकी सदस्यता " + G.fmt(m.expiry) + " को समाप्त हो चुकी है, कृपया रिन्यू करें।");
    else if (x.st === "expiring") p.push("आपकी सदस्यता " + G.fmt(m.expiry) + " को समाप्त हो रही है (" + x.days + " दिन बाकी), कृपया समय पर रिन्यू करें।");
    p.push("ऑनलाइन फीस भरें: " + G.link("pay.html", { o: S.orgId, m: m.id }));
    p.push("धन्यवाद 🙏");
    return p.join("\n");
  }
  function dueRow(x) {
    var m = x.m;
    return '<div class="li"><div class="av">' + esc((m.name || "?").charAt(0).toUpperCase()) + '</div><div class="m" data-a="open" data-id="' + esc(m.id) + '"><b>' + esc(m.name) + "</b><small>" + esc([m.code, m.phone, "Valid till " + G.fmt(m.expiry)].filter(Boolean).join(" · ")) + "</small></div>" +
      '<div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end">' + (x.due > 0 ? '<span class="chip bad">Due ' + esc(G.money(x.due)) + "</span>" : "") + chip(x.st, m) +
      '<div style="display:flex;gap:6px">' + (x.due > 0 ? '<button class="btn sm" data-a="duef" data-id="' + esc(m.id) + '">₹ Collect</button>' : '<button class="btn sm" data-a="renewf" data-id="' + esc(m.id) + '">Renew</button>') +
      '<a class="btn sm sec" target="_blank" rel="noopener" aria-label="WhatsApp reminder" href="' + esc(G.wa(m.phone, remindMsg(x))) + '">💬</a></div></div></div>';
  }
  function dues() {
    var f = ["fee", "expiring", "expired"].indexOf(S.filter) >= 0 ? S.filter : "all", all = dueRows();
    var tot = all.reduce(function (s, x) { return s + x.due; }, 0), nd = all.filter(function (x) { return x.due > 0; }).length;
    var hit = function (x, k) { return k === "all" || (k === "fee" ? x.due > 0 : x.st === k); };
    var rows = all.filter(function (x) { return hit(x, f) && G.match(S.q, searchText(x.m)); }).sort(function (a, b) { return (b.due - a.due) || ((a.days == null ? 9999 : a.days) - (b.days == null ? 9999 : b.days)); });
    var h = "<h2>Dues & reminders</h2><div class=\"grid2\">" + statTile(G.money(tot), "Fee pending", tot ? "bad" : "ok") + statTile(nd, S.tpl.membersWord + " with dues", nd ? "warn" : "") + "</div>" +
      searchBox("Search by name, mobile, ID…") + '<div class="pill">' + [["all", "All"], ["fee", "Fee due"], ["expiring", "Expiring"], ["expired", "Expired"]].map(function (x) { return '<button data-a="filter" data-v="' + x[0] + '" class="' + (f === x[0] ? "on" : "") + '">' + x[1] + " (" + all.filter(function (y) { return hit(y, x[0]); }).length + ")</button>"; }).join("") + '</div>' +
      '<div class="sub" style="margin:4px 2px 8px">💬 opens WhatsApp with a ready reminder (including the online pay link). No SMS cost.</div><div class="card">' +
      (rows.length ? rows.map(dueRow).join("") : '<p class="mut ctr">' + (S.q ? "No matching records." : "Nothing pending — all clear 🎉") + "</p>") + "</div>";
    $("view").innerHTML = h; bindSearch();
  }
  A.duef = function (el) {
    var m = find(el.getAttribute("data-id")); if (!m) return;
    modal('<h2 style="margin-right:40px">Collect due fee</h2><p class="mut">' + esc(m.name) + " · Due " + esc(G.money(m.due)) + '</p><label>Amount received (₹)</label><input class="inp" type="number" id="damt" min="1" max="' + G.num(m.due) + '" value="' + G.num(m.due) + '">' + payFields({}) +
      '<button class="btn ok" id="pgo" style="margin-top:12px" data-a="duepay" data-id="' + esc(m.id) + '">Receive & generate receipt</button>');
  };
  A.duepay = function (el) {
    var m = find(el.getAttribute("data-id")); if (!m) return;
    var amt = Math.round(Number($("damt").value));
    if (!isFinite(amt) || amt < 1 || amt > G.num(m.due)) { $("perr").textContent = "Enter an amount between ₹1 and " + G.money(m.due) + "."; return; }
    var mode = $("pmode").value, utr = $("putr").value.trim(), b = $("pgo"); b.disabled = true; b.textContent = "Please wait…";
    var bs = base(), mRef = bs.collection("members").doc(m.id), pRef = bs.collection("payments").doc(), seq = bs.collection("counters").doc("seq"), out = {};
    G.db.runTransaction(function (tx) {
      return Promise.all([tx.get(seq), tx.get(mRef)]).then(function (r) {
        var q = r[0].exists ? r[0].data() : { member: 0, receipt: 0 }, cur = r[1].data(), due = G.num(cur.due);
        if (amt > due) { var er = new Error("Due is now " + G.money(due) + " — please reopen."); er.plain = 1; throw er; }
        var rno = (S.org.receiptPrefix || "RC") + "-" + G.pad(q.receipt + 1, 5);
        tx.set(seq, { member: q.member, receipt: q.receipt + 1 });
        tx.update(mRef, { paid: G.num(cur.paid) + amt, due: due - amt });
        out.pay = { memberId: m.id, name: m.name, code: m.code, phone: m.phone, batchName: m.batchName || "", amount: amt, mode: mode, utr: utr, receiptNo: rno, type: "due", planName: m.planName || "", from: m.startDate || "", to: m.expiry || "", date: G.today(), ts: G.FV.serverTimestamp(), by: S.user.uid, byName: S.ou.name || "Admin" };
        tx.set(pRef, out.pay);
      });
    }).then(function () { G.toast("Due fee received"); showReceipt(out.pay, m); })
      .catch(function (e) { console.error(e); b.disabled = false; b.textContent = "Receive & generate receipt"; $("perr").textContent = e && e.plain ? e.message : G.firebaseError(e); });
  };

  /* ================= home ================= */
  function weekPaint() {
    var el = $("wk"); if (!el || !S.wk) return;
    var t = G.today(), days = [], vals = [], tot = 0, i, s, v, tt = S.todayPay.reduce(function (a, p) { return a + G.num(p.amount); }, 0);
    for (i = -6; i <= 0; i++) { s = shiftDay(t, i); v = i === 0 ? tt : (S.wk.by[s] || 0); days.push(s); vals.push(v); tot += v; }
    el.innerHTML = '<div class="kv"><span>7-day total</span><b>' + G.money(tot) + "</b></div>" + barChart(days, vals);
  }
  function weekLoad() {
    if (S.wk && Date.now() - S.wk.t < 60000) return weekPaint();
    var t = G.today();
    base().collection("payments").where("date", ">=", shiftDay(t, -6)).where("date", "<", t).get().then(function (q) {
      var by = {}; q.docs.forEach(function (d) { var p = d.data(); by[p.date] = (by[p.date] || 0) + G.num(p.amount); });
      S.wk = { t: Date.now(), by: by }; weekPaint();
    }).catch(function () { var el = $("wk"); if (el) el.textContent = "Could not load the weekly chart."; });
  }
  function home() {
    var ms = S.members, st = { active: 0, expiring: 0, expired: 0, pending: 0 };
    ms.forEach(function (m) { var s = mstate(m); if (st[s] !== undefined) st[s]++; });
    var tp = S.todayPay, tot = 0, by = {}, mode = {};
    tp.forEach(function (p) { tot += G.num(p.amount); by[p.byName || "Staff"] = (by[p.byName || "Staff"] || 0) + G.num(p.amount); mode[p.mode] = (mode[p.mode] || 0) + G.num(p.amount); });
    var adToday = ms.filter(function (m) { return m.approvedDate === G.today(); }).length;
    var join = G.link("join.html", { o: S.orgId });
    var dr = dueRows(), pend = dr.reduce(function (s, x) { return s + x.due; }, 0), nd = dr.filter(function (x) { return x.due > 0; }).length;
    var bc = {}; ms.forEach(function (m) { if (m.status === "active") { var k = m.batchName || "—"; bc[k] = (bc[k] || 0) + 1; } });
    var bk = Object.keys(bc).sort(function (a, b) { return bc[b] - bc[a]; }).slice(0, 8);
    var h = '<h2>Today at a glance</h2><div class="grid2">' + statTile(st.active + st.expiring, "Active " + S.tpl.membersWord.toLowerCase(), "ok") + statTile(st.pending, "Applications awaiting verification", st.pending ? "warn" : "") +
      statTile(st.expiring, "Expiring within 7 days", "warn") + statTile(st.expired, "Expired", "bad") + statTile(adToday, "Admissions today") + statTile(G.money(tot), "Fees collected today") + "</div>";
    h += '<div class="card" style="border-color:' + (pend || st.expiring || st.expired ? "var(--warn)" : "var(--ok)") + '"><div class="kv"><span>Fee pending (' + nd + " " + esc(S.tpl.membersWord.toLowerCase()) + ")</span><b>" + G.money(pend) + '</b></div><button class="btn sm" style="margin-top:8px" data-a="tab" data-v="due">Open dues & send WhatsApp reminders</button></div>';
    if (S.reqs.length) h += '<div class="card" style="border-color:var(--warn)"><b>' + S.reqs.length + ' online payment(s) awaiting your confirmation</b><button class="btn sm" style="margin-top:8px" data-a="tab" data-v="rec">Review now</button></div>';
    h += '<h3>Last 7 days collection</h3><div class="card" id="wk"><p class="mut">Loading…</p></div>';
    h += '<h3>Collection by staff (today)</h3><div class="card">' + (Object.keys(by).length ? Object.keys(by).map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + G.money(by[k]) + "</b></div>"; }).join("") : '<p class="mut">No collection recorded yet today.</p>') + "</div>";
    if (Object.keys(mode).length) h += '<div class="card">' + Object.keys(mode).map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + G.money(mode[k]) + "</b></div>"; }).join("") + "</div>";
    if (bk.length) h += "<h3>" + esc(S.tpl.groupLabel) + "-wise " + esc(S.tpl.membersWord.toLowerCase()) + '</h3><div class="card">' + bk.map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + bc[k] + "</b></div>"; }).join("") + "</div>";
    h += '<h3>Admission link</h3><div class="card"><div class="ro" style="word-break:break-all;font-size:13px">' + esc(join) + '</div><div class="row" style="margin-top:8px"><button class="btn sec" data-a="copy" data-v="' + esc(join) + '">Copy link</button><a class="btn sec" target="_blank" rel="noopener" href="' + esc("https://wa.me/?text=" + encodeURIComponent("Apply for admission at " + S.org.name + ": " + join)) + '">Share on WhatsApp</a></div></div>';
    $("view").innerHTML = h; weekLoad();
  }

  /* ================= admissions desk ================= */
  function searchBox(ph) { return '<div class="srch"><input class="inp" id="q" placeholder="' + esc(ph) + '" value="' + esc(S.q) + '" autocomplete="off"></div>'; }
  function admissions() {
    var f = S.filter || "pending";
    var list = S.members.filter(function (m) { return m.status === f && G.match(S.q, searchText(m)); }).sort(function (a, b) { return (b.createdAt && b.createdAt.toMillis ? b.createdAt.toMillis() : 0) - (a.createdAt && a.createdAt.toMillis ? a.createdAt.toMillis() : 0); });
    var h = "<h2>Admissions desk</h2>" + searchBox("Search by name, mobile or " + S.tpl.groupLabel.toLowerCase() + "…") +
      '<div class="pill">' + [["pending", "Pending"], ["denied", "Denied"]].map(function (x) { return '<button data-a="filter" data-v="' + x[0] + '" class="' + (f === x[0] ? "on" : "") + '">' + x[1] + " (" + S.members.filter(function (m) { return m.status === x[0]; }).length + ")</button>"; }).join("") + '</div><div class="card" id="lst">';
    h += list.length ? list.map(function (m) { return listRow(m, '<span class="sub">' + esc(G.fmtTs(m.createdAt)) + "</span>"); }).join("") : '<p class="mut ctr">' + (S.q ? "No matching applications." : "No " + f + " applications.") + "</p>";
    $("view").innerHTML = h + "</div>"; bindSearch();
  }
  function bindSearch() {
    var q = $("q"); if (!q) return;
    q.oninput = function () { S.q = q.value; S.typing = true; var pos = q.selectionStart; render(); setTimeout(function () { S.typing = false; var n = $("q"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }, 60); };
  }

  /* ================= members ================= */
  function members() {
    var f = S.filter && S.filter !== "pending" && S.filter !== "denied" ? S.filter : "all";
    var rows = S.members.filter(function (m) { return m.status === "active"; }).filter(function (m) { return (f === "all" || mstate(m) === f) && G.match(S.q, searchText(m)); }).sort(function (a, b) { return String(a.name).localeCompare(String(b.name)); });
    var cnt = function (k) { return S.members.filter(function (m) { return m.status === "active" && (k === "all" || mstate(m) === k); }).length; };
    var h = "<h2>" + esc(S.tpl.membersWord) + "</h2>" + searchBox("Search by name, mobile, ID, plan…") + '<div class="pill">' +
      [["all", "All"], ["active", "Active"], ["expiring", "Expiring"], ["expired", "Expired"]].map(function (x) { return '<button data-a="filter" data-v="' + x[0] + '" class="' + (f === x[0] ? "on" : "") + '">' + x[1] + " (" + cnt(x[0]) + ")</button>"; }).join("") + '</div><div class="card">';
    h += rows.length ? rows.map(function (m) { return listRow(m, chip(mstate(m), m)); }).join("") : '<p class="mut ctr">' + (S.q ? "No matching records." : "No records yet.") + "</p>";
    $("view").innerHTML = h + "</div>"; bindSearch();
  }

  /* ================= modal helpers ================= */
  function modal(html) { $("mroot").innerHTML = '<div class="modal" data-a="mbg"><div><button class="x" data-a="close">✕</button>' + html + "</div></div>"; S.typing = true; }
  function closeModal() { $("mroot").innerHTML = ""; S.typing = false; render(); }
  function kvSheet(title, rows) { return '<div class="sheet"><h4>' + esc(title) + "</h4>" + rows.map(function (r) { return '<div class="kv"><span>' + esc(r[0]) + "</span><b>" + esc(r[1]) + "</b></div>"; }).join("") + "</div>"; }
  function find(id) { return S.members.filter(function (m) { return m.id === id; })[0]; }

  /* ================= member / application detail ================= */
  function openMember(id) {
    var m = find(id); if (!m) return;
    var st = mstate(m), head = '<h2 style="margin-right:40px">' + esc(m.name) + "</h2><p>" + chip(st, m) + ' <span class="sub">' + esc(m.code || "") + "</span></p>";
    modal(head + '<div class="card ctr mut" id="dfiles">Loading documents…</div><div id="dbody"></div>');
    var body = "";
    body += kvSheet("Membership", [[S.tpl.planLabel, m.planName || "—"]].concat(extraRows(m), [[S.tpl.groupLabel, m.batchName || "—"], ["Joining date", G.fmt(m.joinDate)]]).concat(m.status === "active" ? [["Valid from", G.fmt(m.startDate)], ["Valid till", G.fmt(m.expiry)], ["Total paid", G.money(m.paid)], ["Fee due", G.money(m.due)]] : [["Plan fee", G.money(m.planPrice)], ["Applied on", G.fmtTs(m.createdAt)], ["UTR given", m.utr || "—"]]));
    OF.sections(S.tpl, m).forEach(function (s) { body += kvSheet(s.title, s.rows); });
    var acts = "";
    if (m.status === "pending") acts = '<button class="btn ok" data-a="approvef" data-id="' + esc(m.id) + '">✔ Approve & generate receipt</button><button class="btn bad" style="margin-top:8px" data-a="denyf" data-id="' + esc(m.id) + '">✖ Deny application</button>';
    else if (m.status === "denied") acts = '<div class="kv"><span>Reason</span><b>' + esc(m.denyReason || "—") + '</b></div><button class="btn sec" style="margin-top:8px" data-a="reopen" data-id="' + esc(m.id) + '">↩ Re-open application</button>';
    else acts = (G.num(m.due) > 0 ? '<button class="btn ok" style="margin-bottom:8px" data-a="duef" data-id="' + esc(m.id) + '">💰 Collect due fee (' + esc(G.money(m.due)) + ')</button>' : '') + '<button class="btn" data-a="renewf" data-id="' + esc(m.id) + '">💳 Collect fee / Renew</button><div class="row" style="margin-top:8px"><a class="btn sec" target="_blank" rel="noopener" href="' + esc(G.wa(m.phone, "Hello " + m.name + ", this is " + S.org.name + ".")) + '">WhatsApp</a><button class="btn sec" data-a="copy" data-v="' + esc(G.link("card.html", { o: S.orgId, m: m.id })) + '">Copy card link</button></div><h3>Payment history</h3><div id="hist" class="card mut">Loading…</div>';
    $("dbody").innerHTML = body + acts + '<button class="btn sec" style="margin-top:8px" data-a="prnt" data-id="' + esc(m.id) + '">🖨 Print admission form</button>';
    base().collection("files").doc(id).get().then(function (s) {
      var f = s.exists ? s.data() : {}, h = "";
      tplSlots().forEach(function (sl) { if (G.img(f[sl.key])) h += '<div class="slot"><div class="lbl" style="margin:0 0 6px">' + esc(sl.label) + (sl.key === "idFront" && f.idType ? " — " + esc(f.idType) : "") + '</div><img class="imgbox" src="' + f[sl.key] + '" alt=""></div>'; });
      if (G.img(f.payShot)) h += '<div class="slot"><div class="lbl" style="margin:0 0 6px">Payment screenshot' + (m.utr ? " — UTR " + esc(m.utr) : "") + '</div><img class="imgbox" src="' + f.payShot + '" alt=""></div>';
      if (G.img(f.sign)) h += '<div class="slot"><div class="lbl" style="margin:0 0 6px">Signature (' + esc(m.signName || "") + ')</div><img class="imgbox" style="background:#fff" src="' + f.sign + '" alt=""></div>';
      var el = $("dfiles"); if (el) { el.className = ""; el.innerHTML = h || '<p class="mut">No documents attached.</p>'; }
    }).catch(function () { var el = $("dfiles"); if (el) el.textContent = "Could not load documents."; });
    if (m.status === "active") base().collection("payments").where("memberId", "==", id).get().then(function (q) {
      var ps = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
      S.pays = ps; var el = $("hist"); if (!el) return; el.className = "card";
      el.innerHTML = ps.length ? ps.map(function (p) { return '<div class="li" data-a="rcpt" data-id="' + esc(p.id) + '"><div class="m"><b>' + esc(p.receiptNo) + " · " + G.money(p.amount) + "</b><small>" + esc(G.fmt(p.date) + " · " + p.mode + " · " + p.planName) + '</small></div><span class="chip">View</span></div>'; }).join("") : '<p class="mut">No payments recorded.</p>';
    });
  }
  function tplSlots() { return S.tpl.docSlots; }
  A.prnt = function (el) {
    var m = find(el.getAttribute("data-id")); if (!m) return;
    var b = el; b.disabled = true; var old = b.textContent; b.textContent = "Preparing form…";
    base().collection("files").doc(m.id).get().then(function (s) { return s.exists ? s.data() : {}; }, function () { return {}; }).then(function (f) {
      b.disabled = false; b.textContent = old; AF.open(S.org, S.tpl, m, f, S.ou && S.ou.name);
    });
  };

  /* ================= approve / deny ================= */
  function catName(id) { var c = (S.org.cats || []).filter(function (x) { return x.id === id; })[0]; return c ? c.name : ""; }
  function planOpts(sel) { return (S.org.plans || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? " selected" : "") + ">" + (p.cat && catName(p.cat) ? esc(catName(p.cat)) + " · " : "") + esc(p.name) + " — " + esc(G.money(p.price)) + "</option>"; }).join(""); }
  function extraRows(m) {
    var d = m.data || {}, r = [];
    if (d.catName) r.push(["Category", d.catName]);
    if (d.referredBy) r.push(["Referred by (mobile)", d.referredBy]);
    if (G.num(m.refCredit) > 0) r.push(["Referral credit available", G.money(m.refCredit)]);
    return r;
  }
  var MODES = ["Cash", "UPI", "Online / Card", "Bank Transfer", "Cheque"];
  function payFields(def) {
    return '<label>Payment mode</label><select id="pmode">' + MODES.map(function (x) { return "<option>" + x + "</option>"; }).join("") + '</select><label>Transaction ID / reference (if any)</label><input class="inp" id="putr" maxlength="30" value="' + esc(def.utr || "") + '"><div class="err" id="perr"></div>';
  }
  A.approvef = function (el) {
    var m = find(el.getAttribute("data-id")); if (!m) return;
    var plan = (S.org.plans || []).filter(function (p) { return p.id === m.planId; })[0] || (S.org.plans || [])[0];
    modal('<h2 style="margin-right:40px">Approve & receive fee</h2><p class="mut">' + esc(m.name) + '</p><label>' + esc(S.tpl.planLabel) + '</label><select id="pplan">' + planOpts(plan && plan.id) + '</select>' +
      '<label>Start date</label><input class="inp" type="date" id="pstart" value="' + esc(m.joinDate || G.today()) + '"><label>Amount received (₹)</label><input class="inp" type="number" id="pamt" min="0" value="' + esc(plan ? plan.price : m.planPrice) + '">' +
      '<div class="sub">Enter 0 to approve without payment — the fee will be marked as due.</div>' + payFields(m) + '<button class="btn ok" id="pgo" style="margin-top:12px" data-a="approve" data-id="' + esc(m.id) + '">Approve & generate receipt</button>');
    $("pplan").onchange = function () { var p = (S.org.plans || []).filter(function (x) { return x.id === $("pplan").value; })[0]; if (p) $("pamt").value = p.price; };
  };
  function readPay(m) {
    var plan = (S.org.plans || []).filter(function (p) { return p.id === $("pplan").value; })[0], amt = Number($("pamt").value), start = $("pstart") ? $("pstart").value : G.today();
    if (!plan) { $("perr").textContent = "Select a plan."; return null; }
    if (!G.parse(start)) { $("perr").textContent = "Choose a valid start date."; return null; }
    if (!isFinite(amt) || amt < 0 || amt > 10000000) { $("perr").textContent = "Enter a valid amount."; return null; }
    var cb = $("pcred"), credit = cb && cb.checked && m ? Math.min(G.num(m.refCredit), G.num(plan.price)) : 0;
    return { plan: plan, amount: Math.round(amt), start: start, mode: $("pmode").value, utr: $("putr").value.trim(), credit: credit };
  }
  function txFee(m, f, type) {
    var b = base(), mRef = b.collection("members").doc(m.id), cRef = b.collection("cards").doc(m.id), pRef = b.collection("payments").doc(), seq = b.collection("counters").doc("seq");
    var months = G.num(f.plan.months) || 1, expiry = G.endDate(f.start, months), out = {}, rf = S.org.referral || {}, ref = null;
    if (type === "admission" && rf.on && G.num(rf.amount) > 0 && m.data && m.data.referredBy) {
      ref = S.members.filter(function (x) { return x.status === "active" && x.id !== m.id && G.ph10(x.phone) === G.ph10(m.data.referredBy); })[0] || null;
    }
    return G.db.runTransaction(function (tx) {
      return tx.get(seq).then(function (sd) {
        return (ref ? tx.get(b.collection("members").doc(ref.id)) : Promise.resolve(null)).then(function (rd) {
          var q = sd.exists ? sd.data() : { member: 0, receipt: 0 }, isNew = type === "admission";
          var code = isNew ? (S.org.codePrefix || S.tpl.codePrefix) + G.pad(q.member + 1, 4) : m.code;
          var rno = f.amount > 0 ? (S.org.receiptPrefix || "RC") + "-" + G.pad(q.receipt + 1, 5) : "";
          var used = Math.max(0, Math.min(G.num(f.credit), G.num(m.refCredit)));
          tx.set(seq, { member: q.member + (isNew ? 1 : 0), receipt: q.receipt + (f.amount > 0 ? 1 : 0) });
          var mu = { status: "active", code: code, startDate: f.start, expiry: expiry, expiryTs: G.endTs(expiry), planId: f.plan.id, planName: f.plan.name, planPrice: G.num(f.plan.price), planMonths: months,
            paid: G.num(m.paid) + f.amount, due: Math.max(0, G.num(f.plan.price) - f.amount - used) };
          if (isNew) { mu.approvedDate = G.today(); mu.approvedBy = S.user.uid; mu.approvedByName = S.ou.name || ""; } else mu.lastRenewed = G.today();
          if (used > 0) mu.refCredit = G.num(m.refCredit) - used;
          tx.update(mRef, mu);
          var cu = { name: m.name, code: code, status: "active", planName: f.plan.name, batchName: m.batchName || "", expiry: expiry, expiryTs: G.endTs(expiry) };
          if (m.data && m.data.catId) cu.catId = m.data.catId;
          if (used > 0) cu.refCredit = mu.refCredit;
          if (f.thumb) cu.thumb = f.thumb;
          tx.set(cRef, cu, { merge: true });
          if (f.amount > 0) {
            var pay = { memberId: m.id, name: m.name, code: code, phone: m.phone, batchName: m.batchName || "", amount: f.amount, mode: f.mode, utr: f.utr, receiptNo: rno, type: type, planName: f.plan.name, from: f.start, to: expiry, date: G.today(), ts: G.FV.serverTimestamp(), by: S.user.uid, byName: S.ou.name || "Admin" };
            if (used > 0) pay.credit = used;
            tx.set(pRef, pay); out.pay = pay;
          }
          if (ref && rd && rd.exists) {
            var nc = G.num(rd.data().refCredit) + G.num(rf.amount);
            tx.update(b.collection("members").doc(ref.id), { refCredit: nc });
            tx.set(b.collection("cards").doc(ref.id), { refCredit: nc }, { merge: true });
            out.refName = ref.name;
          }
          out.code = code; out.expiry = expiry;
        });
      });
    }).then(function () { return out; });
  }
  A.approve = function (el) {
    var m = find(el.getAttribute("data-id")), f = readPay(m); if (!m || !f) return;
    var b = $("pgo"); b.disabled = true; b.textContent = "Please wait…";
    base().collection("files").doc(m.id).get().then(function (s) { return G.thumb(s.exists ? s.data().photo : "", 120, 0.6); }).then(function (th) { f.thumb = th; return txFee(m, f, "admission"); }).then(function (out) {
      G.toast("Approved — " + out.code);
      if (out.pay) showReceipt(out.pay, Object.assign({}, m, { code: out.code })); else closeModal();
    }).catch(function (e) { console.error(e); b.disabled = false; b.textContent = "Approve & generate receipt"; $("perr").textContent = G.firebaseError(e); });
  };
  A.denyf = function (el) {
    var id = el.getAttribute("data-id");
    modal('<h2 style="margin-right:40px">Deny application</h2><label>Reason (shown to the applicant)</label><textarea class="inp" id="dr" maxlength="200" placeholder="e.g. Documents unclear — please apply again"></textarea><div class="err" id="perr"></div><button class="btn bad" style="margin-top:10px" data-a="deny" data-id="' + esc(id) + '">Confirm denial</button>');
  };
  A.deny = function (el) {
    var id = el.getAttribute("data-id"), m = find(id), r = $("dr").value.trim(); if (!m) return;
    if (r.length < 3) { $("perr").textContent = "Please enter a reason."; return; }
    var b = base();
    Promise.all([b.collection("members").doc(id).update({ status: "denied", denyReason: r, deniedDate: G.today() }), b.collection("cards").doc(id).set({ name: m.name, status: "denied", reason: r })]).then(function () { G.toast("Application denied"); closeModal(); }).catch(function (e) { $("perr").textContent = G.firebaseError(e); });
  };
  A.reopen = function (el) {
    var id = el.getAttribute("data-id"), b = base();
    Promise.all([b.collection("members").doc(id).update({ status: "pending", denyReason: "" }), b.collection("cards").doc(id).delete()]).then(function () { G.toast("Re-opened"); closeModal(); });
  };

  /* ================= renew ================= */
  A.renewf = function (el) {
    var m = find(el.getAttribute("data-id")); if (!m) return;
    var start = G.daysLeft(m.expiry) != null && G.daysLeft(m.expiry) >= 0 ? G.addDays(m.expiry, 1) : G.today();
    var plan = (S.org.plans || []).filter(function (p) { return p.id === m.planId; })[0] || (S.org.plans || [])[0];
    modal('<h2 style="margin-right:40px">Collect fee / Renew</h2><p class="mut">' + esc(m.name) + " · valid till " + esc(G.fmt(m.expiry)) + '</p><label>' + esc(S.tpl.planLabel) + '</label><select id="pplan">' + planOpts(plan && plan.id) + '</select>' +
      '<label>New period starts</label><input class="inp" type="date" id="pstart" value="' + start + '"><label>Amount received (₹)</label><input class="inp" type="number" id="pamt" min="1" value="' + esc(plan ? Math.max(0, G.num(plan.price) - Math.min(G.num(m.refCredit), G.num(plan.price))) : "") + '">' + (G.num(m.refCredit) > 0 ? '<label class="chk" style="display:flex;gap:8px;align-items:center;color:var(--tx);margin-top:8px"><input type="checkbox" id="pcred" checked style="width:auto"> Use referral credit (' + esc(G.money(m.refCredit)) + " available)</label>" : "") + payFields({}) +
      '<button class="btn ok" id="pgo" style="margin-top:12px" data-a="renew" data-id="' + esc(m.id) + '">Receive fee & generate receipt</button>');
    function recalc() { var p = (S.org.plans || []).filter(function (x) { return x.id === $("pplan").value; })[0]; if (!p) return; var cb = $("pcred"); $("pamt").value = Math.max(0, G.num(p.price) - (cb && cb.checked ? Math.min(G.num(m.refCredit), G.num(p.price)) : 0)); }
    $("pplan").onchange = recalc; if ($("pcred")) $("pcred").onchange = recalc;
  };
  A.renew = function (el) {
    var m = find(el.getAttribute("data-id")), f = readPay(m); if (!m || !f) return;
    if (f.amount <= 0) { $("perr").textContent = "Enter the amount received."; return; }
    var b = $("pgo"); b.disabled = true; b.textContent = "Please wait…";
    txFee(m, f, "renewal").then(function (out) { G.toast("Fee received"); showReceipt(out.pay, Object.assign({}, m, { code: out.code })); }).catch(function (e) { b.disabled = false; b.textContent = "Receive fee & generate receipt"; $("perr").textContent = G.firebaseError(e); });
  };

  /* ================= receipts ================= */
  function showReceipt(p, m) {
    modal('<h2 style="margin-right:40px">Receipt ' + esc(p.receiptNo) + '</h2><div class="card ctr mut" id="rbox">Preparing receipt…</div><div id="racts"></div>');
    R.draw(S.org, p, m, S.tpl).then(function (c) {
      var box = $("rbox"); if (!box) return; box.className = ""; box.innerHTML = '<img class="imgbox" style="background:#fff;max-height:none" alt="Receipt" src="' + c.toDataURL("image/png") + '">';
      var txt = "Receipt " + p.receiptNo + " — ₹" + p.amount + " received from " + p.name + " for " + p.planName + ", valid " + G.fmt(p.from) + " to " + G.fmt(p.to) + ". Thank you — " + S.org.name;
      $("racts").innerHTML = '<div class="row" style="margin-top:10px"><button class="btn" id="rdl">⬇ Download</button><button class="btn sec" id="rpr">🖨 Print / PDF</button></div><a class="btn sec" style="margin-top:8px" target="_blank" rel="noopener" href="' + esc(G.wa(p.phone || m.phone, txt)) + '">Send on WhatsApp</a>';
      $("rdl").onclick = function () { R.download(c, "Receipt-" + p.receiptNo); }; $("rpr").onclick = function () { R.print(c); };
    });
  }
  A.rcpt = function (el) {
    var id = el.getAttribute("data-id"), p = S.pays.filter(function (x) { return x.id === id; })[0]; if (!p) return;
    var m = find(p.memberId) || { name: p.name, code: p.code, phone: p.phone, batchName: p.batchName };
    showReceipt(p, m);
  };
  /* ================= receipts & reports ================= */
  function rangePreset(k) { var t = G.today(); return k === "today" ? [t, t] : k === "7d" ? [shiftDay(t, -6), t] : k === "month" ? [t.slice(0, 8) + "01", t] : null; }
  A.rpre = function (el) { var k = el.getAttribute("data-v"), r = rangePreset(k); S.rp = k; if (r) { S.rf = r[0]; S.rt = r[1]; } receipts(); };
  function sumBy(ps, fn) { var o = {}; ps.forEach(function (p) { var k = fn(p) || "—"; o[k] = (o[k] || 0) + G.num(p.amount); }); return o; }
  function kvCard(title, o) { var ks = Object.keys(o).sort(function (a, b) { return o[b] - o[a]; }); return ks.length ? "<h3>" + esc(title) + '</h3><div class="card">' + ks.map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + G.money(o[k]) + "</b></div>"; }).join("") + "</div>" : ""; }
  function receipts() {
    var pk = S.rp || "today";
    var rq = S.reqs.length ? '<div class="card" style="border-color:var(--warn)"><h3 style="margin-top:0">Online payments awaiting confirmation (' + S.reqs.length + ')</h3>' + S.reqs.map(function (r) { return '<div class="li" data-a="reqopen" data-id="' + esc(r.id) + '"><div class="m"><b>' + esc(r.name) + " · " + G.money(r.amount) + "</b><small>" + esc((r.planName || "") + " · " + G.fmtTs(r.createdAt)) + '</small></div><span class="chip warn">Review</span></div>'; }).join("") + "</div>" : "";
    $("view").innerHTML = '<h2>Receipts & reports</h2>' + rq + '<div class="pill">' + [["today", "Today"], ["7d", "7 days"], ["month", "This month"], ["custom", "Custom"]].map(function (x) { return '<button data-a="rpre" data-v="' + x[0] + '" class="' + (pk === x[0] ? "on" : "") + '">' + x[1] + "</button>"; }).join("") + '</div>' +
      '<div class="card"><div class="grid2"><div><label>From</label><input class="inp" type="date" id="rf" value="' + S.rf + '"></div><div><label>To</label><input class="inp" type="date" id="rt" value="' + S.rt + '"></div></div></div><div id="rsum"></div><div id="rlist" class="card mut">Loading…</div>';
    $("rf").onchange = $("rt").onchange = function () { S.rf = $("rf").value; S.rt = $("rt").value; S.rp = "custom"; receipts(); };
    if (!G.parse(S.rf) || !G.parse(S.rt)) return;
    base().collection("payments").where("date", ">=", S.rf).where("date", "<=", S.rt).get().then(function (q) {
      var ps = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return String(b.receiptNo).localeCompare(String(a.receiptNo)); });
      S.pays = ps; var el = $("rlist"); if (!el) return; el.className = "card";
      var tot = ps.reduce(function (s, p) { return s + G.num(p.amount); }, 0);
      var cnt = function (t) { return ps.filter(function (p) { return p.type === t; }).length; };
      var perDay = sumBy(ps, function (p) { return p.date; }), days = [], vals = [], i, s = S.rt;
      for (i = 0; i < 31 && s >= S.rf; i++) { days.unshift(s); vals.unshift(perDay[s] || 0); s = shiftDay(s, -1); }
      var sm = $("rsum");
      if (sm) sm.innerHTML = '<div class="grid2">' + statTile(G.money(tot), "Collected", "ok") + statTile(ps.length, "Receipts") + statTile(cnt("admission"), "New admissions") + statTile(cnt("renewal") + cnt("due"), "Renewals / dues paid") + "</div>" +
        (days.length > 1 ? '<h3>Collection per day</h3><div class="card">' + barChart(days, vals) + "</div>" : "") +
        kvCard("By payment mode", sumBy(ps, function (p) { return p.mode; })) + kvCard("By staff", sumBy(ps, function (p) { return p.byName; })) + kvCard("By plan", sumBy(ps, function (p) { return p.planName; })) +
        (ps.length ? '<button class="btn sec" style="margin:10px 0" data-a="csvpay">⬇ Download this report (Excel / CSV)</button>' : "") + "<h3>Receipts</h3>";
      el.innerHTML = '<div class="kv"><span>' + ps.length + " receipts</span><b>" + G.money(tot) + "</b></div>" + (ps.length ? ps.map(function (p) { return '<div class="li" data-a="rcpt" data-id="' + esc(p.id) + '"><div class="m"><b>' + esc(p.name) + "</b><small>" + esc(p.receiptNo + " · " + G.fmt(p.date) + " · " + p.mode + " · " + (p.byName || "")) + "</small></div><b>" + G.money(p.amount) + "</b></div>"; }).join("") : '<p class="mut ctr">No receipts in this period.</p>');
    }).catch(function () { var el = $("rlist"); if (el) el.textContent = "Could not load receipts."; });
  }

  /* ================= export / backup ================= */
  function cell(c) { c = c == null ? "" : String(c); if (/^[=+\-@\t\r]/.test(c) && isNaN(Number(c))) c = "'" + c; return /[",\r\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }
  function toCsv(rows) { return rows.map(function (r) { return r.map(cell).join(","); }).join("\r\n"); }
  function download(name, text, type) {
    var u = URL.createObjectURL(new Blob(["﻿" + text], { type: type || "text/csv;charset=utf-8" })), a = document.createElement("a");
    a.href = u; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 800);
  }
  function payRows(ps) {
    return [["Receipt", "Date", "Name", "ID", "Mobile", "Plan", "Type", "Mode", "UTR / ref", "Amount", "Period from", "Period to", "Received by"]].concat(ps.slice().sort(function (a, b) { return String(a.receiptNo).localeCompare(String(b.receiptNo)); }).map(function (p) {
      return [p.receiptNo, p.date, p.name, p.code, p.phone, p.planName, p.type, p.mode, p.utr, p.amount, p.from, p.to, p.byName];
    }));
  }
  A.csvpay = function () { download("report-" + S.rf + "_to_" + S.rt + ".csv", toCsv(payRows(S.pays || []))); };
  A.expmem = function () {
    var keys = [], seen = {};
    S.members.forEach(function (m) { Object.keys(m.data || {}).forEach(function (k) { if (!seen[k]) { seen[k] = 1; keys.push(k); } }); });
    var head = ["ID", "Name", "Mobile", "Status", S.tpl.planLabel, S.tpl.groupLabel, "Joined", "Valid from", "Valid till", "Total paid", "Fee due"].concat(keys);
    var rows = S.members.slice().sort(function (a, b) { return String(a.code).localeCompare(String(b.code)); }).map(function (m) {
      var d = m.data || {};
      return [m.code, m.name, m.phone, m.status, m.planName, m.batchName, m.joinDate, m.startDate, m.expiry, m.paid, m.due].concat(keys.map(function (k) { return Array.isArray(d[k]) ? d[k].join("; ") : (typeof d[k] === "object" && d[k] ? JSON.stringify(d[k]) : d[k]); }));
    });
    download("members-" + G.today() + ".csv", toCsv([head].concat(rows))); G.toast("Members file downloaded");
  };
  A.exppay = function () { base().collection("payments").get().then(function (q) { download("all-payments-" + G.today() + ".csv", toCsv(payRows(q.docs.map(function (d) { return d.data(); })))); G.toast("Payments file downloaded"); }).catch(function (e) { G.toast(G.firebaseError(e)); }); };
  A.expjson = function () {
    base().collection("payments").get().then(function (q) {
      var o = { app: G.app && G.app.name, exportedOn: G.today(), orgId: S.orgId, org: S.org, members: S.members, payments: q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }), note: "Photos / ID documents are not included in this file." };
      download("backup-" + S.orgId + "-" + G.today() + ".json", JSON.stringify(o), "application/json"); G.toast("Backup downloaded");
    }).catch(function (e) { G.toast(G.firebaseError(e)); });
  };

  /* ================= online payment requests (member Pay page) ================= */
  A.reqopen = function (el) {
    var r = S.reqs.filter(function (x) { return x.id === el.getAttribute("data-id"); })[0]; if (!r) return;
    var m = find(r.memberId);
    modal('<h2 style="margin-right:40px">Confirm online payment</h2>' + kvSheet("Request", [["Name", r.name], ["ID", r.code || (m && m.code) || "—"], [S.tpl.planLabel, r.planName || "—"], ["Amount to receive", G.money(r.amount)], ["Referral credit used", G.money(r.credit || 0)], ["UTR / reference", r.utr || "—"], ["Sent", G.fmtTs(r.createdAt)]]) +
      '<div class="card ctr mut" id="rshot">' + (r.hasShot ? "Loading screenshot…" : "No screenshot attached.") + '</div><div class="sub">Check the amount and UTR in your bank/UPI app before confirming.</div><div class="err" id="perr"></div>' +
      '<button class="btn ok" id="pgo" style="margin-top:10px" data-a="reqok" data-id="' + esc(r.id) + '">✔ Payment received — confirm & make receipt</button><button class="btn bad" style="margin-top:8px" data-a="reqno" data-id="' + esc(r.id) + '">✖ Not received — reject</button>');
    if (r.hasShot) base().collection("payfiles").doc(r.id).get().then(function (s) { var b = $("rshot"); if (!b) return; var u = s.exists ? s.data().shot : ""; if (G.img(u)) { b.className = ""; b.innerHTML = '<img class="imgbox" src="' + u + '" alt="Payment screenshot">'; } else b.textContent = "Screenshot could not be loaded."; });
  };
  A.reqok = function (el) {
    var r = S.reqs.filter(function (x) { return x.id === el.getAttribute("data-id"); })[0], m = r && find(r.memberId), plan = r && (S.org.plans || []).filter(function (p) { return p.id === r.planId; })[0];
    if (!r || !m) return; if (!plan) { $("perr").textContent = "This plan no longer exists in Settings."; return; }
    var b = $("pgo"); b.disabled = true; b.textContent = "Please wait…";
    var start = G.daysLeft(m.expiry) != null && G.daysLeft(m.expiry) >= 0 ? G.addDays(m.expiry, 1) : G.today();
    txFee(m, { plan: plan, amount: Math.round(G.num(r.amount)), start: start, mode: "UPI", utr: r.utr || "", credit: G.num(r.credit) }, "renewal").then(function (out) {
      return base().collection("payreqs").doc(r.id).update({ status: "confirmed", confirmedDate: G.today(), receiptNo: out.pay ? out.pay.receiptNo : "" }).then(function () { return out; });
    }).then(function (out) { G.toast("Payment confirmed"); if (out.pay) showReceipt(out.pay, Object.assign({}, m, { code: out.code })); else closeModal(); })
      .catch(function (e) { console.error(e); b.disabled = false; b.textContent = "✔ Payment received — confirm & make receipt"; $("perr").textContent = G.firebaseError(e); });
  };
  A.reqno = function (el) {
    var id = el.getAttribute("data-id");
    base().collection("payreqs").doc(id).update({ status: "rejected", rejectedDate: G.today() }).then(function () { G.toast("Rejected"); closeModal(); }).catch(function (e) { $("perr").textContent = G.firebaseError(e); });
  };

  /* ================= settings ================= */
  function settings() {
    var o = S.org, t = S.tpl, join = G.link("join.html", { o: S.orgId });
    var h = "<h2>Settings</h2>" +
      '<div class="card"><h3 style="margin-top:0">Organisation profile</h3><label>Name</label><input class="inp" id="sn" maxlength="80" value="' + esc(o.name) + '"><label>Phone</label><input class="inp" id="sp" type="tel" maxlength="10" value="' + esc(o.phone) + '"><label>Address</label><textarea class="inp" id="sa" maxlength="200">' + esc(o.address) + '</textarea><label>UPI ID</label><input class="inp" id="su" maxlength="60" value="' + esc(o.upiId || "") + '"><div class="grid2"><div><label>Brand colour</label><input class="inp" id="sc" type="color" value="' + esc(o.color || "#ffcc00") + '" style="padding:4px;height:44px"></div><div><label>Receipt prefix</label><input class="inp" id="sr" maxlength="5" value="' + esc(o.receiptPrefix || "RC") + '"></div></div><label>Logo</label><input class="inp" type="file" id="sl" accept="image/*"><label>Owner stamp / signature (printed on admission form, optional)</label><input class="inp" type="file" id="sst" accept="image/*"><label>Notice shown on member cards</label><textarea class="inp" id="sno" maxlength="300" placeholder="e.g. Gym closed on Sunday">' + esc(o.notice || "") + "</textarea></div>" +
      '<div class="card"><h3 style="margin-top:0">' + esc(t.planLabel) + 's</h3><div id="splans">' + (o.plans || []).map(planRow).join("") + '</div><button class="btn sec sm" data-a="addp">+ Add plan</button></div>' +
      '<div class="card"><h3 style="margin-top:0">Member categories <span class="sub">(optional)</span></h3><div class="sub" style="margin-bottom:8px">Example: Student, Job seeker, Job / Business. Each plan can then be assigned to one category, and applicants only see plans of their category. Save once after adding categories, then assign them to plans above.</div><div id="scats">' + (o.cats || []).map(catRow).join("") + '</div><button class="btn sec sm" data-a="addc">+ Add category</button></div>' +
      '<div class="card"><h3 style="margin-top:0">Referral credit <span class="sub">(optional)</span></h3><label class="chk" style="display:flex;gap:8px;align-items:center;color:var(--tx)"><input type="checkbox" id="sref" style="width:auto"' + (o.referral && o.referral.on ? " checked" : "") + '> When a member refers a new member, give the referrer fee credit</label><label>Credit per referral (₹)</label><input class="inp" id="srefamt" type="number" min="1" value="' + esc(o.referral && o.referral.amount || "") + '"><div class="sub">The credit is added when the referred member is approved, and is used automatically on the referrer\'s next fee payment.</div></div>' +
      '<div class="card"><h3 style="margin-top:0">' + esc(t.groupsLabel) + '</h3><div id="sgroups">' + (o.groups || []).map(groupRow).join("") + '</div><button class="btn sec sm" data-a="addg">+ Add ' + esc(t.groupLabel.toLowerCase()) + '</button>' + (t.id === "gym" ? ' <button class="btn sec sm" data-a="addslots">+ Add standard 30-minute slots</button><div class="sub" style="margin-top:6px">Morning 05:00–11:00 AM and evening 04:00–11:00 PM, one batch per 30 minutes. Existing batches are kept; you can delete the ones you do not run.</div>' : "") + '</div>' +
      '<div class="card"><h3 style="margin-top:0">Terms & conditions (version ' + (o.termsVersion || 1) + ')</h3><textarea class="inp" id="st" style="min-height:260px" maxlength="6000">' + esc(o.terms) + '</textarea><div class="sub">Saving changed terms creates a new version. Earlier applications keep the version they accepted.</div></div>' +
      '<div class="card"><h3 style="margin-top:0">Printed form — legal declaration <span class="sub">(optional)</span></h3><label>Legal warning line (bold)</label><input class="inp" id="slegal" maxlength="200" value="' + esc(o.legalNote || "") + '" placeholder="e.g. सत्यता: गलत जानकारी मिलने पर सदस्यता रद्द होगी"><label>Declaration text (printed above the member\'s signature on page 2)</label><textarea class="inp" id="sdecl" maxlength="600" placeholder="Leave empty to use the standard declaration">' + esc(o.declaration || "") + '</textarea></div>' +
      '<div class="err" id="serr"></div><button class="btn ok" data-a="saveset">Save settings</button>' +
            '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Backup & export</h3><div class="sub" style="margin-bottom:8px">Your data is always yours. Download it any time — opens in Excel.</div><button class="btn sec" style="margin-bottom:8px" data-a="expmem">⬇ ' + esc(t.membersWord) + ' list (Excel)</button><button class="btn sec" style="margin-bottom:8px" data-a="exppay">⬇ All payments (Excel)</button><button class="btn sec" data-a="expjson">⬇ Full backup (JSON)</button></div>' +
      '<div class="card"><h3 style="margin-top:0">Help & support</h3><div class="sub" style="margin-bottom:8px">Stuck on something? Message us on WhatsApp — we reply personally.</div><a class="btn sec" target="_blank" rel="noopener" href="' + esc("https://wa.me/" + SUPPORT_WA + "?text=" + encodeURIComponent("Hello, I need help with " + (G.app && G.app.name || "OrgDesk") + " (" + o.name + ", ID " + S.orgId + ")")) + '">💬 WhatsApp support</a></div>' +
      '<div class="card"><h3 style="margin-top:0">Links</h3><div class="kv"><span>Admission form</span><button class="btn sec sm" data-a="copy" data-v="' + esc(join) + '">Copy</button></div></div>' +
      '<button class="btn bad" style="margin-top:6px" data-a="logout">Sign out</button><p class="ctr mut" style="margin:14px 0">' + esc(G.app.name) + " · Organisation ID: " + esc(S.orgId) + "</p>";
    $("view").innerHTML = h;
  }
  function planRow(p) {
    var cs = S.org.cats || [], sel = cs.length ? '<select class="inp" data-k="cat" style="grid-column:1/-1"><option value="">All categories</option>' + cs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === p.cat ? " selected" : "") + ">" + esc(c.name) + " only</option>"; }).join("") + "</select>" : "";
    return '<div class="trow" data-id="' + esc(p.id || "") + '"><input class="inp" data-k="name" value="' + esc(p.name) + '" maxlength="60"><input class="inp" data-k="months" type="number" min="1" value="' + esc(p.months) + '"><input class="inp" data-k="price" type="number" min="0" value="' + esc(p.price) + '"><button class="xbtn" data-a="delrow">×</button>' + sel + "</div>";
  }
  function catRow(c) { return '<div class="trow g" data-id="' + esc(c.id || "") + '"><input class="inp" data-k="name" value="' + esc(c.name) + '" maxlength="40" placeholder="Category name"><input class="inp" data-k="note" value="' + esc(c.note || "") + '" maxlength="160" placeholder="Note shown to applicant (optional)"><button class="xbtn" data-a="delrow">×</button></div>'; }
  A.addc = function () { $("scats").insertAdjacentHTML("beforeend", catRow({ name: "", note: "" })); };
  function groupRow(g) { return '<div class="trow g" data-id="' + esc(g.id || "") + '"><input class="inp" data-k="name" value="' + esc(g.name) + '" maxlength="60"><input class="inp" data-k="time" value="' + esc(g.time || "") + '" maxlength="40" placeholder="Timing (optional)"><button class="xbtn" data-a="delrow">×</button></div>'; }
  A.addp = function () { $("splans").insertAdjacentHTML("beforeend", planRow({ name: "", months: 1, price: "" })); };
  A.addslots = function () {
    var have = {}; rows("sgroups").forEach(function (g) { have[g.name] = 1; });
    var add = (window.ORG_GYM_SLOTS ? window.ORG_GYM_SLOTS() : []).filter(function (s) { return !have[s.name]; });
    add.forEach(function (s) { $("sgroups").insertAdjacentHTML("beforeend", groupRow(s)); });
    G.toast(add.length ? add.length + " slots added — press Save settings" : "All standard slots already exist");
  };
  A.addg = function () { $("sgroups").insertAdjacentHTML("beforeend", groupRow({ name: "", time: "" })); };
  A.delrow = function (el) { el.parentNode.remove(); };
  function rows(id) { return [].map.call($(id).children, function (r) { var o = { id: r.getAttribute("data-id") || G.rid(6) }; [].forEach.call(r.querySelectorAll("[data-k]"), function (i) { o[i.getAttribute("data-k")] = i.value.trim(); }); return o; }); }
  A.saveset = function () {
    var e = $("serr"); e.textContent = "";
    var plans = rows("splans"), groups = rows("sgroups"), terms = $("st").value.trim();
    var cats = rows("scats").filter(function (c) { return c.name; }); cats.forEach(function (c) { if (!c.note) delete c.note; });
    var refOn = $("sref").checked, refAmt = Math.round(Number($("srefamt").value));
    if (refOn && !(refAmt >= 1)) { e.textContent = "Enter the referral credit amount, or switch referral off."; return; }
    if ($("sn").value.trim().length < 3) { e.textContent = "Enter the organisation name."; return; }
    if (!/^[6-9]\d{9}$/.test($("sp").value.trim())) { e.textContent = "Enter a valid 10-digit phone number."; return; }
    if (!plans.length) { e.textContent = "Keep at least one plan."; return; }
    for (var i = 0; i < plans.length; i++) { var p = plans[i]; p.months = Math.round(Number(p.months)); p.price = Number(p.price); if (!p.cat || !cats.some(function (c) { return c.id === p.cat; })) delete p.cat; if (!p.name || !(p.months >= 1) || !(p.price > 0)) { e.textContent = "Each plan needs a name, months and a fee above zero."; return; } }
    for (var j = 0; j < groups.length; j++) { if (!groups[j].name) { e.textContent = "Each " + S.tpl.groupLabel.toLowerCase() + " needs a name."; return; } if (!groups[j].time) delete groups[j].time; }
    if (terms.length < 20) { e.textContent = "Terms cannot be empty."; return; }
    var upd = { name: $("sn").value.trim(), phone: $("sp").value.trim(), address: $("sa").value.trim(), upiId: $("su").value.trim(), color: $("sc").value, receiptPrefix: ($("sr").value.trim() || "RC").toUpperCase(), notice: $("sno").value.trim(), plans: plans, groups: groups, terms: terms, legalNote: $("slegal").value.trim(), declaration: $("sdecl").value.trim(), cats: cats, referral: { on: refOn, amount: refOn ? refAmt : 0 } };
    if (terms !== S.org.terms) upd.termsVersion = (S.org.termsVersion || 1) + 1;
    var lf = $("sl").files && $("sl").files[0], sf = $("sst").files && $("sst").files[0];
    var go = function (logo) { if (logo) upd.logo = logo; return (sf ? G.compress(sf, 300, 300, 40000) : Promise.resolve("")).then(function (st) { if (st) upd.stamp = st; return base().update(upd).then(function () { Object.assign(S.org, upd); G.theme(S.org); G.toast("Settings saved"); shell(); S.tab = "set"; render(); }); }); };
    (lf ? G.compress(lf, 200, 200, 40000) : Promise.resolve("")).then(go).catch(function (er) { e.textContent = G.firebaseError(er); });
  };

  /* ================= global actions ================= */
  A.tab = function (el) { S.tab = el.getAttribute("data-v"); S.q = ""; S.filter = ""; if (S.tab === "adm") S.filter = "pending"; if (S.tab === "mem") S.filter = "all"; render(); window.scrollTo(0, 0); };
  A.filter = function (el) { S.filter = el.getAttribute("data-v"); render(); };
  A.open = function (el) { openMember(el.getAttribute("data-id")); };
  A.close = closeModal;
  A.mbg = function (el, ev) { if (ev.target === el) closeModal(); };
  A.copy = function (el) { var v = el.getAttribute("data-v"); try { navigator.clipboard.writeText(v); G.toast("Copied"); } catch (e) { prompt("Copy:", v); } };
  A.logout = function () { G.auth.signOut(); };
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-a]"); if (!el) return;
    var f = A[el.getAttribute("data-a")]; if (f) f(el, ev);
  });
  G.pwa();
})();
