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
var errors = require('./errors.js');
var utils = require('./utils.js');
var context = require('./context.js');
var Server = require('./server.js');
var Daemon = require('./daemon.js');
var JobManager = require('./jobManager.js');
var ShareManager = require('./shareManager.js');
var BlockManager = require('./blockManager.js');
var PeerManager = require('./peerManager.js');
require('./algorithms.js');


var Pool = module.exports = function (config) {

    context.config = config; // set the supplied config.    
    
    // private members
    var _this = this;    

    var emitErrorLog = function (text) { _this.emit('log', 'error', text); }; // error log emitter
    var emitWarningLog = function (text) { _this.emit('log', 'warn', text); }; // warning log emitter.
    var emitInfoLog = function (text) { _this.emit('log', 'info', text); }; // info log emitter.

    // starts the pool.
    this.start = function() {
        
        // run the initialization logic.

        setupDaemon(function () { // setup the daemon connection.
            detectCoinType(function() { // determine the coin type; pure pow or pow + pos.
                detectSubmitBlockSupport(function() { // detect if submitblock() is supported.
                    validatePoolAddress(function() { // validate the supplied pool address.
                        readNetworkInformation(function () { // read the coin network information.
                            setupRecipients(); // setup the fee recipients.
                            setupManagers(); // setup the managers.
                            waitBlockChainSync(function() { // wait for the block chain sync.
                                startServer(function () { // start the stratum server.

                                });
                            });
                        });
                    });
                });
            });
        });            
    }

    /* Starts up the daemon connection */
    function setupDaemon(callback) {
        if (typeof (context.config.daemon) == 'undefined')
        {
            // make sure we have been supplied a daemon configuration.
            emitErrorLog('No coin daemons have been configured. Pool initialization failed.');
            return;
        }
        
        // supply the daemon configuration and logger function.
        context.daemon = new Daemon(config.daemon, function (severity, message) {
            _this.emit('log', severity , message);
        });
        this.daemon = _this.daemon;
        
        // wait until daemon interface reports that we are online (got connected to daemon succesfully).
        context.daemon.once('online', function () {
            callback();
        });
    }    
    
    
    // Detect the coin type to see if it's a pure pw coin or a pow + pos hybrid.
    function detectCoinType(callback) {
        
        // Use getdifficulty() to determine if we are connected to POS + POW hybrid coin. 
        context.daemon.cmd('getdifficulty', [], function(response) {
            
            var result = response.result;

            if (response.error) {
                emitErrorLog('Pool initilization failed as rpc call getddifficulty failed: ' + response.error.message);
                return;
            }
            
            /*
             * By default proof-of-work coins return a floating point as difficulty.
             * On the otherhand proof-of-stake coins returns a json-object; { "proof-of-work" : 41867.16992903, "proof-of-stake" : 0.00390625, "search-interval" : 0 }
             * So basically we can use this info to determine if assigned coin is a proof-of-stake one.
             */

            if (isNaN(result) && 'proof-of-stake' in result.getdifficulty) // is difficulty is not a number and contains 'proof-of-stake'
                context.coin.isProofOfStakeHybrid = true; // set it as a pos + pow hybrid. 
            else
                context.coin.isProofOfStakeHybrid = false; // else a pure pow coin.

            callback();
        });
    }
    
    // detects if the coin supports submitblock() call.
    function detectSubmitBlockSupport(callback) {
        // issue a submitblock() call too see if it's supported.
        context.daemon.cmd('submitblock', ['invalid-hash'], function (response) {

            // If the coin supports the submitblock() call it's should return a DESERIALIZATION_ERROR (-22) - 'Block decode failed' 
            // Otherwise if it doesn't support the call, it should return a METHOD_NOT_FOUND(-32601) - 'Method not found' error.
            if (response.error.code === errors.Rpc.DESERIALIZATION_ERROR) // the coin supports submitblock().
                context.coin.capatabilities.submitBlockSupported = true;
            else if (response.error.code === errors.Rpc.METHOD_NOT_FOUND) // the coin doesn't have submitblock() method.
                context.coin.capatabilities.submitBlockSupported = false;

            callback();
        });
    }
    
    // validates the configured pool address for recieving mined blocks.
    function validatePoolAddress(callback) {
        context.daemon.cmd('validateaddress', [context.config.wallet.address], function (response) {
            
            context.wallet.central = response.result; // set the result of validateaddress(pool) 

            if (response.error) {
                emitErrorLog('Pool initilization failed as rpc call validateaddress() call failed: ' + response.error.message);
                return;
            }

            if (!context.wallet.central.isvalid) { // make sure configured address is valid.
                emitErrorLog('Pool initilization failed as configured pool address \'' + context.config.wallet.address + '\' is not owned by the connected wallet');
                return;
            }

            // for POS hybrid coins we must use the pubkey in coinbase transaction which is only supplied when the address is owned by the connected wallet.
            if (context.coin.isProofOfStakeHybrid || typeof (context.wallet.central.pubkey) == 'undefined') {
                emitErrorLog('The configured pool address \'' + config.wallet.address + '\' is not owned by the connected wallet which is required by POS coins');
            }
            
            // get the script for the pool address.
            context.wallet.central.script = context.coin.isProofOfStakeHybrid ? 
                utils.pubkeyToScript(context.wallet.central.pubkey) : // pos hybrid coins need to use pubkey script within coinbase transaction.
                utils.addressToScript(context.wallet.central.address); // pure pow coins just use the address within the coinbase transaction.

            callback();
        });
    }
    
    // reads coin network information.
    function readNetworkInformation(callback) {
        
        var calls = [
            ['getinfo', []],
            ['getmininginfo', []]
        ];
        
        // make a batch call of getinfo() and getmininginfo()
        context.daemon.batch(calls, function (error, responses) {

            var results = [];
            responses.forEach(function (response, index) {
                
                var call = calls[index][0];
                results[call] = response.result;

                if (response.error) { // catch any rpc errors.
                    emitErrorLog('Pool initilization failed as rpc call '+ call +' failed: ' + response.error.message);
                    return;
                }                
            });
            
            // set the data.
            context.coin.coinVersion = results.getinfo.version;
            context.coin.protocolVersion = results.getinfo.protocolversion;
            context.coin.walletVersion = results.getinfo.walletversion;
            context.network.testnet = results.getinfo.testnet;
            context.network.connections = results.getinfo.connections;
            context.network.errors = results.getinfo.errors;
            context.network.difficulty = results.getmininginfo.difficulty;
            context.network.hashRate = results.getmininginfo.networkhashps;

            callback();
        });        
    }
    
    // waits for the block chain synchronization.
    function waitBlockChainSync(syncComplete) {
        
        // getblocktemplate() will fail if coin daemon still sync blocks from the network.
        // we'll be using it with getinfo() and getpeerinfo() together to see if we are synced with the network.
        var check = function () {
            
            var calls = [
                ['getblocktemplate', []],
                ['getinfo', []],
                ['getpeerinfo', []],
            ];

            context.daemon.batch(calls, function (error, responses) {

                var results = [];
                responses.forEach(function (response, index) {
                    
                    var call = calls[index][0];
                    results[call] = response;
                    
                    if (response.error) {
                        emitErrorLog('Pool initilization failed as rpc call ' + call + ' failed: ' + response.error.message);
                        return;
                    }
                });

                var synced = !results.getblocktemplate.error || results.getblocktemplate.error.code !== errors.Rpc.CLIENT_IN_INITIAL_DOWNLOAD;

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
                    var percent = (blockCount / longestChain * 100).toFixed(2);

                    emitWarningLog('Waiting for block chain syncronization, downloaded ' + percent + '% from ' + peers.length + ' peers');
                }
            });
        }

        check();
    }

    function setupRecipients() {

        for (var entry in context.config.rewards) {
            try {
                var percent = context.config.rewards[entry]; // percent of the entry.            
                var recipient = {
                    percent: percent / 100,
                    script: utils.addressToScript(entry)
                };
                context.fees.recipients.push(recipient);
                context.fees.percent += percent;
            } catch (e) {
                emitErrorLog('Error generating transaction output script for ' + entry);
            }

            if (context.fees.percent === 0) {
                emitWarningLog('Your pool is configured with 0% fees!');
            }
        }
    }

    function setupManagers() {
        context.shareManager = new ShareManager();
        context.blockManager = new BlockManager();
        context.jobManager = new JobManager();
        // var test = new PeerManager();
    }

    function startServer(callback) {
        context.server = new Server(_this) // create the stratum server.
            .on('client.connected', function(client) {
                client.on('client.submit', function (params, resultCallback) {

                    var result = context.shareManager.processShare(client, params);
                    resultCallback(result.error, result.success);
                });
        });
    }
};
Pool.prototype.__proto__ = events.EventEmitter.prototype;