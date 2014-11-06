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
var winston = require('winston');

/**
 * Handles stratum connections to server.
 * Emits:
 *  - subscribe(obj, cback(error, extraNonce1, extraNonce2Size))
**/
var Client = exports.Client = function (options) {    
    this.info = {
        subscriptionId: options.subscriptionId, // subscription id for the client.
        lastActivity: Date.now(), // last activity by the client.
        difficulty: 16,        
        shares : { // number of shares submissions by the client - used by ban manager to evaluate a ban.
            valid: 0, // valid shares counter
            invalid: 0 // invalid shares counter.
        }
    }
    
    var _this = this;

    // members    
    _this.socket = options.socket; // the socket used by the client    

    setupSocket();
    
    /**
     * Setups sockets for client - including data handling and socket events.
    **/
    function setupSocket() {        
        var socket = options.socket; // get the socket.
        socket.setEncoding('utf8'); // set the encoding.
        
        var buffer = ''; // our data buffer.
        
        socket.on('data', function(data) { /* data recieve event */
                buffer += data;

                // check for a new message
                if (buffer.indexOf('\n') !== -1) {
                    var messages = buffer.split('\n'); // get the messages.
                    var incomplete = buffer.slice(-1) === '\n' ? '' : messages.pop(); // make sure to keep existing incomplete message if any.

                    messages.forEach(function(message) {
                        if (message === '')
                            return; // skip empty lines

                        // try to parse the message as json.
                        var json;
                        try {
                            json = JSON.parse(message);
                        } catch (e) {
                            /* destroy connections that submit messages we can't handle */
                            _this.emit('malformedMessage', message);
                            socket.destroy();
                            return;
                        }

                        // if we do have a valid json message
                        if (json) {
                            handleMessage(json);
                        }
                    });

                    buffer = incomplete; // keep the incomplete data in buffer.
                }
            })
            .on('close', function() { /* socket close event */
                _this.emit('disconnect');
            })
            .on('error', function(err) { /* socket error event */
                if (err.code !== 'ECONNRESET')
                    _this.emit('socketError', err);
            });
    }    

    // Handles json-rpc messages from the client
    function handleMessage(message) {
        
        winston.log('info', 'recv:', message);
        
        // check the method.
        switch (message.method) {
            case 'mining.subscribe':// subscription request
                handleSubscribe(message);
                break;
            case 'mining.authorize':// authorization request
                handleAuthorize(message);
                break;
            case 'mining.submit':// share submission
                _this.info.lastActivity = Date.now(); // update the activity for the client.
                handleSubmit(message);
                break;
            case 'mining.get_transactions':
                handleGetTransactions(message);
                break;
            default:
                _this.emit('unknownStratumMethod', message);
                errorReply(message.id, "unknown stratum method");
                break;
        }
    }
    
    /**
     * Handles client subscription request.
     * It emits the event and replies the client with response.
    **/
    function handleSubscribe(message) {
        _this.emit('subscribe', {},
            function (error, extraNonce1, extraNonce2Size) {
            
            _this.subscribed = !error; // set the subscribed flag for the client.

            if (error) {
                // if we do have en error set
                errorReply(message.id, error);
            } else {
                // send the subscription response
                reply(message.id, [
                    [
                        ["mining.set_difficulty", _this.info.subscriptionId],
                        ["mining.notify", _this.info.subscriptionId],
                    ],
                    extraNonce1, // Hex-encoded, per-connection unique string which will be used for coinbase serialization later.
                    extraNonce2Size // The number of bytes that the miner users for its ExtraNonce2 counter.
                ]
                );
            }
        });
    }
    
    /**
     * Handles client authorization request.
     * It emits the event and replies the client with response.
    **/
    function handleAuthorize(message) {
        // set the worker name and password.
        _this.workerName = message.params[0];
        _this.workerPassword = message.params[1];       
        
        // notify the listeners about authorize request.
        _this.emit('authorize', {}, function (success, error) {

            _this.authorized = !error && success; // set the authorized flag for the client.
            if (error) {
                // if we do have en error set
                errorReply(message.id, error);
            } else {
                // send the authorization result
                reply(message.id, _this.authorized);
                sendMessage("Welcome to hpool, enjoy your stay!");
            }

            sendDifficulty();
        });
    }
    
    /**
     * Handles share submission.
    **/
    function handleSubmit(message) {
        errorReply(message.id, "not implemented");
    }
    
    /**
     * Handles get_transaction message.
    **/
    function handleGetTransactions(message) {
        errorReply(message.id, "not implemented");
    }
    
    /**
     * Sends list of arguments as a json-string.
    **/
    function sendJson() {
        var response = '';
        for (var i = 0; i < arguments.length; i++) {
            response += JSON.stringify(arguments[i]) + '\n';
        }
        options.socket.write(response);
        winston.log('info', 'send:', response);
    }
    
    /**
     * Replies back the json-rpc request with given data.
    **/    
    function reply(id, data) {
        sendJson({
            id: id,
            result: data,
            error: null
        });
    }
    
    /**
     * Replies back the json-rpc request with an error message.
    **/    
    function errorReply(id, error) {
        sendJson({
            id: id,
            result: null,
            error: error
        });
    }   
    
    /**
     * Send a message to miners.
    **/    
    function sendMessage(message) {
        sendJson({
            id: null,
            method: "client.show_message",
            params: [
                message
            ]
        });
    }

    function sendDifficulty() {
        sendJson({
            id    : null,
            method: "mining.set_difficulty",
            params: [_this.info.difficulty]
        });
    }

    this.sendJob = function (job) {
        sendJson({
            id    : null,
            method: "mining.notify",
            params: job.params
        });
    }

    return this;
}
Client.prototype.__proto__ = events.EventEmitter.prototype;
