jQuery(document).ready(function ($) {
    $('#learner-password-reset-form').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_password_reset_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_password_reset',
                learner_password_reset_nonce: $('#learner_password_reset_nonce').val(),
                email_address: $('#email-address').val(),
            },
            beforeSend: function () {
                $('#learner-password-reset-form').find('button[type="submit"]').text('Sending password reset email...');
                $('#learner-password-reset-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    $('#learner-password-reset-form').find('button[type="submit"]').text('The email has been sent!');
                    setTimeout(() => {
                        window.location.href = "/learner-login/";
                    }, 2000);
                } else {
                    if(response.data['error'] == 'rate_limit_exceeded') {
                        alert(response.data['message']);
                    }
                    else {
                        alert(response.data);
                    }
                    $('#learner-password-reset-form').find('button[type="submit"]').text('Reset Password');
                }
            },
            error: function (error) {
                alert(error);
                $('#learner-password-reset-form').find('button[type="submit"]').text('Reset Password');
            },
            complete: function () {
                $('#learner-password-reset-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });
});