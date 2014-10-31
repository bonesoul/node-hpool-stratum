var net = require('net');

var server = net.createServer(
    {
        allowHalfOpen: false
    },
    function (socket) {
        handleSocket(socket);
    });

server.listen(81, function () {
    console.log('Server listening on ' + server.address().address + ':' + server.address().port);
});

handleSocket = function (socket) {
    console.log('client connected: ' + socket.remoteAddress + ":" + socket.remotePort);
    socket.setKeepAlive(true);
    
    var client = new StratumClient({
        socket: socket
    });
    
    client.init();
    
    socket.on('end', function () {
        console.log('client disconnected');
    });
};

var StratumClient = function (options) {
    
    this.socket = options.socket;
    this.remoteAddress = options.socket.remoteAddress;
    this.lastActivity = Date.now();
    
    this.init = function init() {
        setupSocket();
    };
    
    function setupSocket() {
        var socket = options.socket;
        socket.setEncoding('utf8');
    }
}