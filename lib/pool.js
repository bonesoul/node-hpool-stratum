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
var stratum = require('./server.js');
var daemon = require('./daemon.js');
var rpc = require('./errors.js');
var utils = require('./utils.js');
var jobManager = require('./jobManager.js');


var Pool = exports.Pool = function (config) {
   
    this.daemon = null; // the daemon interface we'll be using to communicate with coin daemons.   

    this.info = {
        config: config,
        extraNonce: {
            placeholder: new Buffer('f000000ff111111f', 'hex')
        },
        coin: {
            isProofOfStakeHybrid: false,
            capatabilities: {
                submitBlockSupported: false
            }
        },
        wallet: {
            central: null // validation results for supplied pool address.
        },
        fees: {
            percent: 0, // total percent of pool fees.
            recipients: [],// recipients of fees.
        },
        network: {
            coinVersion: null,
            protocolVersion: null,
            walletVersion: null,
            testnet: false,
            connections: 0,
            errors: null,
            difficulty: null,
            hashRate: null,
        }
    };
    
    // private members
    var _this = this;
    
    _this.config = config; // the pool configuration.
    _this.jobManager = null; // the job manager.    

    var emitErrorLog = function (text) { _this.emit('log', 'error', text); }; // error log emitter
    var emitWarningLog = function (text) { _this.emit('log', 'warn', text); }; // warning log emitter.

    // starts the pool.
    this.start = function() {
        
        // run the initialization logic.

        setupDaemon(function () { // setup the daemon connection.
            detectCoinType(function() { // determine the coin type; pure pow or pow + pos.
                detectSubmitBlockSupport(function() { // detect if submitblock() is supported.
                    validatePoolAddress(function() { // validate the supplied pool address.
                        readNetworkInformation(function () { // read the coin network information.
                            setupRecipients(); // setup the fee recipients.
                            setupJobManager(); // setup the job manager.
                            waitBlockChainSync(function() { // wait for the block chain sync.

                                var server = new stratum.Server(); // create the stratum server.
                            });
                        });
                    });
                });
            });
        });            
    }

    /* Starts up the daemon connection */
    function setupDaemon(callback) {
        if (typeof (config.daemon) == 'undefined')
        {
            // make sure we have been supplied a daemon configuration.
            emitErrorLog('No coin daemons have been configured. Pool initialization failed.');
            return;
        }
        
        // supply the daemon configuration and logger function.
        this.daemon = new daemon.Client(config.daemon, function (severity, message) {
            _this.emit('log', severity , message);
        });
        
        // wait until daemon interface reports that we are online (got connected to daemon succesfully).
        this.daemon.once('online', function () {
            callback();
        });
    }    
    
    
    // Detect the coin type to see if it's a pure pw coin or a pow + pos hybrid.
    function detectCoinType(callback) {
        
        // Use getdifficulty() to determine if we are connected to POS + POW hybrid coin. 
        this.daemon.cmd('getdifficulty', [], function(response) {
            
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
                _this.info.coin.isProofOfStakeHybrid = true; // set it as a pos + pow hybrid.
            else
                _this.info.coin.isProofOfStakeHybrid = false; // else a pure pow coin.

            callback();
        });
    }
    
    // detects if the coin supports submitblock() call.
    function detectSubmitBlockSupport(callback) {
        // issue a submitblock() call too see if it's supported.
        this.daemon.cmd('submitblock', ['invalid-hash'], function (response) {

            // If the coin supports the submitblock() call it's should return a RPC_DESERIALIZATION_ERROR (-22) - 'Block decode failed' 
            // Otherwise if it doesn't support the call, it should return a RPC_METHOD_NOT_FOUND(-32601) - 'Method not found' error.
            if (response.error.code === rpc.ErrorCodes.RPC_DESERIALIZATION_ERROR) // the coin supports submitblock().
                _this.info.coin.capatabilities.submitBlockSupported = true;
            else if (response.error.code === rpc.ErrorCodes.RPC_METHOD_NOT_FOUND) // the coin doesn't have submitblock() method.
                _this.info.coin.capatabilities.submitBlockSupported = false;

            callback();
        });
    }
    
    // validates the configured pool address for recieving mined blocks.
    function validatePoolAddress(callback) {
        this.daemon.cmd('validateaddress', [_this.config.wallet.address], function (response) {
            
            _this.info.wallet.central = response.result; // set the result of validateaddress(pool) 

            if (response.error) {
                emitErrorLog('Pool initilization failed as rpc call validateaddress() call failed: ' + response.error.message);
                return;
            }

            if (!_this.info.wallet.central.isvalid) { // make sure configured address is valid.
                emitErrorLog('Pool initilization failed as configured pool address \'' + config.wallet.address + '\' is not owned by the connected wallet');
                return;
            }

            // for POS hybrid coins we must use the pubkey in coinbase transaction which is only supplied when the address is owned by the connected wallet.
            if (_this.info.coin.isProofOfStakeHybrid || typeof (_this.info.wallet.central.pubkey) == 'undefined') {
                emitErrorLog('The configured pool address \'' + config.wallet.address + '\' is not owned by the connected wallet which is required by POS coins');
            }
            
            // get the script for the pool address.
            _this.info.wallet.central.script = _this.info.coin.isProofOfStakeHybrid ? 
                utils.pubkeyToScript(_this.info.wallet.central.pubkey) : // pos hybrid coins need to use pubkey script within coinbase transaction.
                utils.addressToScript(_this.info.wallet.central.address); // pure pow coins just use the address within the coinbase transaction.

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
        this.daemon.batch(calls, function (error, responses) {

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
            _this.info.network.coinVersion = results.getinfo.version;
            _this.info.network.protocolVersion = results.getinfo.protocolversion;
            _this.info.network.walletVersion = results.getinfo.walletversion;
            _this.info.network.testnet = results.getinfo.testnet;
            _this.info.network.connections = results.getinfo.connections;
            _this.info.network.errors = results.getinfo.errors;
            _this.info.network.difficulty = results.getmininginfo.difficulty;
            _this.info.network.hashRate = results.getmininginfo.networkhashps;

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

            this.daemon.batch(calls, function (error, responses) {

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

    function setupRecipients() {

        for (var entry in config.rewards) {
            try {
                var percent = config.rewards[entry]; // percent of the entry.            
                var recipient = {
                    percent: percent / 100,
                    script: utils.addressToScript(entry)
                };
                _this.info.fees.recipients.push(recipient);
                _this.info.fees.percent += percent;
            } catch (e) {
                emitErrorLog('Error generating transaction output script for ' + entry);
            }

            if (_this.info.fees.percent === 0) {
                emitWarningLog('Your pool is configured with 0% fees!');
            }
        }
    }

    function setupJobManager() {
        _this.jobManager = new jobManager(_this.info);

    }
};
Pool.prototype.__proto__ = events.EventEmitter.prototype;