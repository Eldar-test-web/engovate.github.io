jQuery(document).ready(function($) {
    $(document).on('click', '.pagination a', function(e) {
        e.preventDefault();

        var paginationContainer = $(this).closest('.pagination');
        var courseId = paginationContainer.data('courseId');
        var modulesContainer = $('#learning-course-modules-' + courseId);
        var url = $(this).attr('href');
        var urlSegments = url.split('/engovate.github.io/');
        var paged = urlSegments[urlSegments.length - 1];

        searchLearningCourseModules(modulesContainer, paginationContainer, courseId, paged);
    });

    function searchLearningCourseModules(postsContainer, paginationContainer, courseId, paged, beforeSendCallBack = null, completeCallback = null)
    {
        $.ajax({
            url: archive_learning_course_ajax.ajaxurl,
            method: 'POST',
            data: {
                action: 'filter_learning_course_modules',
                course_id: courseId,
                paged: paged,
                learning_course_filter_nonce: $("#learning_course_filter_nonce").val()
            },
            beforeSend: function () {
                postsContainer.css('pointer-events', 'none').animate({opacity: 0}, "fast");
                paginationContainer.html('<div class="spinner"></div>');
                if(beforeSendCallBack)
                {
                    beforeSendCallBack();
                }
            },
            success: function(response) {
                if (response.success) {
                    var filtered_posts = response.data.filtered_posts_data;
                    var posts_per_page = response.data.posts_per_page;
                    var postsMarkup = '';
                    $.each(filtered_posts, function(index, post) {
                        postsMarkup += '<article id="post-' + post.id + '">';
                        postsMarkup += '<div class="post-thumbnail">';
                        if (post.thumbnail) {
                            postsMarkup += '<a href="' + post.permalink + '" rel="bookmark">';
                            postsMarkup += '<img src="' + post.thumbnail + '" alt="' + post.title + '">';
                            postsMarkup += '</a>';
                        }
                        postsMarkup += '</div>';
                        postsMarkup += '<header class="post-header">';
                        postsMarkup += '<div class="post-link"><a href="' + post.permalink + '" rel="bookmark">Lesson ' + (((paged - 1) * posts_per_page) + index + 1) + '</a></div>';
                        postsMarkup += '<h3 class="post-title">' + post.title + '</h3>';
                        postsMarkup += '</header>';
                        postsMarkup += '<div class="post-footer">';
                        postsMarkup += '<a href="' + post.permalink + '" class="start-learning-button">Learn</a>';
                        postsMarkup += '</div>';
                        postsMarkup += '</article>';
                    });
                    
                    if(postsMarkup === '')
                    {
                        postsMarkup = "No Courses Found!";
                    }

                    postsContainer.html(postsMarkup);
                    postsContainer.css('pointer-events', 'auto').animate({opacity: 1}, "fast");
                    paginationContainer.html(response.data.paginate_links);
                } else {
                    alert('Error loading courses');
                }
            },
            error: function() {
                alert('Error loading courses');
            },
            complete: function() {
                if(completeCallback)
                {
                    completeCallback();
                }
            }
        });
    }

    $('.post-locker').on('click', function(e) {
        e.preventDefault();
        $('.payment-popup-container').css('display', 'flex');
    });
});