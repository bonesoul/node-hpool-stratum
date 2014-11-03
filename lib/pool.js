﻿// 
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
var stratum = require('./server.js');
var daemon = require('./daemon.js');
var rpc = require('./errors.js');


var pool = exports.Pool = function (options) {
    
    var _this = this;
        
    _this.daemon = null; // the daemon interface we'll be using to communicate with coin daemons.
    
    // error emitter to share logs with parents.       
    var errorLogEmitter = function(text) {
         _this.emit('log', 'error'  , text);
    };
    
    // starts the pool.
    this.start = function() {
        setupDaemon();
        detectProofOfStakeCoin(); // detect if we are connected to a proof-of-stake coin.    
        detectSubmitBlockSupport(); // detect if the coin daemon supports submitblock call.        

        var server = new stratum.Server(); // create the stratum server.
    }

    /* Starts up the daemon connection */
    function setupDaemon(callback) {
        if (typeof (options.daemon) == 'undefined') { // make sure we have been supplied a daemon configuration.
            errorLogEmitter('No coin daemons have been configured. Pool initialization failed.');
            return;
        }
        
        _this.daemon = new daemon.Client(options.daemon, function (severity, message) {
            _this.emit('log', severity , message);
        });
    }

    /* Detects if coin daemon we are connected is a proof-of-stake + proof-of-work hybrid coin */
    function detectProofOfStakeCoin() {
        // use getdifficulty() to determine if it's POS coin.       
        
        //client.getDifficulty(function (err, response) {
        //    try {
        //        /* By default proof-of-work coins return a floating point as difficulty (https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_lis).
        //         *  Though proof-of-stake coins returns a json-object;
        //         *  { "proof-of-work" : 41867.16992903, "proof-of-stake" : 0.00390625, "search-interval" : 0 }
        //         *  So basically we can use this info to determine if assigned coin is a proof-of-stake one.
        //         */
        //        var pos = response.indexOf('proof-of-stake');
        //        isProofOfStakeHybrid = true;
        //    } catch (e) {
        //        isProofOfStakeHybrid = false;
        //    }
        //});
    }
    
    function detectSubmitBlockSupport() {
        // issue a submitblock() call too see if it's supported.
        // If the coin supports the submitblock() call it's should return a RPC_DESERIALIZATION_ERROR (-22) - 'Block decode failed' 
        // as we just supplied an empty string as block hash. otherwise if it doesn't support the call, it should return a 
        // RPC_METHOD_NOT_FOUND(-32601) - 'Method not found' error.

        //try {
        //    client.submitBlock('', function (err, response) {
        //        if (err.code == rpc.ErrorCodes.RPC_DESERIALIZATION_ERROR) { // the coin supports submitblock().
        //            submitBlockSupported = true;
        //        }
        //        else { // the coin doesn't support submitblock().
        //            submitBlockSupported = false;
        //        }
        //    });
        //} catch (e) {
            
        //}
    }       
};
pool.prototype.__proto__ = events.EventEmitter.prototype;