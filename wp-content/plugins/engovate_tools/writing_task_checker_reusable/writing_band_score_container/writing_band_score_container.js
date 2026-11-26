window.writingTaskCheckerReusable = window.writingTaskCheckerReusable || {};

jQuery(document).ready(function ($) {

    window.writingTaskCheckerReusable.resetWritingBandScoreContainer = function(containerName) {
        $(`${containerName} .vocabulary-level`).find('span').text('N/A');
        $(`${containerName} .grammar-mistakes`).find('span').text('N/A');
        $(`${containerName} .word-repetition`).find('span').html('N/A');

        $(`${containerName} .task-response-score`).text('0.0');
        $(`${containerName} .task-response-description`).html('');
        $(`${containerName} .coherence-cohesion-score`).text('0.0');
        $(`${containerName} .coherence-cohesion-description`).html('');
        $(`${containerName} .lexical-resource-score`).text('0.0');
        $(`${containerName} .lexical-resource-description`).html('');
        $(`${containerName} .grammatical-range-accuracy-score`).text('0.0');
        $(`${containerName} .grammatical-range-accuracy-description`).html('');
        $(`${containerName} .overall-band-score`).text('0.0');
        $(`${containerName} .overall-band-score-wrapper div`).hide();
        $(`${containerName} .export-essay-result-button-wrapper`).hide();
        $(`${containerName} .band-score-premium-cta`).hide();
        $(`${containerName} .band-score-premium-cta-promo`).hide();

        $(`${containerName} .criteria-wrapper strong`).css('color','gray');
    }

    $('.band-score-premium-cta-close').on('click', function(e) {
        e.preventDefault();
        $(this).closest('.band-score-premium-cta, .band-score-premium-cta-promo').addClass('premium-cta-dismissed').hide();
    });

    window.writingTaskCheckerReusable.displayContentAssessmentResult = function(containerName, contentAssessmentResult) {
        var task_response_score = contentAssessmentResult['task_response']['score'];
        $(`${containerName} .task-response-score`).text(task_response_score);
        $(`${containerName} .task-response-description`).html(contentAssessmentResult['task_response']['feedback_and_suggestions']);
        window.writingTaskCheckerReusable.animateScore($(`${containerName} .task-response-score`), task_response_score);

        var coherence_cohesion_score = contentAssessmentResult['coherence_and_cohesion']['score'];
        $(`${containerName} .coherence-cohesion-score`).text(coherence_cohesion_score);
        $(`${containerName} .coherence-cohesion-description`).html(contentAssessmentResult['coherence_and_cohesion']['feedback_and_suggestions']);
        window.writingTaskCheckerReusable.animateScore($(`${containerName} .coherence-cohesion-score`), coherence_cohesion_score);

        var lexical_resource_score = contentAssessmentResult['lexical_resource']['score'];
        $(`${containerName} .lexical-resource-score`).text(lexical_resource_score);
        $(`${containerName} .lexical-resource-description`).html(contentAssessmentResult['lexical_resource']['feedback_and_suggestions']);
        window.writingTaskCheckerReusable.animateScore($(`${containerName} .lexical-resource-score`), lexical_resource_score);

        var grammatical_range_accuracy_score = contentAssessmentResult['grammatical_range_and_accuracy']['score'];
        $(`${containerName} .grammatical-range-accuracy-score`).text(grammatical_range_accuracy_score);
        $(`${containerName} .grammatical-range-accuracy-description`).html(contentAssessmentResult['grammatical_range_and_accuracy']['feedback_and_suggestions']);
        window.writingTaskCheckerReusable.animateScore($(`${containerName} .grammatical-range-accuracy-score`), grammatical_range_accuracy_score);

        var roundedIeltsScore = contentAssessmentResult['overall_band_score'];
        $(`${containerName} .overall-band-score`).text(roundedIeltsScore);
        window.writingTaskCheckerReusable.animateScore($(`${containerName} .overall-band-score`), roundedIeltsScore);
        window.elementScroller.scrollTo($(`${containerName} .overall-band-score`));
        $(`${containerName} .overall-band-score-wrapper div`).show();

        $(`${containerName} .export-essay-result-button-wrapper`).show();
        if (roundedIeltsScore >= 9) {
            $(`${containerName} .band-score-premium-cta-headline`).text('Unlock unlimited practice with Premium');
        } else {
            $(`${containerName} .band-score-premium-cta-headline`).text('Reach your target band faster with Premium');
        }
        $(`${containerName} .band-score-premium-cta:not(.premium-cta-dismissed)`).css('display', 'flex');
        $(`${containerName} .band-score-premium-cta-promo:not(.premium-cta-dismissed)`).css('display', 'block');
    }

    window.writingTaskCheckerReusable.displayTextStatsResult = function(containerName, textStatsResult) {
        if(!textStatsResult) {
            $(`${containerName} .grammar-mistakes`).find('span').text("Error checking your grammar! We're working on fixing the issue!");
            $(`${containerName} .vocabulary-level`).find('span').html("Error checking your vocabulary level! We're working on fixing the issue!");
            return;
        }
        
        var grammarCheckErrors = textStatsResult['grammar_errors'];
        var essayCERF = textStatsResult['cerf'];
        var essayVocabComment = textStatsResult['vocab'];

        $(`${containerName} .grammar-mistakes`).find('span').text(grammarCheckErrors);
        $(`${containerName} .vocabulary-level`).find('span').html('<br>' + essayCERF + '<br><span>' + essayVocabComment + '</span>');
    }

    window.writingTaskCheckerReusable.displayWordRepetitionResult = function(containerName, essay) {
        var wordRepetitionHtml = '';
        var wordRepetitionArray = window.writingTaskCheckerReusable.getWordRepetition(essay);
        wordRepetitionArray.forEach(repetition => {
            if(repetition.count > 2 && repetition.word.length > 4) {
                wordRepetitionHtml += '<div>' + repetition.word + ': ' + repetition.count + '</div>';
            }
        });
        if(!wordRepetitionHtml) {
            wordRepetitionHtml = '<br>No noticeable repetition! Great job!';
        }
        else {
            wordRepetitionHtml = wordRepetitionHtml + '<span>Try using synonyms for the above words</span>';
        }
        $(`${containerName} .word-repetition`).find('span').html(wordRepetitionHtml);
    }

    window.writingTaskCheckerReusable.setOnExportEssayResultButtonClick = function(containerName, topic, essayResult) {
        //remove the existing event listener
        $(`${containerName} .export-essay-result-button`).off('click');
        //reset the button
        $(`${containerName} .export-essay-result-button`).html('Export Result to Word <i class="fa-solid fa-file-export"></i>');
        $(`${containerName} .export-essay-result-button`).prop('disabled', false);

        $(`${containerName} .export-essay-result-button`).on('click', async function() {
            const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, AlignmentType, WidthType, HeadingLevel} = window.docx;

            //set the button to exporting state
            $(`${containerName} .export-essay-result-button`).html('Exporting... <i class="fa-solid fa-spinner fa-spin"></i>');
            $(`${containerName} .export-essay-result-button`).prop('disabled', true);

            //Maybe don't need to get these since we can exact them from the container UI
            var contentAssessmentResult = essayResult['content_result'];
            var grammarAssessmentResult = essayResult['grammar_result'];
            var textStatsResult = essayResult['text_stats'];
            var imageHash = essayResult['image_hash'];

            var topicHeading = new Paragraph({
                text: 'Topic: ' + topic,
                heading: HeadingLevel.HEADING_1,
            });

            var topicImage = null;
            if(imageHash) {
                try {
                    var formData = new FormData();
                    formData.append('action', 'writing_task_1_image_data_fetch');
                    formData.append('image_hash', imageHash);
                    var response = await fetch(writing_band_score_container_ajax.ajaxurl, {
                        method: 'POST',
                        body: formData
                    });
                    var response = await response.json();
                    if(response.success) {
                        var base64String = response.data.base64;
                        var width = response.data.width;
                        var height = response.data.height;

                        topicImage = new ImageRun({
                            data: base64String,
                            transformation: {
                                width: width,
                                height: height
                            },
                        });
                    }
                } catch (error) {
                    console.error('Error loading image:', error);
                }
            }

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

            var grammarMistakes = new Paragraph({
                children: [
                    new TextRun({
                        text: textStatsResult['grammar_errors'].toString(),
                        bold: true,
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
                columnWidths: [2252, 2252, 2252, 2252],
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
                                children: [new Paragraph({ text: "Task Response", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
                                width: { size: 25, type: WidthType.PERCENTAGE }
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: "Coherence & Cohesion", heading: HeadingLevel.HEADING_2, alignment: AlignmentType.CENTER })],
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
                                            text: contentAssessmentResult['coherence_and_cohesion']['score'].toString(),
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
                                children: [new Paragraph({ text: contentAssessmentResult['task_response']['feedback_and_suggestions'] })],
                            }),
                            new TableCell({
                                children: [new Paragraph({ text: contentAssessmentResult['coherence_and_cohesion']['feedback_and_suggestions'] })],
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

            // Helper function to parse text with <del> and <ins> tags
            const parseTextWithTags = (text) => {
                const textRuns = [];
                const regex = /<p>|<\/p>|<del data-index="\d+">(.*?)<\/del>|<ins data-index="\d+">(.*?)<\/ins>|([^<]+)/g; // Added </p> to regex
                let match;
        
                while ((match = regex.exec(text)) !== null) {
                    if (match[0] === '<p>' || match[0] === '</p>') {  // Handle both opening and closing p tags
                        // Add line break for paragraph tags
                        textRuns.push(
                            new TextRun({
                                text: '',
                                break: 1
                            })
                        );
                    } else if (match[1] !== null && match[1] !== undefined) { //have to check for null and undefined because some text might be empty
                        // `<del>` tag: Highlight deletions (red strike-through)
                        textRuns.push(
                            new TextRun({
                                text: match[1].trim().length > 0 ? match[1] : ' ', //if text is empty, add a space to make it visible in the docx
                                strike: true,
                                color: "ff0000", // Red color
                            })
                        );
                    } else if (match[2] !== null && match[2] !== undefined) {
                        // `<ins>` tag: Highlight insertions (green underline)
                        textRuns.push(
                            new TextRun({
                                text: match[2].trim().length > 0 ? match[2] : ' ',
                                underline: {},
                                color: "008c10", // Green color
                            })
                        );
                    } else if (match[3] !== null && match[3] !== undefined) {
                        // Plain text
                        textRuns.push(new TextRun(match[3]));
                    }
                }

                var paragraphs = text.split(/<\/?p>/).filter(p => p.trim());
                var totalWords = paragraphs.reduce((count, p) => {
                    var cleanedParagraph = p.replace(/<[^>]*>/g, '').trim();
                    return count + (cleanedParagraph ? cleanedParagraph.split(/\s+/).length : 0);
                }, 0);
                textRuns.push(new TextRun({
                    text: 'Word Count: ' + totalWords,
                    break: 2,
                }));

                return textRuns;
            };
        
            // Create a table to display the side-by-side comparison
            var grammarAssessmentTable = new Table({
                width: {
                    size: 100,
                    type: WidthType.AUTO,
                },
                columnWidths: [4505, 4505],
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
                                children: [
                                    new Paragraph({
                                        text: "Original",
                                        heading: HeadingLevel.HEADING_2,
                                        alignment: AlignmentType.CENTER,
                                    }),
                                ],
                                width: {
                                    size: 50,
                                    type: WidthType.PERCENTAGE,
                                },
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        text: "Corrected",
                                        heading: HeadingLevel.HEADING_2,
                                        alignment: AlignmentType.CENTER,
                                    }),
                                ],
                                width: {
                                    size: 50,
                                    type: WidthType.PERCENTAGE,
                                },
                            }),
                        ],
                    }),
                    // Content row
                    new TableRow({
                        children: [
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: parseTextWithTags(grammarAssessmentResult.left),
                                    }),
                                ],
                                width: {
                                    size: 50,
                                    type: WidthType.PERCENTAGE,
                                },
                            }),
                            new TableCell({
                                children: [
                                    new Paragraph({
                                        children: parseTextWithTags(grammarAssessmentResult.right),
                                    }),
                                ],
                                width: {
                                    size: 50,
                                    type: WidthType.PERCENTAGE,
                                },
                            }),
                        ],
                    }),
                ],
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
                                children: topicImage ? [topicImage] : [],
                            }),
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
                                text: "Grammar Mistakes:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            grammarMistakes,
                            new Paragraph({
                                text: "Vocabulary Repetition:",
                                heading: HeadingLevel.HEADING_2,
                                spacing: { before: 200 }
                            }),
                            vocabularyRepetitions,
                            new Paragraph({
                                text: "----Corrected Writing----",
                                heading: HeadingLevel.HEADING_1,
                                spacing: { before: 500, after: 200 }
                            }),
                            grammarAssessmentTable,
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
            link.download = "writing_assessment.docx";
            link.click();

            //reset the button
            $(`${containerName} .export-essay-result-button`).html('Export Result to Word <i class="fa-solid fa-file-export"></i>');
            $(`${containerName} .export-essay-result-button`).prop('disabled', false);
        });
    }

    window.writingTaskCheckerReusable.getWordRepetition = function(text) {
        // Replace punctuation with empty string
        text = text.replace(/[.,]/g, '');
        var words = text.split(' ');
        var wordCount = {};
    
        for (var i = 0; i < words.length; i++) {
            var word = words[i].toLowerCase();
            if (word in wordCount) {
                wordCount[word]++;
            } else {
                wordCount[word] = 1;
            }
        }
    
        var wordCountArray = [];
        for (var word in wordCount) {
            wordCountArray.push({
                word: word,
                count: wordCount[word]
            });
        }
    
        // Sort the array by count in descending order
        wordCountArray.sort(function(a, b) {
            return b.count - a.count;
        });
    
        return wordCountArray;
    }

    window.writingTaskCheckerReusable.getOverallWritingBandScore = function(containerName) {
        return parseFloat($(`${containerName} .overall-band-score`).text());
    }

    window.writingTaskCheckerReusable.animateScore = function(element, targetScore) {
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