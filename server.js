/* TO DO:
- Set up rooms
- Delete room keys?
*/

var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    initiated;

app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

server.listen(3000);

app.get('/', function (req, res) {
  res.render('index');
})

app.get('/handshake', function (req, res) {
  var user_id,
      room_key,
      initiator,
      pc_config,
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
  
  var createPcConfig = function() {
    var servers = [];
    var stun_config = 'stun: stun.l.google.com:19302';
    servers.push({ 'url': stun_config });
    return { 'iceServers': servers };
  }

  var createMediaConstraints = function() {
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

  pc_config = createPcConfig();
  media_constraints = createMediaConstraints();
  stereo = false; // Revisit this later to see what it does

  client_data = {
    'user_id': user_id,
    'room_key': room_key,
    'initiator': initiator,
    'pc_config': pc_config,
    'media_constraints': media_constraints,
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