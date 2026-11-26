jQuery(function ($) {
    // Practising a past exam is premium: the locked control opens the upgrade popup instead of
    // navigating (today's exam is never locked).
    $(document).on('click', '.iee-locked', function (e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });

    // Live countdown to next UTC midnight. Re-bound after each AJAX refresh
    // so it keeps pointing at the current DOM node.
    var countdownInterval = null;
    function startCountdown() {
        if (countdownInterval) {
            clearInterval(countdownInterval);
            countdownInterval = null;
        }
        var $countdown = $('.iee-countdown').first();
        if (!$countdown.length) return;
        var endTs = parseInt($countdown.attr('data-end-ts'), 10);
        if (!endTs) return;
        var endMs = endTs * 1000;
        var $value = $countdown.find('.iee-countdown-value');

        function tick() {
            var diff = endMs - Date.now();
            if (diff <= 0) {
                // Don't auto-reload — a stale or browser-cached render would just reload into the same
                // past time and loop. Tell the user to refresh instead.
                clearInterval(countdownInterval);
                $countdown.text('Please refresh the page for the latest exam.');
                return;
            }
            var hours = Math.floor(diff / 3600000);
            var minutes = Math.floor((diff % 3600000) / 60000);
            var seconds = Math.floor((diff % 60000) / 1000);
            $value.text(
                String(hours).padStart(2, '0') + 'h:' +
                String(minutes).padStart(2, '0') + 'm:' +
                String(seconds).padStart(2, '0') + 's'
            );
        }
        tick();
        countdownInterval = setInterval(tick, 1000);
    }
    startCountdown();

    // DISABLED — the page now bypasses edge cache (nocache_headers() on any
    // page containing this shortcode; see scheduled_ielts_exam_bypass_page_cache()), so it renders
    // fresh on every hit and this per-load refresh is redundant. Kept commented as a fallback: if
    // `curl -sI <url> | grep -i x-ac` shows HIT instead of BYPASS, re-enable this block.
    /*
    // Self-heal stale page caches: fetch fresh shortcode HTML over AJAX and
    // swap the wrapper. No-op when the cache is fresh (same HTML).
    var $target = $('.iee-wrap').first();
    if ($target.length) {
        $.post(ielts_exam_event_ajax.ajaxurl, {
            action: 'refresh_ielts_exam_event',
            path: window.location.pathname,
            query_string: window.location.search
        }).done(function (html) {
            if (typeof html === 'string' && html.length > 0) {
                $target.replaceWith(html);
                console.log('refresh data successfully!');
                startCountdown();
            }
        });
    }
    */
});
