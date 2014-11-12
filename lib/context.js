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

// Holds pool context data.

var context = module.exports = {
    config: null,
    coin: {
        coinVersion: null,
        protocolVersion: null,
        walletVersion: null,
        isProofOfStakeHybrid: false,
        capatabilities: {
            submitBlockSupported: false
        }
    },
    network: {
        testnet: false,
        connections: 0,
        errors: null,
        difficulty: null,
        hashRate: null
    },
    wallet: {
        central: null // validation results for supplied pool address.
    },
    fees: {
        percent: 0, // total percent of pool fees.
        recipients: [], // recipients of fees.
    },
    extraNonce: {
        placeholder: new Buffer('f000000ff111111f', 'hex'),
    },
    extraNonce2: {
        size: 0   
    },
    jobManager: null,
    shareManager: null,
    blockManager: null,
    server: null,
    daemon : null // the daemon interface we'll be using to communicate with coin daemons.
}