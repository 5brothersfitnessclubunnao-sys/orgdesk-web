/* Admission form engine — builds a step-by-step form from an organisation template (templates.js).
   OF.mount(root, tpl, org, {onSubmit(payload) -> Promise})   |   OF.sections(tpl, member) -> read-only view for the admin desk */
(function () {
  "use strict";
  var OF = window.OF = {};
  var esc = function (s) { return G.esc(s); };

  var PAT = {
    phone10: [/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number"],
    aadhaar: [/^\d{12}$/, "Aadhaar must be 12 digits"],
    pin6: [/^\d{6}$/, "PIN code must be 6 digits"],
    email: [/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, "Enter a valid email address"]
  };

  function allFields(tpl) { var a = []; tpl.sections.forEach(function (s) { s.fields.forEach(function (f) { a.push(f); }); }); return a; }

  OF.mount = function (root, tpl, org, opts) {
    var files = {}, sig = { drawn: false }, step = 0, busy = false;
    var plans = Array.isArray(org.plans) ? org.plans : [], groups = Array.isArray(org.groups) ? org.groups : [];
    var steps = tpl.sections.map(function (s) { return { id: s.id, title: s.title, hi: s.hi, kind: "fields", sec: s }; });
    steps.push({ id: "admission", title: "Admission Details", hi: "प्रवेश विवरण", kind: "admission" });
    steps.push({ id: "documents", title: "Photograph & Documents", hi: "फोटो एवं दस्तावेज़", kind: "docs" });
    steps.push({ id: "payment", title: "Fee Payment", hi: "शुल्क भुगतान", kind: "payment" });
    steps.push({ id: "terms", title: "Terms & Declaration", hi: "नियम एवं घोषणा", kind: "terms" });

    function lbl(text, hi, req) { return esc(text) + (req ? ' <span class="req">*</span>' : "") + (hi ? "<small>" + esc(hi) + "</small>" : ""); }

    function fieldHtml(f) {
      var id = "f_" + f.id, h = '<div class="field" data-fid="' + esc(f.id) + '">', ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";
      var mx = f.max ? ' maxlength="' + f.max + '"' : "", im = f.inputmode ? ' inputmode="' + f.inputmode + '"' : "";
      var L = '<label class="flab" for="' + id + '">' + lbl(f.label, f.hi, f.req) + "</label>";
      if (f.type === "radio") {
        h += '<div class="lbl flab">' + lbl(f.label, f.hi, f.req) + '</div><div class="opt">' + f.opts.map(function (o) { return '<label><input type="radio" name="' + id + '" value="' + esc(o) + '"> ' + esc(o) + "</label>"; }).join("") + "</div>";
      } else if (f.type === "multi") {
        h += '<div class="lbl flab">' + lbl(f.label, f.hi, f.req) + '</div><div class="opt">' + f.opts.map(function (o) { return '<label><input type="checkbox" class="mf" data-f="' + esc(f.id) + '" value="' + esc(o) + '"> ' + esc(o) + "</label>"; }).join("") + "</div>";
      } else if (f.type === "check") {
        h += '<label class="chk" style="display:flex;gap:8px;align-items:center;color:var(--tx);margin-top:12px"><input type="checkbox" id="' + id + '" style="width:auto"> ' + esc(f.label) + "</label>";
      } else if (f.type === "select") {
        h += L + '<select id="' + id + '"><option value="">— Select —</option>' + f.opts.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select>";
      } else if (f.type === "textarea") {
        h += L + '<textarea class="inp" id="' + id + '"' + mx + ph + "></textarea>";
      } else if (f.type === "computed") {
        h += L + '<div class="ro" id="' + id + '">—</div>';
      } else {
        var t = f.type === "number" ? "number" : f.type === "date" ? "date" : f.type === "tel" ? "tel" : f.type === "email" ? "email" : "text";
        var rg = f.type === "number" ? ' min="' + (f.min == null ? "" : f.min) + '" max="' + (f.max == null ? "" : f.max) + '" step="any" inputmode="decimal"' : mx;
        var dm = f.type === "date" ? ' max="' + G.today() + '"' : "";
        h += L + '<input class="inp" type="' + t + '" id="' + id + '"' + rg + dm + im + ph + ' autocomplete="off">';
      }
      return h + '<div class="err" data-err="' + esc(f.id) + '"></div></div>';
    }
    function fieldsHtml(list) {
      var h = "", i = 0;
      while (i < list.length) {
        var f = list[i], n = list[i + 1];
        if (f.half && n && n.half) { h += '<div class="grid2">' + fieldHtml(f) + fieldHtml(n) + "</div>"; i += 2; } else { h += fieldHtml(f); i++; }
      }
      return h;
    }

    function slotHtml(s) {
      return '<div class="slot" data-slot="' + s.key + '"><div class="lbl" style="margin:0 0 6px">' + lbl(s.label, s.hi, s.req) + "</div>" +
        '<img class="imgbox hide" alt="">' +
        '<div class="sub st"></div>' +
        '<div class="acts"><button type="button" class="btn sec sm" data-pick="file">📁 Choose File</button><button type="button" class="btn sec sm" data-pick="cam">📷 Use Camera</button><button type="button" class="btn bad sm hide fit" data-pick="del" style="flex:0 0 auto">Remove</button></div>' +
        '<input type="file" accept="image/*" class="hide" data-in="file"><input type="file" accept="image/*" capture="' + s.camera + '" class="hide" data-in="cam">' +
        '<div class="err" data-err="slot_' + s.key + '"></div></div>';
    }

    function stepHtml(st) {
      if (st.kind === "fields") return fieldsHtml(st.sec.fields);
      if (st.kind === "admission") {
        var h = "";
        if (groups.length) h += '<div class="field"><label class="flab" for="grp">' + lbl(tpl.groupLabel, "", 1) + '</label><select id="grp"><option value="">— Select —</option>' + groups.map(function (g) { return '<option value="' + esc(g.id) + '">' + esc(g.name) + (g.time ? " (" + esc(g.time) + ")" : "") + "</option>"; }).join("") + '</select><div class="err" data-err="grp"></div></div>';
        if (plans.length) h += '<div class="field"><label class="flab" for="plan">' + lbl(tpl.planLabel, "", 1) + '</label><select id="plan"><option value="">— Select —</option>' + plans.map(function (p) { return '<option value="' + esc(p.id) + '">' + esc(p.name) + " — " + esc(G.money(p.price)) + "</option>"; }).join("") + '</select><div class="err" data-err="plan"></div></div>';
        h += '<div class="field"><label class="flab" for="joinDate">' + lbl("Joining / Admission Date", "प्रवेश की तिथि", 1) + '</label><input class="inp" type="date" id="joinDate" value="' + G.today() + '"><div class="err" data-err="joinDate"></div></div>';
        return h;
      }
      if (st.kind === "docs") {
        var d = "";
        tpl.docSlots.forEach(function (s, i) {
          if (s.key === "idFront" && tpl.docIdTypes) d += '<div class="field"><label class="flab" for="idType">' + lbl("ID Proof Type", "पहचान पत्र का प्रकार", 1) + '</label><select id="idType">' + tpl.docIdTypes.map(function (o) { return "<option>" + esc(o) + "</option>"; }).join("") + "</select></div>";
          d += slotHtml(s);
        });
        return d + '<p class="mut" style="margin-top:10px">Any photo — large or small, from the gallery or the camera — is accepted and is resized automatically.</p>';
      }
      if (st.kind === "payment") {
        return '<p class="mut">You may pay the fee at the counter. If you have already paid by UPI, enter the transaction reference (UTR) below so that the payment can be verified.</p>' +
          '<div id="upiRow" class="hide" style="margin:10px 0"><a class="btn sec" id="upiBtn" href="#">📲 Pay by UPI</a><div class="sub" style="margin-top:6px" id="upiNote"></div></div>' +
          '<div class="kv"><span>Selected plan</span><b id="payPlan">—</b></div><div class="kv"><span>Fee</span><b id="payAmt">—</b></div>' +
          '<div class="field"><label class="flab" for="utr">' + lbl("UTR / Transaction ID (if paid online)", "") + '</label><input class="inp" id="utr" maxlength="30" autocomplete="off"><div class="err" data-err="utr"></div></div>';
      }
      // terms
      return '<div class="terms" id="termsBox"></div>' +
        '<label class="chk" style="display:flex;gap:8px;align-items:flex-start;color:var(--tx);margin-top:12px"><input type="checkbox" id="agree" style="width:auto;margin-top:3px"> I have read and agree to the above terms and conditions. <span class="req">*</span></label><div class="err" data-err="agree"></div>' +
        '<div id="guardBox" class="hide"><label class="chk" style="display:flex;gap:8px;align-items:flex-start;color:var(--tx);margin-top:10px"><input type="checkbox" id="guardOk" style="width:auto;margin-top:3px"> <span id="guardTxt"></span> <span class="req">*</span></label><div class="err" data-err="guardOk"></div></div>' +
        '<div class="field"><label class="flab" for="signName">' + lbl("Signature — type your full name", "हस्ताक्षर (पूरा नाम)", 1) + '</label><input class="inp" id="signName" maxlength="80"><div class="err" data-err="signName"></div></div>' +
        '<div class="lbl" style="margin-top:10px">Draw your signature (optional) <button type="button" class="btn sec sm" id="sigClr" style="float:right;padding:3px 10px">Clear</button></div><canvas class="sig" id="sig" width="600" height="200"></canvas>';
    }

    /* ---------- build shell ---------- */
    var h = '<div class="steps" id="stepBar">' + steps.map(function () { return "<i></i>"; }).join("") + '</div><div class="sub" id="stepInfo"></div>';
    steps.forEach(function (st, i) { h += '<div class="card step hide" data-step="' + i + '"><h3 style="margin-top:0">' + esc(st.title) + (st.hi ? ' <small class="mut">' + esc(st.hi) + "</small>" : "") + "</h3>" + stepHtml(st) + "</div>"; });
    h += '<div class="row" id="nav" style="margin:6px 0 30px"><button class="btn sec" id="bBack" type="button">← Back</button><button class="btn" id="bNext" type="button">Next →</button></div>';
    root.innerHTML = h;
    var $ = function (id) { return root.querySelector("#" + id); };
    $("termsBox").textContent = org.terms || "No terms have been added by this organisation yet.";
    $("guardTxt").textContent = tpl.consent === "always" ? "I am the parent / legal guardian of the applicant and I give my consent for this admission." : "The applicant is below 18 years of age. I am the parent / guardian and I give my consent.";

    /* ---------- values ---------- */
    function getVals() {
      var v = {};
      allFields(tpl).forEach(function (f) {
        var id = "f_" + f.id;
        if (f.type === "radio") { var r = root.querySelector('input[name="' + id + '"]:checked'); v[f.id] = r ? r.value : ""; }
        else if (f.type === "multi") { v[f.id] = [].slice.call(root.querySelectorAll('.mf[data-f="' + f.id + '"]:checked')).map(function (c) { return c.value; }); }
        else if (f.type === "check") { v[f.id] = !!$(id).checked; }
        else if (f.type === "computed") { v[f.id] = ""; }
        else { v[f.id] = String(($(id) || {}).value || "").trim(); }
      });
      v.age = G.age(v.dob);
      var b = G.bmi(v.height, v.weight); v.bmi = b.v; v.bmiCat = b.t;
      return v;
    }
    function selPlan() { var s = $("plan"); return s ? plans.filter(function (p) { return p.id === s.value; })[0] : null; }
    function selGroup() { var s = $("grp"); return s ? groups.filter(function (g) { return g.id === s.value; })[0] : null; }

    function refresh() {
      var v = getVals();
      allFields(tpl).forEach(function (f) {
        var w = root.querySelector('.field[data-fid="' + f.id + '"]'); if (!w) return;
        w.classList.toggle("hide", !!f.showIf && !f.showIf(v));
        if (f.labelFn) { var l = f.labelFn(v), el = w.querySelector(".flab"); if (el) el.innerHTML = lbl(l[0], l[1], f.req); }
        if (f.calc === "age") $("f_" + f.id).textContent = v.age === "" ? "—" : v.age + " years";
        if (f.calc === "bmi") $("f_" + f.id).textContent = v.bmi ? v.bmi + " — " + v.bmiCat : "—";
      });
      // exclusive option ("None" clears the rest, any other clears "None")
      var p = selPlan();
      $("payPlan").textContent = p ? p.name : "—"; $("payAmt").textContent = p ? G.money(p.price) : "—";
      if (org.upiId && p && G.num(p.price) > 0) { $("upiRow").classList.remove("hide"); $("upiBtn").href = "upi://pay?pa=" + encodeURIComponent(org.upiId) + "&pn=" + encodeURIComponent(org.name || "Organisation") + "&am=" + G.num(p.price) + "&cu=INR"; $("upiNote").textContent = "Pays " + G.money(p.price) + " to " + org.upiId; }
      else $("upiRow").classList.add("hide");
      var needG = tpl.consent === "always" || (v.age !== "" && v.age < 18);
      $("guardBox").classList.toggle("hide", !needG);
    }
    root.addEventListener("input", function (e) {
      var w = e.target.closest && e.target.closest(".field, .slot");
      if (w) { var er = w.querySelector(".err"); if (er) er.textContent = ""; if (e.target.classList) e.target.classList.remove("bad"); }
      refresh();
    });
    root.addEventListener("change", function (e) {
      var t = e.target;
      if (t.classList && t.classList.contains("mf")) {
        var f = allFields(tpl).filter(function (x) { return x.id === t.getAttribute("data-f"); })[0];
        if (f && f.exclusive) {
          var boxes = [].slice.call(root.querySelectorAll('.mf[data-f="' + f.id + '"]'));
          if (t.value === f.exclusive && t.checked) boxes.forEach(function (b) { if (b !== t) b.checked = false; });
          else if (t.checked) boxes.forEach(function (b) { if (b.value === f.exclusive) b.checked = false; });
        }
      }
      refresh();
    });

    /* ---------- photos / documents ---------- */
    root.addEventListener("click", function (e) {
      var b = e.target.closest && e.target.closest("[data-pick]"); if (!b) return;
      var slot = b.closest(".slot"), k = b.getAttribute("data-pick"), key = slot.getAttribute("data-slot");
      if (k === "del") { delete files[key]; paintSlot(slot); return; }
      slot.querySelector('[data-in="' + k + '"]').click();
    });
    root.addEventListener("change", function (e) {
      var t = e.target; if (!t.getAttribute || !t.getAttribute("data-in")) return;
      var slot = t.closest(".slot"), key = slot.getAttribute("data-slot"), f = t.files && t.files[0];
      var spec = tpl.docSlots.filter(function (s) { return s.key === key; })[0];
      t.value = ""; if (!f) return;
      files[key] = { pending: true }; paintSlot(slot);
      G.compress(f, spec.w, spec.h, spec.len).then(function (u) {
        if (u) files[key] = { url: u }; else { delete files[key]; slot.querySelector('[data-err]').textContent = "This image could not be read. Please choose another photo or use the camera."; }
        paintSlot(slot);
      });
    });
    function paintSlot(slot) {
      var key = slot.getAttribute("data-slot"), f = files[key], im = slot.querySelector("img"), st = slot.querySelector(".st"), del = slot.querySelector('[data-pick="del"]');
      slot.querySelector("[data-err]").textContent = "";
      if (f && f.url) { im.src = f.url; im.classList.remove("hide"); st.textContent = "✅ Added"; del.classList.remove("hide"); }
      else { im.classList.add("hide"); im.removeAttribute("src"); del.classList.add("hide"); st.textContent = f && f.pending ? "⏳ Preparing image…" : ""; }
    }

    /* ---------- signature pad ---------- */
    (function () {
      var c = $("sig"), x = c.getContext("2d"), down = false;
      function clr() { x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.strokeStyle = "#111"; x.lineWidth = 3; x.lineCap = "round"; x.lineJoin = "round"; sig.drawn = false; }
      function pos(e) { var r = c.getBoundingClientRect(); return [(e.clientX - r.left) * c.width / r.width, (e.clientY - r.top) * c.height / r.height]; }
      c.addEventListener("pointerdown", function (e) { down = true; var p = pos(e); x.beginPath(); x.moveTo(p[0], p[1]); try { c.setPointerCapture(e.pointerId); } catch (er) {} e.preventDefault(); });
      c.addEventListener("pointermove", function (e) { if (!down) return; var p = pos(e); x.lineTo(p[0], p[1]); x.stroke(); sig.drawn = true; e.preventDefault(); });
      ["pointerup", "pointercancel", "pointerleave"].forEach(function (n) { c.addEventListener(n, function () { down = false; }); });
      $("sigClr").addEventListener("click", clr); clr();
      sig.get = function () { return sig.drawn ? c.toDataURL("image/jpeg", 0.6) : ""; };
    })();

    /* ---------- validation ---------- */
    function setErr(key, msg) {
      var e = root.querySelector('[data-err="' + key + '"]'); if (e) e.textContent = msg || "";
      var inp = root.querySelector("#f_" + key + ",#" + key); if (inp && inp.classList) inp.classList.toggle("bad", !!msg);
    }
    function validateStep(i) {
      var st = steps[i], v = getVals(), first = null;
      function bad(key, msg) { setErr(key, msg); if (!first) first = root.querySelector('[data-err="' + key + '"]'); }
      if (st.kind === "fields") {
        st.sec.fields.forEach(function (f) {
          setErr(f.id, "");
          if (f.type === "computed") return;
          if (f.showIf && !f.showIf(v)) return;
          var val = v[f.id], req = f.req || (f.reqWhen && f.reqWhen(v));
          var empty = f.type === "multi" ? !val.length : f.type === "check" ? !val : val === "";
          if (req && empty) return bad(f.id, f.type === "radio" || f.type === "select" || f.type === "multi" ? "Please select an option" : "This field is required");
          if (empty) return;
          if (f.type === "text" && req && val.length < 2) return bad(f.id, "Please enter at least 2 characters");
          if (f.pattern && PAT[f.pattern] && !PAT[f.pattern][0].test(val)) return bad(f.id, PAT[f.pattern][1]);
          if (f.type === "number") { var n = Number(val); if (!isFinite(n) || (f.min != null && n < f.min) || (f.max != null && n > f.max)) return bad(f.id, "Enter a value between " + f.min + " and " + f.max); }
          if (f.id === "dob") { var a = G.age(val); if (!G.parse(val) || a === "" || a < 3 || a > 99) return bad(f.id, "Enter a valid date of birth"); }
        });
      } else if (st.kind === "admission") {
        ["grp", "plan", "joinDate"].forEach(function (k) { setErr(k, ""); });
        if (groups.length && !selGroup()) bad("grp", "Please select " + tpl.groupLabel.toLowerCase());
        if (plans.length && !selPlan()) bad("plan", "Please select " + tpl.planLabel.toLowerCase());
        if (!G.parse($("joinDate").value)) bad("joinDate", "Please choose a valid date");
      } else if (st.kind === "docs") {
        tpl.docSlots.forEach(function (s) {
          setErr("slot_" + s.key, ""); var f = files[s.key];
          if (f && f.pending) return bad("slot_" + s.key, "Image is still being prepared. Please wait a moment.");
          if (s.req && !(f && f.url)) bad("slot_" + s.key, "This document is required");
        });
      } else if (st.kind === "terms") {
        ["agree", "guardOk", "signName"].forEach(function (k) { setErr(k, ""); });
        if (!$("agree").checked) bad("agree", "You must accept the terms to continue");
        var needG = tpl.consent === "always" || (v.age !== "" && v.age < 18);
        if (needG && !$("guardOk").checked) bad("guardOk", "Parent / guardian consent is required");
        if ($("signName").value.trim().length < 2) bad("signName", "Please type your full name as signature");
      }
      if (first) { try { first.scrollIntoView({ behavior: "smooth", block: "center" }); } catch (e) {} return false; }
      return true;
    }

    /* ---------- navigation ---------- */
    function show(i) {
      step = i;
      [].forEach.call(root.querySelectorAll(".step"), function (s) { s.classList.toggle("hide", +s.getAttribute("data-step") !== i); });
      [].forEach.call($("stepBar").children, function (b, j) { b.classList.toggle("on", j <= i); });
      $("stepInfo").textContent = "Step " + (i + 1) + " of " + steps.length;
      $("bBack").classList.toggle("hide", i === 0);
      $("bNext").textContent = i === steps.length - 1 ? "✅ Submit Application" : "Next →";
      refresh(); window.scrollTo(0, 0);
    }
    $("bBack").addEventListener("click", function () { if (step > 0) show(step - 1); });
    $("bNext").addEventListener("click", function () {
      if (busy) return;
      if (!validateStep(step)) return;
      if (step < steps.length - 1) return show(step + 1);
      for (var i = 0; i < steps.length - 1; i++) if (!validateStep(i)) { show(i); G.toast("Please complete this step"); return; }
      var payload = collect();
      busy = true; $("bNext").disabled = true; $("bNext").textContent = "⏳ Submitting…";
      Promise.resolve(opts.onSubmit(payload)).catch(function (e) {
        busy = false; $("bNext").disabled = false; $("bNext").textContent = "✅ Submit Application";
        G.toast((e && e.message) || "Submission failed. Please try again.");
      });
    });

    /* ---------- collect ---------- */
    function collect() {
      var v = getVals(), data = {}, top = {}, p = selPlan(), g = selGroup();
      allFields(tpl).forEach(function (f) {
        if (f.type === "computed") return;
        if (f.showIf && !f.showIf(v)) return;
        var val = v[f.id]; if (f.type === "check") val = !!val;
        if (val === "" || val == null || (Array.isArray(val) && !val.length) || val === false) return;
        if (f.key) top[f.key] = val; else data[f.id] = val;
      });
      if (v.age !== "") data.age = v.age;
      if (v.bmi) { data.bmi = v.bmi; data.bmiCat = v.bmiCat; }
      if (data.sameAddr && data.address) data.curAddress = data.address;
      var needG = tpl.consent === "always" || (v.age !== "" && v.age < 18);
      if (needG) data.guardianConsent = true;
      var doc = {
        name: top.name, phone: top.phone, kind: tpl.id, data: data,
        planId: p ? p.id : "", planName: p ? p.name : "", planPrice: p ? G.num(p.price) : 0, planMonths: p ? G.num(p.months) : 0,
        batchId: g ? g.id : "", batchName: g ? g.name : "", joinDate: $("joinDate").value,
        utr: $("utr").value.trim(), termsVersion: G.num(org.termsVersion) || 1, termsAccepted: true,
        signName: $("signName").value.trim(), status: "pending", createdAt: G.FV.serverTimestamp(), hasFiles: true
      };
      var fd = { idType: ($("idType") || {}).value || "" };
      tpl.docSlots.forEach(function (s) { if (files[s.key] && files[s.key].url) fd[s.key] = files[s.key].url; });
      var sg = sig.get(); if (sg) fd.sign = sg;
      if (!fd.idType) delete fd.idType;
      return { doc: doc, files: fd };
    }
    show(0);
  };

  /* ---------- read-only view of a stored application (admin desk) ---------- */
  OF.sections = function (tpl, m) {
    var d = m.data || {}, vals = {};
    Object.keys(d).forEach(function (k) { vals[k] = d[k]; });
    vals.name = m.name; vals.phone = m.phone;
    var out = [];
    tpl.sections.forEach(function (s) {
      var rows = [];
      s.fields.forEach(function (f) {
        if (f.type === "computed") { var cv = f.calc === "age" ? (d.age !== undefined ? d.age + " years" : "") : (d.bmi ? d.bmi + " — " + d.bmiCat : ""); if (cv) rows.push([f.label, cv]); return; }
        var v = f.key ? m[f.key] : d[f.id]; if (v === undefined || v === "" || v === false) return;
        var label = f.labelFn ? f.labelFn(vals)[0] : f.label;
        rows.push([label.replace(/ \(optional\)$/, ""), Array.isArray(v) ? v.join(", ") : v === true ? "Yes" : v]);
      });
      if (rows.length) out.push({ title: s.title, rows: rows });
    });
    return out;
  };
})();
