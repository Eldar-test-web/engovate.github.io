// Stub for server-only rate-limit data used by the original plugin JS.
// On a static mirror there is no account/premium state; treat as free user.
window.engnovate_rate_limit_data = window.engnovate_rate_limit_data || {
  is_premium: '0',
  remaining: '0'
};
if (typeof window.checkOrSaveRateLimit !== 'function') {
  window.checkOrSaveRateLimit = function () { return ''; };
}
