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
var net = require('net');
var Pool = require('../../lib/pool.js');
require('./setup.js');

var _this = this;

// utility function to send a json-rpc request over a network socket.
_this.sendJson = function () {
    var data = '';
    for (var i = 0; i < arguments.length; i++) {
        data += JSON.stringify(arguments[i]) + '\n';
    }
    _this.client.write(data);
}

describe('stratum', function () {
    describe('server', function () {
        
        before(function () {
            
            _this.requestCounter = 0; // create a request counter in order to track request Id's.                        
            _this.pool = new Pool(config).start(); // run the pool to test against.

        });
        
        beforeEach(function () {
            _this.requestCounter++; // before each test, increase the request counter.
        });
        
        it('should be able to accept connections', function (done) {
            
            // try connecting to pool 
            _this.client = net.connect({
                host: "localhost",
                port: 3337
            }, function () {
                done(); // we are successfully connected.
            })
            .on('error', function (err) {
                done(err); // on error, fail the test.
            });
        });
        
        it('should be able to respond mining.subscribe()', function (done) {
            
            // check for mining.subscribe
            // request: {'id':2, 'method':'mining.subscribe', 'params' : ['hpool-test'] }            
            // response: { "id":2, "result":[[["mining.set_difficulty", 16], ["mining.notify", "deadc0de0100000000000000"]]," 30000000 ",4]," error ":null}

            _this.sendJson({
                id    : _this.requestCounter,
                method: "mining.subscribe",
                params: ["hpool-test"]
            });

            _this.client.on('data', function(data) {
                console.log('data:' + data);
                var json = JSON.parse(data);
                
                should.not.exist(json.error);
                json.should.have.property('id', _this.requestCounter); // make sure the reply contains the same request id.
                json.result.should.be.instanceof(Array).and.have.lengthOf(3); // response should be an array with 3 elements.
                json.result[0][0].should.containEql('mining.set_difficulty'); // should contain set_difficulty
                json.result[0][1].should.containEql('mining.notify'); // should also contain mining.notify
                json.result[2].should.equal(4); // the last member (extraNonce2Size) should be 4.
                
                done();
            });            
        });
    });
});

