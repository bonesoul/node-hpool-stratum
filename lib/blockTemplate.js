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
var context = require('./context.js');

var blockTemplate = module.exports = function (jobId, data) {

    var shareSubmissions = []; // share submissions for the job.

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
    this.generationTransaction = coinbaseTx.CreateGeneration(data);
    
    /*
        https://bitcointalk.org/index.php?topic=557866.msg6078279#msg6078279
        job_id - ID of the job. Use this ID while submitting share generated from this job.
        prevhash - Hash of previous block.
        coinb1 - Initial part of coinbase transaction.
        coinb2 - Final part of coinbase transaction.
        merkle_branch - List of hashes, will be used for calculation of merkle root. This is not a list of all transactions,it only contains prepared hashes of steps of merkle tree algorithm.
        version - Bitcoin block version.
        nbits - Encoded current network difficulty
        ntime - Current ntime
        clean_jobs - When true, server indicates that submitting shares from previous jobs don't have a sense and such shares will be rejected. When this flag is set, miner should also drop all previous jobs, so job_ids can be eventually rotated.
    */

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

    this.commitShare = function (extraNonce1, extraNonce2, nTime, nonce) {

        var submission = extraNonce1 + extraNonce2 + nTime + nonce;

        if (shareSubmissions.indexOf(submission) !== -1) // check if it is already submitted before.
            return false;

        shareSubmissions.push(submission);
        return true;
    }

    this.serializeCoinbase = function (extraNonce1, extraNonce2) {
        return Buffer.concat([
            this.generationTransaction[0],
            extraNonce1,
            extraNonce2,
            this.generationTransaction[1]
        ]);
    };

    //https://en.bitcoin.it/wiki/Protocol_specification#Block_Headers
    this.serializeHeader = function (merkleRoot, nTime, nonce) {
        
        var header = new Buffer(80);
        var position = 0;
        header.write(nonce, position, 4, 'hex');
        header.write(this.data.bits, position += 4, 4, 'hex');
        header.write(nTime, position += 4, 4, 'hex');
        header.write(merkleRoot, position += 4, 32, 'hex');
        header.write(this.data.previousblockhash, position += 32, 32, 'hex');
        header.writeUInt32BE(this.data.version, position + 32);
        header = utils.reverseBuffer(header);
        return header;
    };

    this.serializeBlock = function (header, coinbase) {
        return Buffer.concat([
            header,
            utils.varIntBuffer(this.data.transactions.length + 1),
            coinbase,
            this.transactionData,            
            new Buffer(context.coin.isProofOfStakeHybrid? [0] : []) //POS coins require a zero byte appended to block which the daemon replaces with the signature
        ]);
    };
};