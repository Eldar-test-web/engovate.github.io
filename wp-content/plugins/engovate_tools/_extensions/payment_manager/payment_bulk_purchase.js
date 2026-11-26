jQuery(document).ready(function ($) {
    $('.bulk-purchase-container').each(function () {
        var bulkPurchaseContainer = $(this);
        var bulkPurchaseConfig = payment_bulk_purchase_ajax.bulk_config;

        bulkPurchaseContainer.find('.bulk-purchase-info-button').on('click', function (e) {
            e.preventDefault();
            var infoWrapper = bulkPurchaseContainer.find('.bulk-purchase-info-wrapper');
            if (infoWrapper.is(':visible')) {
                infoWrapper.hide();
                $(this).find('.fa-chevron-down').replaceWith('<i class="fa-solid fa-arrow-right"></i>');
            }
            else {
                infoWrapper.show();
                $(this).find('.fa-arrow-right').replaceWith('<i class="fa-solid fa-chevron-down"></i>');
                updateBulkPurchaseSummary();
            }
        });

        function updateBulkPurchaseSummary() {
            var plan = bulkPurchaseContainer.find('.bulk-purchase-plan').val();
            var seats = parseInt(bulkPurchaseContainer.find('.bulk-purchase-seats').val(), 10);
            var planPrice = parseFloat(payment_bulk_purchase_ajax.subscription_plans[plan]);

            if (!planPrice || !seats || seats < bulkPurchaseConfig.min_seats || seats > bulkPurchaseConfig.max_seats) {
                bulkPurchaseContainer.find('.bulk-purchase-summary').html('<em>Choose between ' + bulkPurchaseConfig.min_seats + ' and ' + bulkPurchaseConfig.max_seats + ' codes.</em>');
                return;
            }

            var discount = 0;
            $.each(bulkPurchaseConfig.discounts, function (requiredSeats, tierDiscount) {
                if (seats >= parseInt(requiredSeats, 10)) {
                    discount = parseInt(tierDiscount, 10);
                }
            });

            var fullPriceInCents = Math.round(planPrice * 100) * seats;
            var priceInCents = Math.round(fullPriceInCents * (100 - discount) / 100);

            var summary = '<div><strong class="bulk-purchase-total">$' + (priceInCents / 100).toFixed(2) + '</strong> for ' + seats + ' codes</div>';
            summary += '<div class="bulk-purchase-per-code">(only $' + (priceInCents / 100 / seats).toFixed(2) + ' per code)</div>';
            if (discount > 0) {
                summary += '<div class="bulk-purchase-saving">' + discount + '% off &mdash; you save $' + ((fullPriceInCents - priceInCents) / 100).toFixed(2) + '</div>';
            }

            bulkPurchaseContainer.find('.bulk-purchase-summary').html(summary);
        }

        bulkPurchaseContainer.find('.bulk-purchase-plan, .bulk-purchase-seats').on('change keyup input', function () {
            updateBulkPurchaseSummary();
        });

        bulkPurchaseContainer.find('.bulk-purchase-checkout-button').on('click', function (e) {
            e.preventDefault();

            var checkoutButton = $(this);

            $.ajax({
                url: payment_bulk_purchase_ajax.ajaxurl,
                type: 'POST',
                data: {
                    action: 'create_polarsh_bulk_checkout',
                    payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                    subscription_plan: bulkPurchaseContainer.find('.bulk-purchase-plan').val(),
                    seats: bulkPurchaseContainer.find('.bulk-purchase-seats').val(),
                },
                beforeSend: function () {
                    checkoutButton.html('Creating your checkout... <i class="fa-solid fa-spinner fa-spin"></i>');
                    checkoutButton.prop('disabled', true);
                },
                success: function (response) {
                    if (response.success && response.data['checkout_url']) {
                        window.location.href = response.data['checkout_url'];
                    } else {
                        if (response.data['error'] == 'rate_limit_exceeded') {
                            alert(response.data['message']);
                        }
                        else {
                            alert(response.data);
                        }
                    }
                },
                error: function (error) {
                    console.log(error);
                    alert("Something went wrong. Please try again or contact support for assistance.");
                },
                complete: function () {
                    checkoutButton.html('Continue to checkout <i class="fa-solid fa-arrow-right"></i>');
                    checkoutButton.prop('disabled', false);
                },
            });
        });
    });
});
