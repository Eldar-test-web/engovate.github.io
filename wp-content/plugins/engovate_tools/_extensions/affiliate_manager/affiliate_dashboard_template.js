jQuery(document).ready(function ($) {
    var $dashboard = $('.affiliate-dashboard');
    if (!$dashboard.length) return;

    var ajaxurl = (typeof affiliate_dashboard_ajax !== 'undefined') ? affiliate_dashboard_ajax.ajaxurl : '/engovate.github.io/wp-admin/admin-ajax.php';
    var $nonce = $dashboard.find('input[name="affiliate_dashboard_nonce"]');

    function nonce() {
        return $nonce.val();
    }

    function toast(message, isError) {
        var $t = $('#affiliate-toast');
        $t.text(message).attr('data-error', isError ? '1' : '0').addClass('affiliate-toast--show');
        clearTimeout(toast._timer);
        toast._timer = setTimeout(function () {
            $t.removeClass('affiliate-toast--show');
        }, 3500);
    }

    // An error reply carries data as either a string or an object
    // (e.g. a rate limit gives {error, message}). Normalize to a string.
    function readMessage(response, fallback) {
        if (response && response.data) {
            if (typeof response.data === 'string') return response.data;
            if (response.data.message) return response.data.message;
        }
        return fallback;
    }

    // Enroll
    $('#affiliate-enroll-btn').on('click', function () {
        var $btn = $(this);
        $btn.prop('disabled', true).text('Enrolling…');
        $.post(ajaxurl, {
            action: 'affiliate_enroll',
            affiliate_dashboard_nonce: nonce()
        }, function (response) {
            if (response && response.success) {
                toast('You\'re in! Reloading…');
                setTimeout(function () { location.reload(); }, 700);
            } else {
                toast(readMessage(response, 'Enrollment failed.'), true);
                $btn.prop('disabled', false).text('Become an affiliate');
            }
        }).fail(function () {
            toast('Network error. Please try again.', true);
            $btn.prop('disabled', false).text('Become an affiliate');
        });
    });

    // Copy referral link
    $('#affiliate-copy-btn').on('click', function () {
        var $input = $('#affiliate-link-input');
        var value = $input.val();

        var done = function () {
            toast('Link copied to clipboard');
            var $btn = $('#affiliate-copy-btn');
            var orig = $btn.text();
            $btn.text('Copied');
            setTimeout(function () { $btn.text(orig); }, 1500);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(value).then(done, function () {
                $input.select();
                document.execCommand('copy');
                done();
            });
        } else {
            $input.select();
            try { document.execCommand('copy'); done(); }
            catch (e) { toast('Copy failed — please copy manually.', true); }
        }
    });

    // Save PayPal email — actually triggers a confirmation email; saving happens
    // when the user clicks the link in that email.
    $('#affiliate-save-paypal-btn').on('click', function () {
        var email = $('#affiliate-paypal-email').val().trim();
        if (!email) {
            toast('Please enter your PayPal email.', true);
            return;
        }
        var $btn = $(this).prop('disabled', true);
        $.post(ajaxurl, {
            action: 'affiliate_save_paypal',
            affiliate_dashboard_nonce: nonce(),
            paypal_email: email
        }, function (response) {
            $btn.prop('disabled', false);
            if (response && response.success) {
                toast(readMessage(response, 'Saved'));
            } else {
                toast(readMessage(response, 'Save failed.'), true);
            }
        }).fail(function () {
            $btn.prop('disabled', false);
            toast('Network error.', true);
        });
    });

    // Request payout
    $('#affiliate-request-payout-btn').on('click', function () {
        var $btn = $(this);
        if ($btn.prop('disabled')) return;
        $btn.prop('disabled', true).text('Requesting…');
        $.post(ajaxurl, {
            action: 'affiliate_request_payout',
            affiliate_dashboard_nonce: nonce()
        }, function (response) {
            if (response && response.success) {
                $('#affiliate-payout-note').text('Payout requested. You\'ll receive your payment via PayPal within 7 business days.');
                toast('Payout requested!');
                $btn.text('Requested');
            } else {
                toast(readMessage(response, 'Request failed.'), true);
                $btn.prop('disabled', false).text('Request payout');
            }
        }).fail(function () {
            toast('Network error.', true);
            $btn.prop('disabled', false).text('Request payout');
        });
    });
});
