jQuery(function ($) {
    // The summary table at the bottom of the page is the single source of
    // truth for answer / evidence / explanation. Per-question reveals and
    // inline-blank popups are rendered as empty placeholders carrying
    // `data-q="N"` (or comma-separated for grouped questions); on first click
    // we pull each cell out of the matching summary row, build the markup,
    // and populate the placeholder. This keeps the rendered HTML lean.

    function lookupAnswer(qNo) {
        var $row = $('.ila-summary-table tr[data-q="' + qNo + '"]');
        if (!$row.length) return null;
        var evidenceHtml    = $row.find('.ila-col-evidence').html();
        var explanationHtml = $row.find('.ila-col-explanation').html();
        // Cells render '—' when empty — treat as no content.
        if (evidenceHtml    && evidenceHtml.trim()    === '—') evidenceHtml    = '';
        if (explanationHtml && explanationHtml.trim() === '—') explanationHtml = '';
        return {
            answer:      $row.find('.ila-col-answer').text(),
            evidence:    evidenceHtml || '',
            explanation: explanationHtml || ''
        };
    }

    function buildAnswerEntry(qNo, data) {
        var html = '<div class="ila-answer-entry">';
        html += '<div class="ila-answer-line">';
        html += '<span class="ila-label">Q' + qNo + ' Answer:</span> ';
        html += '<strong class="ila-answer">' + $('<div>').text(data.answer).html() + '</strong>';
        html += '</div>';
        if (data.evidence) {
            html += '<p class="ila-evidence"><span class="ila-label">Evidence:</span> ' + data.evidence + '</p>';
        }
        if (data.explanation) {
            html += '<p class="ila-explanation"><span class="ila-label">Explanation:</span> ' + data.explanation + '</p>';
        }
        html += '</div>';
        return html;
    }

    function buildPopupRows(data) {
        var html = '<span class="ila-popup-row"><span class="ila-label">Answer:</span> ';
        html += '<strong class="ila-answer">' + $('<div>').text(data.answer).html() + '</strong></span>';
        if (data.evidence) {
            html += '<span class="ila-popup-row"><span class="ila-label">Evidence:</span> ' + data.evidence + '</span>';
        }
        if (data.explanation) {
            html += '<span class="ila-popup-row"><span class="ila-label">Explanation:</span> ' + data.explanation + '</span>';
        }
        return html;
    }

    function parseQList(str) {
        return (str || '')
            .split(',')
            .map(function (s) { return parseInt(s, 10); })
            .filter(function (n) { return !isNaN(n) && n > 0; });
    }

    // Per-question reveal (choice / matching / labeling sections).
    $(document).on('click', '.ila-toggle-answer', function () {
        var $btn   = $(this);
        var $block = $btn.next('.ila-answer-block');
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
    // the printed output is clean (transcript + questions + summary table).
    $(document).on('click', '.ila-export-pdf-link', function (e) {
        e.preventDefault();
        window.print();
    });

    // Lazy-inject a print-only audio link next to each `<audio>` player just
    // before the browser prints, then strip it back out afterwards. Browsers
    // can't play sound from a printed PDF and the audio element renders blank
    // in print, so we add a clickable URL fallback. Same pattern the listening
    // test uses (window.onbeforeprint / onafterprint) — fires for any print
    // trigger (the export button, Ctrl+P, or right-click → Print). Markup +
    // class match the test's `.ielts-listening-print-audio-link` so the visual
    // style is consistent between test PDFs and answer-page PDFs.
    window.addEventListener('beforeprint', function () {
        $('.ila-audio audio').each(function () {
            // The player carries its addresses as <source> children (Cloudflare first, wordpress.com
            // behind it), so take the first one. The attr('src') branch is only for a player that
            // still uses the plain attribute.
            var url = $(this).attr('src') || $(this).find('source').first().attr('src');
            if (!url) return;
            var $printLink = $(
                '<div class="ila-audio-print-link">' +
                    '<i class="fa-solid fa-headphones"></i> Audio: ' +
                    '<a></a>' +
                '</div>'
            );
            $printLink.find('a').attr('href', url).text(url);
            $(this).closest('.ila-audio').after($printLink);
        });
    });

    window.addEventListener('afterprint', function () {
        $('.ila-audio-print-link').remove();
    });

    // Per-blank reveal (form / completion / inline-blank sections).
    $(document).on('click', '.ila-toggle-inline-answer', function () {
        var $btn   = $(this);
        var $popup = $btn.next('.ila-inline-popup');
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
