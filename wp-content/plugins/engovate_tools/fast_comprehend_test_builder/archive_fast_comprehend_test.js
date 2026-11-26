jQuery(document).ready(function($) {

    $('.fast-comprehend-test-category').on('click', function(e){
        e.preventDefault();
       
        var categorySlug = $(this).data('categorySlug');

        // Get the current URL parts
        var protocol = window.location.protocol;
        var host = window.location.host;
        var pathname = window.location.pathname;
        
        // Check if the pathname ends with a slash
        if (!pathname.endsWith('/')) {
            // Add the slash
            pathname += '/';
        }
        
        // Construct the new URL
        var newUrl = protocol + '//' + host + pathname;
        if(categorySlug) {
            newUrl += '?category=' + encodeURIComponent(categorySlug);
        }
    
        // Navigate to new URL
        window.location.href = newUrl;
    });

    $('.fast-comprehend-test-search').on('submit', function(e){
        e.preventDefault();

        var searchTerms = $(this).find('input[name="search_terms"]').val();
        var categorySlug = $(this).find('select[name="category_slug"]').val();
        var submitButton = $(this).find('button[type="submit"]');

        var postsContainter = $('#tag-posts-search');
        var postsPaginationContainter = $('#tag-posts-search-pagination');

        searchFastComprehendTests(postsContainter, postsPaginationContainter, searchTerms, categorySlug, '', 1, () => {
            submitButton.prop("disabled", true);
            submitButton.text("Searching...");
        }, () => {
            submitButton.prop("disabled", false);
            submitButton.text("Search");
            $(".search-results").show();
        });
    });

    $(document).on('click', '.pagination a', function(e) {
        e.preventDefault();

        var paginationContainer = $(this).closest('.pagination');
        var tagSlug = paginationContainer.data('tagSlug');
        var tagPostsContainer = $('#tag-posts-' + tagSlug);
        var url = $(this).attr('href');
        var urlSegments = url.split('/');
        var paged = urlSegments[urlSegments.length - 1];

        var categorySlug = "";
        var searchTerms = "";
        if(tagSlug === "search") {
            tagSlug = "";
            searchTerms = $('.fast-comprehend-test-search').find('input[name="search_terms"]').val();
            categorySlug = $('.fast-comprehend-test-search').find('select[name="category_slug"]').val();
        } else {
            categorySlug = paginationContainer.data('categorySlug') || '';
        }

        searchFastComprehendTests(tagPostsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged);
    });

    function searchFastComprehendTests(postsContainer, paginationContainer, searchTerms, categorySlug, tagSlug, paged, beforeSendCallBack = null, completeCallback = null)
    {
        $.ajax({
            url: archive_fast_comprehend_test_ajax.ajaxurl,
            method: 'POST',
            data: {
                action: 'filter_fast_comprehend_tests',
                search_terms: searchTerms,
                category_slug: categorySlug,
                tag_slug: tagSlug,
                paged: paged,
                fast_comprehend_test_filter_nonce: $("#fast_comprehend_test_filter_nonce").val()
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
                        postsMarkup += '<h3 class="post-title"><a href="' + post.permalink + '" rel="bookmark">' + post.title + '</a></h3>';
                        postsMarkup += '</header>';
                        postsMarkup += '<div class="post-footer">';
                        postsMarkup += '<a href="' + post.permalink + '" class="start-practicing-button">Practice</a>';
                        postsMarkup += '</div>';
                        postsMarkup += '</article>';
                    });
                    
                    if(postsMarkup === '')
                    {
                        postsMarkup = "No Exercises Found!";
                    }

                    postsContainer.html(postsMarkup);
                    postsContainer.css('pointer-events', 'auto').animate({opacity: 1}, "fast");
                    paginationContainer.html(response.data.paginate_links);
                } else {
                    alert((response.data && response.data.message) || 'Error loading exercises');
                }
            },
            error: function() {
                alert('Error loading exercises');
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