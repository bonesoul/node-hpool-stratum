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
var Pool = require('../../lib/pool.js');
var StratumClient = require('../integration/client.js');
var DaemonIntercepter = require('../integration/interceptor.js');
require('../integration/setup.js');

var _this = this;
_this.daemon = new DaemonIntercepter(); // create interceptor for daemon connection so we can simulate it.

_this.pool = new Pool(config)
    .on('pool.started', function (err) {

    })
    .start();

_this.client = new StratumClient();
_this.client.connect("localhost", 3337);

// we should able to connect the pool.
_this.client
    .once('socket.connected', function() {
        _this.client.subscribe("hpool-test", function () { // subscribe
            _this.client.authorize('username', 'password', function() { // authorize
                _this.client.once('mining.notify', function(json) { // wait for mining.notify


                    test();

                        _this.client.submitWork('username', json.params[0], 00000000, json.params[7], 00000000, function(reply) {
                            console.log(reply);
                        });

                });
            });
        });
    })
    .once('socket.error', function(error) {
        
    });

function test() {
    console.log('timer');
    setTimeout(test, 1000);
}