jQuery(document).ready(function ($) {
    //get the order number, user email, and activation code from the url
    var urlParams = new URLSearchParams(window.location.search);
    var paymentType = urlParams.get('payment_type');
    var orderNumber = urlParams.get('order_number');
    var userEmail = urlParams.get('user_email');
    var activationCode = urlParams.get('activation_code');

    if (paymentType == 'paypal') {
        //for Paypal, we need to confirm the payment first by order number (the PayPal order id).
        //a verified payment never changes, so once it is cached a refresh renders from the browser and skips the server
        var paypalCacheKey = 'payment_confirmation_paypal_' + orderNumber;
        var paypalCached = readPaymentCache(paypalCacheKey);

        if (paypalCached) {
            userEmail = paypalCached.userEmail;
            activationCode = paypalCached.activationCode;
            displayPaymentConfirmation();
            saveActivationCode();
        }
        else $.ajax({
            url: payment_success_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'verify_paypal_checkout_session',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                order_number: orderNumber,
            },
            success: function (response) {
                if (response.success) {
                    userEmail = response.data['user_email'];
                    activationCode = response.data['activation_code'];
                    displayPaymentConfirmation();
                    sendConfirmationEmail();
                    saveActivationCode();
                    writePaymentCache(paypalCacheKey, { userEmail: userEmail, activationCode: activationCode });
                } else {
                    //the server explains what happened, for example that another request is finalising this order
                    if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else if (typeof response.data === 'string' && response.data) {
                        alert(response.data);
                    }
                    else {
                        alert("Something went wrong. If you've been charged, please contact support for assistance.");
                    }
                    console.log(response);
                }
            },
            error: function (error) {
                console.log(error);
                alert("Something went wrong. If you've been charged, please contact support for assistance.");
            },
        });
    }
    else if (paymentType == 'polar') {
        //for Polar, we need to confirm the payment first by order number (checkout_id).
        //a verified payment never changes, so once it is cached a refresh renders from the browser and skips the server
        var polarCacheKey = 'payment_confirmation_polar_' + orderNumber;
        var polarCached = readPaymentCache(polarCacheKey);

        if (polarCached && polarCached.activationCodes) {
            userEmail = polarCached.userEmail;
            displayBulkPaymentConfirmation(polarCached.activationCodes, polarCached.seats);
        }
        else if (polarCached) {
            userEmail = polarCached.userEmail;
            activationCode = polarCached.activationCode;
            displayPaymentConfirmation();
            saveActivationCode();
        }
        else $.ajax({
            url: payment_success_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'verify_polarsh_checkout_session',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                order_number: orderNumber,
            },
            success: function (response) {
                if (response.success) {
                    userEmail = response.data['user_email'];

                    //a bulk order comes back with a list of codes instead of a single one, and is emailed by the server,
                    //so there is nothing to confirm by email or to keep in the cookie here
                    if (response.data['activation_codes']) {
                        displayBulkPaymentConfirmation(response.data['activation_codes'], response.data['seats']);
                        writePaymentCache(polarCacheKey, { userEmail: userEmail, activationCodes: response.data['activation_codes'], seats: response.data['seats'] });
                        return;
                    }

                    activationCode = response.data['activation_code'];
                    displayPaymentConfirmation();
                    sendConfirmationEmail();
                    saveActivationCode();
                    writePaymentCache(polarCacheKey, { userEmail: userEmail, activationCode: activationCode });
                } else {
                    //the server explains what happened, for example that another request is finalising this order
                    if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else if (typeof response.data === 'string' && response.data) {
                        alert(response.data);
                    }
                    else {
                        alert("Something went wrong. If you've been charged, please contact support for assistance.");
                    }
                    console.log(response);
                }
            },
            error: function (error) {
                console.log(error);
                alert("Something went wrong. If you've been charged, please contact support for assistance.");
            },
        });
    }
    else if (paymentType == 'stripe') {
        //for Stripe, we need to confirm the payment first by order number (the checkout session id).
        //a verified payment never changes, so once it is cached a refresh renders from the browser and skips the server
        var stripeCacheKey = 'payment_confirmation_stripe_' + orderNumber;
        var stripeCached = readPaymentCache(stripeCacheKey);

        if (stripeCached) {
            userEmail = stripeCached.userEmail;
            activationCode = stripeCached.activationCode;
            displayPaymentConfirmation();
            saveActivationCode();
        }
        else $.ajax({
            url: payment_success_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'verify_stripe_checkout_session',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                order_number: orderNumber,
            },
            success: function (response) {
                if (response.success) {
                    userEmail = response.data['user_email'];
                    activationCode = response.data['activation_code'];
                    displayPaymentConfirmation();
                    sendConfirmationEmail();
                    saveActivationCode();
                    writePaymentCache(stripeCacheKey, { userEmail: userEmail, activationCode: activationCode });
                } else {
                    //the server explains what happened, for example that a bank payment is still going through
                    if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else if (typeof response.data === 'string' && response.data) {
                        alert(response.data);
                    }
                    else {
                        alert("Something went wrong. If you've been charged, please contact support for assistance.");
                    }
                    console.log(response);
                }
            },
            error: function (error) {
                console.log(error);
                alert("Something went wrong. If you've been charged, please contact support for assistance.");
            },
        });
    }
    else if (paymentType == 'dodopayments') {
        //for Dodo Payments, the payment id comes back in the redirect url, so confirm the payment first by order number (payment_id).
        orderNumber = urlParams.get('payment_id');

        //a verified payment never changes, so once it is cached a refresh renders from the browser and skips the server
        var dodoCacheKey = 'payment_confirmation_dodopayments_' + orderNumber;
        var dodoCached = readPaymentCache(dodoCacheKey);

        if (dodoCached && dodoCached.activationCodes) {
            userEmail = dodoCached.userEmail;
            displayBulkPaymentConfirmation(dodoCached.activationCodes, dodoCached.seats);
        }
        else if (dodoCached) {
            userEmail = dodoCached.userEmail;
            activationCode = dodoCached.activationCode;
            displayPaymentConfirmation();
            saveActivationCode();
        }
        else $.ajax({
            url: payment_success_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'verify_dodopayments_checkout_session',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                order_number: orderNumber,
            },
            success: function (response) {
                if (response.success) {
                    userEmail = response.data['user_email'];

                    //a bulk order comes back with a list of codes instead of a single one, and is emailed by the server,
                    //so there is nothing to confirm by email or to keep in the cookie here
                    if (response.data['activation_codes']) {
                        displayBulkPaymentConfirmation(response.data['activation_codes'], response.data['seats']);
                        writePaymentCache(dodoCacheKey, { userEmail: userEmail, activationCodes: response.data['activation_codes'], seats: response.data['seats'] });
                        return;
                    }

                    activationCode = response.data['activation_code'];
                    displayPaymentConfirmation();
                    sendConfirmationEmail();
                    saveActivationCode();
                    writePaymentCache(dodoCacheKey, { userEmail: userEmail, activationCode: activationCode });
                } else {
                    //the server explains what happened, for example that another request is finalising this order
                    if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else if (typeof response.data === 'string' && response.data) {
                        alert(response.data);
                    }
                    else {
                        alert("Something went wrong. If you've been charged, please contact support for assistance.");
                    }
                    console.log(response);
                }
            },
            error: function (error) {
                console.log(error);
                alert("Something went wrong. If you've been charged, please contact support for assistance.");
            },
        });
    }
    else if (paymentType == 'payos') {
        //for PayOS, we need to confirm the payment first by payment id
        orderNumber = urlParams.get('id');
        var paymentStatus = urlParams.get('status');

        if(paymentStatus != 'PAID') {
            var payosPaymentLink = $('<a></a>')
                .attr('href', 'https://pay.payos.vn/web/' + encodeURIComponent(orderNumber))
                .text('Please finish the payment!');
            $('.payment-confirmation-form').empty().append(payosPaymentLink);
            $('.payment-confirmation-form').css('display', 'flex');
            $('.spinner-wrapper').hide();
        }
        else {

            //a verified payment never changes, so once it is cached a refresh renders from the browser and skips the server
            var payosCacheKey = 'payment_confirmation_payos_' + orderNumber;
            var payosCached = readPaymentCache(payosCacheKey);

            if (payosCached) {
                userEmail = payosCached.userEmail;
                activationCode = payosCached.activationCode;
                displayPaymentConfirmation();
                saveActivationCode();
            }
            else $.ajax({
                url: payment_success_ajax.ajaxurl,
                type: 'POST',
                data: {
                    action: 'verify_payos_payment',
                    payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                    order_number: orderNumber,
                    user_email: userEmail,
                },
                success: function (response) {
                    if (response.success) {
                        userEmail = response.data['user_email']; // we don't actually need this since we already have it from the url. But just to make it the same as the other payment types.
                        activationCode = response.data['activation_code'];
                        displayPaymentConfirmation();
                        sendConfirmationEmail();
                        saveActivationCode();
                        writePaymentCache(payosCacheKey, { userEmail: userEmail, activationCode: activationCode });
                    } else {
                        //the server explains what happened, for example that another request is finalising this order
                        if (response.data && response.data['error'] == 'rate_limit_exceeded') {
                            alert(response.data['message']);
                        }
                        else if (typeof response.data === 'string' && response.data) {
                            alert(response.data);
                        }
                        else {
                            alert("Something went wrong. If you've been charged, please contact support for assistance.");
                        }
                        console.log(response);
                    }
                },
                error: function (error) {
                    console.log(error);
                    alert("Something went wrong. If you've been charged, please contact support for assistance.");
                },
            });
        }
    }
    else {
        $('.payment-confirmation-form').html('<a href="/payment-checkout/">Please check out first!</a>');
        $('.payment-confirmation-form').css('display', 'flex');
        $('.spinner-wrapper').hide();
    }

    function displayBulkPaymentConfirmation(activationCodes, seats) {
        var bulkPaymentConfirmationForm = $('.bulk-payment-confirmation-form');
        var codesHtml = '';
        for (var i = 0; i < activationCodes.length; i++) {
            codesHtml += '<div>' + activationCodes[i] + '</div>';
        }

        //the order number comes from the url, so put it in as text rather than markup
        bulkPaymentConfirmationForm.find('.payment-confirm-order-id').text(orderNumber);
        bulkPaymentConfirmationForm.find('.payment-confirm-user-email').text(userEmail);
        bulkPaymentConfirmationForm.find('.payment-confirm-code-count').text(activationCodes.length);
        bulkPaymentConfirmationForm.find('.payment-confirm-activation-codes').html(codesHtml);

        //say so plainly if fewer codes came back than were paid for, rather than showing a short list as if it were complete
        if (seats && activationCodes.length < seats) {
            bulkPaymentConfirmationForm.find('.payment-confirm-shortfall')
                .text('We could only issue ' + activationCodes.length + ' of the ' + seats + ' codes you paid for. Please contact helloengnovate@gmail.com and we will send the rest.')
                .show();
        }

        bulkPaymentConfirmationForm.css('display', 'flex');
        $('.spinner-wrapper').hide();
    }

    function displayPaymentConfirmation() {
        var paymentConfirmationForm = $('.payment-confirmation-form');
        //all three of these come off the url, so put them in as text rather than markup
        paymentConfirmationForm.find('.payment-confirm-order-id').text(orderNumber);
        paymentConfirmationForm.find('.payment-confirm-user-email').text(userEmail);
        paymentConfirmationForm.find('.payment-confirm-activation-code').text(activationCode);
        paymentConfirmationForm.find('.go-to-profile-button').attr('href', '/learner-profile/?activation_code=' + encodeURIComponent(activationCode));
        paymentConfirmationForm.css('display', 'flex');
        $('.spinner-wrapper').hide();
    }

    function sendConfirmationEmail() {
        $.ajax({
            url: payment_success_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'send_confirm_payment_checkout_email',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                user_email: userEmail,
                order_number: orderNumber,
                activation_code: activationCode
            },
            success: function (response) {
                if (response.success) {
                    console.log('Email sent!');
                } else {
                    console.log(response);
                }
            },
            error: function (error) {
                console.log(error);
            },
        });
    }

    function saveActivationCode() {
        writePaymentCache('saved_premium_activation_code', { code: activationCode });
    }

    //A verified payment is final, so its confirmation is kept in localStorage and the page renders from there on a
    //refresh instead of asking the server again. Every access is guarded because localStorage throws in private mode
    //and when a browser blocks site data, and in that case we simply fall back to the normal server round trip.
    function readPaymentCache(cacheKey) {
        try {
            var stored = window.localStorage.getItem(cacheKey);
            if (!stored) {
                return null;
            }

            var cached = JSON.parse(stored);

            //keep it for the same 10 days the saved activation code cookie uses
            if (!cached || !cached.savedAt || (new Date().getTime() - cached.savedAt) > 10 * 24 * 60 * 60 * 1000) {
                window.localStorage.removeItem(cacheKey);
                return null;
            }

            return cached;
        }
        catch (e) {
            return null;
        }
    }

    function writePaymentCache(cacheKey, data) {
        try {
            data.savedAt = new Date().getTime();
            window.localStorage.setItem(cacheKey, JSON.stringify(data));
        }
        catch (e) {
            //nothing to do, the page just verifies with the server again next time
        }
    }

});