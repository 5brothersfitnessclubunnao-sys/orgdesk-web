/* Admin panel — sign in, dashboard, admissions desk, members, receipts, settings. */
(function () {
  "use strict";
  if (!window.G || !G.ok) return;
  var S = { tab: "home", members: [], todayPay: [], q: "", filter: "", rf: G.today(), rt: G.today(), pays: [] }, A = {};
  var app = document.getElementById("app"), esc = G.esc;
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
        unsubs.push(base().collection("payments").where("date", "==", G.today()).onSnapshot(function (q) { S.todayPay = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }); render(true); }));
      });
    }).catch(function () { app.innerHTML = '<div class="wrap"><div class="card ctr"><h2>Unable to load</h2><p class="mut">Please check your connection and reload.</p></div></div>'; });
  }
  G.auth.onAuthStateChanged(boot);

  /* ================= shell ================= */
  var TABS = [["home", "🏠", "Home"], ["adm", "📝", "Admissions"], ["mem", "👥", "Members"], ["rec", "🧾", "Receipts"], ["set", "⚙️", "Settings"]];
  function shell() {
    app.innerHTML = '<div class="top"><img id="tl" class="logo hide" alt=""><b>' + esc(S.org.name) + '</b><span class="chip">' + esc(S.tpl.name) + '</span></div><div class="wrap" id="view"></div><div class="tabs" id="tabs"></div><div id="mroot"></div>';
    if (G.img(S.org.logo)) { $("tl").src = S.org.logo; $("tl").classList.remove("hide"); }
    drawTabs(); render();
  }
  function pendingCount() { return S.members.filter(function (m) { return m.status === "pending"; }).length; }
  function drawTabs() {
    var pc = pendingCount();
    $("tabs").innerHTML = TABS.map(function (t) { return '<button data-a="tab" data-v="' + t[0] + '" class="' + (S.tab === t[0] ? "on" : "") + '"><i>' + t[1] + "</i>" + t[2] + (t[0] === "adm" && pc ? ' <span class="chip warn">' + pc + "</span>" : "") + "</button>"; }).join("");
  }
  var rt;
  function render(soft) {
    if (!$("view")) return;
    drawTabs();
    if (soft && (S.tab === "set" || S.typing)) return;                // never wipe a form the user is editing
    clearTimeout(rt); rt = setTimeout(function () { var f = { home: home, adm: admissions, mem: members, rec: receipts, set: settings }[S.tab]; f(); }, 30);
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

  /* ================= home ================= */
  function home() {
    var ms = S.members, st = { active: 0, expiring: 0, expired: 0, pending: 0 };
    ms.forEach(function (m) { var s = mstate(m); if (st[s] !== undefined) st[s]++; });
    var tp = S.todayPay, tot = 0, by = {}, mode = {};
    tp.forEach(function (p) { tot += G.num(p.amount); by[p.byName || "Staff"] = (by[p.byName || "Staff"] || 0) + G.num(p.amount); mode[p.mode] = (mode[p.mode] || 0) + G.num(p.amount); });
    var adToday = ms.filter(function (m) { return m.approvedDate === G.today(); }).length;
    var join = G.link("join.html", { o: S.orgId });
    function tile(n, l, c) { return '<div class="stat ' + (c || "") + '"><b>' + n + "</b><span>" + l + "</span></div>"; }
    var h = '<h2>Today at a glance</h2><div class="grid2">' + tile(st.active + st.expiring, "Active " + S.tpl.membersWord.toLowerCase(), "ok") + tile(st.pending, "Applications awaiting verification", st.pending ? "warn" : "") +
      tile(st.expiring, "Expiring within 7 days", "warn") + tile(st.expired, "Expired", "bad") + tile(adToday, "Admissions today") + tile(G.money(tot), "Fees collected today") + "</div>";
    h += '<h3>Collection by staff (today)</h3><div class="card">' + (Object.keys(by).length ? Object.keys(by).map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + G.money(by[k]) + "</b></div>"; }).join("") : '<p class="mut">No collection recorded yet today.</p>') + "</div>";
    if (Object.keys(mode).length) h += '<div class="card">' + Object.keys(mode).map(function (k) { return '<div class="kv"><span>' + esc(k) + "</span><b>" + G.money(mode[k]) + "</b></div>"; }).join("") + "</div>";
    h += '<h3>Admission link</h3><div class="card"><div class="ro" style="word-break:break-all;font-size:13px">' + esc(join) + '</div><div class="row" style="margin-top:8px"><button class="btn sec" data-a="copy" data-v="' + esc(join) + '">Copy link</button><a class="btn sec" target="_blank" rel="noopener" href="' + esc("https://wa.me/?text=" + encodeURIComponent("Apply for admission at " + S.org.name + ": " + join)) + '">Share on WhatsApp</a></div></div>';
    $("view").innerHTML = h;
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
    body += kvSheet("Membership", [[S.tpl.planLabel, m.planName || "—"], [S.tpl.groupLabel, m.batchName || "—"], ["Joining date", G.fmt(m.joinDate)]].concat(m.status === "active" ? [["Valid from", G.fmt(m.startDate)], ["Valid till", G.fmt(m.expiry)], ["Total paid", G.money(m.paid)], ["Fee due", G.money(m.due)]] : [["Plan fee", G.money(m.planPrice)], ["Applied on", G.fmtTs(m.createdAt)], ["UTR given", m.utr || "—"]]));
    OF.sections(S.tpl, m).forEach(function (s) { body += kvSheet(s.title, s.rows); });
    var acts = "";
    if (m.status === "pending") acts = '<button class="btn ok" data-a="approvef" data-id="' + esc(m.id) + '">✔ Approve & generate receipt</button><button class="btn bad" style="margin-top:8px" data-a="denyf" data-id="' + esc(m.id) + '">✖ Deny application</button>';
    else if (m.status === "denied") acts = '<div class="kv"><span>Reason</span><b>' + esc(m.denyReason || "—") + '</b></div><button class="btn sec" style="margin-top:8px" data-a="reopen" data-id="' + esc(m.id) + '">↩ Re-open application</button>';
    else acts = '<button class="btn" data-a="renewf" data-id="' + esc(m.id) + '">💳 Collect fee / Renew</button><div class="row" style="margin-top:8px"><a class="btn sec" target="_blank" rel="noopener" href="' + esc(G.wa(m.phone, "Hello " + m.name + ", this is " + S.org.name + ".")) + '">WhatsApp</a><button class="btn sec" data-a="copy" data-v="' + esc(G.link("card.html", { o: S.orgId, m: m.id })) + '">Copy card link</button></div><h3>Payment history</h3><div id="hist" class="card mut">Loading…</div>';
    $("dbody").innerHTML = body + acts;
    base().collection("files").doc(id).get().then(function (s) {
      var f = s.exists ? s.data() : {}, h = "";
      tplSlots().forEach(function (sl) { if (G.img(f[sl.key])) h += '<div class="slot"><div class="lbl" style="margin:0 0 6px">' + esc(sl.label) + (sl.key === "idFront" && f.idType ? " — " + esc(f.idType) : "") + '</div><img class="imgbox" src="' + f[sl.key] + '" alt=""></div>'; });
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

  /* ================= approve / deny ================= */
  function planOpts(sel) { return (S.org.plans || []).map(function (p) { return '<option value="' + esc(p.id) + '"' + (p.id === sel ? " selected" : "") + ">" + esc(p.name) + " — " + esc(G.money(p.price)) + "</option>"; }).join(""); }
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
  function readPay() {
    var plan = (S.org.plans || []).filter(function (p) { return p.id === $("pplan").value; })[0], amt = Number($("pamt").value), start = $("pstart") ? $("pstart").value : G.today();
    if (!plan) { $("perr").textContent = "Select a plan."; return null; }
    if (!G.parse(start)) { $("perr").textContent = "Choose a valid start date."; return null; }
    if (!isFinite(amt) || amt < 0 || amt > 10000000) { $("perr").textContent = "Enter a valid amount."; return null; }
    return { plan: plan, amount: Math.round(amt), start: start, mode: $("pmode").value, utr: $("putr").value.trim() };
  }
  function txFee(m, f, type) {
    var b = base(), mRef = b.collection("members").doc(m.id), cRef = b.collection("cards").doc(m.id), pRef = b.collection("payments").doc(), seq = b.collection("counters").doc("seq");
    var months = G.num(f.plan.months) || 1, expiry = G.endDate(f.start, months), out = {};
    return G.db.runTransaction(function (tx) {
      return tx.get(seq).then(function (sd) {
        var q = sd.exists ? sd.data() : { member: 0, receipt: 0 }, isNew = type === "admission";
        var code = isNew ? (S.org.codePrefix || S.tpl.codePrefix) + G.pad(q.member + 1, 4) : m.code;
        var rno = f.amount > 0 ? (S.org.receiptPrefix || "RC") + "-" + G.pad(q.receipt + 1, 5) : "";
        tx.set(seq, { member: q.member + (isNew ? 1 : 0), receipt: q.receipt + (f.amount > 0 ? 1 : 0) });
        var mu = { status: "active", code: code, startDate: f.start, expiry: expiry, expiryTs: G.endTs(expiry), planId: f.plan.id, planName: f.plan.name, planPrice: G.num(f.plan.price), planMonths: months,
          paid: G.num(m.paid) + f.amount, due: Math.max(0, G.num(f.plan.price) - f.amount) };
        if (isNew) { mu.approvedDate = G.today(); mu.approvedBy = S.user.uid; mu.approvedByName = S.ou.name || ""; } else mu.lastRenewed = G.today();
        tx.update(mRef, mu);
        var cu = { name: m.name, code: code, status: "active", planName: f.plan.name, batchName: m.batchName || "", expiry: expiry, expiryTs: G.endTs(expiry) };
        if (f.thumb) cu.thumb = f.thumb;
        tx.set(cRef, cu, { merge: true });
        if (f.amount > 0) {
          var pay = { memberId: m.id, name: m.name, code: code, phone: m.phone, batchName: m.batchName || "", amount: f.amount, mode: f.mode, utr: f.utr, receiptNo: rno, type: type, planName: f.plan.name, from: f.start, to: expiry, date: G.today(), ts: G.FV.serverTimestamp(), by: S.user.uid, byName: S.ou.name || "Admin" };
          tx.set(pRef, pay); out.pay = pay;
        }
        out.code = code; out.expiry = expiry;
      });
    }).then(function () { return out; });
  }
  A.approve = function (el) {
    var m = find(el.getAttribute("data-id")), f = readPay(); if (!m || !f) return;
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
      '<label>New period starts</label><input class="inp" type="date" id="pstart" value="' + start + '"><label>Amount received (₹)</label><input class="inp" type="number" id="pamt" min="1" value="' + esc(plan ? plan.price : "") + '">' + payFields({}) +
      '<button class="btn ok" id="pgo" style="margin-top:12px" data-a="renew" data-id="' + esc(m.id) + '">Receive fee & generate receipt</button>');
    $("pplan").onchange = function () { var p = (S.org.plans || []).filter(function (x) { return x.id === $("pplan").value; })[0]; if (p) $("pamt").value = p.price; };
  };
  A.renew = function (el) {
    var m = find(el.getAttribute("data-id")), f = readPay(); if (!m || !f) return;
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
  function receipts() {
    $("view").innerHTML = '<h2>Receipts & collection</h2><div class="card"><div class="grid2"><div><label>From</label><input class="inp" type="date" id="rf" value="' + S.rf + '"></div><div><label>To</label><input class="inp" type="date" id="rt" value="' + S.rt + '"></div></div></div><div id="rlist" class="card mut">Loading…</div>';
    $("rf").onchange = $("rt").onchange = function () { S.rf = $("rf").value; S.rt = $("rt").value; receipts(); };
    if (!G.parse(S.rf) || !G.parse(S.rt)) return;
    base().collection("payments").where("date", ">=", S.rf).where("date", "<=", S.rt).get().then(function (q) {
      var ps = q.docs.map(function (d) { return Object.assign({ id: d.id }, d.data()); }).sort(function (a, b) { return String(b.receiptNo).localeCompare(String(a.receiptNo)); });
      S.pays = ps; var el = $("rlist"); if (!el) return; el.className = "card";
      var tot = ps.reduce(function (s, p) { return s + G.num(p.amount); }, 0);
      el.innerHTML = '<div class="kv"><span>' + ps.length + " receipts</span><b>" + G.money(tot) + "</b></div>" + (ps.length ? ps.map(function (p) { return '<div class="li" data-a="rcpt" data-id="' + esc(p.id) + '"><div class="m"><b>' + esc(p.name) + "</b><small>" + esc(p.receiptNo + " · " + G.fmt(p.date) + " · " + p.mode + " · " + (p.byName || "")) + "</small></div><b>" + G.money(p.amount) + "</b></div>"; }).join("") : '<p class="mut ctr">No receipts in this period.</p>');
    }).catch(function () { var el = $("rlist"); if (el) el.textContent = "Could not load receipts."; });
  }

  /* ================= settings ================= */
  function settings() {
    var o = S.org, t = S.tpl, join = G.link("join.html", { o: S.orgId });
    var h = "<h2>Settings</h2>" +
      '<div class="card"><h3 style="margin-top:0">Organisation profile</h3><label>Name</label><input class="inp" id="sn" maxlength="80" value="' + esc(o.name) + '"><label>Phone</label><input class="inp" id="sp" type="tel" maxlength="10" value="' + esc(o.phone) + '"><label>Address</label><textarea class="inp" id="sa" maxlength="200">' + esc(o.address) + '</textarea><label>UPI ID</label><input class="inp" id="su" maxlength="60" value="' + esc(o.upiId || "") + '"><div class="grid2"><div><label>Brand colour</label><input class="inp" id="sc" type="color" value="' + esc(o.color || "#ffcc00") + '" style="padding:4px;height:44px"></div><div><label>Receipt prefix</label><input class="inp" id="sr" maxlength="5" value="' + esc(o.receiptPrefix || "RC") + '"></div></div><label>Logo</label><input class="inp" type="file" id="sl" accept="image/*"><label>Notice shown on member cards</label><textarea class="inp" id="sno" maxlength="300" placeholder="e.g. Gym closed on Sunday">' + esc(o.notice || "") + "</textarea></div>" +
      '<div class="card"><h3 style="margin-top:0">' + esc(t.planLabel) + 's</h3><div id="splans">' + (o.plans || []).map(planRow).join("") + '</div><button class="btn sec sm" data-a="addp">+ Add plan</button></div>' +
      '<div class="card"><h3 style="margin-top:0">' + esc(t.groupsLabel) + '</h3><div id="sgroups">' + (o.groups || []).map(groupRow).join("") + '</div><button class="btn sec sm" data-a="addg">+ Add ' + esc(t.groupLabel.toLowerCase()) + '</button></div>' +
      '<div class="card"><h3 style="margin-top:0">Terms & conditions (version ' + (o.termsVersion || 1) + ')</h3><textarea class="inp" id="st" style="min-height:260px" maxlength="6000">' + esc(o.terms) + '</textarea><div class="sub">Saving changed terms creates a new version. Earlier applications keep the version they accepted.</div></div>' +
      '<div class="err" id="serr"></div><button class="btn ok" data-a="saveset">Save settings</button>' +
      '<div class="card" style="margin-top:14px"><h3 style="margin-top:0">Links</h3><div class="kv"><span>Admission form</span><button class="btn sec sm" data-a="copy" data-v="' + esc(join) + '">Copy</button></div></div>' +
      '<button class="btn bad" style="margin-top:6px" data-a="logout">Sign out</button><p class="ctr mut" style="margin:14px 0">' + esc(G.app.name) + " · Organisation ID: " + esc(S.orgId) + "</p>";
    $("view").innerHTML = h;
  }
  function planRow(p) { return '<div class="trow" data-id="' + esc(p.id || "") + '"><input class="inp" data-k="name" value="' + esc(p.name) + '" maxlength="60"><input class="inp" data-k="months" type="number" min="1" value="' + esc(p.months) + '"><input class="inp" data-k="price" type="number" min="0" value="' + esc(p.price) + '"><button class="xbtn" data-a="delrow">×</button></div>'; }
  function groupRow(g) { return '<div class="trow g" data-id="' + esc(g.id || "") + '"><input class="inp" data-k="name" value="' + esc(g.name) + '" maxlength="60"><input class="inp" data-k="time" value="' + esc(g.time || "") + '" maxlength="40" placeholder="Timing (optional)"><button class="xbtn" data-a="delrow">×</button></div>'; }
  A.addp = function () { $("splans").insertAdjacentHTML("beforeend", planRow({ name: "", months: 1, price: "" })); };
  A.addg = function () { $("sgroups").insertAdjacentHTML("beforeend", groupRow({ name: "", time: "" })); };
  A.delrow = function (el) { el.parentNode.remove(); };
  function rows(id) { return [].map.call($(id).children, function (r) { var o = { id: r.getAttribute("data-id") || G.rid(6) }; [].forEach.call(r.querySelectorAll("[data-k]"), function (i) { o[i.getAttribute("data-k")] = i.value.trim(); }); return o; }); }
  A.saveset = function () {
    var e = $("serr"); e.textContent = "";
    var plans = rows("splans"), groups = rows("sgroups"), terms = $("st").value.trim();
    if ($("sn").value.trim().length < 3) { e.textContent = "Enter the organisation name."; return; }
    if (!/^[6-9]\d{9}$/.test($("sp").value.trim())) { e.textContent = "Enter a valid 10-digit phone number."; return; }
    if (!plans.length) { e.textContent = "Keep at least one plan."; return; }
    for (var i = 0; i < plans.length; i++) { var p = plans[i]; p.months = Math.round(Number(p.months)); p.price = Number(p.price); if (!p.name || !(p.months >= 1) || !(p.price > 0)) { e.textContent = "Each plan needs a name, months and a fee above zero."; return; } }
    for (var j = 0; j < groups.length; j++) { if (!groups[j].name) { e.textContent = "Each " + S.tpl.groupLabel.toLowerCase() + " needs a name."; return; } if (!groups[j].time) delete groups[j].time; }
    if (terms.length < 20) { e.textContent = "Terms cannot be empty."; return; }
    var upd = { name: $("sn").value.trim(), phone: $("sp").value.trim(), address: $("sa").value.trim(), upiId: $("su").value.trim(), color: $("sc").value, receiptPrefix: ($("sr").value.trim() || "RC").toUpperCase(), notice: $("sno").value.trim(), plans: plans, groups: groups, terms: terms };
    if (terms !== S.org.terms) upd.termsVersion = (S.org.termsVersion || 1) + 1;
    var lf = $("sl").files && $("sl").files[0];
    var go = function (logo) { if (logo) upd.logo = logo; return base().update(upd).then(function () { Object.assign(S.org, upd); G.theme(S.org); G.toast("Settings saved"); shell(); S.tab = "set"; render(); }); };
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
