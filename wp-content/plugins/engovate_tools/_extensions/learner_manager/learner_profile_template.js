jQuery(document).ready(function ($) {
    var savedActivationCode = '';
    try {
        var savedCodeRaw = window.localStorage.getItem('saved_premium_activation_code');
        var savedCode = savedCodeRaw ? JSON.parse(savedCodeRaw) : null;
        if (savedCode && savedCode.code && savedCode.savedAt && (new Date().getTime() - savedCode.savedAt) <= 10 * 24 * 60 * 60 * 1000) {
            savedActivationCode = savedCode.code;
        }
        else if (savedCode) {
            window.localStorage.removeItem('saved_premium_activation_code');
        }
    } catch (e) {}

    if (savedActivationCode) {
        $('.saved-premium-activation-code').find('strong').text(savedActivationCode).end().prop('hidden', false);
        $('.premium-plan-purchase-incentive').hide();
    }

    $('.learner-account').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_update_account_details',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
                first_name: $("#first-name").val(),
                last_name: $("#last-name").val(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    window.location.reload();
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
                $('.spinner-overlay').hide();
            },
        });
    });

    $('.learner-subscription').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_activate_subscription',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
                subscription_activation_code: $("#subscription-activation-code").val().trim(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    try {
                        window.localStorage.removeItem('saved_premium_activation_code');
                    } catch (e) {}
                    alert(response.data);
                    window.location.reload();
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
                $('.spinner-overlay').hide();
            },
        });
    });

    $('.learner-password').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_change_password',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
                old_password: $("#old-password").val(),
                new_password: $("#new-password").val(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    alert(response.data);
                    window.location.href = '/engovate.github.io/learner-login/';
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
                $('.spinner-overlay').hide();
            },
        });
    });

    $('.learner-logout').on('submit', function (e) {
        e.preventDefault();
        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_logout',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    window.location.href = '/engovate.github.io/learner-login/';
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
                $('.spinner-overlay').hide();
            },
        });
    });

    $('.reset-all-progress-button').on('click', function (e) {
        e.preventDefault();

        if (!confirm('WARNING: this permanently deletes ALL of your saved progress \u2014 every reading, listening, writing and speaking test you have taken, every marked essay and answer, your band score charts and your Review Mistakes list.\n\nThere is no backup and this CANNOT be undone.\n\nAre you absolutely sure?')) {
            return;
        }

        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: {
                action: 'learner_reset_progress',
                learner_profile_nonce: $('#learner_profile_nonce').val(),
            },
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    alert(response.data);
                    window.location.href = '?menu=progress';
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
                $('.spinner-overlay').hide();
            },
        });
    });

    $('.save-ielts-target-button').on('click', function (e) {
        e.preventDefault();

        var targetData = {
            action: 'learner_save_target_band_scores',
            learner_profile_nonce: $('#learner_profile_nonce').val(),
            module: $('.ielts-target-module').val(),
        };
        $('.ielts-target-band').each(function () {
            targetData[$(this).data('target-key')] = $(this).val();
        });

        $.ajax({
            url: learner_profile_ajax.ajaxurl,
            type: 'POST',
            data: targetData,
            beforeSend: function () {
                $('.spinner-overlay').css('display', 'flex');
            },
            success: function (response) {
                if (response.success) {
                    window.location.reload();
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
                $('.spinner-overlay').hide();
            },
        });
    });

    //hide all OCR buttons
    $('.writing-task-essay-editable .ocr-button-container').hide();

    //-------TARGET BAND SCORES----------
    var targetBandScores = $('#ielts-target-band-scores').length > 0 ? JSON.parse($('#ielts-target-band-scores').val()) : {};

    //Draws the learner's target band as a dashed green line across a chart, with "Target 7.0" at its left end (the right end is where the newest score sits).
    //Each chart passes its skill's target in options.plugins.targetLine.value; no target means no line.
    var targetLinePlugin = {
        id: 'targetLine',
        afterDatasetsDraw: function (chart, args, options) {
            if (!options.value) return;

            var y = chart.scales.y.getPixelForValue(options.value);
            var area = chart.chartArea;
            var ctx = chart.ctx;
            ctx.save();
            ctx.strokeStyle = 'green';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.moveTo(area.left, y);
            ctx.lineTo(area.right, y);
            ctx.stroke();

            //write the label under the line when the line is too close to the top of the chart
            var labelBelow = y - area.top < 18;
            ctx.fillStyle = 'green';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = labelBelow ? 'top' : 'bottom';
            ctx.fillText('Target ' + Number(options.value).toFixed(1), area.left + 6, labelBelow ? y + 4 : y - 4);
            ctx.restore();
        }
    };

    //-------OVERALL BAND SCORE----------
    if($('#ielts-overall-band-score-progress-data').length > 0) {
        var overallBandScoreProgressData = JSON.parse($('#ielts-overall-band-score-progress-data').val());
        var overallBandScoreTitles = overallBandScoreProgressData.map(point => point.title);
        var overallBandScores = overallBandScoreProgressData.map(point => point.band_score);

        new Chart($('.ielts-overall-band-score-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: overallBandScoreTitles.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Overall Band Score',
                    data: overallBandScores,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Overall Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'After Each Test',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.overall },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return overallBandScoreTitles[context[0].dataIndex];
                            },
                            //the four skill scores the overall was worked out from at that point
                            afterLabel: function(context) {
                                var skillScores = overallBandScoreProgressData[context.dataIndex].skill_scores;
                                return Object.keys(skillScores).map(skill => skill.charAt(0).toUpperCase() + skill.slice(1) + ' ' + Number(skillScores[skill]).toFixed(1));
                            }
                        }
                    },
                }
            }
        });
    }

    //-------IELTS READING TESTS----------
    if($('#ielts-reading-test-progress-data').length > 0) {
        var ieltsReadingTestProgressData = JSON.parse($('#ielts-reading-test-progress-data').val());
        var readingTestTitles = ieltsReadingTestProgressData.map(test => test.title);
        var readingTestBandScores = ieltsReadingTestProgressData.map(test => test.band_score);

        new Chart($('.ielts-reading-test-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: readingTestTitles.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: readingTestBandScores,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + readingTestTitles.length + ' Test(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.reading },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return readingTestTitles[context[0].dataIndex];
                            }
                        }
                    },
                }
            }
        });
    }

    //-------IELTS LISTENING TESTS----------
    if($('#ielts-listening-test-progress-data').length > 0) {
        var ieltsListeningTestProgressData = JSON.parse($('#ielts-listening-test-progress-data').val());
        var listeningTestTitles = ieltsListeningTestProgressData.map(test => test.title);
        var listeningTestBandScores = ieltsListeningTestProgressData.map(test => test.band_score);

        new Chart($('.ielts-listening-test-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: listeningTestTitles.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: listeningTestBandScores,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + listeningTestTitles.length + ' Test(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.listening },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return listeningTestTitles[context[0].dataIndex];
                            }
                        }
                    },
                }
            }
        });
    }

    //-------IELTS WRITING TESTS----------
    if($('#ielts-writing-test-progress-data').length > 0) {
        var ieltsWritingTestProgressData = JSON.parse($('#ielts-writing-test-progress-data').val());
        var writingTestTitles = ieltsWritingTestProgressData.map(test => test.title);
        var writingTestBandScores = ieltsWritingTestProgressData.map(test => test.band_score);

        new Chart($('.ielts-writing-test-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: writingTestTitles.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: writingTestBandScores,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + writingTestTitles.length + ' Test(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.writing },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return writingTestTitles[context[0].dataIndex];
                            }
                        }
                    },
                }
            }
        });
    }

    //Have to wait for the writingTaskCheckerReusable to be loaded. We can enqueue the writingTaskCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    if($('#ielts-writing-test-data').length > 0) {
        var loadIELTSWritingyTestDataInterval = setInterval(function() {
            if(window.contentEditableDiv && window.writingTaskCheckerReusable) {
                var ieltsWritingTestData = JSON.parse($('#ielts-writing-test-data').val());
                for(var i = 0; i < ieltsWritingTestData.length; i++) {
                    var essayData = ieltsWritingTestData[i];
                    if(essayData) {
                        window.contentEditableDiv.setContentEditorReadOnly('#writing-task-essay-' + i, true);

                        var contentAssessmentResult = essayData['assessment_result']['content_result'];
                        window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-task-band-score-container-' + i, contentAssessmentResult);

                        var textStatsResult = essayData['assessment_result']['text_stats'];
                        window.writingTaskCheckerReusable.displayTextStatsResult('#writing-task-band-score-container-' + i, textStatsResult);
                        
                        window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-task-band-score-container-' + i, essayData['essay']);

                        window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-task-band-score-container-' + i, essayData['topic'], essayData['assessment_result']);

                        var grammarAssessmentResult = essayData['assessment_result']['grammar_result'];
                        window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-task-essay-' + i, grammarAssessmentResult);
                    }
                }

                window.elementScroller.clearAllScrollTimeouts();
                clearInterval(loadIELTSWritingyTestDataInterval);
            }
        }, 100);
    }

    //-------IELTS SPEAKING TESTS----------
    if($('#ielts-speaking-test-progress-data').length > 0) {
        var ieltsSpeakingTestProgressData = JSON.parse($('#ielts-speaking-test-progress-data').val());
        var speakingTestTitles = ieltsSpeakingTestProgressData.map(test => test.title);
        var speakingTestBandScores = ieltsSpeakingTestProgressData.map(test => test.band_score);

        new Chart($('.ielts-speaking-test-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: speakingTestTitles.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: speakingTestBandScores,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + speakingTestTitles.length + ' Test(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.speaking },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return speakingTestTitles[context[0].dataIndex];
                            }
                        }
                    },
                }
            }
        });
    }

    //Have to wait for the speakingPartCheckerReusable to be loaded. We can enqueue the speakingPartCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    if($('#ielts-speaking-test-data').length > 0) {
        var loadIELTSSpeakingTestDataInterval = setInterval(function() {
            if(window.speakingPartCheckerReusable) {
                var ieltsSpeakingTestData = JSON.parse($('#ielts-speaking-test-data').val());

                for(var i = 0; i < ieltsSpeakingTestData.length; i++) {
                    var speakingPartData = ieltsSpeakingTestData[i];
                    if(speakingPartData) {
                        var bandScoreJSON = speakingPartData['assessment_result']['content_result'];
                        var pronunciationJSON = speakingPartData['assessment_result']['pronunciation_result'];
                        var textStatsResult = speakingPartData['assessment_result']['text_stats'];
                        var wordRepetitions = speakingPartData['assessment_result']['word_repetitions'];

                        window.speakingPartCheckerReusable.displayContentAssessmentResult('#speaking-part-answer-band-score-container-' + i, bandScoreJSON);
                        window.speakingPartCheckerReusable.displayTextStatsResult('#speaking-part-answer-band-score-container-' + i, textStatsResult);
                        window.speakingPartCheckerReusable.displayWordRepetitionResult('#speaking-part-answer-band-score-container-' + i, wordRepetitions);
                        window.speakingPartCheckerReusable.displaySpeechAccuracyResult('#speaking-part-answer-pronunciation-result-container-' + i, pronunciationJSON, null);
                        window.speakingPartCheckerReusable.setOnExportAnswerResultButtonClick('#speaking-part-answer-band-score-container-' + i, speakingPartData['topic'], speakingPartData['assessment_result']);
                        $('#speaking-part-answer-pronunciation-result-container-' + i).find('.pronunciation-transcript-label').after(`<div class="audio-privacy-notice">To protect your privacy, we will not save your audio.</div>`);
                    }
                }

                window.elementScroller.clearAllScrollTimeouts();
                clearInterval(loadIELTSSpeakingTestDataInterval);
            }
        }, 100);
    }

    //-------WRITING TASK 1 ACADEMIC----------
    if($('#writing-task-1-academic-progress-data').length > 0) {
        var writingTask1AcademicProgressData = JSON.parse($('#writing-task-1-academic-progress-data').val());
        new Chart($('.writing-task-1-academic-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: writingTask1AcademicProgressData.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: writingTask1AcademicProgressData,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Overall Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + writingTask1AcademicProgressData.length + ' Report(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.writing }
                }
            }
        });
    }

    //Have to wait for the writingTaskCheckerReusable to be loaded. We can enqueue the writingTaskCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    if($('#writing-task-1-academic-essay-data').length > 0) {
        var loadWritingTask1AcademicEssayDataInterval = setInterval(function() {
            if(window.contentEditableDiv && window.writingTaskCheckerReusable) {
                var writingTask1AcademicEssayData = JSON.parse($('#writing-task-1-academic-essay-data').val());
                if(writingTask1AcademicEssayData) {
                    window.contentEditableDiv.setContentEditorReadOnly('#writing-task-1-academic-essay', true);

                    var contentAssessmentResult = writingTask1AcademicEssayData['assessment_result']['content_result'];
                    window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-task-1-academic-band-score-container', contentAssessmentResult);

                    var textStatsResult = writingTask1AcademicEssayData['assessment_result']['text_stats'];
                    window.writingTaskCheckerReusable.displayTextStatsResult('#writing-task-1-academic-band-score-container', textStatsResult);
                    
                    window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-task-1-academic-band-score-container', writingTask1AcademicEssayData['essay']);

                    window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-task-1-academic-band-score-container', writingTask1AcademicEssayData['topic'], writingTask1AcademicEssayData['assessment_result']);

                    var grammarAssessmentResult = writingTask1AcademicEssayData['assessment_result']['grammar_result'];
                    window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-task-1-academic-essay', grammarAssessmentResult);
                }

                window.elementScroller.clearAllScrollTimeouts();
                clearInterval(loadWritingTask1AcademicEssayDataInterval);
            }
        }, 100);
    }

    //-------WRITING TASK 1 GENERAL----------
    if($('#writing-task-1-general-progress-data').length > 0) {
        var writingTask1GeneralProgressData = JSON.parse($('#writing-task-1-general-progress-data').val());
        new Chart($('.writing-task-1-general-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: writingTask1GeneralProgressData.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: writingTask1GeneralProgressData,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Overall Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + writingTask1GeneralProgressData.length + ' Letter(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.writing }
                }
            }
        });
    }

    //Have to wait for the writingTaskCheckerReusable to be loaded. We can enqueue the writingTaskCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    if($('#writing-task-1-general-essay-data').length > 0) {
        var loadWritingTask1GeneralEssayDataInterval = setInterval(function() {
            if(window.contentEditableDiv && window.writingTaskCheckerReusable) {
                var writingTask1GeneralEssayData = JSON.parse($('#writing-task-1-general-essay-data').val());
                if(writingTask1GeneralEssayData) {
                    window.contentEditableDiv.setContentEditorReadOnly('#writing-task-1-general-essay', true);

                    var contentAssessmentResult = writingTask1GeneralEssayData['assessment_result']['content_result'];
                    window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-task-1-general-band-score-container', contentAssessmentResult);

                    var textStatsResult = writingTask1GeneralEssayData['assessment_result']['text_stats'];
                    window.writingTaskCheckerReusable.displayTextStatsResult('#writing-task-1-general-band-score-container', textStatsResult);
                    
                    window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-task-1-general-band-score-container', writingTask1GeneralEssayData['essay']);

                    window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-task-1-general-band-score-container', writingTask1GeneralEssayData['topic'], writingTask1GeneralEssayData['assessment_result']);

                    var grammarAssessmentResult = writingTask1GeneralEssayData['assessment_result']['grammar_result'];
                    window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-task-1-general-essay', grammarAssessmentResult);
                }
                window.elementScroller.clearAllScrollTimeouts();
                clearInterval(loadWritingTask1GeneralEssayDataInterval);
            }
        }, 100);
    }

    //-------WRITING TASK 2----------
    if($('#writing-task-2-progress-data').length > 0) {
        var writingTask2ProgressData = JSON.parse($('#writing-task-2-progress-data').val());
        new Chart($('.writing-task-2-progress-chart')[0].getContext('2d'), {
            type: 'line',
            plugins: [targetLinePlugin],
            data: {
                labels: Array.from({length: writingTask2ProgressData.length}, (_, i) => i + 1),
                datasets: [{
                    label: 'Band Score',
                    data: writingTask2ProgressData,
                    borderColor: 'red',
                    tension: 0
                }]
            },
            options: {
                responsive: true,
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 9,
                        title: {
                            display: true,
                            text: 'Overall Band Score',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: 'Last ' + writingTask2ProgressData.length + ' Essay(s)',
                            color: 'black'
                        },
                        ticks: {
                            color: 'black'
                        }
                    }
                },
                plugins: {
                    targetLine: { value: targetBandScores.writing }
                }
            }
        });
    }

    //Have to wait for the writingTaskCheckerReusable to be loaded. We can enqueue the writingTaskCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    if($('#writing-task-2-essay-data').length > 0) {
        var loadWritingTask2EssayDataInterval = setInterval(function() {
            if(window.contentEditableDiv && window.writingTaskCheckerReusable) {
                var writingTask2EssayData = JSON.parse($('#writing-task-2-essay-data').val());
                if(writingTask2EssayData) {
                    window.contentEditableDiv.setContentEditorReadOnly('#writing-task-2-essay', true);

                    var contentAssessmentResult = writingTask2EssayData['assessment_result']['content_result'];
                    window.writingTaskCheckerReusable.displayContentAssessmentResult('#writing-task-2-band-score-container', contentAssessmentResult);

                    var textStatsResult = writingTask2EssayData['assessment_result']['text_stats'];
                    window.writingTaskCheckerReusable.displayTextStatsResult('#writing-task-2-band-score-container', textStatsResult);
                    
                    window.writingTaskCheckerReusable.displayWordRepetitionResult('#writing-task-2-band-score-container', writingTask2EssayData['essay']);

                    window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick('#writing-task-2-band-score-container', writingTask2EssayData['topic'], writingTask2EssayData['assessment_result']);

                    var grammarAssessmentResult = writingTask2EssayData['assessment_result']['grammar_result'];
                    window.writingTaskCheckerReusable.displayGrammarAssessmentResult('#writing-task-2-essay', grammarAssessmentResult);
                }
                window.elementScroller.clearAllScrollTimeouts();
                clearInterval(loadWritingTask2EssayDataInterval);
            }
        }, 100);
    }

    //----SPEAKING PART ANSWERS----
    for(var i = 1; i <= 3; i++) {
        if($('#speaking-part-'+i+'-progress-data').length > 0) {
            var speakingPartProgressData = JSON.parse($('#speaking-part-'+i+'-progress-data').val());
            new Chart($('.speaking-part-'+i+'-progress-chart')[0].getContext('2d'), {
                type: 'line',
                plugins: [targetLinePlugin],
                data: {
                    labels: Array.from({length: speakingPartProgressData.length}, (_, i) => i + 1),
                    datasets: [{
                        label: 'Band Score',
                        data: speakingPartProgressData,
                        borderColor: 'red',
                        tension: 0
                    }]
                },
                options: {
                    responsive: true,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 9,
                            title: {
                                display: true,
                                text: 'Overall Band Score',
                                color: 'black'
                            },
                            ticks: {
                                color: 'black'
                            }
                        },
                        x: {
                            title: {
                                display: true,
                                text: 'Last ' + speakingPartProgressData.length + ' Answer(s)',
                                color: 'black'
                            },
                            ticks: {
                                color: 'black'
                            }
                        }
                    },
                    plugins: {
                        targetLine: { value: targetBandScores.speaking }
                    }
                }
            });
        }
    }

    //Have to wait for the speakingPartCheckerReusable to be loaded. We can enqueue the speakingPartCheckerReusable scripts to avoid doing this, but this is more clean and requires less effort refactoring backend code.
    for (var i = 1; i <= 3; i++) {
        (function(currentIndex) {
            if ($('#speaking-part-' + currentIndex + '-answer-data').length > 0) {
                var loadSpeakingPartAnswerDataInterval = setInterval(function() {
                    if (window.speakingPartCheckerReusable) {
                        var speakingPartAnswerData =  JSON.parse($('#speaking-part-' + currentIndex + '-answer-data').val());
                        if (speakingPartAnswerData) {
                            var bandScoreJSON = speakingPartAnswerData['assessment_result']['content_result'];
                            var pronunciationJSON = speakingPartAnswerData['assessment_result']['pronunciation_result'];
                            var textStatsResult = speakingPartAnswerData['assessment_result']['text_stats'];
                            var wordRepetitions = speakingPartAnswerData['assessment_result']['word_repetitions'];
    
                            window.speakingPartCheckerReusable.displayContentAssessmentResult('#speaking-part-answer-band-score-container', bandScoreJSON);
                            window.speakingPartCheckerReusable.displayTextStatsResult('#speaking-part-answer-band-score-container', textStatsResult);
                            window.speakingPartCheckerReusable.displayWordRepetitionResult('#speaking-part-answer-band-score-container', wordRepetitions);
                            window.speakingPartCheckerReusable.displaySpeechAccuracyResult('#speaking-part-answer-pronunciation-result-container', pronunciationJSON, null);
                            window.speakingPartCheckerReusable.setOnExportAnswerResultButtonClick('#speaking-part-answer-band-score-container', speakingPartAnswerData['topic'], speakingPartAnswerData['assessment_result']);
                            $('#speaking-part-answer-pronunciation-result-container').find('.pronunciation-transcript-label').after(`<div class="audio-privacy-notice">To protect your privacy, we will not save your audio.</div>`);
                        }
    
                        window.elementScroller.clearAllScrollTimeouts();
                        clearInterval(loadSpeakingPartAnswerDataInterval);
                    }
                }, 100);
            }
        })(i);
    }
});
