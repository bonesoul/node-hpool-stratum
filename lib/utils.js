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

var base58 = require('base58-native');
var bignum = require('bignum');

exports.packInt64LE = function (num) {
    var buff = new Buffer(8);
    buff.writeUInt32LE(num % Math.pow(2, 32), 0);
    buff.writeUInt32LE(Math.floor(num / Math.pow(2, 32)), 4);
    return buff;
};

// For POS coins - used to format wallet address for use in generation transaction's output
exports.pubkeyToScript = function (key) {
    if (key.length !== 66) {
        console.error('Invalid pubkey: ' + key);
        throw new Error();
    }
    var pubkey = new Buffer(35);
    pubkey[0] = 0x21;
    pubkey[34] = 0xac;
    new Buffer(key, 'hex').copy(pubkey, 1);
    return pubkey;
};

// For POW coins - used to format wallet address for use in generation transaction's output
exports.addressToScript = function (addr) {
    
    var decoded = base58.decode(addr);
    
    if (decoded.length != 25) {
        console.error('invalid address length for ' + addr);
        throw new Error();
    }
    
    if (!decoded) {
        console.error('base58 decode failed for ' + addr);
        throw new Error();
    }
    
    var pubkey = decoded.slice(1, -4);
    
    return Buffer.concat([new Buffer([0x76, 0xa9, 0x14]), pubkey, new Buffer([0x88, 0xac])]);
};

/*
 Used to convert getblocktemplate bits field into target if target is not included.
 More info: https://en.bitcoin.it/wiki/Target
 */
exports.bignumFromBitsBuffer = function (bitsBuff) {
    var numBytes = bitsBuff.readUInt8(0);
    var bigBits = bignum.fromBuffer(bitsBuff.slice(1));
    var target = bigBits.mul(
        bignum(2).pow(
            bignum(8).mul(
                numBytes - 3
            )
        )
    );
    return target;
};

exports.bignumFromBitsHex = function (bitsString) {
    var bitsBuff = new Buffer(bitsString, 'hex');
    return exports.bignumFromBitsBuffer(bitsBuff);
};