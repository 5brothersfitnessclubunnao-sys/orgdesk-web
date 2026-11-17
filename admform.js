/* Printable admission form (A4, 2 pages): details + photo + signature, then terms, declaration, office-use block.
   AF.open(org, tpl, member, files, signatory) opens it in a new tab with a Print / Save PDF button. */
(function () {
  "use strict";
  var AF = window.AF = {};
  var esc = function (v) { return G.esc(v); };

  function kvTable(rows) {
    if (!rows.length) return "";
    var h = '<table class="kv">', i;
    for (i = 0; i < rows.length; i += 2) {
      h += "<tr><th>" + esc(rows[i][0]) + "</th><td>" + esc(rows[i][1]) + "</td>" +
        (rows[i + 1] ? "<th>" + esc(rows[i + 1][0]) + "</th><td>" + esc(rows[i + 1][1]) + "</td>" : "<th></th><td></td>") + "</tr>";
    }
    return h + "</table>";
  }
  function box(title, inner) { return inner ? '<div class="sec"><h3>' + esc(title) + "</h3>" + inner + "</div>" : ""; }

  AF.html = function (org, tpl, m, f, signatory) {
    f = f || {};
    var d = m.data || {}, photo = G.img(f.photo) ? '<img class="ph" src="' + f.photo + '" alt="">' : '<div class="ph none">PHOTO</div>';
    var logo = G.img(org.logo) ? '<img class="lg" src="' + org.logo + '" alt="">' : "";
    var stamp = G.img(org.stamp) ? '<img class="stamp" src="' + org.stamp + '" alt="">' : "";
    var sign = G.img(f.sign) ? '<img class="sg" src="' + f.sign + '" alt="">' : '<div class="sgt">' + esc(m.signName || m.name) + "</div>";
    var who = signatory || org.name;
    var membership = [
      [tpl.memberWord + " ID", m.code || "—"], ["Joining date", G.fmt(m.joinDate)],
      [tpl.planLabel, m.planName || "—"], [tpl.groupLabel, m.batchName || "—"]
    ];
    if (d.catName) membership.push(["Category", d.catName]);
    if (m.startDate) membership.push(["Valid from", G.fmt(m.startDate)], ["Valid till", G.fmt(m.expiry)]);
    membership.push(["Fee", G.money(m.planPrice)], ["Paid / Due", G.money(m.paid) + " / " + G.money(m.due)]);
    if (d.referredBy) membership.push(["Referred by", d.referredBy]);

    var secs = OF.sections(tpl, m).map(function (s) { return box(s.title, kvTable(s.rows)); }).join("");
    var idLine = f.idType ? '<div class="note">ID proof submitted: ' + esc(f.idType) + "</div>" : "";

    var css = "@page{size:A4;margin:9mm}*{box-sizing:border-box}body{margin:0;background:#fff;color:#000;font:12px/1.35 Arial,Helvetica,sans-serif}" +
      ".page{width:190mm;margin:0 auto;padding:4mm;border:1px solid #000;min-height:275mm;position:relative;page-break-after:always}.page:last-child{page-break-after:auto}" +
      ".hd{display:flex;align-items:center;gap:10px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:6px}.hd .t{flex:1;text-align:center}.hd h1{margin:0;font-size:20px;text-transform:uppercase}.hd p{margin:2px 0;font-size:11px}" +
      ".lg{width:52px;height:52px;object-fit:contain}.ph{width:30mm;height:38mm;object-fit:cover;border:1px solid #000}.ph.none{display:flex;align-items:center;justify-content:center;font-size:10px;color:#777}" +
      ".sec{margin-top:6px}.sec h3{margin:0 0 3px;font-size:12px;background:#eee;border:1px solid #bbb;padding:2px 6px}" +
      "table.kv{width:100%;border-collapse:collapse}table.kv th{width:17%;text-align:left;font-weight:normal;color:#444;padding:2px 4px;border:1px solid #ccc;font-size:11px}table.kv td{width:33%;padding:2px 4px;border:1px solid #ccc;font-weight:bold;font-size:11.5px;word-break:break-word}" +
      ".note{font-size:10.5px;margin-top:3px}.row{display:flex;justify-content:space-between;align-items:flex-end;margin-top:14px}.sgbox{min-width:60mm;text-align:center}.sg{max-height:16mm;max-width:60mm}.sgt{font:italic 18px Georgia,serif;border-bottom:1px dotted #000;padding:6px 8px}.stamp{max-height:24mm;max-width:50mm}" +
      ".lbl{font-size:10.5px;color:#333;border-top:1px dotted #000;margin-top:2px;padding-top:2px}.terms{white-space:pre-wrap;font-size:10.5px;border:1px solid #ccc;padding:6px;margin-top:4px}" +
      ".ofc{border:1.5px solid #000;padding:6px;margin-top:8px}.ofc h3{margin:0 0 4px;font-size:12px;text-decoration:underline}.ofc .ln{display:flex;gap:14px;margin:6px 0}.ofc .ln span{flex:1;border-bottom:1px dotted #000;padding-bottom:1px}" +
      "table.ms{width:100%;border-collapse:collapse;margin-top:4px}table.ms th,table.ms td{border:1px solid #000;padding:5px 2px;font-size:10.5px;text-align:center}" +
      ".bar{position:sticky;top:0;background:#222;padding:8px;text-align:center}.bar button{background:#ffcc00;border:0;border-radius:8px;padding:10px 18px;font-weight:bold;font-size:15px}" +
      "@media print{.bar{display:none}.page{border:1px solid #000}}";

    var meas = tpl.id === "gym" ?
      '<div class="sec"><h3>Body measurements &amp; progress record</h3><table class="ms"><tr><th>Stage</th><th>Chest</th><th>Waist</th><th>Shoulder</th><th>Biceps</th><th>Forearm</th><th>Weight</th></tr>' +
      "<tr><td>Initial</td><td></td><td></td><td></td><td></td><td></td><td>" + esc(d.weight || "") + "</td></tr><tr><td>After 1 month</td><td></td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>After 3 months</td><td></td><td></td><td></td><td></td><td></td><td></td></tr></table></div>" : "";

    var p1 = '<div class="page"><div class="hd">' + logo + '<div class="t"><h1>' + esc(org.name) + "</h1><p>" + esc([org.address, org.phone ? "Ph: " + org.phone : ""].filter(Boolean).join(" | ")) + "</p><p><b>" + esc(tpl.memberWord) + " Admission Form</b></p></div>" + photo + "</div>" +
      box("Admission details", kvTable(membership)) + secs + idLine +
      '<div class="sec"><h3>Declaration</h3><div class="note">I declare that the information given above is true and complete. I have read and accept the terms &amp; conditions (version ' + esc(m.termsVersion || 1) + ') printed overleaf. <br>मैं घोषणा करता/करती हूँ कि उपरोक्त जानकारी सत्य है और मैं नियम एवं शर्तों से सहमत हूँ।</div></div>' +
      '<div class="row"><div class="sgbox">' + sign + '<div class="lbl">Signature of ' + esc(tpl.memberWord.toLowerCase()) + " — " + esc(m.name) + '</div><div class="note">Date: ' + esc(G.fmt(m.approvedDate || m.joinDate)) + '</div></div>' +
      '<div class="sgbox">' + stamp + '<div class="lbl">' + esc(who) + "<br>Authorised signatory / stamp</div></div></div></div>";

    var p2 = '<div class="page"><div class="hd">' + logo + '<div class="t"><h1>' + esc(org.name) + "</h1><p>Terms, rules &amp; declaration (version " + esc(m.termsVersion || 1) + ")</p></div></div>" +
      '<div class="terms">' + esc(org.terms || "") + "</div>" +
      '<div class="row"><div class="sgbox"><div class="sgt">' + esc(m.signName || m.name) + '</div><div class="lbl">Name &amp; signature of ' + esc(tpl.memberWord.toLowerCase()) + '</div></div><div class="sgbox">' + sign + '<div class="lbl">Signature</div></div></div>' +
      '<div class="ofc"><h3>FOR OFFICE USE ONLY</h3><div class="ln"><span>Form received by: ' + esc(m.approvedByName || "") + "</span><span>" + esc(tpl.groupLabel) + ": " + esc(m.batchName || "") + '</span></div><div class="ln"><span>Amount received: ' + (m.paid ? G.money(m.paid) : "") + "</span><span>Date: " + esc(G.fmt(m.approvedDate || "")) + "</span><span>Sign:</span></div></div>" + meas + "</div>";

    return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(m.name + " — " + tpl.memberWord + " admission form") + "</title><style>" + css + '</style></head><body><div class="bar"><button onclick="window.print()">🖨 Print / Save as PDF</button></div>' + p1 + p2 + "</body></html>";
  };

  AF.open = function (org, tpl, m, f, signatory) {
    var html = AF.html(org, tpl, m, f, signatory), url;
    try { url = URL.createObjectURL(new Blob([html], { type: "text/html" })); } catch (e) { url = ""; }
    var w = url ? window.open(url, "_blank") : null;
    if (!w) { var w2 = window.open("", "_blank"); if (w2) { w2.document.open(); w2.document.write(html); w2.document.close(); return true; } G.toast("Allow pop-ups to open the form"); return false; }
    return true;
  };
})();