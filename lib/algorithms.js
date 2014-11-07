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
var hashlib = require('hpool-hashlib');
var util = require('./utils.js');

var diff1 = global.diff1 = 0x00000000ffff0000000000000000000000000000000000000000000000000000;

var algorithms = module.exports = global.algorithms = {
    sha256: {
        multiplier: 1,
        hash: function () {
            return function () {
                return util.sha256d.apply(this, arguments);
            }
        }
    },
    scrypt: {
        multiplier: Math.pow(2, 16),
        hash: function (coinConfig) {
            var nValue = coinConfig.nValue || 1024;
            var rValue = coinConfig.rValue || 1;
            return function (data) {
                return hashlib.scrypt(data, nValue, rValue);
            }
        }
    }
};