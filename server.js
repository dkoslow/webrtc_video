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

var room;

app.get('/handshake', function (req, res) {
  var user_id;
  var room_key;
  var initiator;
  var turn_url;
  var pc_config;
  var pc_constraints;
  var media_constraints;
  var stereo;
  var client_data;

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
    var constraints = { 'optional': [] }
    return constraints; 
  }

  var createMediaConstraints = function() {
    // var video_constraints = { 'optional': [], 'mandatory': {} };
    var media_constraints = { 'video': true, 'audio': true };
    return media_constraints;
  }
  
  user_id = createUserId();
  room_key = createRoomKey();
  if (!room) {
    room = {
      'key': room_key,
      'users': []
    };
    initiator = true;
  } else {
    initiator = false;
  }
  room.users.push(user_id);

  turn_url = createTurnURL(user_id);
  pc_config = createPcConfig();
  pc_constraints = createPcConstraints();
  media_constraints = createMediaConstraints();
  stereo = false; // Revisit this later to see what it does

  client_data = {
    'token': '1111111',
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
  socket.on('message', function (msg) {
    console.log('I received a private message saying: ' + msg);
    socket.broadcast.emit('message', msg);
  });

  socket.on('disconnect', function () {
    io.sockets.emit('user disconnected');
  });
})