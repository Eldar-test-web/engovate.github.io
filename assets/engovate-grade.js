(function () {
  "use strict";
  var keyEl = document.getElementById("engovate-answer-key");
  if (!keyEl) return;
  var key;
  try { key = JSON.parse(keyEl.textContent); } catch (e) { return; }
  var answers = key.answers || key;
  var names = Object.keys(answers);
  if (!names.length) return;

  var bandTable = {
    listening: [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]],
    academic: [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[0,2]],
    general: [[40,9],[39,8.5],[38,8],[36,7.5],[34,7],[32,6.5],[30,6],[26,5.5],[23,5],[18,4.5],[15,4],[13,3.5],[10,3],[8,2.5],[6,2],[0,1.5]]
  };
  function bandFor(score, type) {
    var t = bandTable[type] || bandTable.listening;
    for (var i = 0; i < t.length; i++) if (score >= t[i][0]) return t[i][1];
    return 0;
  }
  function norm(v) {
    return String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function valueOf(n) {
    var form = document.querySelector("form[id*='test-form']") || document;
    var els = form.querySelectorAll("[name='" + n + "']");
    for (var i = 0; i < els.length; i++) {
      if (els[i].type === "radio" || els[i].type === "checkbox") { if (els[i].checked) return els[i].value; }
      else if (els[i].value && els[i].value.trim()) return els[i].value;
    }
    return "";
  }
  function showResult(correct, total, wrong) {
    var id = "engovate-result";
    var old = document.getElementById(id);
    if (old) old.remove();
    var isGeneral = /general/i.test(location.pathname + " " + document.title);
    var type = key.kind === "listening" ? "listening" : (isGeneral ? "general" : "academic");
    var scaled = total === 40 ? correct : Math.round(correct * 40 / total);
    var band = bandFor(scaled, type);
    var box = document.createElement("div");
    box.id = id;
    box.style.cssText = "position:fixed;inset:0;z-index:100000;background:#0009;display:flex;align-items:center;justify-content:center;padding:16px";
    var card = document.createElement("div");
    card.style.cssText = "background:#fff;border-radius:8px;max-width:720px;width:100%;max-height:88vh;overflow:auto;padding:24px;box-shadow:0 8px 40px #0006;font-family:inherit";
    var rows = wrong.map(function (w) { return "<tr><td>" + w.q + "</td><td>" + w.your + "</td><td><strong>" + w.correct + "</strong></td></tr>"; }).join("");
    card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Test result</h2><button id="engovate-close" style="font-size:22px;border:0;background:none;cursor:pointer">&times;</button></div>' +
      '<p style="font-size:22px;font-weight:700;margin:18px 0 6px">' + correct + ' / ' + total + ' correct &nbsp;|&nbsp; Band <span style="color:#3f58e0">' + band.toFixed(1) + '</span></p>' +
      (total !== 40 ? '<p style="font-size:13px;color:#666">Scaled to /40: ' + scaled + ' correct (this test has ' + total + ' questions)</p>' : '') +
      (rows ? '<table style="width:100%;border-collapse:collapse;font-size:14px"><thead><tr><th>#</th><th>Your answer</th><th>Correct</th></tr></thead><tbody>' + rows + '</tbody></table>' : '<p>All answers correct!</p>');
    box.appendChild(card);
    document.body.appendChild(box);
    document.getElementById("engovate-close").onclick = function () { box.remove(); };
    box.addEventListener("click", function (e) { if (e.target === box) box.remove(); });
  }
  function grade(e) {
    if (e) e.preventDefault();
    var correct = 0, wrong = [];
    names.forEach(function (n) {
      var user = valueOf(n);
      var ans = answers[n];
      var ok = norm(user) === norm(ans);
      if (ok) correct++;
      else wrong.push({ q: n.split("_").pop(), your: user || "—", correct: ans });
    });
    showResult(correct, names.length, wrong);
  }
  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (form.id && /test-form/.test(form.id)) grade(e);
  }, true);
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("button");
    if (b && b.id && /submit-button/.test(b.id)) { e.preventDefault(); grade(); }
  }, true);
  var btn = document.querySelector("button[id*='submit-button']");
  if (btn) btn.title = "Local grading enabled";
})();
