window.speakingPartCheckerReusable = window.speakingPartCheckerReusable || {};

jQuery(document).ready(function ($) {

    window.speakingPartCheckerReusable.resetSpeakingBandScoreContainer = function(containerName) {
        $(`${containerName} .pronunciation-score`).text('0.0');
        $(`${containerName} .pronunciation-description`).html('');
        $(`${containerName} .task-response-score`).text('0.0');
        $(`${containerName} .task-response-description`).html('');
        $(`${containerName} .fluency-coherence-score`).text('0.0');
        $(`${containerName} .fluency-coherence-description`).html('');
        $(`${containerName} .lexical-resource-score`).text('0.0');
        $(`${containerName} .lexical-resource-description`).html('');
        $(`${containerName} .grammatical-range-accuracy-score`).text('0.0');
        $(`${containerName} .grammatical-range-accuracy-description`).html('');
        $(`${containerName} .overall-band-score`).text('0.0');
        $(`${containerName} .overall-band-score-wrapper div`).hide();
        $(`${containerName} .export-answer-result-button-wrapper`).hide();
        $(`${containerName} .band-score-premium-cta`).hide();
        $(`${containerName} .band-score-premium-cta-promo`).hide();

        $(`${containerName} .criteria-wrapper strong`).css('color','gray');
    }

    $('.band-score-premium-cta-close').on('click', function(e) {
        e.preventDefault();
        $(this).closest('.band-score-premium-cta, .band-score-premium-cta-promo').addClass('premium-cta-dismissed').hide();
    });

    window.speakingPartCheckerReusable.displayContentAssessmentResult = function(containerName, contentAssessmentResult) {
        var pronunciation_score = contentAssessmentResult['pronunciation']['score'];
        $(`${containerName} .pronunciation-score`).text(pronunciation_score);
        $(`${containerName} .pronunciation-description`).html(contentAssessmentResult['pronunciation']['feedback_and_suggestions']);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .pronunciation-score`), pronunciation_score);

        var task_response_score = contentAssessmentResult['task_response']['score'];
        $(`${containerName} .task-response-score`).text(task_response_score);
        $(`${containerName} .task-response-description`).html(contentAssessmentResult['task_response']['feedback_and_suggestions']);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .task-response-score`), task_response_score);

        var fluency_coherence_score = contentAssessmentResult['fluency_and_coherence']['score'];
        $(`${containerName} .fluency-coherence-score`).text(fluency_coherence_score);
        $(`${containerName} .fluency-coherence-description`).html(contentAssessmentResult['fluency_and_coherence']['feedback_and_suggestions']);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .fluency-coherence-score`), fluency_coherence_score);

        var lexical_resource_score = contentAssessmentResult['lexical_resource']['score'];
        $(`${containerName} .lexical-resource-score`).text(lexical_resource_score);
        $(`${containerName} .lexical-resource-description`).html(contentAssessmentResult['lexical_resource']['feedback_and_suggestions']);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .lexical-resource-score`), lexical_resource_score);

        var grammatical_range_accuracy_score = contentAssessmentResult['grammatical_range_and_accuracy']['score'];
        $(`${containerName} .grammatical-range-accuracy-score`).text(grammatical_range_accuracy_score);
        $(`${containerName} .grammatical-range-accuracy-description`).html(contentAssessmentResult['grammatical_range_and_accuracy']['feedback_and_suggestions']);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .grammatical-range-accuracy-score`), grammatical_range_accuracy_score);

        var roundedIeltsScore = contentAssessmentResult['overall_band_score'];
        $(`${containerName} .overall-band-score`).text(roundedIeltsScore);
        window.speakingPartCheckerReusable.animateScore($(`${containerName} .overall-band-score`), roundedIeltsScore);
        window.elementScroller.scrollTo($(`${containerName} .overall-band-score`));
        $(`${containerName} .overall-band-score-wrapper div`).show();

        $(`${containerName} .export-answer-result-button-wrapper`).show();
        if (roundedIeltsScore >= 9) {
            $(`${containerName} .band-score-premium-cta-headline`).text('Unlock unlimited practice with Premium');
        } else {
            $(`${containerName} .band-score-premium-cta-headline`).text('Reach your target band faster with Premium');
        }
        $(`${containerName} .band-score-premium-cta:not(.premium-cta-dismissed)`).css('display', 'flex');
        $(`${containerName} .band-score-premium-cta-promo:not(.premium-cta-dismissed)`).css('display', 'block');
    }

    window.speakingPartCheckerReusable.displayTextStatsResult = function(containerName, textStatsResult) {
        if(!textStatsResult) {
            $(`${containerName} .vocabulary-level`).find('span').html("Error checking your vocabulary level! We're working on fixing the issue!");
            return;
        }
        
        var answerCERF = textStatsResult['cerf'];
        var answerVocabComment = textStatsResult['vocab'];

        $(`${containerName} .vocabulary-level`).find('span').html('<br>' + answerCERF + '<br><span>' + answerVocabComment + '</span>');
    }

    window.speakingPartCheckerReusable.displayWordRepetitionResult = function(containerName, wordRepetitionArray) {
        var wordRepetitionHtml = '';
        wordRepetitionArray.forEach(repetition => {
            wordRepetitionHtml += '<div>' + repetition.word + ': ' + repetition.count + '</div>';
        });
        if(!wordRepetitionHtml) {
            wordRepetitionHtml = '<br>No noticeable repetition! Great job!';
        }
        else {
            wordRepetitionHtml = wordRepetitionHtml + '<span>Try using synonyms for the above words</span>';
        }
        $(`${containerName} .word-repetition`).find('span').html(wordRepetitionHtml);
    }

    window.speakingPartCheckerReusable.setOnExportAnswerResultButtonClick = function(containerName, topic, answerResult) {
        //remove the existing event listener
        $(`${containerName} .export-answer-result-button`).off('click');
        //reset the button
        $(`${containerName} .export-answer-result-button`).html('Export Result to Word <i class="fa-solid fa-file-export"></i>');
        $(`${containerName} .export-answer-result-button`).prop('disabled', false);

        $(`${containerName} .export-answer-result-button`).on('click', async function() {
            const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, AlignmentType, WidthType, HeadingLevel} = window.docx;

            //set the button to exporting state
            $(`${containerName} .export-answer-result-button`).html('Exporting... <i class="fa-solid fa-spinner fa-spin"></i>');
            $(`${containerName} .export-answer-result-button`).prop('disabled', true);

            //Maybe don't need to get these since we can exact them from the container UI
            var contentAssessmentResult = answerResult['content_result'];
            var pronunciationAssessmentResult = answerResult['pronunciation_result'];
            var textStatsResult = answerResult['text_stats'];

            var topicHeading = new Paragraph({
                text: 'Topic: ' + topic,
                heading: HeadingLevel.HEADING_1,
            });

            var overallBandScore = new Paragraph({
                children: [
                    new TextRun({
                        text: contentAssessmentResult['overall_band_score'].toString(), //convert to string because number is not supported by textrun
                        bold: true,
                    })
                ]
            });

            var vocabularyComplexity = new Paragraph({
                children: [
                    new TextRun({
                        text: textStatsResult['cerf'],
                        bold: true,
                    }),
                    new TextRun({
                        text: textStatsResult['vocab'],
                        break: 1,
                    })
                ]
            });

            //loop through each div in ${containerName} .word-repetition
            var wordRepetitions = [];
            $(`${containerName} .word-repetition span div`).each(function(index) {
                var wordRepetition = $(this).text();
                wordRepetitions.push(new TextRun({
                    text: wordRepetition,
                    break: (index == 0) ? 0 : 1, //don't break the first word
                }));
            });
            var vocabularyRepetitions = new Paragraph({
                children: wordRepetitions.length > 0 ? wordRepetitions : [new TextRun({
                    text: 'No noticeable repetition! Great job!',
                    break: 0,
                })]
            });

            //content assessment table
            var contentAssessmentTable = new Table({
                width: {
                    size: 100,
                    type: WidthType.AUTO,
                },
                columnWidths: [2252, 2252, 2252, 2252, 2252],
                margins: {
                    top: 100,
                    bottom: 100,
                    left: 100,
                    right: 100,
                },
                rows: [
                    // Header row
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ text: "Pronunciation", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Task Response", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Fluency & Coherence", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Lexical Resource", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Grammatical Range & Accuracy", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                        ],
                    }),
                    // Scores row
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [
                                        new TextRun({
                                            text: contentAssessmentResult['pronunciation']['score'].toString(),
                                            bold: true
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [
                                        new TextRun({
                                            text: contentAssessmentResult['task_response']['score'].toString(),
                                            bold: true
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [
                                        new TextRun({
                                            text: contentAssessmentResult['fluency_and_coherence']['score'].toString(),
                                            bold: true
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [
                                        new TextRun({
                                            text: contentAssessmentResult['lexical_resource']['score'].toString(),
                                            bold: true
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ 
                                    children: [
                                        new TextRun({
                                            text: contentAssessmentResult['grammatical_range_and_accuracy']['score'].toString(),
                                            bold: true
                                        })
                                    ],
                                    alignment: AlignmentType.CENTER
                                })],
                            }),
                        ],
                    }),
                    // Feedback row
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['pronunciation']['feedback_and_suggestions'] })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['task_response']['feedback_and_suggestions'] })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['fluency_and_coherence']['feedback_and_suggestions'] })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['lexical_resource']['feedback_and_suggestions'] })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['grammatical_range_and_accuracy']['feedback_and_suggestions'] })],
                            }),
                        ],
                    }),
                ]
            });

            // actual audio transcript
            var words = pronunciationAssessmentResult['words'];
            var actualAudioTranscript = new Paragraph({
                children: words.map(word => {
                    let displayWord = word['punctuated_word'];
                    let wordAccuracyScore = Math.round(word['accuracy_score']);
                    return new TextRun({
                        text: `${displayWord} (${wordAccuracyScore}%)  `,
                        color: window.speakingPartCheckerReusable.getMarkColor(wordAccuracyScore)
                    });
                })
            });

            // refined transcription
            var refinedTranscription = new Paragraph({
                children: [
                    new TextRun({
                        text: pronunciationAssessmentResult['refined_transcript'],
                    })
                ]
            });
        
            // Create the document with the table
            const doc = new Document({
                settings: {
                    proofState: {
                        spelling: false,
                        grammar: false
                    }
                },
                styles: {
                    default: {
                        document: {
                            run: {
                                size: 24, // Default font size (in half-points, so 24 = 12pt)
                                font: "Arial", // Default font family
                            },
                        },
                    }
                },
                sections: [
                    {
                        children: [
                            topicHeading,
                            new Paragraph({
                                text: "Overall Band Score:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            overallBandScore,
                            new Paragraph({
                                text: "Vocabulary Complexity:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            vocabularyComplexity,
                            new Paragraph({
                                text: "Vocabulary Repetition:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            vocabularyRepetitions,
                            new Paragraph({
                                text: "----Transcripts----",
                                heading: HeadingLevel.HEADING_1,
                                spacing: { before: 500, after: 200 }
                            }),
                            new Paragraph({
                                text: "Actual Audio Transcript (what native speakers are likely to hear):",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            actualAudioTranscript,
                            new Paragraph({
                                text: "Polished Transcript:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            refinedTranscription,
                            new Paragraph({
                                text: "----Feedback----",
                                heading: HeadingLevel.HEADING_1,
                                spacing: { before: 500, after: 200 }
                            }),
                            contentAssessmentTable,
                        ],
                    },
                ],
            });
        
            // Generate the .docx file
            const blob = await Packer.toBlob(doc);
        
            // Trigger the download
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "speaking_assessment.docx";
            link.click();

            //reset the button
            $(`${containerName} .export-answer-result-button`).html('Export Result to Word <i class="fa-solid fa-file-export"></i>');
            $(`${containerName} .export-answer-result-button`).prop('disabled', false);
        });
    }

    window.speakingPartCheckerReusable.getOverallSpeakingBandScore = function(containerName) {
        return parseFloat($(`${containerName} .overall-band-score`).text());
    }

    window.speakingPartCheckerReusable.animateScore = function(element, targetScore) {
        targetScore = parseFloat(targetScore);
        $({score: 0}).animate({score: targetScore}, {
            duration: 1000, // Duration of the animation in milliseconds
            easing: 'swing', // The easing method for the animation
            step: function (currentScore) {
                element.text(currentScore.toFixed(1));
            },
            complete: function () {
                element.text(targetScore.toFixed(1));
            }
        });

        if(targetScore >= 8)
        {
            element.css('color','darkgreen');
        }
        else
        {
            if(targetScore >= 7)
            {
                element.css('color','orangered');
            }
            else {
                if(targetScore >= 6)
                {
                    element.css('color','darkorange');
                }
                else
                {
                    if(targetScore >= 5)
                    {
                        element.css('color','mediumblue');
                    }
                    else
                    {
                        element.css('color','darkred');
                    }              
                }
            }
        }
    }
});