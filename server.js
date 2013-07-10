/* TO DO:
- Set up rooms
- Delete room keys?
*/

var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server);

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

server.listen(3000);

app.get('/', function (req, res) {
  res.render('index');
})

var initiated;

app.get('/handshake', function (req, res) {
  var user_id,
      room_key,
      initiator,
      turn_url,
      pc_config,
      pc_constraints,
      media_constraints,
      stereo,
      client_data;

  var createUserId = function() {
    // Generates a random 8 digit number
    var id = Math.floor((Math.random()+1)*10000000);
    return id;
  }

  var createRoomKey = function() {
    // Will need to make dynamic once app is ready for more than 2 users
    var key = '12345678';
    return key;
  }

  var createTurnURL = function(user_id) {
    var baseURL = 'https://computeengineondemand.appspot.com/';
    var turnURL = baseURL + 'turn?' + 'username=' + user_id + '&key=4080218913';
    return turnURL;
  }
  
  var createPcConfig = function() {
    var servers = [];
    var stun_config = 'stun: stun.l.google.com:19302';
    servers.push({ 'url': stun_config });
    return { 'iceServers': servers };
  }

  // This no longer seems to do anything, need to refactor later
  var createPcConstraints = function() {
    var constraints = { 'optional': [] };
    return constraints; 
  }

  var createMediaConstraints = function() {
    // var video_constraints = { 'optional': [], 'mandatory': {} };
    var media_constraints = { 'video': true, 'audio': true };
    return media_constraints;
  }
  
  user_id = createUserId();
  room_key = createRoomKey();
  if (!initiated) {
    initiated = true;
    initiator = true;
  } else {
    initiator = false;
  }

  turn_url = createTurnURL(user_id);
  pc_config = createPcConfig();
  pc_constraints = createPcConstraints();
  media_constraints = createMediaConstraints();
  stereo = false; // Revisit this later to see what it does

  client_data = {
    'user_id': user_id,
    'room_key': room_key,
    'initiator': initiator,
    'pc_config': pc_config,
    'pc_constraints': pc_constraints,
    'media_constraints': media_constraints,
    'turn_url': turn_url,
    'stereo': stereo
  }

  res.send(client_data);
})

io.sockets.on('connection', function(socket) {
  var otherUser;

  socket.on('room', function(room) {
    console.log(socket.id + " asked to join room: " + room);
    socket.join(room);
  });

  socket.on('message', function (msg) {
    console.log('Server received a message of type: ' + msg.type);
    otherUser = otherUser || setOtherUser();

    // Send message to other user, if setOtherUser returns "null"
    // socket.io seems to be able to handle it gracefully
    io.sockets.socket(otherUser).emit("message", msg);
  });

  var setOtherUser = function() {
    var room,
        roomNumber,
        otherUserId;

    room = io.sockets.manager.roomClients[socket.id];
    roomNumber = findRoomNumber(room);
    otherUserId = otherUserInRoom(roomNumber);
    return otherUserId;
  }

  var findRoomNumber = function(room) {
    for (var key in room) {
      if (key.length > 0) {
        return key.substr(1);
      }
    }
  }

  var otherUserInRoom = function(roomNumber) {
    var clientArray = io.sockets.clients(roomNumber),
        firstClientId,
        secondClientId;

    if (clientArray.length == 2) {
      firstClientId = clientArray[0].id;
      secondClientId = clientArray[1].id;

      if (socket.id === firstClientId) {
        return secondClientId;
      } else if (socket.id === secondClientId ) {
        return firstClientId;
      } else {
        console.log("Socket id does not match either client");
      }
    } else {
      console.log("Message received in room with only one user.");
    }
  }

  socket.on('disconnect', function () {
    io.sockets.emit('User disconnected');
  });
})