var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    qs = require('querystring'),
    users = [],
    initiated;

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.static('assets'));

app.use(express.bodyParser());

server.listen(3000);

app.get('/', function (req, res) {
  res.render('index.html', {users: users});
})

app.get('/handshake', function (req, res) {
  var user_id,
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

  pc_config = createPcConfig();
  media_constraints = createMediaConstraints();
  stereo = false; // Revisit this later to see what it does

  client_data = {
    'user_id': user_id,
    'pc_config': pc_config,
    'media_constraints': media_constraints,
    'stereo': stereo
  }

  res.send(client_data);
})

io.sockets.on('connection', function(socket) {

  socket.on('register', function(userData) {
    users.push({socketId: socket.id, name: userData.name});
    socket.broadcast.emit('message', {
      type: 'userRegister',
      socketId: socket.id,
      name: userData.name
    })
  });


  socket.on('message', function (msg) {
    console.log('Server received a message of type: ' + msg.type +
      ' from: ' + msg.from + ' to: ' + msg.to);
    console.log('Message: ' + console.dir(msg));

    // Send message to other user, if setOtherUser returns "null"
    // socket.io seems to be able to handle it gracefully
    io.sockets.socket(msg.to).emit('message', msg);
  });

  socket.on('disconnect', function () {
    // TODO: Remove user from users where socketId === socket.id
    io.sockets.emit('User disconnected');
  });
})