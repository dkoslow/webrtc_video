var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require('socket.io').listen(server),
    users = [];

app.set('views', __dirname + '/views');
app.engine('html', require('ejs').renderFile);
app.use(express.static('assets'));

app.use(express.bodyParser());
app.use(express.favicon(__dirname + '/assets/favicon.ico'));

server.listen(3000);

app.get('/', function (req, res) {
  res.render('index.html', {users: users});
})

io.sockets.on('connection', function(socket) {
  var userName;

  socket.on('register', function(userData) {
    userName = userData.name
    users.push({socketId: socket.id, name: userName});
    socket.broadcast.emit('message', {
      type: 'userRegister',
      socketId: socket.id,
      name: userData.name
    })
    console.log(userName + " added to users list.")
    console.log(users);
  });

  socket.on('message', function (msg) {
    console.log('Server received a message of type: ' + msg.type +
      ' from: ' + msg.from + ' to: ' + msg.to);
    console.log('Message: ' + console.dir(msg));

    io.sockets.socket(msg.to).emit('message', msg);
  });

  socket.on('status', function(status) {
    socket.broadcast.emit('message', {
      type: status.userStatus,
      socketId: socket.id
    });
  })

  socket.on('disconnect', function () {
    for(var i=0, len = users.length; i < len; i++) {
      if(users[i].name === userName) {
        users.splice(i, 1);
        break;
      }
    }
    socket.broadcast.emit('message', {
      type: 'userDisconnect',
      socketId: socket.id
    });
    console.log(userName + " removed from users list.")
    console.log(users);
  });
})
