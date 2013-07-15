// ;(function(exports) {

  // Section 1: Initialize global variables and do app server handshake

  // Media initialization varibles
  var getUserMedia = navigator.webkitGetUserMedia.bind(navigator),
      webRTCDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]),
      localVideo,
      miniVideo,
      remoteVideo,
      mediaContainer,
      videoTracks;

  // Media constraints
  var sdpConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': true
    }
  };

  // Socket
  var socket;

  // Groundwork function completion variables
  var readyToConnect = false,
      localStream,
      channelReady;

  // Connection and messaging variables
  var pc,
      socket,
      xmlhttp;

  // Application initialization variables (from server)
  var userId,
      roomKey,
      initiator,
      pcConfig,
      offerConstraints,
      mediaConstraints,
      stereo;

  var initialize = function(){
    console.log('Sending request for initialization variables')
    $.ajax({
      url: '/handshake',
      dataType: 'json',

      success: function(data) {
        console.log('Received intialization data from server: ' + data);

        userId = data['user_id'];
        roomKey = data['room_key'];
        initiator = data['initiator'];
        pcConfig = data['pc_config'];
        mediaConstraints = data['media_constraints'];
        stereo = data['stereo'];

        callGroundworkFunctions();
      },
      error: function(_, errorMessage) {
        console.log('Handshake failed: ', status);
        alert('Initialization failed. Please exit video chat and try again.');
      }
    });
  }

  var callGroundworkFunctions = function() {
    activateVideo();
    openChannel();
    console.log('Groundwork functions have been called');
  }

  // Called by all three Groundwork Function branches.
  // Makes sure all three branches have finished before executing.
  var startWhenReady = function() {
    if (!readyToConnect && localStream && channelReady) {
      readyToConnect = true;

      tryCreateConnection();

      if (initiator) {
        console.log('Initiator is ready to connect');
        sendPeerConnectionOffer();
      } else {
        console.log('Receiver is ready to connect');
        sendMessage({type: 'requestForOffer'});
      }
    } else {
      console.log('startWhenReady failed.');
    }
  }


  // Section 2: Get local media

  var activateVideo = function() {
    console.log('Initializing media elements')
    localVideo = document.getElementById('localVideo');
    miniVideo = document.getElementById('miniVideo');
    remoteVideo = document.getElementById('remoteVideo');
    mediaContainer = document.getElementById('mediaContainer');
    tryGetUserMedia(mediaConstraints);
  }

  var tryGetUserMedia = function(constraints) {
    console.log('Attempting to get user media.');
    try {
      getUserMedia(constraints, onUserMediaSuccess, onUserMediaError);
    } catch(error) {
      alert('Failed to capture local media. Please try again.');
      console.log('getUserMedia failed with exception: ' + error.message);
    }
  }

  var onUserMediaSuccess = function(stream) {
    console.log('User has granted access to local media');
    localVideo.src = URL.createObjectURL(stream);
    localVideo.style.opacity = 1;
    localStream = stream;
    startWhenReady();
  }

  var onUserMediaError = function(error) {
    console.log('Failed to get access to local media. Error code was: ' +
                error.code);
  }


  // Section 3: Send ice candidates that have been received by the ice agent to peer

  var onIceCandidate = function(event) {
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates');
    }
  }


  // Section 4: Set up the channel

  var openChannel = function() {
    console.log('Opening the channel');
    socket = io.connect();
    socket.on('connect', onChannelOpened);
    socket.on('message', onChannelMessage);
    socket.on('disconnect', onChannelClosed);
  }

  var onChannelOpened = function() {
    console.log('Channel opened');
    socket.emit('room', roomKey);
    channelReady = true;
    startWhenReady();
  }

  var onChannelMessage = function(message) {
    console.log('Received a message from the server of type: ' + message.type);

    if (message.type === 'offer') {
      handlePeerConnectionOffer(message);
    } else if (message.type === 'answer') {
      handlePeerConnectionAnswer(message);
    } else if (message.type === 'candidate') {
      handleCandidateMessage(message);
    } else if (message.type === 'requestForOffer') {
      sendPeerConnectionOffer();
    } else if (message.type === 'bye') {
      onHangup();
    } else {
      console.log('Received message of unknown type: ' + message);
    }
  }

  var onChannelError = function() {
    console.log('Channel error');
  }

  var onChannelClosed = function() {
    console.log('Channel closed');
  }


  // Section 5: Set up the peer connection and message handler functions

  var sendPeerConnectionOffer = function() {
    if (readyToConnect) {
      console.log('Sending offer to peer');

      // createOffer generates a blob of SDP that contains configuration options
      // for the session, including: a description of local mediaStream attached
      // to the peer connection object, the codec options supported by the
      // implementation, and any candidates that have been gathered by the ICE Agent.
      // Contains the full set of capabilities supported by the session, (as opposed
      // to the answer, which only contains a specific negotiated subset to use)
      // The constraints parameter provides additional control over the offer generated
      pc.createOffer(setLocalAndSendMessage, null, sdpConstraints);
    } else {
      console.log("Received requestForOffer but was not readyToConnect.")
    }
  }

  var handlePeerConnectionOffer = function(message) {
    if (readyToConnect) {
      if (stereo) {
        message.sdp = addStereo(message.sdp);
      }
      pc.setRemoteDescription(new RTCSessionDescription(message));
      sendPeerConnectionAnswer();
      console.log('Connection answer sent to peer');
    } else {
      console.log("Received connection offer but was not readyToConnect.")
    }
  }

  var sendPeerConnectionAnswer = function() {
    console.log('Sending answer to peer.');

    // Generates a blob of SDP that includes the supported configuration for
    // the session based on the parameters in the remote configuration.
    // Contains: the local mediaStreams attached to the connection object,
    // the codec options negotiated for the session, and any candidates gathered
    // by the ICE Agent. Like the offer, the answer can also include additional constraints.
    // The session description generated by createAnswer will contain a specific
    // configuration that, along with the corresponding offer, will specify how
    // the media plane should be established.
    pc.createAnswer(setLocalAndSendMessage, null, sdpConstraints);
  }

  var handlePeerConnectionAnswer = function(message) {
    console.log('Received answer from peer.');
    if (stereo) message.sdp = addStereo(message.sdp);
    pc.setRemoteDescription(new RTCSessionDescription(message));
  }

  var setLocalAndSendMessage = function(sessionDescription) {
    // Set Opus as the preferred codec in SDP if Opus is present
    sessionDescription.sdp = preferOpus(sessionDescription.sdp);

    // Sets the local description equal of the peerconnection equal to the
    // blob elements generated by createOffer or createAnswer
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
  }

  var tryCreateConnection = function() {
    try {

      // The pc object has the information to find and acess the STUN server.
      // The pc has an associated ICE agent that is responsible for interfacing with the
      // STUN server
      pc = new webkitRTCPeerConnection(pcConfig);

      // Handles a changed to the state of the ICE agent, Called any time
      // that the ice agent receives an ice candidate from the ICE server
      pc.onicecandidate = onIceCandidate;
      console.log('Created a new peer connection')
      pc.addStream(localStream);
      pc.onaddstream = onRemoteStreamAdded;
      pc.onremovestream = onRemoteStreamRemoved;
    } catch (error) {
      console.log('Failed to create PeerConnection, exception: ' + error.message);
    }
  }

  // Handles candidate messages, ensures that pc has been established
  // before calling addIceCandidate
  var handleCandidateMessage = function(message) {
    if (pc) {
      var candidate = new RTCIceCandidate({
        sdpMLineIndex: message.label,
        candidate: message.candidate
      });

      // Provides a remote candidate (received from peer) to the ice agent,
      // the ice agent then adds the remote candidate to the remote description
      pc.addIceCandidate(candidate);
    }
  }


  // Section 6: Manage remote video
  var onRemoteStreamAdded = function(event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    miniVideo.src = localVideo.src;
    remoteVideo.src = URL.createObjectURL(event.stream);
    waitForRemoteVideo();
  }

  function onRemoteStreamRemoved(event) {
    console.log('Remote stream removed');
  }

  function waitForRemoteVideo() {
    videoTracks = remoteStream.getVideoTracks();
    if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
      transitionToActive();
    } else {
      console.log('Waiting for remote video');
      setTimeout(waitForRemoteVideo, 100);
    }
  }


  // Section 7: Session handlers

  function transitionToActive() {
    remoteVideo.style.opacity = 1;
    mediaContainer.style.webkitTransform = 'rotateY(180deg)';
    setTimeout(function() { localVideo.src = ''; }, 500);
    setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
  }

  var hangup = function() {
    onHangup();
    socket.close();
  }

  var onHangup = function() {
    if(pc) pc.close();
    pc = null;
  }

  window.onbeforeunload = function() {
    sendMessage({type: 'bye'});
    console.log('Bye sent on refreshing page to ensure room is cleaned.');
  }


  // Section 8: Utilities

  var sendMessage = function(message) {
    console.log('Sending client to server message of type: ' + message.type);
    socket.emit('message', message);
  }

  var mergeConstraints = function(cons1, cons2) {
    var merged = cons1;
    for (var name in cons2.mandatory) {
      merged.mandatory[name] = cons2.mandatory[name];
    }
    merged.optional.concat(cons2.optional);
    return merged;
  }


  // Section 9: Opus stuff (Direct C+P)

  // Set Opus as the default audio codec if it's present.
  function preferOpus(sdp) {
    var sdpLines = sdp.split('\r\n');

    // Search for m line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('m=audio') !== -1) {
        var mLineIndex = i;
        break;
      }
    }
    if (mLineIndex === null)
      return sdp;

    // If Opus is available, set it as the default in m line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('opus/48000') !== -1) {
        var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
        if (opusPayload)
          sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex],
                                                 opusPayload);
        break;
      }
    }

    // Remove CN in m line and sdp.
    sdpLines = removeCN(sdpLines, mLineIndex);

    sdp = sdpLines.join('\r\n');
    return sdp;
  }

  // Set Opus in stereo if stereo is enabled.
  function addStereo(sdp) {
    var sdpLines = sdp.split('\r\n');

    // Find opus payload.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('opus/48000') !== -1) {
        var opusPayload = extractSdp(sdpLines[i], /:(\d+) opus\/48000/i);
        break;
      }
    }

    // Find the payload in fmtp line.
    for (var i = 0; i < sdpLines.length; i++) {
      if (sdpLines[i].search('a=fmtp') !== -1) {
        var payload = extractSdp(sdpLines[i], /a=fmtp:(\d+)/ );
        if (payload === opusPayload) {
          var fmtpLineIndex = i;
          break;
        }
      }
    }
    // No fmtp line found.
    if (fmtpLineIndex === null)
      return sdp;

    // Append stereo=1 to fmtp line.
    sdpLines[fmtpLineIndex] = sdpLines[fmtpLineIndex].concat(' stereo=1');

    sdp = sdpLines.join('\r\n');
    return sdp;
  }

  function extractSdp(sdpLine, pattern) {
    var result = sdpLine.match(pattern);
    return (result && result.length == 2)? result[1]: null;
  }

  // Set the selected codec to the first in m line.
  function setDefaultCodec(mLine, payload) {
    var elements = mLine.split(' ');
    var newLine = new Array();
    var index = 0;
    for (var i = 0; i < elements.length; i++) {
      if (index === 3) // Format of media starts from the fourth.
        newLine[index++] = payload; // Put target payload to the first.
      if (elements[i] !== payload)
        newLine[index++] = elements[i];
    }
    return newLine.join(' ');
  }

  // Strip CN from sdp before CN constraints is ready.
  function removeCN(sdpLines, mLineIndex) {
    var mLineElements = sdpLines[mLineIndex].split(' ');
    // Scan from end for the convenience of removing an item.
    for (var i = sdpLines.length-1; i >= 0; i--) {
      var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
      if (payload) {
        var cnPos = mLineElements.indexOf(payload);
        if (cnPos !== -1) {
          // Remove CN payload from m line.
          mLineElements.splice(cnPos, 1);
        }
        // Remove CN line in sdp
        sdpLines.splice(i, 1);
      }
    }

    sdpLines[mLineIndex] = mLineElements.join(' ');
    return sdpLines;
  }

  setTimeout(initialize, 2000);

// }(this));
