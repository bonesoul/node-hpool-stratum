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
var coinbaseTx = require('./coinbaseTx.js');

var diff1 = global.diff1 = 0x00000000ffff0000000000000000000000000000000000000000000000000000;

var BlockTemplate = module.exports = function BlockTemplate(jobId, data, poolInfo) {

    // public members
    this.id = jobId;
    this.data = data;

    this.target = data.target ?
        bignum(data.target, 16) :
        utils.bignumFromBitsHex(data.bits);

    this.difficulty = parseFloat((diff1 / this.target.toNumber()).toFixed(9));
    this.prevHashReversed = utils.reverseByteOrder(new Buffer(data.previousblockhash, 'hex')).toString('hex');
    this.transactionData = Buffer.concat(data.transactions.map(function (tx) {
            return new Buffer(tx.data, 'hex');
        }));

    this.merkleTree = new merkleTree(getTransactionBuffers(data.transactions));
    this.merkleBranch = getMerkleHashes(this.merkleTree.steps);

    this.generationTransaction = coinbaseTx.CreateGeneration(
        data,
        poolInfo
    );
    
    // job parameters defined by stratum protocol.
    this.params = [
        this.id, // id of the job used by miners while sending back a related share.
        this.prevHashReversed, // reversed hash of the previous block.
        this.generationTransaction[0].toString('hex'), // initial part of the coinbase transaction - the miner inserts ExtraNonce1 and ExtraNonce2 after this section of the coinbase.
        this.generationTransaction[1].toString('hex'), // The miner appends this after the first part of the coinbase and the two ExtraNonce values.
        this.merkleBranch,
        utils.packInt32BE(data.version).toString('hex'),
        data.bits,
        utils.packUInt32BE(data.curtime).toString('hex'),
        true // force miner to clean existing jobs
    ];            

    function getTransactionBuffers(txs) {
        var txHashes = txs.map(function (tx) {
            return utils.uint256BufferFromHash(tx.hash);
        });
        return [null].concat(txHashes);
    }

    function getMerkleHashes(steps) {
        return steps.map(function (step) {
            return step.toString('hex');
        });
    }
};