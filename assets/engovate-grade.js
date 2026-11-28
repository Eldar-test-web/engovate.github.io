(function () {
  "use strict";

  var keyEl = document.getElementById("engovate-answer-key");
  if (!keyEl) return;

  var key;
  try { key = JSON.parse(keyEl.textContent); } catch (e) { return; }

  var answers = key.answers || key;
  var names = Object.keys(answers);
  if (!names.length) return;

  var isListening = key.kind === "listening" || /listening/i.test(location.pathname + " " + document.title);
  var prefix = isListening ? "ielts-listening" : "ielts-reading";

  // Exact tables from the original plugin JS (single_ielts_*_test.js).
  var bandTable = {
    listening: [[39,9],[37,8.5],[35,8],[32,7.5],[30,7],[26,6.5],[23,6],[18,5.5],[16,5],[13,4.5],[11,4],[9,3.5],[7,3],[5,2.5],[3,2],[0,1]],
    academic: [[39,9],[37,8.5],[35,8],[33,7.5],[30,7],[27,6.5],[23,6],[19,5.5],[15,5],[13,4.5],[10,4],[8,3.5],[6,3],[4,2.5],[2,2],[0,1]],
    general: [[40,9],[39,8.5],[37,8],[36,7.5],[34,7],[32,6.5],[30,6],[27,5.5],[23,5],[19,4.5],[15,4],[12,3.5],[9,3],[7,2.5],[5,2],[3,1.5],[0,1]]
  };

  function bandFor(score, type) {
    var t = bandTable[type] || bandTable.listening;
    for (var i = 0; i < t.length; i++) if (score >= t[i][0]) return t[i][1];
    return 0;
  }

  function norm(v) {
    return String(v == null ? "" : v).toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
  }

  function compact(v) {
    return norm(v).replace(/\s+/g, "");
  }

  function same(a, b) {
    var x = norm(a);
    if (!x) return false;
    var y = norm(b);
    return !!y && (x === y || compact(x) === compact(y));
  }

  // Answer keys list alternatives separated by "/" ("BEGINNING / BEGINNER"), and sometimes
  // prefix the option letter with a comma ("C, TAKE OFF THEIR JEWELLERY,").
  // Clean commas from both ends of each alternative and add the bare letter as an option.
  function answerCandidates(correct) {
    var out = [];
    var parts = String(correct == null ? "" : correct).split("/");
    for (var i = 0; i < parts.length; i++) {
      var clean = parts[i].replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim();
      if (!clean) continue;
      out.push(clean);
      var m = clean.match(/^([A-Da-d])\s*[,;:.\-\s]+(.+)$/);
      if (m) {
        out.push(m[1]);
        out.push(m[2].replace(/^[\s,;:]+|[\s,;:]+$/g, "").trim());
      }
    }
    return out;
  }

  // For radio groups the key may hold the visible option text ("ASIA", "SERVICE")
  // rather than the submitted value ("A", "B"). Map that text back to the value.
  function radioOptionTexts(el) {
    var out = [];
    var parent = el.parentNode;
    var labelText = "";
    var labels = (el.labels && el.labels.length) ? Array.prototype.slice.call(el.labels) : [];
    if (!labels.length && parent && parent.querySelector) {
      var local = parent.querySelector("label");
      if (local) labels.push(local);
    }
    for (var i = 0; i < labels.length; i++) {
      var text = String(labels[i].textContent || "").replace(/\s+/g, " ").trim();
      if (text) { out.push(text); labelText = text; }
    }
    if (parent && parent.textContent) {
      var pt = String(parent.textContent).replace(/\s+/g, " ").trim();
      if (pt) {
        out.push(pt);
        if (labelText && pt.toLowerCase().indexOf(labelText.toLowerCase()) === 0) {
          out.push(pt.slice(labelText.length).replace(/^[\s.,;:]+/, "").trim());
        }
        out.push(pt.replace(/^[A-Da-d]\s*[,.;:\s]*/, "").trim());
      }
    }
    return out;
  }

  function isMatch(user, correct, els) {
    var candidates = answerCandidates(correct);
    if (!candidates.length) return false;
    for (var i = 0; i < candidates.length; i++) {
      if (same(user, candidates[i])) return true;
    }
    if (els && els.length) {
      for (var j = 0; j < els.length; j++) {
        var el = els[j];
        if (!el.checked || el.type !== "radio") continue;
        var texts = radioOptionTexts(el);
        for (var k = 0; k < texts.length; k++) {
          for (var c = 0; c < candidates.length; c++) {
            if (same(candidates[c], texts[k])) return true;
          }
        }
      }
    }
    return false;
  }

  function fieldsOf(n) {
    var form = document.querySelector("form[id*='test-form']") || document;
    try { return Array.prototype.slice.call(form.querySelectorAll("[name='" + n + "']")); }
    catch (e) { return []; }
  }

  function valueOf(els) {
    var picked = [];
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el.type === "radio" || el.type === "checkbox") {
        if (el.checked && el.value && el.value.trim()) picked.push(el.value);
      } else if (el.value && el.value.trim()) {
        return el.value;
      }
    }
    return picked.join(", ");
  }

  function checkAnswer(n) {
    var els = fieldsOf(n);
    var user = valueOf(els);
    return { user: user, ok: isMatch(user, answers[n], els) };
  }

  function find(sel, root) {
    return (root || document).querySelector(sel);
  }

  function make(tag, cls) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    return node;
  }

  function bandColor(band) {
    if (band >= 8) return "darkgreen";
    if (band >= 7) return "orangered";
    if (band >= 6) return "darkorange";
    if (band >= 5) return "mediumblue";
    return "darkred";
  }

  function elapsedText(ms) {
    var s = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    function pad(n) { return (n < 10 ? "0" : "") + n; }
    return pad(h) + ":" + pad(m) + ":" + pad(sec);
  }

  var pageLoadedAt = Date.now();
  var graded = false;
  var overlay = null;

  function ensureOverlay() {
    var existing = find("." + prefix + "-result-overlay");
    if (existing) return existing;

    overlay = make("div", prefix + "-result-overlay");
    var content = make("div", prefix + "-result-overlay-content");

    content.appendChild(make("div", prefix + "-result-info"));

    var cta = make("div", prefix + "-premium-cta");
    var text = make("div", prefix + "-premium-cta-text");
    text.innerHTML = '<span class="' + prefix + '-premium-cta-headline">Unlock your full analysis with Premium</span>' +
      '<span class="' + prefix + '-premium-cta-features">Every-question detailed explanations &middot; Mistake &amp; progress tracking</span>';
    cta.appendChild(text);
    var link = make("a", prefix + "-premium-cta-button");
    link.href = "/engovate.github.io/payment-plans/index.html";
    link.target = "_blank";
    link.rel = "noopener";
    link.innerHTML = 'Go Premium <i class="fa-solid fa-arrow-right"></i>';
    cta.appendChild(link);
    var hide = make("button", prefix + "-premium-cta-close");
    hide.type = "button";
    hide.innerHTML = 'Hide <i class="fa-solid fa-xmark"></i>';
    cta.appendChild(hide);
    content.appendChild(cta);

    var wrapper = make("div", prefix + "-result-table-wrapper");
    var table = make("table", prefix + "-result-table");
    table.innerHTML = "<thead><tr><th>#</th><th>Your Answer</th><th>Correct Answer</th></tr></thead>";
    table.appendChild(make("tbody", prefix + "-result-table-body"));
    wrapper.appendChild(table);
    content.appendChild(wrapper);

    var close = make("button");
    close.id = prefix + "-result-close-button";
    close.type = "button";
    close.textContent = "x";
    content.appendChild(close);

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    return overlay;
  }

  function ensureActions() {
    var content = find("." + prefix + "-result-overlay-content", overlay);
    if (!content) return;

    var footer = find(".engovate-result-actions", content);
    if (!footer) {
      footer = make("div", "engovate-result-actions");
      footer.style.cssText = "display:flex;justify-content:center;gap:10px;flex-shrink:0;margin-top:12px";
      var close = document.getElementById(prefix + "-result-close-button");
      if (close && close.parentNode === content) content.insertBefore(footer, close);
      else content.appendChild(footer);
    }

    var retake = find(".engovate-retake-button", footer);
    if (!retake) {
      retake = make("button", prefix + "-submit-button engovate-retake-button");
      retake.type = "button";
      retake.textContent = "Retake Test";
      footer.appendChild(retake);
    }

    var review = find(".engovate-review-button", footer);
    if (!review) {
      review = make("button", prefix + "-review-button engovate-review-button");
      review.type = "button";
      review.title = "Review";
      review.setAttribute("aria-label", "Review");
      review.innerHTML = '<i class="fa-solid fa-list-check"></i>';
      footer.appendChild(review);
    }
  }

  function resetAnswers() {
    var form = document.querySelector("form[id*='test-form']") || document;
    names.forEach(function (n) {
      var els = fieldsOf(n);
      for (var i = 0; i < els.length; i++) {
        if (els[i].type === "radio" || els[i].type === "checkbox") els[i].checked = false;
        else if (els[i].type && /^select/.test(els[i].type)) els[i].selectedIndex = -1;
        else els[i].value = "";
      }
    });
    // Unkeyed groups (e.g. ungraded "choose two" checkboxes) still need clearing on retake.
    if (form !== document) {
      var selects = form.querySelectorAll("input[type='radio'], input[type='checkbox']");
      for (var j = 0; j < selects.length; j++) selects[j].checked = false;
    }
  }

  function hideOverlay() {
    if (overlay) overlay.classList.remove("completed");
  }

  function showOverlay() {
    if (overlay) overlay.classList.add("completed");
  }

  function retake() {
    resetAnswers();
    graded = false;
    hideOverlay();
    var submit = document.getElementById(prefix + "-test-submit-button");
    if (submit) submit.innerHTML = 'Submit <i class="fa-solid fa-paper-plane"></i>';
    var band = find("." + prefix + "-band-score");
    if (band) band.textContent = "";
  }

  function showResult(correct, total, wrong) {
    overlay = ensureOverlay();
    var content = find("." + prefix + "-result-overlay-content", overlay);
    var info = find("." + prefix + "-result-info", overlay);
    var tbody = find("." + prefix + "-result-table-body", overlay);
    if (!content || !info || !tbody) return;

    var catInput = document.getElementById("category_type");
    var cat = catInput ? (catInput.value || "") : "";
    var isGeneral = !isListening && (/general/i.test(cat + " " + location.pathname + " " + document.title));
    var type = isListening ? "listening" : (isGeneral ? "general" : "academic");
    var scaled = total === 40 ? correct : Math.round(correct * 40 / total);
    var band = bandFor(scaled, type);

    info.innerHTML = "";

    var bandEl = find("." + prefix + "-band-score") || find(".ielts-reading-band-score") || find(".ielts-listening-band-score");
    if (bandEl) {
      bandEl.textContent = "Band Score: " + band;
      bandEl.style.color = bandColor(band);
      info.appendChild(bandEl.cloneNode(true));
    } else {
      var localBand = make("div", prefix + "-band-score");
      localBand.textContent = "Band Score: " + band;
      localBand.style.color = bandColor(band);
      info.appendChild(localBand);
    }

    var count = make("h3");
    count.textContent = correct + "/" + total;
    info.appendChild(count);

    var timer = find("." + prefix + "-timer") || find(".ielts-reading-timer") || find(".ielts-listening-timer");
    if (timer) {
      var timerClone = timer.cloneNode(true);
      var strong = find("strong", timerClone);
      if (strong && /^00:00:00$/.test(strong.textContent.trim())) {
        strong.textContent = elapsedText(Date.now() - pageLoadedAt);
      }
      info.appendChild(timerClone);
    } else {
      var localTimer = make("div", prefix + "-timer");
      localTimer.innerHTML = '<i class="fa-solid fa-clock"></i> <strong>' + elapsedText(Date.now() - pageLoadedAt) + "</strong>";
      info.appendChild(localTimer);
    }

    var cta = find("." + prefix + "-premium-cta", overlay);
    if (cta) {
      var headline = find("." + prefix + "-premium-cta-headline", cta);
      if (headline) {
        headline.textContent = wrong.length && band < 9
          ? "You missed " + wrong.length + " question" + (wrong.length === 1 ? "" : "s") + " — Improve faster with Premium"
          : "Unlock your full analysis with Premium";
      }
      var features = find("." + prefix + "-premium-cta-features", cta);
      if (features) features.textContent = "Every-question detailed explanations · Mistake & progress tracking";
      cta.style.display = "";
    }

    tbody.innerHTML = "";
    names.forEach(function (n, i) {
      var result = checkAnswer(n);
      var user = result.user;
      var answer = answers[n];
      var ok = result.ok;
      var row = make("tr", (ok ? "correct-" : "incorrect-") + prefix + "-answer");

      var num = make("td");
      num.textContent = String(i + 1);
      var yours = make("td");
      yours.textContent = user || "—";
      var right = make("td");
      var answerText = answer == null ? "" : String(answer);
      if (ok) right.textContent = answerText;
      else {
        var strong = make("strong");
        strong.textContent = answerText;
        right.appendChild(strong);
      }

      row.appendChild(num);
      row.appendChild(yours);
      row.appendChild(right);
      tbody.appendChild(row);
    });

    ensureActions();
    showOverlay();
    graded = true;

    var submit = document.getElementById(prefix + "-test-submit-button");
    if (submit) submit.textContent = "Retake Test";
  }

  function grade(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    var correct = 0;
    var wrong = [];
    names.forEach(function (n) {
      var result = checkAnswer(n);
      if (result.ok) correct++;
      else wrong.push({ q: n.split("_").pop(), your: result.user || "—", correct: answers[n] });
    });
    showResult(correct, names.length, wrong);
  }

  document.addEventListener("submit", function (e) {
    var form = e.target;
    if (form.id && /test-form/.test(form.id)) grade(e);
  }, true);

  document.addEventListener("click", function (e) {
    var btn = e.target.closest && e.target.closest("button");
    if (!btn) return;
    var id = btn.id || "";

    if (id === prefix + "-result-close-button") {
      e.preventDefault();
      hideOverlay();
      return;
    }
    if (btn.classList.contains(prefix + "-premium-cta-close")) {
      e.preventDefault();
      var cta = btn.closest("." + prefix + "-premium-cta");
      if (cta) cta.style.display = "none";
      return;
    }
    if (btn.classList.contains("engovate-retake-button") || (id === prefix + "-test-submit-button" && graded)) {
      e.preventDefault();
      e.stopPropagation();
      retake();
      return;
    }
    if (btn.classList.contains("engovate-review-button") || (id === prefix + "-test-review-button" && graded)) {
      e.preventDefault();
      e.stopPropagation();
      showOverlay();
      return;
    }
    if (id === prefix + "-test-submit-button" && !graded) {
      e.preventDefault();
      e.stopPropagation();
      grade();
    }
  }, true);

  var btn = find("button[id*='submit-button']");
  if (btn) btn.title = "Local grading enabled";
})();
