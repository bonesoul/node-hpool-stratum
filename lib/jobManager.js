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

var bignum = require('bignum');
var events = require('events');
var crypto = require('crypto');
var blockTemplate = require('./blockTemplate.js');
var errors = require('./errors.js');
var utils = require('./utils.js');

var JobManager = module.exports = function JobManager(poolInfo) {
    
    // private members.
    var _this = this;
    _this.jobCounter = new jobCounter();    
    var shareMultiplier = algorithms[poolInfo.config.coin.algorithm].multiplier;

    // public members.
    this.extraNonceCounter = new extraNonceCounter();
    this.extraNoncePlaceholder = new Buffer('f000000ff111111f', 'hex');
    this.extraNonce2Size = this.extraNoncePlaceholder.length - this.extraNonceCounter.size;
    
    this.current = null;
    this.jobs = {};    

    var _this = this;
    
    queryNetwork(); // initially query for the block once.
    setupBlockPoller();
    
    function queryNetwork() {
        this.daemon.cmd('getblocktemplate',
        [{ capabilities: ["coinbasetxn", "workid", "coinbase/append"] }], function (response) {
            
            if (_this.current !== null && response.result.height === _this.current.data.height)
                return;
            
            var job = new blockTemplate(
                _this.jobCounter.next(), 
                response.result,
                poolInfo
            );
            
            _this.current = job;
            _this.jobs[job.id] = job;
            _this.emit('newJob', job);
        });
    }
    
    function setupBlockPoller() {
        setInterval(function () {
            queryNetwork();
        }, poolInfo.config.poller.interval);
    }
    
    var hashDigest = algorithms[poolInfo.config.coin.algorithm].hash(poolInfo.config.coin);

    var coinbaseHasher = (function() {
        switch (poolInfo.config.coin.algorithm) {
            case 'keccak':
            case 'blake':
            case 'fugue':
            case 'groestl':
                    return utils.sha256;
            default:
                return utils.sha256d;
        }
    })();
    
    var blockHasher = (function () {
        switch (poolInfo.coin.algorithm) {
            case 'scrypt':
                if (poolInfo.coin.isProofOfStakeHybrid) {
                    return function (d) {
                        return utils.reverseBuffer(hashDigest.apply(this, arguments));
                    };
                }
            case 'scrypt-jane':
                if (poolInfo.coin.isProofOfStakeHybrid) {
                    return function (d) {
                        return utils.reverseBuffer(hashDigest.apply(this, arguments));
                    };
                }
            case 'scrypt-n':
            case 'sha1':
                return function (d) {
                    return utils.reverseBuffer(utils.sha256d(d));
                };
            default:
                return function () {
                    return utils.reverseBuffer(hashDigest.apply(this, arguments));
                };
        }
    })();

    this.processShare = function (client, params) {

        var submitTime = Date.now() / 1000 | 0;
        
        // make sure submitted extraNonce2 by client meets our requirements.
        if (params.extraNonce2.length  / 2 !== _this.extraNonce2Size) {
            return shareError(errors.stratum.INCORRECT_SIZE_OF_EXTRANONCE2);
        }          
        
        // find the associated job.
        var job = _this.jobs[params.jobId];
        
        if (typeof job === 'undefined' || job.id !== params.jobId) {
            return shareError(errors.stratum.JOB_NOT_FOUND);
        }
        
        if (params.nTime.length !== 8) {
            return shareError(errors.stratum.INCORRECT_SIZE_OF_NTIME);
        }

        var nTimeInt = parseInt(params.nTime, 16);
        if (nTimeInt < job.data.curtime || nTimeInt > submitTime + 7200) {
            return shareError(errors.stratum.NTIME_OUT_OF_RANGE);
        }
        
        if (params.nonce.length !== 8) {
            return shareError(errors.stratum.INCORRECT_SIZE_OF_NONCE);
        }
        
        if (!job.commitShare(client.extraNonce1, params.extraNonce2, params.nTime, params.nonce)) {
            return shareError(errors.stratum.DUPLICATE_SHARE);
        }
        
        var extraNonce1Buffer = new Buffer(client.extraNonce1, 'hex');
        var extraNonce2Buffer = new Buffer(params.extraNonce2, 'hex');
        
        var coinbaseBuffer = job.serializeCoinbase(extraNonce1Buffer, extraNonce2Buffer);
        var coinbaseHash = coinbaseHasher(coinbaseBuffer);
        
        var merkleRoot = utils.reverseBuffer(job.merkleTree.withFirst(coinbaseHash)).toString('hex');
        
        var headerBuffer = job.serializeHeader(merkleRoot, params.nTime, params.nonce);
        var headerHash = hashDigest(headerBuffer, nTimeInt);
        var headerBigNum = bignum.fromBuffer(headerHash, { endian: 'little', size: 32 });
        
        var shareDiff = diff1 / headerBigNum.toNumber() * shareMultiplier;
        var blockDiffAdjusted = job.difficulty * shareMultiplier;
        
        //Check if share is a block candidate (matched network difficulty)
        if (job.target.ge(headerBigNum)) {
            isValid = true;
            blockCandidate = true;
            blockHex = job.serializeBlock(headerBuffer, coinbaseBuffer).toString('hex');
            blockHash = blockHasher(headerBuffer, params.nTime).toString('hex');
        } else {
            //Check if share didn't reached the miner's difficulty)
            if (shareDiff / client.difficulty < 0.99) {
                isValid = false;
                blockCandidate = false;
                return shareError(error.stratum.LOW_DIFFICULTY_SHARE);
            }
        }
        
        _this.emit('share', {
            job: job.id,
            height: job.data.height,
            client: client,
            clientDiff: client.difficulty,
            shareDiff: shareDiff.toFixed(8),
            blockDiff : blockDiffAdjusted,
            blockDiffActual: job.difficulty,
            blockHash: blockHash,
            blockHex: blockHex,
            isValid: isValid,
            blockCandidate: blockCandidate
        });

        return {
            success: true, 
            error: null
        };

        function shareError(error) {
            _this.emit('share', {
                job: params.jobId,
                ip: client.remoteAddress,
                worker: client.workerName,
                difficulty: client.difficulty,
                error: error
            });
            
            return {
                success: false,
                error: error
            };
        }
    }
};
JobManager.prototype.__proto__ = events.EventEmitter.prototype;

//Unique job per new block template
var jobCounter = function () {
    
    var counter = 0;
    
    this.next = function () {
        counter++;
        if (counter % 0xffff === 0)
            counter = 1;
        return this.current();
    };
    
    this.current = function () {
        return counter.toString(16);
    };
}

var extraNonceCounter = function () {
    
    var instanceId = crypto.randomBytes(4).readUInt32LE(0);
    var counter = instanceId << 27;
    
    this.next = function () {
        var extraNonce = utils.packUInt32BE(Math.abs(counter++));
        return extraNonce.toString('hex');
    }
    
    this.size = 4;
}