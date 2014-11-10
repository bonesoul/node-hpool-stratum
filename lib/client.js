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
var errors = require('./errors.js');

/**
 * Handles stratum connections to server.
 * Emits:
 *  - subscribe(obj, cback(error, extraNonce1, extraNonce2Size))
**/
var client = module.exports = function (options) {
    
    this.id = options.subscriptionId; // subscription id for the client.
    this.lastActivity = Date.now(); // last activity by the client.
    this.difficulty = 16;
    this.authorized = false;
    this.subscribed = false;
    this.workerName = null;
    this.workerPassword = null;
    this.extraNonce1 = null; // extraNonce1 for the client.
    
    // number of shares submissions by the client - used by ban manager to evaluate a ban.
    this.shares = {
        valid: 0, // valid shares counter
        invalid: 0 // invalid shares counter.
    }
    
    var _this = this;
    _this.socket = options.socket; // the socket used by the client    
    
    setupSocket();
    
    /**
     * Setups sockets for client - including data handling and socket events.
    **/
    function setupSocket() {
        var socket = options.socket; // get the socket.
        socket.setEncoding('utf8'); // set the encoding.
        
        var buffer = ''; // our data buffer.
        
        socket.on('data', function (data) {
            // data recieve event
            
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
                        /* destroy connections that submit messages we can't handle */
                        _this.emit('protocol.error', message);
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
            .on('close', function () {
                /* socket close event */
                _this.emit('socket.disconnect');
            })
            .on('error', function (err) {
                /* socket error event */
                if (err.code !== 'ECONNRESET')
                    _this.emit('socket.error', err);
            });
    }
    
    // Handles json-rpc messages from the client
    function handleMessage(message) {
        
        // winston.log('info', 'recv:', message);
        
        // check the method.
        switch (message.method) {
            case 'mining.subscribe':// subscription request
                handleSubscribe(message);
                break;
            case 'mining.extranonce.subscribe':
                handleExtraNonceSubscribe(message);
                break;
            case 'mining.authorize':// authorization request
                handleAuthorize(message);
                break;
            case 'mining.submit':// share submission
                _this.lastActivity = Date.now(); // update the activity for the client.
                handleSubmit(message);
                break;
            case 'mining.get_transactions':
                handleGetTransactions(message);
                break;
            case 'mining.capabilities':
                handleCapabilities(message);
                break;
            case 'mining.suggest_target':
                handleSuggestTarget(message);
            default:
                _this.emit('stratum.error', message);
                errorReply(message.id, errors.stratum.METHOD_NOT_FOUND);
                break;
        }
    }
    
    /**
     * Handles client subscription request.
     * It emits the event and replies the client with response.
    **/
    function handleSubscribe(message) {

        var userAgent = message.params[0];
        var extraNonce1 = message.params[1];
             
        _this.emit('subscribe', {},
            function (error, extraNonce1, extraNonce2Size) {
            
            _this.subscribed = !error; // set the subscribed flag for the client.
            
            if (error) {
                // if we do have en error set
                errorReply(message.id, error);
            } else {
                
                _this.extraNonce1 = extraNonce1; // set the assigned extraNonce1
                
                // send the subscription response
                reply(message.id, [
                    [
                        ["mining.set_difficulty", _this.difficulty],
                        ["mining.notify", _this.id]
                    ],
                    extraNonce1, // Hex-encoded, per-connection unique string which will be used for coinbase serialization later.
                    extraNonce2Size // The number of bytes that the miner users for its ExtraNonce2 counter.
                ]
                );
            }
        });
    }    
    
    // https://en.bitcoin.it/wiki/Stratum_mining_protocol#mining.extranonce.subscribe
    function handleExtraNonceSubscribe(message) {        
        errorReply(message.id, errors.stratum.METHOD_NOT_FOUND);
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
    
    // https://en.bitcoin.it/wiki/Stratum_mining_protocol#mining.capabilities_.28DRAFT.29
    function handleCapabilities(message) {
        
        var capabilities = message.params[0];
        var options = message.params[1];
        
        errorReply(message.id, errors.stratum.METHOD_NOT_FOUND);
    }
    
    // https://en.bitcoin.it/wiki/Stratum_mining_protocol#mining.suggest_target
    function handleSuggestTarget() {

        var target = message.params[0];

        errorReply(message.id, errors.stratum.METHOD_NOT_FOUND);
    }
    
    /**
     * Handles share submission.
    **/
    function handleSubmit(message) {
        
        if (!_this.subscribed) {
            errorReply(message.id, errors.stratum.NOT_SUBSCRIBED);
            return;
        }
        else if (!_this.authorized) {
            errorReply(message.id, errors.stratum.UNAUTHORIZED_WORKER);
            return;
        }
        
        _this.emit('client.submit', {
            name        : message.params[0],
            jobId       : message.params[1],
            extraNonce2 : message.params[2],
            nTime       : message.params[3],
            nonce       : message.params[4]
        }, 
        function (error, result) {
            reply(message.id, result, error);
        });
    }
    
    /**
     * Handles get_transaction message.
    **/
    function handleGetTransactions(message) {
        
        /* 
         * sample
         * C: { "params": ["b57e"],"id": "txlistb57e", "method": "mining.get_transactions"}
         * S: {"error": null, "id": "txlistb57e", "result": ["0100000001e45eb5311f14f66eff9351134265e33dbd41daa8110acc5b031e80de38893a65000000006b483045022028837a004078689c927fdc794a1e1a15b90671e90cd77e3f98c1c8776b7a9054022100c5c803954112f0ce183041c38b2e31e38bf91c61c3a5cc2b981b23665e7c1d240121029b497b642311bb84f184c0534d3874182035e77c8b1a48c35d3e9e8a390c93c3ffffffff0200a78c13180000001976a914b4eac5b7bba166b7f8c8cd195d6cb3f4680eede788ac80267241000000001976a9147ff701619769fbd1a12f8d0f440c3cfa50adfefe88ac00000000", ...]}
         */

        // TODO: implement a configurable option to disable this.
        // TODO: bfgminer reports - Coinbase check: incomplete coinbase for payout check
        // eloipool implementation: https://gitorious.org/bitcoin/eloipool/commit/c80698b154d0dcdfb6e40265d0e8fc155b56e510

        //var transactions = [];
        //options.pool.jobManager.current.data.transactions.forEach(function (tx) {
        //    transactions.push(tx.data);
        //});        
        //reply(message.id, transactions);                

        errorReply(message.id, errors.stratum.METHOD_NOT_FOUND);
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
        
        //winston.log('info', 'send:', response);
    }
    
    /**
     * Replies back the json-rpc request with given data.
    **/    
    function reply(id, result, error) {
        sendJson({
            id: id,
            result: result,
            error: error || null
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
    
    function sendDifficulty() {
        sendJson({
            id    : null,
            method: "mining.set_difficulty",
            params: [_this.difficulty]
        });
    }
    
    this.sendJob = function (job) {
        sendJson({
            id    : null,
            method: "mining.notify",
            params: job.params
        });
    }
    
    // Send a message to miner.
    function sendMessage(message) {
        sendJson({
            id: null,
            method: "client.show_message",
            params: [
                message
            ]
        });
    }
    
    https://en.bitcoin.it/wiki/Stratum_mining_protocol#mining.set_extranonce
    function sendExtraNonce(extraNonce1, extranonce2Size) {
        sendJson({
            id: null,
            method: "mining.set_extranonce",
            params: [
                extraNonce1, extranonce2Size
            ]
        });
    }
    
    // https://en.bitcoin.it/wiki/Stratum_mining_protocol#client.get_version
    function requestVersion() {
        // TODO: read the reply back.
        sendJson({
            id    : null,
            method: "client.get_version",
            params: []
        });
    }
    
    // https://en.bitcoin.it/wiki/Stratum_mining_protocol#client.reconnect
    function requestReconnect(hostname, port, waitTime) {
        // TODO: read the reply back.
        sendJson({
            id    : null,
            method: "client.reconnect",
            params: [hostname, port, waitTime]
        });
    }
    
    return this;
}
client.prototype.__proto__ = events.EventEmitter.prototype;
