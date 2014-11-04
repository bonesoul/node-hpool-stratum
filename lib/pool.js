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
var stratum = require('./server.js');
var daemon = require('./daemon.js');
var rpc = require('./errors.js');


var pool = exports.Pool = function (options) {
    
    // private members
    var _this = this;        
    _this.daemon = null; // the daemon interface we'll be using to communicate with coin daemons.    
    
    // starts the pool.
    this.start = function() {
        
        setupDaemon(function () {
            detectCapabilities(function() {
                
            });
        });            

        var server = new stratum.Server(); // create the stratum server.
    }

    /* Starts up the daemon connection */
    function setupDaemon(callback) {
        if (typeof (options.daemon) == 'undefined')
        {
            // make sure we have been supplied a daemon configuration.
            _this.emit('log', 'error'  , 'No coin daemons have been configured. Pool initialization failed.');
            return;
        }
        
        _this.daemon = new daemon.Client(options.daemon, function (severity, message) {
            _this.emit('log', severity , message);
        });

        _this.daemon.once('online', function () {
            callback();
        });
    }    

    function detectCapabilities(callback) {
        var calls = [
            ['validateaddress', [options.wallet.address]],
            ['getdifficulty', []],
            ['getinfo', []],
            ['getmininginfo', []],
            ['submitblock', []]
        ];

        _this.daemon.batch(calls, function (error, responses) {

            var results = [];

            for (var i = 0; i < responses.length; i++) {
                var current = calls[i][0];
                var response = responses[i];
                results[current] = response.result;

                if (current != 'submitblock' && responses[i].error) {
                    _this.emit('log', 'error', 'Pool initilization failed as rpc call ' + current + ' failed: ' + response.error.message);
                    return;
                }
            }
            
            // validate the pool address.
            if (!results.validateaddress.isvalid) {
                _this.emit('log', 'error', 'Pool initilization failed as configured pool address \'' + options.wallet.address + '\' is not owned by the wallet');
                return;
            }
            
           /*  Use getdifficulty() to determine if we are connected to POS + POW hybrid coin. 
            *  By default proof-of-work coins return a floating point as difficulty (https://en.bitcoin.it/wiki/Original_Bitcoin_client/API_calls_lis).
            *  Though proof-of-stake coins returns a json-object;
            *  { "proof-of-work" : 41867.16992903, "proof-of-stake" : 0.00390625, "search-interval" : 0 }
            *  So basically we can use this info to determine if assigned coin is a proof-of-stake one.
            */

            if (isNaN(results.getdifficulty) && 'proof-of-stake' in results.getdifficulty)
                options.reward = 'POS';
            else
                options.rewards = 'POW';

            callback();

        });
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