/* Fee receipt — drawn on a canvas so it can be downloaded as an image, printed or shared. */
(function () {
  "use strict";
  var R = window.R = {};
  var ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
  var TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? " " + ONES[n % 10] : ""); }
  function three(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + " Hundred" + (n % 100 ? " " : "") : "") + (n % 100 ? two(n % 100) : ""); }
  R.words = function (n) {
    n = Math.floor(Number(n) || 0); if (n <= 0) return "Zero";
    var parts = [], cr = Math.floor(n / 10000000), lk = Math.floor(n / 100000) % 100, th = Math.floor(n / 1000) % 100, rest = n % 1000;
    if (cr) parts.push(three(cr) + " Crore"); if (lk) parts.push(two(lk) + " Lakh"); if (th) parts.push(two(th) + " Thousand"); if (rest) parts.push(three(rest));
    return parts.join(" ");
  };
  function loadImg(u) { return new Promise(function (res) { if (!G.img(u)) return res(null); var im = new Image(); im.onload = function () { res(im); }; im.onerror = function () { res(null); }; im.src = u; }); }
  function wrap(x, text, maxW, font) {
    x.font = font; var words = String(text).split(" "), lines = [], cur = "";
    words.forEach(function (w) { var t = cur ? cur + " " + w : w; if (x.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; });
    if (cur) lines.push(cur); return lines;
  }

  /* org: organisation doc, p: payment doc, m: member doc (name, code, phone, batchName), tpl: template */
  R.draw = function (org, p, m, tpl) {
    return loadImg(org.logo).then(function (logo) {
      var W = 800, H = 1060, c = document.createElement("canvas"); c.width = W; c.height = H;
      var x = c.getContext("2d"), ac = /^#[0-9a-fA-F]{6}$/.test(org.color || "") ? org.color : "#d4a300";
      x.fillStyle = "#fff"; x.fillRect(0, 0, W, H);
      x.fillStyle = "#111"; x.fillRect(0, 0, W, 150); x.fillStyle = ac; x.fillRect(0, 150, W, 6);
      var tx = 40;
      if (logo) { x.drawImage(logo, 40, 30, 90, 90); tx = 150; }
      x.fillStyle = "#fff"; x.font = "bold 34px Arial"; x.textBaseline = "alphabetic";
      var nm = String(org.name || "").toUpperCase(); while (x.measureText(nm).width > W - tx - 30 && nm.length > 4) nm = nm.slice(0, -1);
      x.fillText(nm, tx, 68);
      x.font = "16px Arial"; x.fillStyle = "#ddd";
      wrap(x, org.address || "", W - tx - 30, "16px Arial").slice(0, 2).forEach(function (l, i) { x.fillText(l, tx, 96 + i * 20); });
      x.fillText("Phone: " + (org.phone || ""), tx, 138);

      x.fillStyle = "#111"; x.font = "bold 26px Arial"; x.fillText("PAYMENT RECEIPT", 40, 205);
      x.font = "16px Arial"; x.fillStyle = "#333"; x.textAlign = "right";
      x.fillText("Receipt No: " + p.receiptNo, W - 40, 188); x.fillText("Date: " + G.fmt(p.date), W - 40, 212); x.textAlign = "left";
      x.strokeStyle = "#ddd"; x.lineWidth = 1; x.beginPath(); x.moveTo(40, 228); x.lineTo(W - 40, 228); x.stroke();

      var y = 262;
      function row(k, v) { x.fillStyle = "#777"; x.font = "15px Arial"; x.fillText(k, 40, y); x.fillStyle = "#111"; x.font = "bold 17px Arial"; x.fillText(String(v || "—"), 230, y); y += 34; }
      row("Received from", m.name); row(((tpl && tpl.memberWord) || "Member") + " ID", m.code); row("Mobile", m.phone);
      if (m.batchName) row(((tpl && tpl.groupLabel) || "Batch"), m.batchName);

      y += 10; x.fillStyle = "#111"; x.fillRect(40, y, W - 80, 38);
      x.fillStyle = "#fff"; x.font = "bold 15px Arial"; x.fillText("DESCRIPTION", 54, y + 25); x.textAlign = "right"; x.fillText("AMOUNT", W - 54, y + 25); x.textAlign = "left";
      y += 38; x.fillStyle = "#f6f6f6"; x.fillRect(40, y, W - 80, 74);
      x.fillStyle = "#111"; x.font = "bold 17px Arial"; x.fillText((p.type === "renewal" ? "Renewal — " : "Admission — ") + (p.planName || "Fee"), 54, y + 30);
      x.font = "14px Arial"; x.fillStyle = "#555"; x.fillText("Valid: " + G.fmt(p.from) + "  to  " + G.fmt(p.to), 54, y + 54);
      x.fillStyle = "#111"; x.font = "bold 18px Arial"; x.textAlign = "right"; x.fillText("₹ " + G.num(p.amount).toLocaleString("en-IN"), W - 54, y + 40); x.textAlign = "left";
      y += 74; x.strokeStyle = "#ddd"; x.beginPath(); x.moveTo(40, y); x.lineTo(W - 40, y); x.stroke();

      y += 12; x.fillStyle = ac; x.fillRect(40, y, W - 80, 52);
      x.fillStyle = "#000"; x.font = "bold 20px Arial"; x.fillText("TOTAL RECEIVED", 54, y + 33); x.textAlign = "right"; x.font = "bold 26px Arial"; x.fillText("₹ " + G.num(p.amount).toLocaleString("en-IN"), W - 54, y + 36); x.textAlign = "left";
      y += 82; x.fillStyle = "#444"; x.font = "italic 15px Arial";
      wrap(x, "Rupees " + R.words(p.amount) + " only", W - 80, "italic 15px Arial").forEach(function (l) { x.fillText(l, 40, y); y += 20; });
      y += 14; row("Payment mode", p.mode); if (p.utr) row("Transaction ID", p.utr); row("Received by", p.byName || "Administration");

      y = Math.max(y + 30, 800);
      x.strokeStyle = "#999"; x.beginPath(); x.moveTo(W - 260, y); x.lineTo(W - 40, y); x.stroke();
      x.fillStyle = "#555"; x.font = "14px Arial"; x.textAlign = "center"; x.fillText("Authorised Signatory", W - 150, y + 20); x.textAlign = "left";
      var note = "Fees once paid are non-refundable and non-transferable. Please retain this receipt for future reference. This is a computer-generated receipt.";
      x.fillStyle = "#777"; x.font = "13px Arial"; wrap(x, note, W - 80, "13px Arial").forEach(function (l, i) { x.fillText(l, 40, y + 60 + i * 18); });
      x.fillStyle = ac; x.fillRect(0, H - 14, W, 14);
      return c;
    });
  };
  R.download = function (canvas, name) {
    canvas.toBlob(function (b) {
      var a = document.createElement("a"); a.href = URL.createObjectURL(b); a.download = (name || "receipt") + ".png"; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    }, "image/png");
  };
  R.print = function (canvas) {
    var w = window.open("", "_blank"); if (!w) { G.toast("Please allow pop-ups to print"); return; }
    var img = w.document.createElement("img"); img.src = canvas.toDataURL("image/png"); img.style.cssText = "width:100%;max-width:800px";
    w.document.body.style.margin = "0"; w.document.body.appendChild(img); img.onload = function () { w.focus(); w.print(); };
  };
})();
