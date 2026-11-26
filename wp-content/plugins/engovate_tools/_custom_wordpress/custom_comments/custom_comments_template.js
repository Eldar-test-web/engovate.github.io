jQuery(document).ready(function($) {

    function performCustomSetup() {
        $('#comment').attr('rows', 1);
        $('.comment-form-cookies-consent label').text('Save my name and email in this browser for the next time I comment.');
        $('.comment-author').each(function () {
            var authorName = $(this).find('cite').text();
            var firstLetter = authorName.charAt(0).toUpperCase();
            $(this).prepend('<span class="comment-avatar">' + firstLetter + '</span>');
        });
        $('.comment-navigation-wrapper').html(generatePaginationHtml());

        var cookies = document.cookie.split(';');
        for(var i = 0; i < cookies.length; i++) {
            var c = jQuery.trim(cookies[i]);
            if (c.indexOf('comment_author=') == 0) {
                $('#author').val(c.substring('comment_author='.length, c.length));
            }
            if (c.indexOf('comment_author_email=') == 0) {
                $('#email').val(c.substring('comment_author_email='.length, c.length));
            }
            if (c.indexOf('comment_author_url=') == 0) {
                $('#url').val(c.substring('comment_author_url='.length, c.length));
            }
            if (c.indexOf('save_info_checkbox=') == 0) {
            var checkboxState = c.substring('save_info_checkbox='.length, c.length);
                $('#wp-comment-cookies-consent').prop('checked', checkboxState === 'true');
            }
        }
    }

    //call on load
    performCustomSetup();

    $(document).on('submit', '.comment-form', function(e) {
        e.preventDefault();

        var d = new Date();
        d.setTime(d.getTime() + (365*24*60*60*1000)); // Set the cookie to expire in 1 year
        var expires = 'expires='+ d.toUTCString();
        if ($('#wp-comment-cookies-consent').prop('checked')) {
            document.cookie = 'comment_author=' + $('#author').val() + ';' + expires + ';path=/';
            document.cookie = 'comment_author_email=' + $('#email').val() + ';' + expires + ';path=/';
            document.cookie = 'comment_author_url=' + $('#url').val() + ';' + expires + ';path=/';
            document.cookie = 'save_info_checkbox=true;' + expires + ';path=/';
        } else {
            // Set the cookies with an expiry date in the past to remove them
            document.cookie = 'comment_author=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'comment_author_email=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'comment_author_url=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
            document.cookie = 'save_info_checkbox=false;' + expires + ';path=/';
        }

        var currentCommentText = $(this).find('textarea').val();

        $.ajax({
            type: 'POST',
            dataType: 'json',
            url: custom_comments_template_ajax.ajaxurl,
            data: $(this).serialize() + '&action=custom_comments_submit&paged=' + $('#paged').val() + '&nonce=' + custom_comments_template_ajax.nonce,
            beforeSend: function () {
                $('#submit').prop('disabled', true).val('Submitting...');
            }, 
            success: function(result){
                if(!result.success){
                    alert(result.data);
                }else{
                    $('#comments').replaceWith(result.data);
                    // Update the URL
                    history.pushState({}, '', '?comment-page=' + parseInt($('#paged').val()));
                    performCustomSetup();

                    $('.comment-list li').each(function(index, commentItem) {
                        if(currentCommentText === $(commentItem).find('p').text().trim()) {
                            //scroll to this commentItem
                            $('html, body').animate({
                                scrollTop: $(commentItem).offset().top - 100
                            }, 500);
                            // Make the comment grow bigger
                            $(commentItem).css({
                                transition: 'transform 0.5s, background-color 0.5s',
                                transform: 'scale(1.05)',
                                'background-color': 'lightgray'
                            });
                
                            // After a delay, reset the size of the commentItem
                            setTimeout(function() {
                                $(commentItem).css({
                                    transform: 'scale(1)',
                                    'background-color': 'rgb(250, 250, 250)'
                                });
                            }, 1000);
                            return false;
                        }
                    });
                }
            },
            error: function(e){
                alert(e.responseText);
            },
            complete: function () {
                $('#submit').prop('disabled', false).val('Post Comment');
            },
        });
        return false;
    });


    $(document).on('click', '.comment-pagination a', function(e) {
        e.preventDefault();
        var post_id = $("#comment_post_ID").val();
        var page = $(this).data("page");

        $.ajax({
            type : "POST",
            dataType : "json",
            url : custom_comments_template_ajax.ajaxurl,
            data : { action: "custom_load_comments", post_id: post_id, page: page, nonce: custom_comments_template_ajax.nonce },
            beforeSend: function () {
                $('.comment-list').fadeOut('fast');
            },
            success: function(result){
                if(!result.success){
                    alert(result.data);
                }else{
                    $('#comments').replaceWith(result.data);
                    // Update the URL
                    history.pushState({}, '', '?comment-page=' + parseInt($('#paged').val()));
                    performCustomSetup();
                }
            },
            error: function(e){
                alert(e.responseText);
            },
            complete: function () {
                $('.comment-list').fadeIn('fast');
            },
        });
    });

    //a hacky solution to avoid the default weird scrolling behavior when clicking the reply button
    $(document).on('click', '.comment-reply-link, #cancel-comment-reply-link', function(e) {
        e.preventDefault();
        // Save the current scroll position
        var oldScroll = $(window).scrollTop();
        // Wait for the old code to execute and then counteract the scroll
        setTimeout(function() {
        $(window).scrollTop(oldScroll);
        }, 1);
    });

    function generatePaginationHtml() {

        let maxNumPages = parseInt($('#pages').val());
        let currentPage = parseInt($('#paged').val());

        let paginationHtml = '<nav class="comment-pagination">';
    
        if (maxNumPages <= 1) {
            for (let i = 1; i <= maxNumPages; i++) {
                const rel = i === currentPage - 1 ? 'rel="prev"' : i === currentPage + 1 ? 'rel="next"' : '';
                paginationHtml += `<a href="#" class="comment-pagination-item ${i === currentPage ? 'current" aria-current="page" ' : '"'} data-page="${i}" ${rel}>${i}</a>`;
            }
        } else {
            const range = 1; // Number of pages to display around the current page
            const start = Math.max(1, currentPage - range);
            const end = Math.min(maxNumPages, currentPage + range);

            // Add previous button
            if (currentPage > 1) {
                paginationHtml += `<a href="#" class="comment-pagination-item prev" data-page="${currentPage-1}">« Previous</a>`;
            }
    
            // First page
            if (start > 1) {
                const rel = currentPage === 2 ? 'rel="prev"' : '';
                paginationHtml += `<a href="#" class="comment-pagination-item prev" data-page="1" ${rel}>1</a>`;
            }
    
            // Dots before current range
            if (start > 2) {
                paginationHtml += `<span class="pagination-dots">...</span>`;
            }
    
            // Pages around the current page
            for (let i = start; i <= end; i++) {
                const rel = i === currentPage - 1 ? 'rel="prev"' : i === currentPage + 1 ? 'rel="next"' : '';
                paginationHtml += `<a href="#" class="comment-pagination-item ${i === currentPage ? 'current" aria-current="page" ' : '"'} data-page="${i}" ${rel}>${i}</a>`;
            }
    
            // Dots after current range
            if (end < maxNumPages - 1) {
                paginationHtml += `<span class="pagination-dots">...</span>`;
            }
    
            // Last page
            if (end < maxNumPages) {
                const rel = currentPage === maxNumPages - 1 ? 'rel="next"' : '';
                paginationHtml += `<a href="#" class="comment-pagination-item" data-page="${maxNumPages}" ${rel}>${maxNumPages}</a>`;
            }

            // Add next button
            if (currentPage < maxNumPages) {
                paginationHtml += `<a href="#" class="comment-pagination-item prev" data-page="${currentPage+1}">Next »</a>`;
            }
        }
    
        paginationHtml += '</nav>';
        return paginationHtml;
    }
});