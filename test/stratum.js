var should = require('should');
var net = require('net');
var context = require('../lib/context.js');
require('../lib/algorithms.js');
var ShareManager = require('../lib/shareManager.js');
var BlockManager = require('../lib/blockManager.js');
var JobManager = require('../lib/jobManager.js');
var Server = require('../lib/server.js');

context.config = {
    enabled: true,
    coin: {
        algorithm: "scrypt"
    },
    poller: {
        interval: 1000,
    }
}

this.sendJson = function () {
    var data = '';
    for (var i = 0; i < arguments.length; i++) {
        data += JSON.stringify(arguments[i]) + '\n';
    }
    _this.client.write(data);
}

var _this = this;


    describe('stratum', function () {
        describe('server', function () {
            
            before(function () {
                _this.requestCounter = 0;
                _this.server = new Server();
            });

            beforeEach(function() {
                _this.requestCounter++;
            });
            
            it('should be able to response mining.subscribe()', function (done) {
                
                _this.client = net.connect({
                    host: "localhost",
                    port: 3337
                }, function () {
                    _this.sendJson({
                        id    : _this.requestCounter,
                        method: "mining.subscribe",
                        params: ["hpool-test"]
                    });
                }).
                on('data', function (data) {
                        console.log('data:' + data);                        
                        var json = JSON.parse(data);

                        should.not.exist(json.error);
                        json.should.have.property('id', _this.requestCounter);
                        json.result.should.be.instanceof(Array).and.have.lengthOf(3);
                        json.result[0][0].should.containEql('mining.set_difficulty');
                        json.result[0][1].should.containEql('mining.notify');
                        json.result[2].should.equal(4);

                        done();
                    })
                .on('close', function () {
                    console.log('closed');
                        assert(false);
                    })
                .on('error', function (err) {
                    console.log('error:' + err);
                    assert(false);
                    });                                                
            });
        });
    });

