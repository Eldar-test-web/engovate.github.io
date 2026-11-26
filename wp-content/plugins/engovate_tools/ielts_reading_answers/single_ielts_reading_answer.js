jQuery(function ($) {
    // The summary table at the bottom of the page is the single source of
    // truth for answer / evidence / explanation. Per-question reveals and
    // inline-blank popups are rendered as empty placeholders carrying
    // `data-q="N"` (or comma-separated for grouped questions); on first click
    // we pull each cell out of the matching summary row, build the markup,
    // and populate the placeholder. This keeps the rendered HTML lean.

    function lookupAnswer(qNo) {
        var $row = $('.ira-summary-table tr[data-q="' + qNo + '"]');
        if (!$row.length) return null;
        var evidenceHtml    = $row.find('.ira-col-evidence').html();
        var explanationHtml = $row.find('.ira-col-explanation').html();
        // Cells render '—' when empty — treat as no content.
        if (evidenceHtml    && evidenceHtml.trim()    === '—') evidenceHtml    = '';
        if (explanationHtml && explanationHtml.trim() === '—') explanationHtml = '';
        return {
            answer:      $row.find('.ira-col-answer').text(),
            evidence:    evidenceHtml || '',
            explanation: explanationHtml || ''
        };
    }

    function buildAnswerEntry(qNo, data) {
        var html = '<div class="ira-answer-entry">';
        html += '<div class="ira-answer-line">';
        html += '<span class="ira-label">Q' + qNo + ' Answer:</span> ';
        html += '<strong class="ira-answer">' + $('<div>').text(data.answer).html() + '</strong>';
        html += '</div>';
        if (data.evidence) {
            html += '<p class="ira-evidence"><span class="ira-label">Evidence:</span> ' + data.evidence + '</p>';
        }
        if (data.explanation) {
            html += '<p class="ira-explanation"><span class="ira-label">Explanation:</span> ' + data.explanation + '</p>';
        }
        html += '</div>';
        return html;
    }

    function buildPopupRows(data) {
        var html = '<span class="ira-popup-row"><span class="ira-label">Answer:</span> ';
        html += '<strong class="ira-answer">' + $('<div>').text(data.answer).html() + '</strong></span>';
        if (data.evidence) {
            html += '<span class="ira-popup-row"><span class="ira-label">Evidence:</span> ' + data.evidence + '</span>';
        }
        if (data.explanation) {
            html += '<span class="ira-popup-row"><span class="ira-label">Explanation:</span> ' + data.explanation + '</span>';
        }
        return html;
    }

    function parseQList(str) {
        return (str || '')
            .split(',')
            .map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return !isNaN(n) && n > 0; });
    }

    // Per-question reveal (choice / Y-N / T-F-NG / matching sections).
    $(document).on('click', '.ira-toggle-answer', function () {
        var $btn   = $(this);
        var $block = $btn.next('.ira-answer-block');
        var hidden = $block.is(':hidden');

        // Lazy-populate from the summary table on first reveal.
        if (hidden && !$block.data('populated')) {
            var qList = parseQList($btn.attr('data-q'));
            var html  = '';
            qList.forEach(function (qNo) {
                var data = lookupAnswer(qNo);
                if (data) html += buildAnswerEntry(qNo, data);
            });
            $block.html(html);
            $block.data('populated', true);
        }

        $block.toggle();
        $btn.text(hidden ? 'Hide answer' + (parseQList($btn.attr('data-q')).length > 1 ? 's' : '') : 'Show answer' + (parseQList($btn.attr('data-q')).length > 1 ? 's' : ''));
        $btn.attr('aria-expanded', hidden ? 'true' : 'false');
    });

    // PDF export — open the browser's print dialog. The `@media print` rules
    // in the stylesheet hide the sidebar/toggle buttons/related sections so
    // the printed output is clean (passage + questions + summary table).
    $(document).on('click', '.ira-export-pdf-link', function (e) {
        e.preventDefault();
        window.print();
    });

    // Per-blank reveal (completion / inline-blank sections).
    $(document).on('click', '.ira-toggle-inline-answer', function () {
        var $btn   = $(this);
        var $popup = $btn.next('.ira-inline-popup');
        var hidden = $popup.is(':hidden');

        if (hidden && !$popup.data('populated')) {
            var qNo  = parseInt($popup.attr('data-q'), 10);
            var data = qNo ? lookupAnswer(qNo) : null;
            if (data) $popup.html(buildPopupRows(data));
            $popup.data('populated', true);
        }

        $popup.toggle();
        $btn.text(hidden ? 'Hide answer' : 'Show answer');
        $btn.attr('aria-expanded', hidden ? 'true' : 'false');
    });
});
