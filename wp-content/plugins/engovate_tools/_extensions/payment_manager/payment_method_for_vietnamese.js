jQuery(document).ready(function ($) {
    //the checkout page is served from the cdn cache, so the region has to be worked out per visitor here rather than in php.
    //the timezone catches anyone whose device clock is set to vietnam, the language catches vietnamese speakers whose
    //device is set somewhere else, and ?vn=1 is the link to send anyone that both of those miss.
    var timezone = '';
    try {
        timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    } catch (error) {
        timezone = '';
    }

    //windows keeps one time zone for hanoi, bangkok and jakarta together and picks the city from the country setting,
    //so an english windows with the country left unset reports bangkok. Accept it, or those users never see the option.
    //Matched with [?&] and (&|$) so that ?xvn=1 and ?vn=12 do not turn it on by accident.
    var isInVietnamRegion = /[?&]vn=1(&|$)/.test(window.location.search) || timezone == 'Asia/Ho_Chi_Minh' || timezone == 'Asia/Saigon' || timezone == 'Asia/Bangkok';
    var browserLanguages = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || ''];
    for (var i = 0; i < browserLanguages.length; i++) {
        var browserLanguage = String(browserLanguages[i]).toLowerCase();
        if (browserLanguage == 'vi' || browserLanguage.indexOf('vi-') === 0) {
            isInVietnamRegion = true;
        }
    }
    if (isInVietnamRegion) {
        $('.payment-for-vietnamese-container').removeAttr('hidden');
    }

    $('.payment-for-vietnamese-info-button').on('click', function (event) {
        if($('.payment-for-vietnamese-info-wrapper').is(':visible')) {
            $('.payment-for-vietnamese-info-wrapper').hide();
            $(this).find('.payment-for-vietnamese-toggle-icon').removeClass('fa-chevron-down').addClass('fa-arrow-right');
        }
        else {
            $('.payment-for-vietnamese-info-wrapper').show();
            $(this).find('.payment-for-vietnamese-toggle-icon').removeClass('fa-arrow-right').addClass('fa-chevron-down');
        }
    });

    //payment_prices.js only moves .selected inside its own list, so mirror the choice onto the vnd rows.
    //without this the panel keeps the plan the page loaded with and creates the qr for the wrong amount
    $('.payment-checkout-form .payment-price').on('click', function (e) {
        var selectedPlan = $(this).data('plan');
        $('.vietnamese-payment-price').removeClass('selected').find('input').prop('checked', false);
        $('.vietnamese-payment-price[data-plan="' + selectedPlan + '"]').addClass('selected').find('input').prop('checked', true);
    });

    $('.vietnamese-payment-price').on('click', function (e) {
        e.preventDefault();
        $('.vietnamese-payment-price').removeClass('selected');
        $('.vietnamese-payment-price').find('input').prop('checked', false);
        $(this).addClass('selected');
        $(this).find('input').prop('checked', true);
    });

    $('.vietnamese-payment-create-checkout-button').on('click', function (e) {
        e.preventDefault();

        var email = $('#vietnamese-payment-email').val();
        var selectedPlan = $('.vietnamese-payment-price.selected').data('plan');

        if(!email) {
            alert('Vui lòng nhập email để nhận mã kích hoạt tài khoản premium!');
            return;
        }

        if(!selectedPlan) {
            alert('Vui lòng chọn gói để tạo thông tin QR chuyển khoản!');
            return;
        }

        $.ajax({
            url: payment_method_for_vietnamese_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'create_payos_payment_link',
                payment_checkout_nonce: $('#payment_checkout_nonce').val(),
                user_email: email,
                subscription_plan: selectedPlan,
            },
            beforeSend: function () {
                $('.vietnamese-payment-create-checkout-button').html('Đang tạo thông tin QR chuyển khoản... <i class="fa-solid fa-spinner fa-spin"></i>');
                $('.vietnamese-payment-create-checkout-button').prop('disabled', true);
                $('.vietnamese-payment-create-checkout-button-link').remove();
            },
            success: function (response) {
                if (response.success && response.data['checkout_url']) {
                    window.open(response.data['checkout_url'], '_blank');
                    // create a url under the button in case browser doesn't open the new tab automatically
                    $('.vietnamese-payment-create-checkout-button').after('<div style="margin-top: 20px;" class="vietnamese-payment-create-checkout-button-link"><a href="' + response.data['checkout_url'] + '" target="_blank" rel="nofollow">Nếu trình duyệt không tự động chuyển hướng đến trang thanh toán, hãy nhấn vào đây <i class="fa-solid fa-arrow-right"></i></a></div>');
                } else {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else {
                        alert(response.data);
                    }
                }
            },
            error: function (error) {
                alert(error);
            },
            complete: function () {
                $('.vietnamese-payment-create-checkout-button').html('Tạo thông tin QR chuyển khoản <i class="fa-solid fa-qrcode"></i>');
                $('.vietnamese-payment-create-checkout-button').prop('disabled', false);
            },
        });
    });
});