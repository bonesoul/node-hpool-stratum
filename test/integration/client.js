// 
//     hpool-stratum - stratum protocol module for hpool-server
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
//

var events = require('events');
var net = require('net');

var stratumTestClient = module.exports = function () {
    
    var _this = this;
    _this.requestCounter = 0; // create a request counter in order to track request Id's.

    var buffer = ''; // our data buffer.
    
    this.connect = function(host, port) {
        _this.socket = net.connect({
                host: host,
                port: port
            }, function() {
                _this.socket.setEncoding('utf8'); // set the encoding.
                _this.emit('socket.connected');
            })
            .on('data', function (data) {

                buffer += data;               

                if (buffer.indexOf('\n') !== -1) {

                    var messages = buffer.split('\n'); // get the messages.
                    var incomplete = buffer.slice(-1) === '\n' ? '' : messages.pop(); // make sure to keep existing incomplete message if any.

                    messages.forEach(function(message) {

                        if (message === '')
                            return; // skip empty lines

                        var json;
                        try {
                            json = JSON.parse(message);
                        } catch (e) {
                            _this.emit('protocol.error', message);
                            socket.destroy();
                            return;
                        }

                        parseMessage(json);
                    });

                    buffer = incomplete; // keep the incomplete data in buffer.
                }
            })
            .on('error', function(err) {
                _this.emit('socket.error', err);
            });
    }
    
    function parseMessage(json) {
        _this.emit('incoming.message', json); // TODO: remove this
                        
        if (typeof json.result !== 'undefined') {
            _this.emit('message.reply', json);
        }
        else if (typeof json.method !== 'undefined') {
            _this.emit(json.method, json);
        }
    };

    this.sendJson = function () {
        var data = '';
        for (var i = 0; i < arguments.length; i++) {
            data += JSON.stringify(arguments[i]) + '\n';
        }
        _this.send(data);
    }

    this.send = function(data) {
        _this.socket.write(data);
    }

    this.subscribe = function(signature, callback) {

        _this.sendJson({
            id: _this.requestCounter++,
            method: "mining.subscribe",
            params: [signature]
        });

        _this.once('message.reply', function(message) {
            callback(message);
        });
    }

    this.authorize = function(username, password, callback) {
        
        _this.sendJson({
            id    : _this.requestCounter++,
            method: "mining.authorize",
            params: [username, password]
        });

        _this.once('message.reply', function (message) {
            callback(message);
        });
    }

    _this.submitWork = function(worker, jobId, extraNonce2, nTime, nonce, callback) {

        var request = {
            id: _this.requestCounter++,
            method: "mining.submit",
            params: [worker, jobId, extraNonce2, nTime, nonce]
        };

        _this.sendJson(request);

        _this.once('message.reply', function (message) {
            if (message.id = request.id)
                callback(message);
        });
    };
};
stratumTestClient.prototype.__proto__ = events.EventEmitter.prototype;