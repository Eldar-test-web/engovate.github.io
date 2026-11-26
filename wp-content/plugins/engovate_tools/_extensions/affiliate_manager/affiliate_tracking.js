/**
 * Affiliate referral tracker.
 *
 * Reads ?ref=CODE from the URL on every page view; if present, sets a cookie
 * (last-click attribution) and fires a single AJAX call to log the click.
 * Subsequent page views without ?ref= leave the cookie untouched.
 */
(function () {
    if (typeof affiliate_tracking_config === 'undefined') return;

    var COOKIE = affiliate_tracking_config.cookie_name;
    var DAYS = parseInt(affiliate_tracking_config.cookie_days, 10) || 60;
    var PARAM = affiliate_tracking_config.query_param || 'ref';

    function getQueryParam(name) {
        try {
            var url = new URL(window.location.href);
            return url.searchParams.get(name);
        } catch (e) {
            // very old browser fallback
            var match = window.location.search.match(new RegExp('[?&]' + name + '=([^&]+)'));
            return match ? decodeURIComponent(match[1]) : null;
        }
    }

    function setCookie(value, days) {
        var expires = new Date();
        expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);
        var secure = (window.location.protocol === 'https:') ? '; Secure' : '';
        document.cookie = COOKIE + '=' + encodeURIComponent(value)
            + '; expires=' + expires.toUTCString()
            + '; path=/; SameSite=Lax' + secure;
    }

    function getCookie(name) {
        var nameEQ = name + '=';
        var parts = document.cookie.split(';');
        for (var i = 0; i < parts.length; i++) {
            var c = parts[i].trim();
            if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length));
        }
        return null;
    }

    function trackClick(code) {
        if (typeof jQuery === 'undefined') return;
        jQuery.post(affiliate_tracking_config.ajaxurl, {
            action: 'affiliate_track_click',
            code: code,
            landing_url: window.location.href,
            referrer_url: document.referrer || ''
        });
    }

    var ref = getQueryParam(PARAM);
    if (ref) {
        ref = String(ref).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
        if (ref.length >= 4) {
            var prior = getCookie(COOKIE);
            // last-click attribution: always overwrite
            setCookie(ref, DAYS);
            // only fire AJAX click if code changed (avoid double-counting refresh)
            if (prior !== ref) {
                trackClick(ref);
            }
        }
    }
})();
