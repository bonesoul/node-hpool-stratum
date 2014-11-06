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
var utils = require('./utils.js');
var merkleTree = require('./merkleTree.js');
var transactions = require('./transaction.js');

var diff1 = global.diff1 = 0x00000000ffff0000000000000000000000000000000000000000000000000000;

var BlockTemplate = module.exports = function BlockTemplate(jobId, data, poolInfo) {

    // public members
    this.Id = jobId;

    this.target = data.target ?
        bignum(data.target, 16) :
        utils.bignumFromBitsHex(data.bits);

    this.difficulty = parseFloat((diff1 / this.target.toNumber()).toFixed(9));
    this.prevHashReversed = utils.reverseByteOrder(new Buffer(data.previousblockhash, 'hex')).toString('hex');
    this.transactionData = Buffer.concat(data.transactions.map(function (tx) {
            return new Buffer(tx.data, 'hex');
        }));

    this.merkleTree = new merkleTree(getTransactionBuffers(data.transactions));

    this.generationTransaction = transactions.CreateGeneration(
        data,
        poolInfo
    );

    // private members

    function getTransactionBuffers(txs) {
        var txHashes = txs.map(function (tx) {
            return utils.uint256BufferFromHash(tx.hash);
        });
        return [null].concat(txHashes);
    }
};