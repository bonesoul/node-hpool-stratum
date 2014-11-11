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
    _this.mitm = Mitm();
    _this.mitm.on("request", function (req, res) {
        req.on("data", function (data) {
            
            var request = JSON.parse(data);
            var response = '';
            
            switch (request.method) {
                case 'getinfo':
                    response = handleGetInfo(request);
                    break;
                case 'getdifficulty':
                    response = handleGetDifficulty(request);
                    break;
                case 'submitblock':
                    response = handleSubmitBlock(request);
                    break;
                default :
                    console.log('unhandled request: %j', request);
                    break;
            }
            
            res.end(response);
        });
    });
    
    _this.mitm.disable(); // disable by default.
    
    function handleGetInfo(request) {
        return reply(
            request,
            {
                "version": "aaa",
                "protocolversion": 70002,
                "walletversion": 60000,
                "balance": 24670138.54690000,
                "blocks": 17848,
                "timeoffset": 0,
                "connections": 0,
                "proxy": "",
                "difficulty": 0.01381189,
                "testnet": true,
                "keypoololdest": 1411208539,
                "keypoolsize": 101,
                "paytxfee": 0.00000000,
                "mininput": 0.00001000,
                "errors": ""
            });
    }
    
    function handleGetDifficulty(request) {
        return reply(request, 0.01381189);
    }
    
    function handleSubmitBlock(request) {
        return reply(request, null, {
             code : -22
        });
    }
    
    this.enable = function () {
        _this.mitm.enable();
    }
    
    this.disable = function () {
        _this.mitm.disable();
    }
    
    function reply(request, data, error) {
        
        var response = {
            'id' : request.id,
            'error' : error || null,
            'result' : data
        };
        
        var json = JSON.stringify(response);
        return json;
    }
};
daemonIntercepter.prototype.__proto__ = events.EventEmitter.prototype;