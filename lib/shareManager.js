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
var bignum = require('bignum');
var crypto = require('crypto');
var winston = require('winston');
var context = require('./context.js');
var errors = require('./errors.js');
var utils = require('./utils.js');

var ShareManager = module.exports = function () {

    var _this = this;

    var shareMultiplier = algorithms[context.config.coin.algorithm].multiplier;

    var coinbaseHasher = (function () {
        switch (context.config.coin.algorithm) {
            case 'keccak':
            case 'blake':
            case 'fugue':
            case 'groestl':
                return utils.sha256;
            default:
                return utils.sha256d;
        }
    })();
    
    var hashDigest = algorithms[context.config.coin.algorithm].hash(context.config.coin);
    
    // TODO: should be fixed for all algorithms
    var blockHasher = (function () {
        return function (d) {
            return utils.reverseBuffer(utils.sha256d(d));
        };
    })();   

    this.processShare = function (client, params) {
        
        var shareError = function (error) {

            _this.emit('share.invalid', {
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
        };

        var submitTime = Date.now() / 1000 | 0;
        
        // make sure submitted extraNonce2 by client meets our requirements.
        if (params.extraNonce2.length / 2 !== context.extraNonce2.size) {
            return shareError(errors.stratum.INCORRECT_SIZE_OF_EXTRANONCE2);
        }
        
        // find the associated job.
        var job = context.jobManager.jobs[params.jobId];
        
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
        
        var blockHash = blockHasher(headerBuffer, params.nTime).toString('hex');
        var blockHex = job.serializeBlock(headerBuffer, coinbaseBuffer).toString('hex');

        //Check if share is a block candidate (matched network difficulty)
        if (job.target.ge(headerBigNum)) {
            isValid = true;
            blockCandidate = true;                                    
        } else {
            //Check if share didn't reached the miner's difficulty)
            if (shareDiff / client.difficulty < 0.99) {
                isValid = false;
                blockCandidate = false;

                return shareError(error.stratum.LOW_DIFFICULTY_SHARE);
            } else {
                isValid = true;
                blockCandidate = false;
            }
        }
        
        var share = {
            job: job.id,
            height: job.data.height,
            client: client,
            clientDiff: client.difficulty,
            shareDiff: shareDiff.toFixed(8),
            blockDiff: blockDiffAdjusted,
            blockDiffActual: job.difficulty,
            blockHash: blockHash,
            blockHex: blockHex,
            isValid: isValid,
            blockCandidate: blockCandidate
        };
        
        _this.emit('share.valid', share);

        return {
            success: true, 
            error: null
        };          
    }
}
ShareManager.prototype.__proto__ = events.EventEmitter.prototype;