(function () {
  "use strict";
  var prefixes = [];
  [].slice.call(document.querySelectorAll('div[class*="_category_filter_buttons"]')).forEach(function (box) {
    var m = box.className.match(/(ielts_[a-z_]+?)_category_filter_buttons/);
    if (m && prefixes.indexOf(m[1]) < 0) prefixes.push(m[1]);
  });
  if (!prefixes.length) return;

  function apply(prefix, category, search, types) {
    var buttons = document.querySelectorAll("." + prefix + "_category_filter_button");
    [].slice.call(buttons).forEach(function (b) {
      var href = b.getAttribute("href") || "";
      var cat = new URLSearchParams(href.split("?")[1] || "").get("category_type") || "all";
      b.classList.toggle("current", cat === category);
    });
    var sections = document.querySelectorAll('div[id^="' + prefix + '_filter_results_"]');
    var shown = 0;
    [].slice.call(sections).forEach(function (sec) {
      var slug = sec.id.replace(prefix + "_filter_results_", "");
      var visible = category === "all" || slug === category;
      [].slice.call(sec.querySelectorAll("article")).forEach(function (art) {
        var text = (art.textContent || "").toLowerCase();
        var ok = visible && (!search || text.indexOf(search) >= 0);
        if (ok && types.length) {
          var data = art.querySelector("[data-sections]");
          var raw = data ? data.getAttribute("data-sections") : "";
          ok = types.some(function (t) { return raw.toLowerCase().indexOf(t.toLowerCase()) >= 0; });
        }
        art.style.display = ok ? "" : "none";
        if (ok) shown++;
      });
    });
    var label = document.querySelector("." + prefix + "_active_category strong");
    if (label) {
      var active = [].slice.call(buttons).filter(function (b) { return b.classList.contains("current"); })[0];
      label.textContent = category === "all" ? "All Tests" : (active ? active.textContent.replace("★", "").trim() : category);
    }
    return shown;
  }

  prefixes.forEach(function (prefix) {
    var form = document.querySelector("form." + prefix + "_filter_form") || document.querySelector('form');
    var searchInput = document.querySelector('input[placeholder="Search terms..."]');
    var typeSelect = document.querySelector('select[name="section_type[]"]');
    var current = "all";
    try { current = new URLSearchParams(location.search).get("category_type") || "all"; } catch (e) {}

    [].slice.call(document.querySelectorAll("." + prefix + "_category_filter_button")).forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        var q = b.getAttribute("href").split("?")[1] || "";
        current = new URLSearchParams(q).get("category_type") || "all";
        history.replaceState(null, "", location.pathname + (current === "all" ? "" : "?category_type=" + encodeURIComponent(current)) + location.hash);
        apply(prefix, current, searchInput ? searchInput.value.trim().toLowerCase() : "", []);
      });
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var types = [];
        if (typeSelect) [].slice.call(typeSelect.selectedOptions).forEach(function (o) { types.push(o.value || o.textContent.trim()); });
        apply(prefix, current, searchInput ? searchInput.value.trim().toLowerCase() : "", types);
      });
    }
    apply(prefix, current, "", []);
  });
})();
