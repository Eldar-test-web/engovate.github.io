(function () {
  "use strict";
  if (!/ielts-writing-tests/.test(location.pathname)) return;
  var btn = document.getElementById("ielts-writing-test-submit-button");
  if (!btn || btn.dataset.engovateBound) return;
  btn.dataset.engovateBound = "1";

  function words(text) { return (String(text || "").match(/\b[\w'-]+\b/g) || []).length; }
  function evaluate() {
    var parts = [].slice.call(document.querySelectorAll('[contenteditable="true"]'));
    var text = parts.map(function (p) { return p.innerText || p.textContent || ""; }).join("\n");
    var wc = words(text);
    var paras = text.split(/\n{2,}/).filter(function (p) { return p.trim().length > 20; }).length;
    var sentences = (text.match(/[.!?]+/g) || []).length || 1;
    var avg = wc / sentences;
    var band = 4.0;
    if (wc >= 150) band = 5.0;
    if (wc >= 220) band = 5.5;
    if (wc >= 260) band = 6.0;
    if (wc >= 300) band = 6.5;
    if (paras >= 3) band += 0.5;
    if (avg >= 12 && avg <= 28) band += 0.5;
    if (wc >= 400 && paras >= 4) band += 0.5;
    band = Math.min(8.5, Math.max(3.0, band));

    var host = document.querySelector(".ielts-writing-band-score") || document.querySelector(".overall-band-score") || document.body;
    var box = document.getElementById("engovate-writing-result");
    if (box) box.remove();
    box = document.createElement("div");
    box.id = "engovate-writing-result";
    box.style.cssText = "position:fixed;right:20px;bottom:20px;z-index:100000;background:#fff;border:2px solid #3f58e0;border-radius:8px;padding:16px 20px;box-shadow:0 6px 24px #0004;font-size:15px;max-width:340px";
    box.innerHTML = '<div style="font-weight:700;margin-bottom:6px">Writing evaluation</div>' +
      '<div>Words: <strong>' + wc + '</strong> &nbsp; Paragraphs: <strong>' + paras + '</strong></div>' +
      '<div style="font-size:22px;color:#006400;font-weight:700;margin:8px 0">Band ' + band.toFixed(1) + '</div>' +
      '<div style="font-size:12px;color:#666">Local estimate — AI grading requires the original site server.</div>' +
      '<button style="margin-top:8px" onclick="this.parentNode.remove()">Close</button>';
    document.body.appendChild(box);
    var overall = document.querySelector(".overall-band-score");
    if (overall) overall.textContent = band.toFixed(1);
    var c = document.querySelector(".band-score-container");
    if (c) c.style.display = "block";
  }
  btn.addEventListener("click", function (e) {
    e.preventDefault();
    e.stopImmediatePropagation();
    evaluate();
  }, true);
  document.addEventListener("submit", function (e) {
    if (e.target.id === "ielts-writing-test-form") { e.preventDefault(); e.stopImmediatePropagation(); evaluate(); }
  }, true);
})();
