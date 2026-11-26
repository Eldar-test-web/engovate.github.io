var engnovateRateLimitUntil = {};

function checkOrSaveRateLimit(actionKey, retryAfterSeconds) {
    var storageKey = actionKey + '_limit';
    if (retryAfterSeconds > 0) {
        engnovateRateLimitUntil[actionKey] = Date.now() + retryAfterSeconds * 1000;
        try {
            localStorage.setItem(storageKey, engnovateRateLimitUntil[actionKey]);
        } catch (e) {}
    }
    else if (engnovate_rate_limit_data.is_premium === '1') {
        return '';
    }
    var now = Date.now();
    var until = engnovateRateLimitUntil[actionKey] || 0;
    try {
        until = Math.max(until, parseInt(localStorage.getItem(storageKey), 10) || 0);
    } catch (e) {}
    if (until <= now) {
        return '';
    }
    var secondsLeft = Math.floor((until - now) / 1000);
    var daysLeft = Math.floor(secondsLeft / 86400);
    var waitFor = (daysLeft >= 1 ? daysLeft + 'd:' : '') + ('0' + Math.floor((secondsLeft % 86400) / 3600)).slice(-2) + 'h:' + ('0' + Math.floor((secondsLeft % 3600) / 60)).slice(-2) + 'm:' + ('0' + (secondsLeft % 60)).slice(-2) + 's';
    return 'You have reached your request limit. Please wait ' + waitFor + ' before making any more requests.\nAlternatively, you could remove this restriction by upgrading to our Premium plan.';
}
