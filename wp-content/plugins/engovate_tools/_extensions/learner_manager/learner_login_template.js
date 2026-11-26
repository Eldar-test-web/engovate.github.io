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
        $('.google-signin-button').hide();
        $('.signin-divider').hide();
    }

    $('.google-signin-button').on('click', function (e) {
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
                    url: learner_login_ajax.ajaxurl,
                    type: 'POST',
                    data: {
                        action: 'learner_google_signin',
                        learner_google_signin_nonce: $('#learner_google_signin_nonce').val(),
                        firebase_id_token: idToken,
                        first_name: firstName,
                        last_name: lastName,
                    },
                    beforeSend: function () {
                        $('.google-signin-button').html('Logging you in...');
                        $('.google-signin-button').prop('disabled', true);
                        $('#learner-login-form').find('button[type="submit"]').text('Logging you in...');
                        $('#learner-login-form').find('button[type="submit"]').prop('disabled', true);
                    },
                    success: function (response) {
                        if (response.success) {
                            window.location.href = '/engovate.github.io/learner-profile/';
                        } else {
                            alert(response.data && response.data.message ? response.data.message : response.data);
                        }
                    },
                    error: function (jqXHR) {
                        alert('Something went wrong while signing you in. Please refresh the page and try again. (error ' + (jqXHR.status || 0) + ' ' + (jqXHR.statusText || '') + ')');
                    },
                    complete: function () {
                        $('.google-signin-button').html('<i class="fa-brands fa-google"></i> Fast sign in with Google');
                        $('.google-signin-button').prop('disabled', false);
                        $('#learner-login-form').find('button[type="submit"]').text('Log In');
                        $('#learner-login-form').find('button[type="submit"]').prop('disabled', false);
                    },
                });
            })
            .catch((error) => {
                console.log(error);
                alert('Google Sign In Failed! Please try again!');
            });
    });

    $('#learner-login-form').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_login_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_login',
                learner_login_nonce: $('#learner_login_nonce').val(),
                email_address: $('#email-address').val(),
                password: $('#password').val(),
            },
            beforeSend: function () {
                $('#learner-login-form').find('button[type="submit"]').text('Logging you in...');
                $('#learner-login-form').find('button[type="submit"]').prop('disabled', true);
            },
            success: function (response) {
                if (response.success) {
                    window.location.href = '/engovate.github.io/learner-profile/';
                } else {
                    alert(response.data && response.data.message ? response.data.message : response.data);
                }
            },
            error: function (jqXHR) {
                alert('Something went wrong while logging you in. Please refresh the page and try again. (error ' + (jqXHR.status || 0) + ' ' + (jqXHR.statusText || '') + ')');
            },
            complete: function () {
                $('#learner-login-form').find('button[type="submit"]').text('Log In');
                $('#learner-login-form').find('button[type="submit"]').prop('disabled', false);
            },
        });
    });
});