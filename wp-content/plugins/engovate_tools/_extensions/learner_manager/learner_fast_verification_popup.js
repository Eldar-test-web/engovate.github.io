jQuery(document).ready(function ($) {

    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebase_info.config);
        } else {
            firebase.app();
        }
    }
    catch (error) {
        console.log(error);
        $('.google-fast-verification-button').hide();
        $('.fast-verification-divider').hide();
    }

    $('.google-fast-verification-button').on('click', function (e) {
        const googleProvider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(googleProvider)
            .then((result) => {
                // Get the signed Firebase ID token. The server verifies it
                // and pulls the email from the verified payload — never from
                // anything we send in the body.
                return result.user.getIdToken();
            })
            .then((idToken) => {
                $.ajax({
                    url: learner_fast_verification_ajax.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'learner_google_fast_verification',
                        learner_google_fast_verification_nonce: $('#learner_google_fast_verification_nonce').val(),
                        firebase_id_token: idToken,
                    },
                    beforeSend: function () {
                        $('.google-fast-verification-button').html('Verifying Your Identity...');
                        $('.google-fast-verification-button').prop('disabled', true);
                        $('#fast-verification-form').find('button[type="submit"] span').text('Sending Verification Request...');
                        $('#fast-verification-form').find('button[type="submit"]').prop('disabled', true);
                    },
                    success: function (response) {
                        if (response.success) {
                            $('.close-fast-verification-popup-button').click();
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
                        $('.google-fast-verification-button').html('<i class="fa-brands fa-google"></i> Fast verification with Google');
                        $('.google-fast-verification-button').prop('disabled', false);
                        $('#fast-verification-form').find('button[type="submit"] span').text('Verify My Identity');
                        $('#fast-verification-form').find('button[type="submit"]').prop('disabled', false);
                    },
                });
            })
            .catch((error) => {
                console.log(error);
                alert('Google Verification Failed! Please try again!');
            });
    });

    $('#fast-verification-form').on('submit', function (event) {
        event.preventDefault();

        var emailAddress = $('#fast-verification-email-address').val();

        if(emailAddress.includes('@gmail.com')) {
            alert('Please use Google/Gmail Verification instead. Verification with Email/Code is not supported for Gmail users.');
            return;
        }

        $('#verification-confirm-email-address').text(emailAddress);
        
        $.ajax({
            url: learner_fast_verification_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_prepare_fast_verification',
                learner_fast_verification_nonce: $('#learner_fast_verification_nonce').val(),
                email_address: emailAddress, 
            },
            beforeSend: function () {
                $('#fast-verification-form').find('button[type="submit"] span').text('Sending Verification Request...');
                $('#fast-verification-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    
                    var successReason = response.data['reason'];

                    if(successReason == 'user_verified') {
                        $('.close-fast-verification-popup-button').click();
                    }
                    else {
                        $('#fast-verification-form').hide();
                        $('#verification-confirm-form').css('display', 'flex');
                    }

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
                $('#fast-verification-form').find('button[type="submit"] span').text('Verify My Identity');
                $('#fast-verification-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });

    $('#verification-confirm-form').on('submit', function (event) {
        event.preventDefault();

        var emailAddress = $('#fast-verification-email-address').val();
        var verificationCode = $('#verification-confirm-code').val().trim();
        
        $.ajax({
            url: learner_fast_verification_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_confirm_fast_verification',
                learner_fast_verification_nonce: $('#learner_fast_verification_nonce').val(),
                email_address: emailAddress,
                verification_code: verificationCode
            },
            beforeSend: function () {
                $('#verification-confirm-form').find('button[type="submit"] span').text('Checking Code...');
                $('#verification-confirm-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    $('.close-fast-verification-popup-button').click();
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
                $('#verification-confirm-form').find('button[type="submit"] span').text("I'm done!");
                $('#verification-confirm-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });

    $('#reenter-fast-verification-info').on('click', function (event) {
        $('#fast-verification-form').css('display', 'flex');
        $('#verification-confirm-form').hide();
    });

    $('.close-fast-verification-popup-button').on('click', function (event) {
        $('#fast-verification-form').css('display', 'flex');
        $('#verification-confirm-form').hide();
        $('.fast-verification-popup-container').hide();
    });
});