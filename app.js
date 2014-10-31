var net = require('net');

var server = net.createServer(
    {
         allowHalfOpen: false
    },
    function(socket) {
        handleSocket(socket);
    });

server.listen(81, function () {
    console.log('server listening');
});

handleSocket = function (socket) {
    console.log('client connected');

    socket.on('end', function () {
        console.log('client disconnected');
    });
};