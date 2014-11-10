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
var events = require('events');
var winston = require('winston');
var utils = require('./utils.js');
var context = require('./context.js');
var Client = require('./client.js');

/**
 * Stratum server that listens and manages connections 
**/
var Server = module.exports = function () {
    
    this.clients = {};
    var _this = this;
    
    var subscriptionCounter = SubscriptionCounter(); // create a subscription counter for the server that's used for assinging id's to clients.
    
    // create the tcp server for stratum+tp:// connections 
    var server = net.createServer({ allowHalfOpen: false }, function (socket) {
        handleConnection(socket); // handle the new connection
    });
        
    // start listening for connections
    server.listen(3337, function () {
        winston.log('info', 'stratum server listening on %s:%d', server.address().address, server.address().port);
    });

    if (context.jobManager) {
        context.jobManager.on('job.created', function(job) {
            broadcastJob(job);
        });
    }

    // Handles incoming connections
    function handleConnection(socket) {
        
        winston.log('info', 'client connected %s:%d', socket.remoteAddress, socket.remotePort);
        socket.setKeepAlive(true); // set keep-alive on as we want a continous connection.
        
        // create a stratum client that will handle stratum protocol.
        var client = new Client({
            socket: socket, // assigned socket to client's connection.
            subscriptionId: subscriptionCounter.next() // get a new subscription id for the client.
        })
        .on('subscribe', function (params, callback) {
            // on subscription reques
            var extraNonce = context.jobManager.extraNonceCounter.next();                
            callback(null, extraNonce, context.extraNonce2.size);
        })
        .on('authorize', function (params, callback) {
            // on authorization request
            callback(true, null);
            this.sendJob(context.jobManager.current);
        })
        .on('socket.disconnect', function () {
            delete _this.clients[client.id];
            _this.emit('client.disconnected', client);
        });
        
        _this.clients[client.id] = client;
        _this.emit('client.connected', client);
    }
    
    function broadcastJob(job) {
        
        for (var id in _this.clients) {
            var client = _this.clients[id];
            client.sendJob(job);
        }        
    }
};
Server.prototype.__proto__ = events.EventEmitter.prototype;

// Subscriptions counter for the server.
var SubscriptionCounter = function () {
    var count = 0;
    var padding = 'deadc0de';
    return {
        next: function () {
            count++;
            if (Number.MAX_VALUE === count) // once we reach the maximum allowed value
                count = 0; // reset back.
            
            return padding + utils.packInt64LE(count).toString('hex');
        }
    };
};