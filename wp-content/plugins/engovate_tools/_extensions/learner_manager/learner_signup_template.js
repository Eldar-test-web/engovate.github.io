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
        $('.google-signup-button').hide();
        $('.signup-divider').hide();
    }

    $('.google-signup-button').on('click', function (e) {
        const googleProvider = new firebase.auth.GoogleAuthProvider();
        firebase.auth().signInWithPopup(googleProvider)
            .then((result) => {
                var firstName = result.additionalUserInfo.profile.given_name;
                var lastName = result.additionalUserInfo.profile.family_name;
                // Get the signed Firebase ID token. The server verifies it
                // and pulls the email from the verified payload — never from
                // anything we send in the body.
                return result.user.getIdToken().then((idToken) => ({ idToken, firstName, lastName }));
            })
            .then(({ idToken, firstName, lastName }) => {
                $.ajax({
                    url: learner_signup_ajax.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'learner_google_signin',
                        learner_google_signin_nonce: $('#learner_google_signin_nonce').val(),
                        firebase_id_token: idToken,
                        first_name: firstName,
                        last_name: lastName,
                    },
                    beforeSend: function () {
                        $('.google-signup-button').html('Signing you up...');
                        $('.google-signup-button').prop('disabled', true);
                        $('#learner-signup-form').find('button[type="submit"]').text('Signing you up...');
                        $('#learner-signup-form').find('button[type="submit"]').prop('disabled', true);
                    },
                    success: function (response) {
                        if (response.success) {
                            window.location.href = '/engovate.github.io/learner-profile/';
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
                        $('.google-signup-button').html('<i class="fa-brands fa-google"></i> Fast sign up with Google');
                        $('.google-signup-button').prop('disabled', false);
                        $('#learner-signup-form').find('button[type="submit"]').text('Register');
                        $('#learner-signup-form').find('button[type="submit"]').prop('disabled', false);
                    },
                });
            })
            .catch((error) => {
                console.log(error);
                alert('Google Sign Up Failed! Please try again!');
            });
    });

    $('#learner-signup-form').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_signup_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_signup',
                learner_signup_nonce: $('#learner_signup_nonce').val(),
                email_address: $('#email-address').val(),
                first_name: $('#first-name').val(),
                last_name: $('#last-name').val(),
                password: $('#password').val(),
            },
            beforeSend: function () {
                $('.google-signup-button').html('Signing you up...');
                $('.google-signup-button').prop('disabled', true);
                $('#learner-signup-form').find('button[type="submit"]').text('Signing you up...');
                $('#learner-signup-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    $('#learner-signup-form').html("<div>Thank you for signing up!<br><strong>Please check your email to verify your account and complete the registration process.</strong><br>If you can't find the email, remember to check your spam folder.</div>");
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
                $('.google-signup-button').html('<i class="fa-brands fa-google"></i> Fast sign up with Google');
                $('.google-signup-button').prop('disabled', false);
                $('#learner-signup-form').find('button[type="submit"]').text('Register');
                $('#learner-signup-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });
});