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
var winston = require('winston');
var context = require('./context.js');

var BlockManager = module.exports = function () {
    
    var _this = this;

    setupBlockPoller();
    
    function setupBlockPoller() {
        setInterval(function () {
            queryNetwork();
        }, context.config.poller.interval);
    }

    function queryNetwork() {

        context.daemon.cmd('getblockcount', [], function(response) {
            var longestChain = response.result;

            if (context.jobManager.current !== null && longestChain + 1 === context.jobManager.current.data.height)
                return;

            winston.log('info', 'New block emerged in network: ' + longestChain);
            _this.emit('block.emerged', longestChain);            
        });
    }

    context.shareManager.on('share.valid', function (share) {

        if (!share.isValid || !share.blockCandidate)
            return;

        submitBlock(share, function () {
            queryBlock(share, function (isAccepted, data) {
                winston.log('info', 'Found block: ' + data.height);
                _this.emit('block.found', data);
            });
        });
    });
    
    function queryBlock(share, callback) {
        context.daemon.cmd('getblock', [share.blockHash], function (response) {
            if (response.error)
                callback(false);
            else
                callback(true, response.result);             
        });
    }

    function submitBlock(share, callback) {
        
        var command, args;
        
        if (context.coin.capatabilities.submitBlockSupported) {
            command = "submitblock";
            args = [share.blockHex];
        } else {
            command = "getblocktemplate";
            args = [{ 'mode': 'submit', 'data': share.blockHex }];
        }
        
        context.daemon.cmd(command, args, function (response) {
            if (response.error) {
                winston.log('error', 'Block submission failed for ' + share.height + ', error: ' + JSON.stringify(result.error));
                return;
            }
            else if (response.result == 'rejected') {
                winston.log('error', 'Block submission for ' + share.height + 'got rejected by daemon');
                return;
            }
            
            winston.log('Submitted block ' + share.height + ' successfully');
            callback();
        });
    }
}
BlockManager.prototype.__proto__ = events.EventEmitter.prototype;