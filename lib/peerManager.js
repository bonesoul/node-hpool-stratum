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
var net = require('net');
var context = require('./context.js');

var PeerManager = module.exports = function() {

    context.daemon.cmd('getpeerinfo', [], function (response) {

        response.result.forEach(function(entry) {
            var host = entry.addr.split(':')[0];
            var port = entry.addr.split(':')[1];
            
            // connectPeer(host, port);
            connectPeer("10.0.0.40", 25677);
        });
    });

    function connectPeer(host, port) {
        var client = net.connect({
                host: host,
                port: port
            }, function() {

            }).
            on('data', function(data) {

            })
            .on('close', function () {

            })
            .on('error', function (err) {
                if (err.code !== 'ECONNRESET')
                    _this.emit('socket.error', err);
            });
    }

};
PeerManager.prototype.__proto__ = events.EventEmitter.prototype;