jQuery(function ($) {
    // DISABLED — the page now bypasses edge cache (nocache_headers() on any
    // page containing this shortcode; see scheduled_ielts_exam_bypass_page_cache()), so it renders
    // fresh on every hit and this per-load refresh is redundant. Kept commented as a fallback: if
    // `curl -sI <url> | grep -i x-ac` shows HIT instead of BYPASS, re-enable this block.
    /*
    // Self-heal stale page caches: fetch fresh shortcode HTML over AJAX and
    // swap the wrapper. No-op when the cache is fresh (same HTML).
    var $target = $('.iel-wrap').first();
    if ($target.length) {
        $.post(ielts_exam_leaderboard_ajax.ajaxurl, {
            action: 'refresh_ielts_exam_leaderboard',
            path: window.location.pathname,
            query_string: window.location.search
        }).done(function (html) {
            if (typeof html === 'string' && html.length > 0) {
                $target.replaceWith(html);
                console.log('refresh data successfully!');
            }
        });
    }
    */
});
