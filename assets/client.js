// ;(function(exports) {

  // Section 0: Global variables

  // Media initialization varibles
  var getUserMedia = navigator.webkitGetUserMedia.bind(navigator),
      webRTCDetectedVersion = parseInt(navigator.userAgent.match(/Chrom(e|ium)\/([0-9]+)\./)[2]),
      localVideo,
      miniVideo,
      remoteVideo,
      mediaContainer,
      localStream;

  // Connection and messaging variables
  var pc,
      socket,
      userName;

  // sdp constraints
  var sdpConstraints = {
    'mandatory': {
      'OfferToReceiveAudio': true,
      'OfferToReceiveVideo': true
    }
  };

  // Application initialization variables
  var pcConfig,
      mediaConstraints;

  // Section 1: Initialize video and channel

  var initialize = function(){
    console.log('Initializing')

    pcConfig = createPcConfig();
    mediaConstraints = { 'video': true, 'audio': true };

    callGroundworkFunctions();
  }

  var createPcConfig = function() {
    var servers = [];
    var stun_config = 'stun: stun.l.google.com:19302';
    servers.push({ 'url': stun_config });
    return { 'iceServers': servers };
  }

  var callGroundworkFunctions = function() {
    activateVideo();
    openChannel();
    console.log('Groundwork functions have been called');
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
  }

  var onUserMediaError = function(error) {
    console.log('Failed to get access to local media. Error code was: ' +
                error.code);
  }

  // Section 3: Send ice candidates that have been received by the ice agent to peer

  var onIceCandidate = function(toSID, event) {
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate,
        to: toSID
      });
    } else {
      console.log('End of candidates');
    }
  }


  // Section 4: Set up the channel

  var openChannel = function() {
    console.log('Opening the channel');
    socket = io.connect();
    userName = prompt("What is your name friendo? ");
    socket.emit('register', {name: userName});
    socket.on('connect', onChannelOpened);
    socket.on('message', onChannelMessage);
    socket.on('disconnect', onChannelClosed);
  }

  var onChannelOpened = function() {
    console.log('Channel opened');
  }

  var onChannelMessage = function(message) {
    console.log('Received a message from the server of type: ' + message.type);

    if (message.type === 'offer') {
      handlePeerConnectionOffer(message);
    } else if (message.type === 'answer') {
      handlePeerConnectionAnswer(message);
    } else if (message.type === 'connectionRequest') {
      if (confirm('Do you want to connect to: ' + message.name)) {
        tryCreateConnection(message.from);
        sendConnectionAnswer(message.from);
      }
    } else if(message.type === 'connectionAnswer') {
      tryCreateConnection(message.from);
      sendPeerConnectionOffer(message.from);
    } else if (message.type === 'candidate') {
      handleCandidateMessage(message);
    } else if (message.type === 'requestForOffer') {
      sendPeerConnectionOffer(message.from);
    } else if (message.type === 'userRegister') {
      appendToUsersList(message.socketId, message.name);
    } else if (message.type === 'userDisconnect') {
      removeFromUsersList(message.socketId);
    } else if (message.type === 'bye') {
      callEnded();
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

  var sendMessage = function(message) {
    console.log('Sending client to server message of type: ' + message.type);
    message.from = socket.socket.sessionid;
    socket.emit('message', message);
  }


  // Section 5: Set up the peer connection and message handler functions
  var sendConnectionAnswer = function(toSID) {
    sendMessage({
      type: 'connectionAnswer',
      to: toSID
    });
  }

  var sendPeerConnectionOffer = function(toSID) {
    console.log('Sending offer to peer');

    // createOffer generates a blob of SDP that contains configuration options
    // for the session, including: a description of local mediaStream attached
    // to the peer connection object, the codec options supported by the
    // implementation, and any candidates that have been gathered by the ICE Agent.
    // Contains the full set of capabilities supported by the session, (as opposed
    // to the answer, which only contains a specific negotiated subset to use)
    // The constraints parameter provides additional control over the offer generated
    pc.createOffer(function(desc) {
      setLocalAndSendMessage(toSID, desc);
    }, null, sdpConstraints);
  }

  var handlePeerConnectionOffer = function(message) {
    pc.setRemoteDescription(new RTCSessionDescription(message));
    sendPeerConnectionAnswer(message.from);
    console.log('Connection answer sent to peer');
  }

  var sendPeerConnectionAnswer = function(toSID) {
    console.log('Sending answer to peer.');

    // Generates a blob of SDP that includes the supported configuration for
    // the session based on the parameters in the remote configuration.
    // Contains: the local mediaStreams attached to the connection object,
    // the codec options negotiated for the session, and any candidates gathered
    // by the ICE Agent. Like the offer, the answer can also include additional constraints.
    // The session description generated by createAnswer will contain a specific
    // configuration that, along with the corresponding offer, will specify how
    // the media plane should be established.
    pc.createAnswer(function(desc) {
      setLocalAndSendMessage(toSID, desc)
    } , null, sdpConstraints);
  }

  var handlePeerConnectionAnswer = function(message) {
    console.log('Received answer from peer.');
    pc.setRemoteDescription(new RTCSessionDescription(message));
  }

  var setLocalAndSendMessage = function(toSID, sessionDescription) {
    sessionDescription.to = toSID;

    // Sets the local description equal of the peerconnection equal to the
    // blob elements generated by createOffer or createAnswer
    pc.setLocalDescription(sessionDescription);
    sendMessage(sessionDescription);
  }

  var tryCreateConnection = function(toSID) {
    if (localStream) {
      try {

        // The pc object has the information to find and acess the STUN server.
        // The pc has an associated ICE agent that is responsible for interfacing with the
        // STUN server
        pc = new webkitRTCPeerConnection(pcConfig);

        // Handles a changed to the state of the ICE agent, Called any time
        // that the ice agent receives an ice candidate from the ICE server
        pc.onicecandidate = function(desc) {
          onIceCandidate(toSID, desc);
        }
        console.log('Created a new peer connection')
        pc.addStream(localStream);
        pc.onaddstream = function(event) {
          onRemoteStreamAdded(toSID, event);
        }
        pc.onremovestream = onRemoteStreamRemoved;
      } catch (error) {
        console.log('Failed to create PeerConnection, exception: ' + error.message);
      }  
    } else {
      console.log('Failed to create peerConnection object');
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
  var onRemoteStreamAdded = function(toSID, event) {
    console.log('Remote stream added.');
    remoteStream = event.stream;
    miniVideo.src = localVideo.src;
    remoteVideo.src = URL.createObjectURL(event.stream);
    waitForRemoteVideo(toSID);
  }

  var onRemoteStreamRemoved = function(event) {
    console.log('Remote stream removed');
  }

  var waitForRemoteVideo = function(toSID) {
    var videoTracks = remoteStream.getVideoTracks();
    if (videoTracks.length === 0 || remoteVideo.currentTime > 0) {
      transitionToActive(toSID);
    } else {
      console.log('Waiting for remote video');
      setTimeout(waitForRemoteVideo, 100, [toSID]);
    }
  }

  // Section 7: Video functionality

  var hangUp = function(toSID) {
    sendMessage({
      type: 'bye',
      to: toSID
    });
    callEnded();
  }

  var callEnded = function() {
    pc.close();
    removeHangUpButton();
    transitiontoInactive();
  }


  // Section 8: DOM element modifiers

  var transitionToActive = function(toSID) {
    remoteVideo.style.opacity = 1;
    mediaContainer.style.webkitTransform = 'rotateY(180deg)';
    setTimeout(function() { localVideo.src = ''; }, 500);
    setTimeout(function() { miniVideo.style.opacity = 1; }, 1000);
    appendHangUpButton(toSID);
  }

  var transitiontoInactive = function() {
    mediaContainer.style.webkitTransform = 'rotateY(0deg)';
    setTimeout(function() {
      localVideo.src = miniVideo.src;
      miniVideo.src = '';
      remoteVideo.src = '';
    }, 500);
    miniVideo.style.opacity = 0;
    remoteVideo.style.opacity = 0;
  }


  $(document).on('click', '.user', function(e) {
    e.preventDefault();
    socket.emit('message', {
      type: 'connectionRequest',
      to: this.dataset.socketId,
      name: userName,
      from: socket.socket.sessionid
    })
  })

  $(document).on('click', '#hangup', function() {
    hangUp(this.dataset.socketId);
  })

  var appendToUsersList = function(socketId, name) {
    $("#users").append('<li class="user" data-socket-id=' + socketId + '><a href="#">' + name + '</a></li>')
  }

  var removeFromUsersList = function(socketId) {
    $(".user").filter(function() {
      return this.dataset.socketId === socketId
    }).remove();
  }

  var appendHangUpButton = function(toSID) {
    $("#hangupContainer").append('<br><button id="hangup" data-socket-id=' + toSID + '>Hang Up</button>');
  }

  var removeHangUpButton = function() {
    $("#hangup").remove();
  }

  window.onload = initialize;

// }(this));
