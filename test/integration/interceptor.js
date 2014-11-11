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

var Mitm = require("mitm");
var events = require('events');

var daemonIntercepter = module.exports = function () {
    
    var _this = this;
    
    // intercep connection to coin daemon coin daemon @ localhost:9337 and simulate it.
    _this.mitm = Mitm()
    .on("connect", function(socket, options) {

	if(options.host !== 'localhost' || options.port !== 9337)
		socket.bypass();
    })
    .on("request", function (req, res) {    
        req.on("data", function (data) {            
            var request = JSON.parse(data);
            
            var response;
            
            if (request instanceof Array) {
                response = [];
                request.forEach(function (entry) {
                    response.push(handleMessage(entry));
                });
            } else {
                response = handleMessage(request);
            }
            
            var json = JSON.stringify(response);
            res.end(json);
        });
    })    
//    .disable(); // disable by default.
    
    function handleMessage(request) {
        
        var response = '';
        
        switch (request.method) {
            case 'getinfo':
                response = handleGetInfo();
                break;
            case 'getdifficulty':
                response = handleGetDifficulty();
                break;
            case 'submitblock':
                response = handleSubmitBlock();
                break;
            case 'validateaddress':
                response = handleValidateAddress();
                break;
            case 'getmininginfo':
                response = handleGetMiningInfo();
                break;
            case 'getblocktemplate':
                response = handleGetBlockTemplate();
                break;
            case 'getpeerinfo':
                response = handleGetPeerInfo();
                break;
            case 'getblockcount':
                response = handleGetBlockCount();
                break;
            default :
                response = unhandlesRequest();
                break;
        }
        
        return {
            'id' : request.id,
            'error' : response.error || null,
            'result' : response.result
        }
    }
    
    function handleGetInfo() {
        return {
            result: {
                version: 1030100,
                protocolversion: 70002,
                walletversion: 60000,
                balance: 24670138.54690000,
                blocks: 17848,
                timeoffset: 0,
                connections: 0,
                proxy: "",
                difficulty: 0.01381189,
                testnet: true,
                keypoololdest: 1411208539,
                keypoolsize: 101,
                paytxfee: 0.00000000,
                mininput: 0.00001000,
                errors: ""
            },
            error: null
        }
    }
    
    function handleGetMiningInfo() {
        return {
            result: {
                blocks : 17848,
                currentblocksize : 1000,
                currentblocktx : 0,
                difficulty : 0.01381189,
                errors : "",
                generate : false,
                genproclimit : -1,
                hashespersec : 0,
                networkhashps : 112418,
                pooledtx : 3,
                testnet : true
            },
            error: null
        }
    }
    
    function handleGetBlockTemplate() {
        return {
            result: {
                version : 2,
                previousblockhash : "bab6ddee7ed94e8ebf71eb375ae1218c571809b63f9fa3d9669e7076304c7012",
                transactions : [],
                coinbaseaux : {
                    flags : "062f503253482f"
                },
                coinbasevalue : 1042300000000,
                target : "00000043f67c0000000000000000000000000000000000000000000000000000",
                mintime : 1415618974,
                mutable : [
                    "time",
                    "transactions",
                    "prevblock"
                ],
                noncerange : "00000000ffffffff",
                sigoplimit : 20000,
                sizelimit : 1000000,
                curtime : 1415724581,
                bits : "1d43f67c",
                height : 17849
            },
            error: null
        }
    }
    
    function handleGetPeerInfo() {
        return {
            result: [
                {
                    addr : "130.255.72.107:25677",
                    services : "00000003",
                    lastsend : 1415724187,
                    lastrecv : 1415724187,
                    bytessent : 1216,
                    bytesrecv : 569,
                    blocksrequested : 0,
                    conntime : 1415718785,
                    version : 70002,
                    subver : "/Satoshi:1.3.2/",
                    inbound : false,
                    startingheight : 17848,
                    banscore : 0,
                    syncnode : true
                }
            ],
            error: null
        };
    }
    
    function handleGetBlockCount() {
        return {
            result: 17848,
            error: null
        };
    }
    
    function handleGetDifficulty() {
        return {
            result: 0.01381189,
            error: null
        };
    }
    
    function handleSubmitBlock() {
        return {
            result: null,
            error: {
                code: -22
            }
        };
    }
    
    function handleValidateAddress() {
        return {
            result: {
                isvalid: true,
                address: "n1DdGwwc3fFX4wP7aS7wvVFvaGLocoUGna",
                ismine: true,
                isscript: false,
                pubkey: "0313b0014de52b74e7a46606a4084efe77a7f37f58fa00ab8d8b8e86d1b46f18c0",
                iscompressed: true,
                account: "pool-wallet"
            },
            error: null
        };
    }
    
    function unhandlesRequest() {
        return {
            result: null,
            error: {
                code: -32601
            }
        };
    }
    
    this.enable = function () {
        _this.mitm.enable();
    }
    
    this.disable = function () {
        _this.mitm.disable();
    }
};
daemonIntercepter.prototype.__proto__ = events.EventEmitter.prototype;
