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

var should = require('should');
var async = require('async');
var Pool = require('../../lib/pool.js');
var StratumClient = require('./client.js');
var DaemonFaker = require('../common/daemonFaker.js');
require('./setup.js');

var _this = this;

describe('stratum', function () {
    describe('server', function () {
        
        before(function () {
            _this.daemon = new DaemonFaker(); // create interceptor for daemon connection so we can simulate it.
        });
        
        beforeEach(function () { 
            _this.daemon.enable(); // enable intercepting of messages.
        });
        
        afterEach(function () {
            _this.daemon.disable(); // disable intercepting of messages.
        });
        
        it('should start', function (done) {
            
            // initialize the pool and let it start.

            config.stratum.port = 3337;
            _this.pool = new Pool(config)
                .on('pool.started', function (err) {
                    done(err);
                })
            .start();
        });
        
        it('should connect', function (done) {
            
            // try connecting to pool 
            
            _this.client = new StratumClient();
            _this.client.connect("localhost", 3337);
            
            // we should able to connect the pool.
            _this.client
                .once('socket.connected', function () {
                    done();
                })
                .once('socket.error', function (error) {
                    done(error);
                });
        });
        
        it('should subscribe', function (done) {
            
            // send mining.subscribe request.
            _this.client.subscribe('hpool-test', function (reply) {
                
                // check for mining.subscribe
                // request: {'id':2, 'method':'mining.subscribe', 'params' : ['hpool-test'] }            
                // response: { "id":2, "result":[[["mining.set_difficulty", 16], ["mining.notify", "deadc0de0100000000000000"]]," 30000000 ",4]," error ":null}
                
                should.not.exist(reply.error); // the response should contain no errors.
                reply.result.should.be.instanceof(Array).and.have.lengthOf(3); // response should be an array with 3 elements.
                reply.result[0][0].should.containEql('mining.set_difficulty'); // should contain set_difficulty
                reply.result[0][1].should.containEql('mining.notify'); // should also contain mining.notify
                reply.result[2].should.equal(4); // the last member (extraNonce2Size) should be 4.                
                done();
            });
        });
        
        it('should authorize', function (done) {
            
            // send mining.authorize request.
            _this.client.authorize('username', 'password', function (reply) {
                
                // check for mining.authorize
                // request: { 'id' : 3, 'method' : 'mining.authorize', 'params' : ['username','password'] }
                // response: { id: 3, result: true, error: null }
                
                should.not.exist(reply.error); // the response should contain no errors.
                reply.result.should.equal(true); // make sure we were able to authorize.
                
                // set 3 tasks to parse next messages;
                // * client.show_message
                // * mining.set_difficulty
                // * mining.notify
                
                async.series([
                    function (callback) {
                        
                        // we should recieve a client.show_message
                        // { id: null, method: 'client.show_message', params: [ 'Welcome to hpool, enjoy your stay!' ] }
                        
                        _this.client.once('client.show_message', function () {
                            callback();
                        });
                    },
                    function (callback) {
                        
                        // next we should recieve a mining.set_difficulty
                        // { id: null, method: 'mining.set_difficulty', params: [ 16 ] }
                        
                        _this.client.once('mining.set_difficulty', function (message) {
                            message.params.should.be.instanceof(Array).and.have.lengthOf(1); // params should be an array.
                            message.params[0].should.equal(16);
                            callback();
                        });
                    },
                    function (callback) {
                        
                        // eventually we should recieve a new job with mining.notify 
                        // {
                        //    id: null,
                        //    method: 'mining.notify',
                        //    params: [
                        //        '1',
                        //        '02e581a45f678af3db0644fe625be40f96a4c9df4d1be8717a95922146a9c604',
                        //        '02000000010000000000000000000000000000000000000000000000000000000000000000ffffffff2002b645062f503253482f042a04625408',
                        //        '072f68706f6f6c2f0000000002407ba940f00000001976a914d81b9168e4758c972a9b4d0a5ebb27d6fe0668a688acc05b426d020000001976a914ca47f1ccb629a2346716fb07c780d2d156391c5288ac0000000014687474703a2f2f7777772e68706f6f6c2e6f7267',
                        //        [],
                        //        '00000002',
                        //        '1d1fe3db',
                        //        '5462042a',
                        //        true
                        //    ]
                        // }                    
                        
                        _this.client.once('mining.notify', function (message) {

                            _this.job = message; // store the job as we will need it later.

                            message.params.should.be.instanceof(Array).and.have.lengthOf(9); // params should be an array and it should contain 9 elements.
                            message.params[0].should.equal('1'); // job Id should equal 1.                            
                            message.params[5].should.equal('00000002'); // version should be 2.
                            message.params[8].should.equal(true); // should force the miner to clear existing jobs.
                            // TODO: once we have mitm with daemon connectivity we should be able to check for other data here too.

                            callback();
                        });
                    }
                ],
                    function (err) {
                    done(err);
                });
            });
        });

        describe('submit work', function () {
            it('should handle incorrect extraNonce2 size', function (done) {
                _this.client.submit('username', _this.job.params[0], 00000000, _this.job.params[7], 00000000, function (reply) {
                    
                    reply.result.should.equal(false); // the work submission should rejected.
                    reply.error[0].should.equal(20); // the error should be 20 (submit error)
                    reply.error[1].should.equal('Incorrect size of extranonce2');
                    done();
                });
            });
        });        
    });
});

//it('should be able to handle flooded sockets', function (done) {
//    var data = generateRandomData(1024); // generate random 1KB random data.
//    // send 15 KB's of random data.
//    for (var i = 0; i < 15; i++) {
//        _this.client.send(data);
//    }
//    done();
//    function generateRandomData(size) {
//        var chars = 'abcdefghijklmnopqrstuvwxyz123456789'.split('');
//        var len = chars.length;
//        var data = [];
//        while (size--) {
//            data.push(chars[Math.random() * len | 0]);
//        }
//        return data.join('');
//    }
//});
