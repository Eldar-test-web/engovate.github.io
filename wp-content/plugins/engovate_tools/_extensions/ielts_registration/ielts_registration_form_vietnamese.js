jQuery(document).ready(function($) {

    // Form elements
    const form = $('#ielts-registration-form-vietnamese');
    const submitButton = $('#submit-ielts-registration');
    const responseMessage = $('#ielts-registration-response');
    const specialRequirementsSelect = $('#need_special_requirements');
    const specialRequirementsDetails = $('#special_requirements_details');

    // Initialize form
    initForm();

    // Form submission
    form.on('submit', function(e) {
        e.preventDefault();
        handleFormSubmission();
    });

    // Special requirements toggle
    specialRequirementsSelect.on('change', function() {
        toggleSpecialRequirements();
    });

    // Initialize form functionality
    function initForm() {
        // Set minimum date for test date (today)
        const today = new Date().toISOString().split('T')[0];
        $('#test_date').attr('min', today);
        
        // Set minimum date for identification expiry (today)
        $('#identification_expiry_date').attr('min', today);
        
        // Initialize special requirements
        toggleSpecialRequirements();
    }

    // Toggle special requirements details
    function toggleSpecialRequirements() {
        const selectedValue = specialRequirementsSelect.val();
        if (selectedValue == '1') {
            specialRequirementsDetails.show();
            $('#special_requirements_details_text').prop('required', true);
        } else {
            specialRequirementsDetails.hide();
            $('#special_requirements_details_text').prop('required', false);
        }
    }

    // Handle form submission
    function handleFormSubmission() {
        // Validate form
        if (!validateForm()) {
            return;
        }

        // Show loading state
        setLoadingState(true);

        // Prepare form data
        const formData = new FormData(form[0]);
        formData.append('action', 'ielts_registration_form_vietnamese_submit');

        // Submit form via AJAX
        $.ajax({
            url: ielts_registration_form_vietnamese_ajax.ajaxurl,
            type: 'POST',
            data: formData,
            processData: false,
            contentType: false,
            success: function(response) {
                if (response.success) {
                    // Hide submit button
                    submitButton.hide();
                    
                    // Show success message under the button
                    const successMessage = $('<div class="success-message">Cảm ơn bạn đã đăng ký! Chúng tôi sẽ liên hệ với bạn sớm nhất.</div>');
                    submitButton.parent().append(successMessage);
                    
                    // Disable all form fields
                    form.find('input, select, textarea').prop('disabled', true);
                } else {
                    showMessage(response.data || 'Có lỗi xảy ra. Vui lòng thử lại.', 'error');
                }
            },
            error: function(xhr, status, error) {
                console.error('AJAX Error:', error);
                showMessage('Có lỗi xảy ra. Vui lòng thử lại.', 'error');
            },
            complete: function() {
                setLoadingState(false);
            }
        });
    }

    // Validate form fields
    function validateForm() {
        let isValid = true;
        const requiredFields = form.find('[required]');
        
        // Clear previous error states
        form.find('.form-group').removeClass('error');
        
        // Check each required field
        requiredFields.each(function() {
            const field = $(this);
            const value = field.val().trim();
            
            if (!value) {
                field.closest('.form-group').addClass('error');
                isValid = false;
            }
        });

        // Validate email format
        const emailField = $('#email');
        const emailValue = emailField.val();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (emailValue && !emailRegex.test(emailValue)) {
            emailField.closest('.form-group').addClass('error');
            isValid = false;
        }

        // Validate phone number
        const phoneField = $('#phone_number');
        const phoneValue = phoneField.val();
        const phoneRegex = /^[0-9+\-\s()]+$/;
        
        if (phoneValue && !phoneRegex.test(phoneValue)) {
            phoneField.closest('.form-group').addClass('error');
            isValid = false;
        }

        // Validate identification number
        const idField = $('#identification_number');
        const idValue = idField.val();
        const idRegex = /^[0-9A-Za-z\s\-]+$/;
        
        if (idValue && !idRegex.test(idValue)) {
            idField.closest('.form-group').addClass('error');
            isValid = false;
        }

        // Validate dates
        const dateFields = ['#date_of_birth', '#identification_expiry_date', '#test_date'];
        dateFields.forEach(function(fieldSelector) {
            const field = $(fieldSelector);
            const value = field.val();
            
            if (value) {
                const selectedDate = new Date(value);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                
                // For test date and expiry date, should be in the future
                if ((fieldSelector === '#test_date' || fieldSelector === '#identification_expiry_date') && selectedDate <= today) {
                    field.closest('.form-group').addClass('error');
                    isValid = false;
                }
                
                // For date of birth, should be in the past and reasonable age
                if (fieldSelector === '#date_of_birth') {
                    const age = today.getFullYear() - selectedDate.getFullYear();
                    if (selectedDate > today || age < 10 || age > 120) {
                        field.closest('.form-group').addClass('error');
                        isValid = false;
                    }
                }
            }
        });

        if (!isValid) {
            showMessage('Vui lòng kiểm tra và điền đầy đủ thông tin bắt buộc.', 'error');
        }

        return isValid;
    }

    // Show message
    function showMessage(message, type) {
        responseMessage
            .removeClass('success error')
            .addClass(type)
            .text(message)
            .show();

        // Auto-hide success messages after 5 seconds
        if (type === 'success') {
            setTimeout(function() {
                responseMessage.fadeOut();
            }, 5000);
        }

        // Scroll to message
        $('html, body').animate({
            scrollTop: responseMessage.offset().top - 100
        }, 500);
    }

    // Set loading state
    function setLoadingState(loading) {
        const buttonText = submitButton.find('.button-text');
        const loadingSpinner = submitButton.find('.loading-spinner');
        
        if (loading) {
            submitButton.prop('disabled', true);
            buttonText.hide();
            loadingSpinner.show();
        } else {
            submitButton.prop('disabled', false);
            buttonText.show();
            loadingSpinner.hide();
        }
    }

    // Real-time validation
    form.find('input, select, textarea').on('blur', function() {
        const field = $(this);
        const value = field.val().trim();
        const isRequired = field.prop('required');
        
        if (isRequired && !value) {
            field.closest('.form-group').addClass('error');
        } else {
            field.closest('.form-group').removeClass('error');
        }
    });

    // Clear error on input
    form.find('input, select, textarea').on('input', function() {
        const field = $(this);
        field.closest('.form-group').removeClass('error');
    });

    // Phone number formatting
    $('#phone_number').on('input', function() {
        let value = $(this).val().replace(/\D/g, '');
        
        // Limit to 15 digits
        if (value.length > 15) {
            value = value.substring(0, 15);
        }
        
        $(this).val(value);
    });

    // Identification number formatting
    $('#identification_number').on('input', function() {
        let value = $(this).val();
        
        // Allow only alphanumeric characters, spaces, and hyphens
        value = value.replace(/[^0-9A-Za-z\s\-]/g, '');
        
        $(this).val(value);
    });

    // Auto-hide response messages on new input
    form.find('input, select, textarea').on('input change', function() {
        if (responseMessage.is(':visible')) {
            responseMessage.fadeOut();
        }
    });

    // Keyboard navigation for form
    form.find('input, select, textarea').on('keydown', function(e) {
        if (e.key === 'Enter' && e.target.type !== 'textarea') {
            e.preventDefault();
            const currentField = $(this);
            const nextField = currentField.closest('.form-group').next().find('input, select, textarea');
            
            if (nextField.length) {
                nextField.focus();
            } else {
                // If no next field, submit form
                form.submit();
            }
        }
    });

    // Accessibility improvements
    form.find('label').each(function() {
        const label = $(this);
        const forAttr = label.attr('for');
        
        if (forAttr) {
            const targetField = $('#' + forAttr);
            if (targetField.length) {
                // Add aria-describedby for required fields
                if (targetField.prop('required')) {
                    const requiredText = ' (bắt buộc)';
                    if (!label.text().includes(requiredText)) {
                        label.text(label.text() + requiredText);
                    }
                }
            }
        }
    });

    // Focus management
    form.find('input, select, textarea').on('focus', function() {
        $(this).closest('.form-group').addClass('focused');
    }).on('blur', function() {
        $(this).closest('.form-group').removeClass('focused');
    });

    // Form reset handler
    form.on('reset', function() {
        setTimeout(function() {
            form.find('.form-group').removeClass('error success focused');
            responseMessage.hide();
            toggleSpecialRequirements();
        }, 100);
    });
});
