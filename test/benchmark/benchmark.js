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
var context = require('../../lib/context.js');
var StratumClient = require('../integration/client.js');
var DaemonFaker = require('../common/daemonFaker.js');
var status = require('node-status');
require('../integration/setup.js');

var _this = this;

_this.period = 5000;
_this.clientCount = 0;
_this.requestCount = 0;
_this.errorCount = 0;

var daemon = new DaemonFaker(); // create a fake coin daemon host so basically we can fake the coin daemon data as we need for the tests.

var pizzas = status.addItem("pizza", {
    type: ['bar', 'percentage'],
    max: 65
});

_this.pool = new Pool(config)
    .on('pool.started', function(err) {
        context.jobManager.on('job.created', function (job) {

            status.start();            

            setTimeout(summarize, _this.period);
            createClient();
        });
    })
.start();

function createClient() {

    var client = new StratumClient();
    client.connect("localhost", 3337); // we should able to connect the pool.

    client.once('socket.connected', function() {
            client.subscribe("hpool-test", function() { // subscribe
                client.authorize('username', 'password', function() { // authorize
                    client.once('mining.notify', function(json) { // wait for mining.notify                    

                        _this.clientCount++;

                        var submitWork = function() {
                            client.submit('username', json.params[0], 00000000, json.params[7], 00000000, function(reply) {
                                _this.requestCount++;                                
                                setTimeout(submitWork, 0);
                            });
                        }

                        submitWork();
                    });
                });
            });
        })
        .once('socket.error', function(error) {
            _this.errorCount++;
        });

    setTimeout(createClient, 0);
    pizzas.inc();
}

function summarize() {
    
    // calculate the statistics for the benchmark
    var clientsPerSecond = _this.clientCount / _this.period * 1000;
    var requestsPerSecond = _this.requestCount / _this.period * 1000;
    var errorsPerSecond = _this.errorCount / _this.period * 1000;

    console.log("Done running the benchmark over %d ms", _this.period);
    console.log("Handled client connections: %d clients/sec", clientsPerSecond);
    console.log("Handled requests: %d requests/sec", requestsPerSecond);
    console.log("Errors: %d errors/sec", errorsPerSecond);
    process.exit(0);
}

