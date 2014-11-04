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
var utils = require('./utils.js');


var pool = exports.Pool = function (config) {
    
    // private members
    var _this = this;
    _this.config = config;   
    _this.daemon = null; // the daemon interface we'll be using to communicate with coin daemons.   
    _this.poolAddress = null;
    _this.networkInfo = {};
    
    var emitErrorLog = function (text) { _this.emit('log', 'error', text); };
    var emitWarningLog = function (text) { _this.emit('log', 'warn', text); };

    // starts the pool.
    this.start = function() {
        
        setupDaemon(function () {
            detectCoinType(function() {
                detectSubmitBlockSupport(function() {
                    validatePoolAddress(function() {
                        readNetworkInformation(function() {
                            waitBlockChainSync(function() {

                            });
                        });
                    });
                });
            });
        });            

        var server = new stratum.Server(); // create the stratum server.
    }

    /* Starts up the daemon connection */
    function setupDaemon(callback) {
        if (typeof (config.daemon) == 'undefined')
        {
            // make sure we have been supplied a daemon configuration.
            emitErrorLog('No coin daemons have been configured. Pool initialization failed.');
            return;
        }
        
        _this.daemon = new daemon.Client(config.daemon, function (severity, message) {
            _this.emit('log', severity , message);
        });

        _this.daemon.once('online', function () {
            callback();
        });
    }    
    
    
    // Detect the coin type to see if it's a pure pw coin or a pow + pos hybrid.
    function detectCoinType(callback) {
        
        // Use getdifficulty() to determine if we are connected to POS + POW hybrid coin. 
        _this.daemon.cmd('getdifficulty', [], function(response) {
            
            if (response.error) {
                emitErrorLog('Pool initilization failed as rpc call getddifficulty failed: ' + response.error.message);
                return;
            }

            var result = response.result;
            
            /*
             * By default proof-of-work coins return a floating point as difficulty.
             * On the otherhand proof-of-stake coins returns a json-object; { "proof-of-work" : 41867.16992903, "proof-of-stake" : 0.00390625, "search-interval" : 0 }
             * So basically we can use this info to determine if assigned coin is a proof-of-stake one.
             */

            if (isNaN(result) && 'proof-of-stake' in result.getdifficulty) // is difficulty is not a number and contains 'proof-of-stake'
                _this.config.coin.options.isProofOfStakeHybrid = true; // set it as a pos + pow hybrid.
            else
                _this.config.coin.options.isProofOfStakeHybrid = false; // else a pure pow coin.

            callback();
        });
    }
    
    // detects if the coin supports submitblock() call.
    function detectSubmitBlockSupport(callback) {
        // issue a submitblock() call too see if it's supported.
        _this.daemon.cmd('submitblock', ['invalid-hash'], function (response) {

            // If the coin supports the submitblock() call it's should return a RPC_DESERIALIZATION_ERROR (-22) - 'Block decode failed' 
            // Otherwise if it doesn't support the call, it should return a RPC_METHOD_NOT_FOUND(-32601) - 'Method not found' error.
            if (response.error.code === rpc.ErrorCodes.RPC_DESERIALIZATION_ERROR) // the coin supports submitblock().
                _this.config.coin.capatabilities.submitBlockSupported = true;
            else if (response.error.code === rpc.ErrorCodes.RPC_METHOD_NOT_FOUND) // the coin doesn't have submitblock() method.
                _this.config.coin.capatabilities.submitBlockSupported = false;

            callback();
        });
    }
    
    // validate the pool address.
    function validatePoolAddress(callback) {        
        _this.daemon.cmd('validateaddress', [_this.config.wallet.address], function (response) {
            if (response.error) {
                emitErrorLog('Pool initilization failed as rpc call validateaddress() call failed: ' + response.error.message);
                return;
            }

            _this.poolAddress = response.result;

            if (!_this.poolAddress.isvalid) {
                emitErrorLog('Pool initilization failed as configured pool address \'' + config.wallet.address + '\' is not owned by the connected wallet');
                return;
            }

            // For coins we must use the pubkey in coinbase transaction which is only supplied when the address is owned by the connected wallet.
            if (_this.config.coin.options.isProofOfStakeHybrid || typeof (_this.poolAddress.pubkey) == 'undefined') {
                emitErrorLog('The configured pool address \'' + config.wallet.address + '\' is not owned by the connected wallet which is required by POS coins');
            }

            _this.poolAddress.script = _this.config.coin.options.isProofOfStakeHybrid ? 
                utils.pubkeyToScript(_this.poolAddress.pubkey) :
                utils.addressToScript(_this.poolAddress.address);

            callback();
        });
    }

    function readNetworkInformation(callback) {
        
        var calls = [
            ['getinfo', []],
            ['getmininginfo', []]
        ];

        _this.daemon.batch(calls, function (error, responses) {

            var results = [];
            responses.forEach(function (response, index) {
                
                var call = calls[index][0];
                results[call] = response.result;

                if (response.error) {                    
                    emitErrorLog('Pool initilization failed as rpc call '+ call +' failed: ' + response.error.message);
                    return;
                }                
            });

            _this.networkInfo.coinVersion = results.getinfo.version;
            _this.networkInfo.protocolVersion = results.getinfo.protocolversion;
            _this.networkInfo.walletVersion = results.getinfo.walletversion;
            _this.networkInfo.testnet = results.getinfo.testnet;
            _this.networkInfo.connections = results.getinfo.connections;
            _this.networkInfo.errors = results.getinfo.errors;
            _this.networkInfo.difficulty = results.getmininginfo.difficulty;
            _this.networkInfo.hashRate = results.getmininginfo.networkhashps;

            callback();
        });        
    }

    function waitBlockChainSync(syncComplete) {
        
        var check = function () {
            
            var calls = [
                ['getblocktemplate', []],
                ['getinfo', []],
                ['getpeerinfo', []],
            ];

            _this.daemon.batch(calls, function (error, responses) {

                var results = [];
                responses.forEach(function (response, index) {
                    
                    var call = calls[index][0];
                    results[call] = response;
                    
                    if (response.error) {
                        emitErrorLog('Pool initilization failed as rpc call ' + call + ' failed: ' + response.error.message);
                        return;
                    }
                });

                var synced = !results.getblocktemplate.error || results.getblocktemplate.error.code !== rpc.ErrorCodes.RPC_CLIENT_IN_INITIAL_DOWNLOAD;

                if (synced)
                    syncComplete();
                else {
                    setTimeout(check, 5000);

                    var blockCount = results.getinfo.result.blocks;
                    var peers = results.getpeerinfo.result;
                    var sorted = peers.sort(function(a, b) {
                        return b.startingheight - a.startingheight;
                    });

                    var longestChain = sorted[0].startingheight;
                    var percent = (blockCount / blockCount * 100).toFixed(2);

                    emitWarningLog('Waiting for block chain syncronization, downloaded ' + percent + '% from ' + peers.length + ' peers');
                }
            });
        }

        check();
    }
};
pool.prototype.__proto__ = events.EventEmitter.prototype;