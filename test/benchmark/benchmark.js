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
var StratumClient = require('../common/stratumClient.js');
var DaemonFaker = require('../common/daemonFaker.js');
require('../common/config.js');

/*
 * Benchmarks the performance of the pool with fake stratum clients sending fake share submissions
 */

var _this = this;
_this.period = 5000;
_this.clientCount = 0;
_this.requestCount = 0;
_this.errorCount = 0;

var daemon = new DaemonFaker(config); // create a fake coin daemon host so basically we can fake the coin daemon data as we need for the tests.

// run the pool
_this.pool = new Pool(config)
    .on('pool.started', function (err) {
        // wait for the pool to get started.
        context.jobManager.on('job.created', function (job) {
            // wait for the pool to create it's very first mining job.
            setTimeout(summarize, _this.period); // schedule the end of the benchmark with the given perid.
            createClient(); // create the very first fake stratum client.
        });
    })
.start();

// creates a fake stratum client which connects, subscribes, authenticates and submits fake shares.
function createClient() {
    
    var client = new StratumClient(); // create a fake stratum client.
    client.connect("localhost", context.config.stratum.port); // let it connect to pool
    
    // wait for the socket connection.
    client.once('socket.connected', function () {
        
        // subscribe to the pool
        client.subscribe("hpool-test", function () {
            
            // authenticate the the pool
            client.authorize('username', 'password', function () {
                
                // wait for mining job
                client.once('mining.notify', function (json) {
                    
                    _this.clientCount++; // once we recieve the job, increase the count of handled clients.
                    
                    // the function submits a fake share and re-schedules the next share once we get the response.                
                    var submitWork = function () {
                        
                        // submit the work and wait for it's reply.
                        client.submit('username', json.params[0], 00000000, json.params[7], 00000000, function (reply) {
                            
                            _this.requestCount++; // increase the handled request count.
                            setTimeout(submitWork, 0); // reschedule the next share submission immediately.
                        });
                    }
                    
                    submitWork(); // send the very first share.
                });
            });
        });
    })
    .once('socket.error', function (error) { 
        // on socket error, increase the error count.
        _this.errorCount++;
    });
    
    // schedule creation of client immediately
    setTimeout(createClient, 0);
}

function summarize() {
    
    // calculate the statistics for the benchmark
    var clientsPerSecond = (_this.clientCount / _this.period * 1000).toFixed(2);;
    var requestsPerSecond = (_this.requestCount / _this.period * 1000).toFixed(2);;
    var errorsPerSecond = (_this.errorCount / _this.period * 1000).toFixed(2);;
    
    console.log("Done running the benchmark over %d ms", _this.period);
    console.log("Handled a total of %d clients [%d clients/sec]", _this.clientCount, clientsPerSecond);
    console.log("Handled a total of %d requests [%d requests/sec]", _this.requestCount, requestsPerSecond);
    console.log("Errors: %d errors/sec", errorsPerSecond);

    process.exit(0);
}

