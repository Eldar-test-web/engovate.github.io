window.speakingPartCheckerReusable = window.speakingPartCheckerReusable || {};

jQuery(document).ready(function ($) {

    var userAudioDatas = {};

    //----AUDIO RECORDING----//
    window.speakingPartCheckerReusable.setUpAudioRecorder = function(recorderName, maxRecordingTime, onStart = null, onFinalized = null) {

        var container = $(recorderName).closest('.speaking-part-answer-recorder');
        var speakingTimeSpan = container.find('.speaking-time span');
        var textHolderElementId = '#' + container.find('.content-editable-div-wrapper')[0].id;
        var audioRecordContainer = container.find('.audio-record-container');
        var audioUploadContainer = container.find('.audio-upload-container');

        window.audioRecorderReusable.setOnDoRecordingEvent(recorderName, maxRecordingTime, false,
        () => { //onStart
            speakingTimeSpan.text('0');
            userAudioDatas[recorderName] = null;
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, 'Recording...');
            audioUploadContainer.hide();
            if(onStart) onStart();
        },
        (elapsedTime, percentage) => { //onTimerFill
            speakingTimeSpan.text(elapsedTime);
        },
        (transcript) => { //onInterimTranscriptUpdate
    
        },
        (transcript) => { //onFullTranscriptUpdate
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, transcript);
        },
        () => { //onStop
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, 'Finalizing input...');
        },
        (audioData, duration, transcript) => { //onFinalized
            userAudioDatas[recorderName] = audioData;
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, 'Your answer has been successfully recorded!');
            speakingTimeSpan.text(duration);
            if(onFinalized) onFinalized();
        });
    
        window.audioRecorderReusable.setOnClickStopRecordingEvent(recorderName, function() {});
    
        window.audioRecorderReusable.setOnRecordedAudioPlayerCloseEvent(recorderName, true, function () {
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, '');
            speakingTimeSpan.text('0');
            userAudioDatas[recorderName] = null;
            audioUploadContainer.show();
        });


        //----AUDIO UPLOADING----//
        window.audioUploaderReusable.setOnDoUploadingEvent(recorderName + '-upload', maxRecordingTime, () => {
            speakingTimeSpan.text('0');
            userAudioDatas[recorderName] = null;
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, 'Uploading audio file...');
            audioRecordContainer.hide();
            if(onStart) onStart();
        }, (audioData, duration) => {
            if(audioData) {
                speakingTimeSpan.text(duration);
                userAudioDatas[recorderName] = audioData;
                window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, 'Your audio file has been successfully uploaded!');
                audioRecordContainer.hide();
            }
            else {
                window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, '');
                speakingTimeSpan.text('0');
                userAudioDatas[recorderName] = null;
                audioRecordContainer.show();
            }
            if(onFinalized) onFinalized();
        });

        window.audioUploaderReusable.setOnUploadedAudioPlayerCloseEvent(recorderName + '-upload', true, () => {
            window.contentEditableDiv.setContentEditorPlainText(textHolderElementId, '');
            speakingTimeSpan.text('0');
            userAudioDatas[recorderName] = null;
            audioRecordContainer.show();
        });
    }

    window.speakingPartCheckerReusable.setAudioRecorderScriptText = function(recorderName, text) {
        window.contentEditableDiv.setContentEditorPlainText(window.speakingPartCheckerReusable.getAudioRecorderContentEditableId(recorderName), text);
    }

    window.speakingPartCheckerReusable.getAudioRecorderContentEditableId = function(recorderName) {
        var container = $(recorderName).closest('.speaking-part-answer-recorder');
        var textHolderElementId = '#' + container.find('.content-editable-div-wrapper')[0].id;
        return textHolderElementId;
    }

    window.speakingPartCheckerReusable.getAudioRecorderData = function(recorderName) {
        return userAudioDatas[recorderName];
    }

    window.speakingPartCheckerReusable.getAudioRecorderRecordingTime = function(recorderName) {
        var container = $(recorderName).closest('.speaking-part-answer-recorder');
        var speakingTimeSpan = container.find('.speaking-time span');
        return parseInt(speakingTimeSpan.text());
    }

    $('.speaking-part-note button').on('click', function() {
        var noteContainer = $(this).closest('.speaking-part-note');
        if(noteContainer.find('.note-popup').is(":visible")) {
            noteContainer.find('.note-popup').hide();
            $(this).find('span').text('Take notes');
        }
        else {
            noteContainer.find('.note-popup').show();
            noteContainer.find('.note-content').focus();
            $(this).find('span').text('Close notes');
        }
    });
});