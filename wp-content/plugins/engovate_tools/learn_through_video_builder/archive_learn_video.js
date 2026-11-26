jQuery(document).ready(function($) {

    $('.learn-video-search').on('submit', function(e){
        e.preventDefault();

        var searchTerms = $(this).find('input[name="search_terms"]').val();
        var categorySlug = $(this).find('select[name="category_slug"]').val();
        var submitButton = $(this).find('button[type="submit"]');

        var categoryPostsContainter = $('#category-posts-search');
        var postsPaginationContainter = $('#category-posts-search-pagination');

        searchLearnVideos(categoryPostsContainter, postsPaginationContainter, searchTerms, categorySlug, 1, () => {
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
        var categorySlug = paginationContainer.data('categorySlug');
        var categoryPostsContainer = $('#category-posts-' + categorySlug);
        var url = $(this).attr('href');
        var urlSegments = url.split('/engovate.github.io/');
        var paged = urlSegments[urlSegments.length - 1];

        var searchTerms = "";
        if(categorySlug === "search") {
            searchTerms = $('.learn-video-search').find('input[name="search_terms"]').val();
            categorySlug = $('.learn-video-search').find('select[name="category_slug"]').val();
        }

        searchLearnVideos(categoryPostsContainer, paginationContainer, searchTerms, categorySlug, paged);
    });

    function searchLearnVideos(categoryPostsContainer, paginationContainer, searchTerms, categorySlug, paged, beforeSendCallBack = null, completeCallback = null)
    {
        $.ajax({
            url: archive_learn_video_ajax.ajaxurl,
            method: 'POST',
            data: {
                action: 'filter_learn_videos',
                search_terms: searchTerms,
                category_slug: categorySlug,
                paged: paged,
                learn_video_filter_nonce: $("#learn_video_filter_nonce").val()
            },
            beforeSend: function () {
                categoryPostsContainer.css('pointer-events', 'none').animate({opacity: 0}, "fast");
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
                        postsMarkup += '<div class="post-content"><p>' + post.excerpt + '</p></div>';
                        postsMarkup += '<div class="post-footer">';
                        postsMarkup += '<a href="' + post.permalink + '" class="watch-video">Watch Video</a>';
                        postsMarkup += '</div>';
                        postsMarkup += '</article>';
                    });
                    
                    if(postsMarkup === '')
                    {
                        postsMarkup = "No Videos Found!";
                    }

                    categoryPostsContainer.html(postsMarkup);
                    categoryPostsContainer.css('pointer-events', 'auto').animate({opacity: 1}, "fast");
                    paginationContainer.html(response.data.paginate_links);
                } else {
                    alert((response.data && response.data.message) || 'Error loading videos');
                }
            },
            error: function() {
                alert('Error loading videos');
            },
            complete: function() {
                if(completeCallback)
                {
                    completeCallback();
                }
            }
        });
    }

});