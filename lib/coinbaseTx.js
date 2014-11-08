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

var utils = require('./utils.js');
var context = require('./context.js');

exports.CreateGeneration = function (data) {
    
    var txInputsCount = 1;
    var txVersion = data.version;
    var txLockTime = 0;
    
    var txInPrevOutHash = 0;
    var txInPrevOutIndex = Math.pow(2, 32) - 1;
    var txInSequence = 0;
    
    var txTimestamp = context.coin.isProofOfStakeHybrid ?
        util.packUInt32LE(data.curtime) : new Buffer([]);
    
    //For coins that support/require transaction comments
    var txComment = context.config.coin.capatabilities.txMessage === true ?
        utils.serializeString('http://www.hpool.org') :
        new Buffer([]);
    
    var scriptSigPart1 = Buffer.concat([
        utils.serializeNumber(data.height),
        new Buffer(data.coinbaseaux.flags, 'hex'),
        utils.serializeNumber(Date.now() / 1000 | 0),
        new Buffer([context.extraNonce.placeholder.length])
    ]);
    
    var scriptSigPart2 = utils.serializeString('/hpool/');

    var p1 = Buffer.concat([
        utils.packUInt32LE(txVersion),
        txTimestamp,

        //transaction input
        utils.varIntBuffer(txInputsCount),
        utils.uint256BufferFromHash(txInPrevOutHash),
        utils.packUInt32LE(txInPrevOutIndex),
        utils.varIntBuffer(scriptSigPart1.length + context.extraNonce.placeholder.length + scriptSigPart2.length),
        scriptSigPart1
    ]);
    
    /*
        The generation transaction must be split at the extranonce (which located in the transaction input
        scriptSig). Miners send us unique extranonces that we use to join the two parts in attempt to create
        a valid share and/or block.
     */

    var outputTransactions = generateOutputTransactions(data);    
    
    var p2 = Buffer.concat([
        scriptSigPart2,
        utils.packUInt32LE(txInSequence),
        //end transaction input

        //transaction output
        outputTransactions,
        //end transaction ouput

        utils.packUInt32LE(txLockTime),
        txComment
    ]);

    return [p1, p2];
}

/*
This function creates the generation transaction that accepts the reward for
successfully mining a new block.
For some (probably outdated and incorrect) documentation about whats kinda going on here,
see: https://en.bitcoin.it/wiki/Protocol_specification#tx
 */

var generateOutputTransactions = function (data) {
    
    var reward = data.coinbasevalue;
    var rewardToPool = reward;
    
    var txOutputBuffers = [];
    
    for (var i = 0; i < context.fees.recipients.length; i++) {
        {
            var recipient = context.fees.recipients[i];
            
            var recipientReward = Math.floor(recipient.percent * reward);
            rewardToPool -= recipientReward;
            
            txOutputBuffers.push(Buffer.concat([
                    utils.packInt64LE(recipientReward),
                    utils.varIntBuffer(recipient.script.length),
                    recipient.script
                ]));
        }
        
        txOutputBuffers.unshift(Buffer.concat([
                utils.packInt64LE(rewardToPool),
                utils.varIntBuffer(context.wallet.central.script.length),
                context.wallet.central.script
            ]));
    }
    
    return Buffer.concat([
        utils.varIntBuffer(txOutputBuffers.length),
        Buffer.concat(txOutputBuffers)
    ]);
};