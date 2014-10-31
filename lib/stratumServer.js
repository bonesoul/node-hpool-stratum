// 
//     hpool-stratum - sratum protocol module for hpool-server
//     Copyright (C) 2013 - 2014, hpool project 
//     http://www.hpool.org - https://github.com/int6/hpool-stratum
// 
//     This software is dual-licensed: you can redistribute it and/or modify
//     it under the terms of the GNU General Public License as published by
//     the Free Software Foundation, either version 3 of the License, or
//     (at your option) any later version.
// 
//     This program is distributed in the hope that it will be useful,
//     but WITHOUT ANY WARRANTY; without even the implied warranty of
//     MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//     GNU General Public License for more details.
//    
//     For the terms of this license, see licenses/gpl_v3.txt.
// 
//     Alternatively, you can license this software under a commercial
//     license or white-label it as set out in licenses/commercial.txt.

var net = require('net');
var winston = require('winston');
var StratumClient = require('./stratumClient.js');
var utils = require('./utils.js');

var StratumServer = module.exports = function (options) {

    var subscriptionCounter = SubscriptionCounter();

    var server = net.createServer({ allowHalfOpen: false }, function (socket) {
        handleConnection(socket);
    });
    
    server.listen(3337, function () {
        winston.log('info', 'stratum server listening on %s:%d', server.address().address, server.address().port);
    });

    function handleConnection(socket) {
        // handle connections

        winston.log('info', 'client connected %s:%d', socket.remoteAddress, socket.remotePort);
        socket.setKeepAlive(true); // set keep-alive on as we want a continous connection.
        
        // create a stratum client object that will handle stratum protocol over json-rpc connection.
        var client = new StratumClient({
            socket: socket,
            subscriptionId: subscriptionCounter.next()
        }).init();
    };
};

var SubscriptionCounter = function () {
    var count = 0;
    var padding = 'deadbeefcafebabe';
    return {
        next: function () {
            count++;
            if (Number.MAX_VALUE === count) count = 0;
            return padding + utils.packInt64LE(count).toString('hex');
        }
    };
};