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

var MerkleTree = module.exports = function MerkleTree(data) {
    
    function merkleJoin(h1, h2) {
        var joined = Buffer.concat([h1, h2]);
        var dhashed = utils.sha256d(joined);
        return dhashed;
    }
    
    function calculateSteps(data) {
        var L = data;
        var steps = [];
        var PreL = [null];
        var StartL = 2;
        var Ll = L.length;
        
        if (Ll > 1) {
            while (true) {
                
                if (Ll === 1)
                    break;
                
                steps.push(L[1]);
                
                if (Ll % 2)
                    L.push(L[L.length - 1]);
                
                var Ld = [];
                var r = utils.range(StartL, Ll, 2);
                r.forEach(function (i) {
                    Ld.push(merkleJoin(L[i], L[i + 1]));
                });
                L = PreL.concat(Ld);
                Ll = L.length;
            }
        }
        return steps;
    }
    
    this.data = data;
    this.steps = calculateSteps(data);
}
