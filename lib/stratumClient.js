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

var events = require('events');
var winston = require('winston');

var StratumClient = module.exports = function (options) {
    
    var _this = this;    
    
    this.socket = options.socket; // the socket used by the client
    this.subscriptionId = options.subscriptionId; // subscription id for the client.
    this.lastActivity = Date.now(); // last activity by the client.
    
    this.shares = {
        valid: 0, // valid shares counter
        invalid: 0 // invalid shares counter.
    }
    
    this.init = function init() {
        setupSocket();
    };
    
    function setupSocket() {
        
        var socket = options.socket;
        socket.setEncoding('utf8');
        
        var buffer = ''; // our data buffer.
        
        socket.on('data', function (data) {
            
            buffer += data;
            
            // check for a new message
            if (buffer.indexOf('\n') !== -1) {
                var messages = buffer.split('\n'); // get the messages.
                var incomplete = buffer.slice(-1) === '\n' ? '' : messages.pop(); // make sure to keep existing incomplete message if any.
                
                messages.forEach(function (message) {
                    if (message === '')
                        return; // skip empty lines
                    
                    // try to parse the message as json.
                    var json;
                    try {
                        json = JSON.parse(message);
                    } catch (e) {
                        return; // ignore messages that are not json.
                    }
                    
                    // if we do have a valid json message
                    if (json) {
                        handleMessage(json);
                    }
                });
                
                buffer = incomplete; // keep the incomplete data in buffer.
            }
        });
        
        socket.on('close', function () {
            _this.emit('socket-disconnect');
        });
        
        socket.on('error', function (err) {
            _this.emit('socket-error', err);
        });
    }
    
    function handleMessage(message) {
        
        winston.log('info', 'recv:', message);
        
        // check the json-rpc method.
        switch (message.method) {
            case 'mining.subscribe':// subscription request
                handleSubscribe(message);
                break;
            case 'mining.authorize':// authorization request
                break;
            case 'mining.submit':// share submission
                break;
            case 'mining.get_transactions':
                break;
            default:
                _this.emit('unknownStratumMethod', message);
                break;
        }
        
        function handleSubscribe(message) {
            
            // notify the listeners about new subsciption.
            _this.emit('subscribe', {},
                function (error, extraNonce1, extraNonce2Size) {
                // callback for the stratum-subscribe event.                
                
                if (error) {
                    // if we do have en error set
                    sendError(message.id, error);
                } else {
                    // send the subscription response
                    sendMessage(message.id,[
                        [
                            ["mining.set_difficulty", _this.subscriptionId],
                            ["mining.notify", _this.subscriptionId],
                        ],
                        extraNonce1,
                        extraNonce2Size
                    ]
                    );
                }
            });            
        }
        
        function handleAuthorization(message) {
            winston.log('info', 'authorize:', message);
            _this.emit('authorize', {}); // notify the listeners about authorization.
        }
    }
    
    function sendJson() {
        var response = '';
        for (var i = 0; i < arguments.length; i++) {
            response += JSON.stringify(arguments[i]) + '\n';
        }
        options.socket.write(response);
        winston.log('info', 'send:', response);
    }
    
    function sendError(id, error) {
        sendJson({
            id: id,
            result: null,
            error: error
        });
    }
    
    function sendMessage(id, data) {
        sendJson({
            id: id,
            result: data,
            error: null
        });
    }    
}
StratumClient.prototype.__proto__ = events.EventEmitter.prototype;
