jQuery(document).ready(function ($) {
    $('.learner-header-icon-button').on('click', function(e) {
        e.preventDefault();
        $('.learner-header-icon-dropdown-menu').toggle();
    });
    
    $(document).on('mousedown', function(e) {
        if (!$(e.target).closest('.learner-header-icon-button, .learner-header-icon-dropdown-menu').length) {
            $('.learner-header-icon-dropdown-menu').hide();
        }
    });

    $('.learner-header-icon-logout').on('click', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_header_icon_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_logout',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    window.location.href = '/engovate.github.io/learner-login/';
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
                $('.spinner-overlay').hide();
            },
        });
    });
});