/* Printable admission form (A4, 2 pages) — "5 Brother's" style: bilingual Hindi/English, dotted fill-in fields,
   health tick-boxes, emergency box, consent + signature + stamp, then Terms / Waiver, legal declaration, office-use block.
   AF.open(org, tpl, member, files, signatory) opens it in a new tab with a Print / Save PDF button.
   Gym gets the full custom layout; school / college use the same look with their own sections. */
(function () {
  "use strict";
  var AF = window.AF = {};
  var esc = function (v) { return G.esc(v == null ? "" : v); };

  /* ---------- small builders ---------- */
  function L(label, val, fx) { return '<span class="fl" style="flex:' + (fx || 1) + '"><i>' + esc(label) + ':</i><b>' + esc(val) + "</b></span>"; }
  function R() { return '<div class="ln">' + [].join.call(arguments, "") + "</div>"; }
  function H(t) { return '<div class="h">' + esc(t) + "</div>"; }
  function CB(on, label) { return '<span class="cb">[' + (on ? "✓" : "&nbsp;&nbsp;") + "] " + esc(label) + "</span>"; }
  function ageOf(dob) {
    var t = new Date(dob); if (isNaN(t)) return "";
    var n = new Date(), a = n.getFullYear() - t.getFullYear(), md = n.getMonth() - t.getMonth();
    if (md < 0 || (md === 0 && n.getDate() < t.getDate())) a--;
    return a >= 0 && a < 120 ? a : "";
  }
  function fieldOpts(tpl, id) {
    var out = [];
    (tpl.sections || []).forEach(function (s) { (s.fields || []).forEach(function (f) { if (f.id === id) out = f.opts || []; }); });
    return out;
  }
  var COND_HI = { "None": "कोई समस्या नहीं (Fit)", "High Blood Pressure": "हाई / लो बीपी", "Diabetes": "शुगर (Diabetes)", "Heart Condition": "दिल की बीमारी", "Asthma / Breathing Issue": "अस्थमा / सांस", "Thyroid": "थायराइड", "Back / Joint Pain": "कमर / जोड़ों का दर्द", "Recent Surgery / Injury": "हाल की सर्जरी / चोट", "Other": "अन्य (Other)" };
  var GOAL_HI = { "Weight Loss": "वज़न घटाना", "Muscle Gain": "बॉडी बिल्डिंग / मसल गेन", "General Fitness": "सामान्य फिटनेस", "Strength & Conditioning": "स्ट्रेंथ", "Sports Performance": "स्पोर्ट्स परफॉर्मेंस", "Rehabilitation": "रिहैबिलिटेशन" };
  var GENDER_HI = { Male: "पुरुष (M)", Female: "महिला (F)", Other: "अन्य" };
  var CONSENT = {
    gym: "मैं जिम परिसर में किसी भी आपातकालीन स्थिति में प्राथमिक चिकित्सा या नज़दीकी अस्पताल ले जाने हेतु जिम प्रबंधन को पूर्ण सहमति देता/देती हूँ।",
    school: "मैं आपातकालीन स्थिति में अपने बच्चे को प्राथमिक चिकित्सा या नज़दीकी अस्पताल ले जाने हेतु विद्यालय प्रबंधन को पूर्ण सहमति देता/देती हूँ।",
    college: "मैं परिसर में किसी भी आपातकालीन स्थिति में प्राथमिक चिकित्सा या नज़दीकी अस्पताल ले जाने हेतु संस्थान प्रबंधन को पूर्ण सहमति देता/देती हूँ।"
  };

  /* terms text (plain, editable in Settings) -> numbered bold headings + bullets, like the original form */
  function termsHtml(text) {
    var out = "", lines = String(text || "").split(/\r?\n/), first = true;
    lines.forEach(function (ln) {
      var t = ln.trim(); if (!t) return;
      if (first) { first = false; if ((/^[A-Z0-9 &,.\-\/()']+$/.test(t) || /Terms, Rules/i.test(t)) && !/^\d+\./.test(t)) return; }
      if (/^\d+[.)]\s/.test(t)) out += '<div class="th">' + esc(t) + "</div>";
      else if (/^[-•*]\s*/.test(t)) out += '<div class="tb">• ' + esc(t.replace(/^[-•*]\s*/, "")) + "</div>";
      else out += '<div class="tp">' + esc(t) + "</div>";
    });
    return out;
  }

  /* ---------- page 1 bodies ---------- */
  function gymBody(org, tpl, m, d) {
    var phone = m.phone ? (/^\d{10}$/.test(m.phone) ? "+91 " + m.phone : m.phone) : "";
    var gender = d.gender || "", dob = d.dob ? G.fmt(d.dob) + (ageOf(d.dob) !== "" ? " / " + ageOf(d.dob) + " yrs" : "") : "";
    var married = gender === "Female" && d.marital === "Married";
    var parentLbl = married ? "पति का नाम (Husband's Name)" : "पिता / माता का नाम (Parent Name)";
    var addr = [d.address, d.pincode ? "- " + d.pincode : ""].filter(Boolean).join(" ");
    var cur = d.sameAddr || !d.curAddress ? "" : R(L("वर्तमान पता (Current Address)", d.curAddress, 1));
    var conds = d.conditions || [], goal = d.goal || "";
    var info = '<div class="inf">Member ID: <b>' + esc(m.code || "—") + "</b></div>" +
      '<div class="inf">जॉइनिंग: <b>' + esc(G.fmt(m.joinDate)) + "</b></div>" +
      '<div class="inf">प्लान: <b>' + esc(m.planName || "—") + "</b>" + (m.startDate ? " &nbsp;|&nbsp; वैधता: <b>" + esc(G.fmt(m.startDate)) + " → " + esc(G.fmt(m.expiry)) + "</b>" : "") + (m.batchName ? " &nbsp;|&nbsp; " + esc(tpl.groupLabel) + ": <b>" + esc(m.batchName) + "</b>" : "") + "</div>" +
      '<div class="inf">फीस: <b>' + esc(G.money(m.planPrice)) + "</b> &nbsp;|&nbsp; जमा: <b>" + esc(G.money(m.paid)) + "</b> &nbsp;|&nbsp; बकाया: <b>" + esc(G.money(m.due)) + "</b>" + (d.catName ? " &nbsp;|&nbsp; श्रेणी: <b>" + esc(d.catName) + "</b>" : "") + "</div>";
    var sec1 = H("1. व्यक्तिगत विवरण (Personal Details)") + info +
      R(L("पूरा नाम (Full Name)", m.name, 1)) +
      R(L(parentLbl, d.parentName, 1)) + (married && d.fatherName ? R(L("पिता का नाम (Father's Name)", d.fatherName, 1)) : "") +
      R(L("जन्म तिथि / आयु (DOB / Age)", dob, 1.3), L("लिंग (M/F)", GENDER_HI[gender] || gender, 1)) +
      R(L("व्यवसाय (Occupation)", d.occupation, 1), L("मोबाइल नंबर (Mobile)", phone, 1.2)) +
      R(L("पूरा पता (Address)", addr, 1)) + cur +
      (d.email ? R(L("ईमेल (Email)", d.email, 1)) : "") +
      '<div class="emg"><b>🚨 आपातकालीन संपर्क — केवल परिवार/रिश्तेदार का नंबर</b><div class="note">माता-पिता, परिवार के सदस्य या अभिभावक का ही नंबर दें।</div>' +
      R(L("संपर्क व्यक्ति का नाम", d.emergName, 1.4), L("संबंध", d.emergRelation, 1)) + R(L("मोबाइल नंबर", d.emergPhone, 1)) + "</div>";
    var goals = fieldOpts(tpl, "goal").map(function (o) { return CB(o === goal, GOAL_HI[o] || o); }).join(" ");
    var condBoxes = fieldOpts(tpl, "conditions").map(function (o) { return CB(conds.indexOf(o) >= 0, COND_HI[o] || o); }).join(" &nbsp; ");
    var sec2 = H("2. स्वास्थ्य एवं फिटनेस विवरण (Health Details)") +
      R(L("ऊंचाई (सेमी)", d.height, 1), L("वज़न (किलो)", d.weight, 1), L("BMI", d.bmi || (d.height && d.weight ? (d.weight / Math.pow(d.height / 100, 2)).toFixed(1) : ""), 0.8), L("ब्लड ग्रुप", d.bloodGroup || "N/A", 1)) +
      '<div class="chk"><span class="lb">फिटनेस लक्ष्य:</span> ' + goals + "</div>" +
      '<div class="chk"><span class="lb">स्वास्थ्य स्थिति (यदि लागू हो तो टिक करें):</span><br>' + condBoxes + "</div>" +
      (d.conditionsNote ? R(L("बीमारी / दवा का विवरण", d.conditionsNote, 1)) : "") +
      '<div class="chk"><span class="lb">सप्लीमेंट लेते हैं?</span> ' + CB(d.supplements === "Yes", "हाँ") + " " + CB(d.supplements !== "Yes", "नहीं") + "</div>" +
      '<div class="chk"><span class="lb">क्या आप वर्तमान में कोई नियमित दवा ले रहे हैं?</span> ' + CB(d.medication === "Yes", "हाँ") + " " + CB(d.medication !== "Yes", "नहीं") + ' &nbsp;|&nbsp; <span class="lb">डॉक्टर ने मना किया है?</span> ' + CB(d.doctorRestricted === "Yes", "हाँ") + " " + CB(d.doctorRestricted !== "Yes", "नहीं") + "</div>" +
      (d.experience || d.source || d.ptInterest ? R(L("अनुभव", d.experience, 1.2), L("जानकारी का स्रोत", d.source, 1), L("पर्सनल ट्रेनिंग", d.ptInterest, 0.8)) : "");
    return sec1 + sec2;
  }

  function genericBody(org, tpl, m, d) {
    var membership = [[tpl.memberWord + " ID", m.code || "—"], ["Joining date", G.fmt(m.joinDate)], [tpl.planLabel, m.planName || "—"], [tpl.groupLabel, m.batchName || "—"]];
    if (d.catName) membership.push(["Category", d.catName]);
    if (m.startDate) membership.push(["Valid from", G.fmt(m.startDate)], ["Valid till", G.fmt(m.expiry)]);
    membership.push(["Fee", G.money(m.planPrice)], ["Paid / Due", G.money(m.paid) + " / " + G.money(m.due)]);
    if (d.referredBy) membership.push(["Referred by", d.referredBy]);
    function flow(rows) {
      var h = "", i;
      for (i = 0; i < rows.length; i += 2) h += R(L(rows[i][0], rows[i][1], 1), rows[i + 1] ? L(rows[i + 1][0], rows[i + 1][1], 1) : '<span class="fl" style="flex:1"></span>');
      return h;
    }
    var n = 1, h = H(n++ + ". प्रवेश विवरण (Admission Details)") + flow(membership);
    (window.OF ? OF.sections(tpl, m) : []).forEach(function (s) { if (s.rows && s.rows.length) h += H(n++ + ". " + s.title) + flow(s.rows); });
    return h;
  }

  /* ---------- whole document ---------- */
  AF.html = function (org, tpl, m, f, signatory) {
    f = f || {};
    var d = m.data || {}, isGym = tpl.id === "gym";
    var photo = G.img(f.photo) ? '<img class="ph" src="' + f.photo + '" alt="">' : '<div class="ph none">PHOTO</div>';
    var logo = G.img(org.logo) ? '<img class="lg" src="' + org.logo + '" alt="">' : "";
    var stampImg = G.img(org.stamp) ? '<img class="stamp" src="' + org.stamp + '" alt="">' : "";
    var sign = G.img(f.sign) ? '<img class="sg" src="' + f.sign + '" alt="">' : '<div class="sgt">' + esc(m.signName || m.name) + "</div>";
    var who = signatory || org.name, mw = tpl.memberWord, ver = m.termsVersion || 1;
    var dateTxt = G.fmt(m.approvedDate || m.joinDate);
    var sub = isGym ? "सदस्य पंजीकरण एवं स्वास्थ्य विवरण (Membership Registration Form)" : "प्रवेश फॉर्म (" + mw + " Admission Form)";
    var sectionNo = isGym ? "3" : "";
    var consentTxt = CONSENT[tpl.id] || CONSENT.college;
    var idLine = f.idType ? '<div class="note">ID proof submitted: ' + esc(f.idType) + "</div>" : "";

    var css = "@page{size:A4;margin:8mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font:12px/1.4 'Noto Sans Devanagari',Arial,Helvetica,sans-serif}" +
      ".page{width:194mm;margin:0 auto;padding:5mm 6mm;border:1.5px solid #000;min-height:278mm;position:relative;page-break-after:always}.page:last-of-type{page-break-after:auto}" +
      ".hd{display:flex;align-items:flex-start;gap:10px}.hd .t{flex:1;text-align:center}.hd h1{margin:0;font-size:22px;text-transform:uppercase;letter-spacing:.3px}.hd p{margin:2px 0 0;font-size:11px;color:#333}" +
      ".lg{width:46px;height:46px;object-fit:contain}.ph{width:29mm;height:36mm;object-fit:cover;border:1.5px solid #000}.ph.none{display:flex;align-items:center;justify-content:center;font-size:10px;color:#777}" +
      ".h{font-weight:700;font-size:12.5px;border-bottom:1.5px solid #555;margin:12px 0 6px;padding-bottom:2px}.hd+.h{margin-top:4px}" +
      ".inf{font-size:11px;color:#333;margin:2px 0}.inf b{color:#000}" +
      ".ln{display:flex;gap:16px;margin:7px 0;align-items:baseline}.fl{display:flex;align-items:baseline;gap:4px;min-width:0}.fl i{font-style:normal;color:#444;font-size:10.5px;white-space:nowrap}" +
      ".fl b{flex:1;border-bottom:1px dotted #000;padding:0 4px 1px;font-size:13px;min-height:16px;word-break:break-word}" +
      ".emg{border:1px solid #000;background:#fafafa;padding:5px 8px;margin:9px 0 4px}.emg b{font-size:11.5px}.note{font-size:10.5px;color:#333;margin-top:2px}" +
      ".chk{font-size:11px;margin:5px 0;line-height:1.7}.chk .lb{color:#444}.cb{white-space:nowrap}" +
      ".cons{font-size:11.5px;margin:4px 0}.row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px}.sgbox{min-width:62mm}" +
      ".sg{max-height:16mm;max-width:62mm;display:block}.sgt{font:italic 20px 'Brush Script MT','Segoe Script',Georgia,serif;padding:4px 8px 0}.sline{border-top:1px dotted #000;margin-top:2px}" +
      ".stamp{max-height:26mm;max-width:52mm;display:block;margin-left:auto}.cap{font-size:10px;color:#333;text-align:right;margin-top:2px}.lbl{font-size:11px;font-weight:700}" +
      ".th{font-weight:700;font-size:11.5px;margin:8px 0 2px}.tb{font-size:10.8px;padding-left:12px;margin:2px 0}.tp{font-size:10.8px;margin:3px 0}" +
      ".ttl{text-align:center;font-weight:700;font-size:14px;margin:6px 0 2px}" +
      ".legal{border:1px solid #000;background:#fafafa;padding:6px 8px;margin-top:10px}.legal .q{font-style:italic;font-size:10.8px;margin:3px 0}" +
      ".ofc{border:1.5px solid #000;padding:6px 8px;margin-top:10px}.ofc h3{margin:0 0 4px;font-size:11.5px;text-decoration:underline}" +
      "table.ms{width:100%;border-collapse:collapse;margin-top:6px}table.ms th,table.ms td{border:1px solid #000;padding:6px 2px;font-size:10.5px;text-align:center}table.ms th{background:#eee}" +
      ".ft{display:flex;justify-content:space-between;align-items:flex-end;border-top:1.5px dotted #666;margin-top:12px;padding-top:8px;font-size:10.5px}.ft .nm{font-weight:700;font-size:12px}" +
      ".ft .os{font-size:9.5px;font-weight:700;color:#a07d1c;text-align:center;letter-spacing:.5px}" +
      ".bar{position:sticky;top:0;background:#222;padding:8px;text-align:center;z-index:5}.bar button{background:#ffcc00;border:0;border-radius:8px;padding:10px 18px;font-weight:bold;font-size:15px}" +
      "@media print{.bar{display:none}}";

    var body1 = isGym ? gymBody(org, tpl, m, d) : genericBody(org, tpl, m, d);
    var p1 = '<div class="page"><div class="hd">' + logo + '<div class="t"><h1>' + esc(org.name) + "</h1><p>" + esc(sub) + "</p>" + (org.address || org.phone ? "<p>" + esc([org.address, org.phone ? "Ph: " + org.phone : ""].filter(Boolean).join(" | ")) + "</p>" : "") + "</div>" + photo + "</div>" +
      body1 + idLine +
      H((sectionNo ? sectionNo + ". " : "") + (isGym ? "आपातकालीन सहमति" : "घोषणा एवं सहमति (Declaration & Consent)")) +
      '<div class="cons">' + esc(consentTxt) + (isGym ? "" : " मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी सत्य है और मैं नियम एवं शर्तों (version " + esc(ver) + ") से सहमत हूँ।") + "</div>" +
      '<div class="row"><div class="sgbox"><div class="lbl">' + esc(isGym ? "सदस्य के हस्ताक्षर:" : mw + " / अभिभावक के हस्ताक्षर:") + "</div>" + sign + '<div class="sline"></div></div>' +
      '<div class="sgbox" style="text-align:right">' + L("दिनांक", dateTxt, 1) + (stampImg ? '<div style="margin-top:10px">' + stampImg + '<div class="cap">अधिकृत मुहर / Authorised Stamp</div></div>' : '<div class="cap" style="margin-top:34px">' + esc(who) + "<br>अधिकृत मुहर / Authorised Stamp</div>") + "</div></div></div>";

    var decl = org.declaration || ("मैंने " + org.name + " के सभी नियमों, फीस पॉलिसी और कानूनी चेतावनी को भली-भांति पढ़ व समझ लिया है।" + (isGym ? " यदि मैं फीस बकाया छोड़कर जाता/जाती हूँ, तो प्रबंधन को मेरे विरुद्ध कानूनी कार्रवाई करने की पूर्ण अनुमति है।" : " मैं इनसे पूरी तरह सहमत हूँ।") + " (Terms version " + ver + ")");
    var meas = isGym ? '<div class="lbl" style="margin-top:8px;font-size:10.5px">BODY MEASUREMENTS &amp; MONTHLY PROGRESS RECORD</div><table class="ms"><tr><th>Stage</th><th>Chest</th><th>Waist</th><th>Shoulder</th><th>Biceps</th><th>Forearm</th><th>Weight</th></tr>' +
      "<tr><td>Initial</td><td></td><td></td><td></td><td></td><td></td><td>" + esc(d.weight || "") + "</td></tr><tr><td>Current</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table>" : "";
    var p2 = '<div class="page"><div class="ttl" style="font-size:17px;text-transform:uppercase">' + esc(org.name) + '</div><div class="ttl">नियम, शर्तें एवं दायित्व पत्र (Terms, Rules &amp; Waiver)</div>' + termsHtml(org.terms) +
      '<div class="legal"><div class="lbl">कानूनी चेतावनी एवं घोषणा (Legal Declaration &amp; Warning):</div>' + (org.legalNote ? '<div class="lbl" style="margin-top:2px">' + esc(org.legalNote) + "</div>" : "") + '<div class="q">"' + esc(decl) + '"</div>' +
      R(L(isGym ? "सदस्य का नाम" : mw + " का नाम", m.signName || m.name, 1.6), L("दिनांक", dateTxt, 1)) +
      '<div class="row" style="margin-top:6px"><div class="sgbox"><div class="lbl" style="font-weight:400;color:#444;font-size:10.5px">' + esc(isGym ? "सदस्य के हस्ताक्षर:" : "हस्ताक्षर:") + "</div>" + sign + '<div class="sline"></div></div></div></div>' +
      '<div class="ofc"><h3>केवल कार्यालय उपयोग हेतु (OFFICE USE ONLY)</h3>' +
      R(L("Form Received By", m.approvedByName || "", 1.4), L(tpl.groupLabel, m.batchName || "", 1.2)) +
      R(L("Amount Received ₹", m.paid != null ? String(m.paid) : "", 1), L("Date & Sign", G.fmt(m.approvedDate || ""), 1)) + meas + "</div>" +
      '<div class="ft"><div>' + stampImg + '<div class="nm">' + esc(who) + "</div><div>Owner</div><div>" + esc(org.name) + '</div></div>' + (stampImg ? '<div>' + stampImg + '<div class="os">OFFICIAL STAMP</div></div>' : "") + "</div></div>";

    return '<!DOCTYPE html><html lang="hi"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(m.name + " — " + mw + " admission form") + '</title><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@400;700&display=swap"><style>' + css +
      '</style></head><body><div class="bar"><button onclick="window.print()">🖨 प्रिंट निकालें / PDF सेव करें</button></div>' + p1 + p2 + "</body></html>";
  };

  AF.open = function (org, tpl, m, f, signatory) {
    var html = AF.html(org, tpl, m, f, signatory), url;
    try { url = URL.createObjectURL(new Blob([html], { type: "text/html" })); } catch (e) { url = ""; }
    var w = url ? window.open(url, "_blank") : null;
    if (!w) { var w2 = window.open("", "_blank"); if (w2) { w2.document.open(); w2.document.write(html); w2.document.close(); return true; } G.toast("Allow pop-ups to open the form"); return false; }
    return true;
  };
})();
