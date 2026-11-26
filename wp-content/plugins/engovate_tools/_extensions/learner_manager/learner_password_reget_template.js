jQuery(document).ready(function ($) {
    $('#learner-password-reget-form').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_password_reget_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_password_reget',
                learner_password_reget_nonce: $('#learner_password_reget_nonce').val(),
                password: $('#password').val(),
                key: $('#reget-key').val(),
                login: $('#reget-login').val()
            },
            beforeSend: function () {
                $('#learner-password-reget-form').find('button[type="submit"]').text('Setting new password...');
                $('#learner-password-reget-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    $('#learner-password-reget-form').html('You have successfully set a new password!');
                    setTimeout(() => {
                        window.location.href = '/engovate.github.io/learner-login/';
                    }, 2000);
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
                $('#learner-password-reget-form').find('button[type="submit"]').text('Set New Password');
                $('#learner-password-reget-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });
});