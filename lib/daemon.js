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

var winston = require('winston');
var events = require('events');
var http = require('http');
var context = require('./context.js');

var daemon = module.exports = function () {
    
    // private members
    var _this = this;
    
    // public members
    this.cmd = cmd;
    this.batch = batch;
    
    winston.log('info', 'Checking coin daemon connectivity [%s:%d]', context.config.daemon.host, context.config.daemon.port);
    waitUntilOnline(function () {
        winston.log('info', 'Coin daemon connection check succesfull [%s:%d]', context.config.daemon.host, context.config.daemon.port);
        _this.emit('online');
    });    
    
    function waitUntilOnline(callback) {
        
        var retryCount = 0;
        var check = function () {
            
            cmd('getinfo', [], function (error, response) {
                                
                if (response !== 'undefined' && !response.error) {                    
                    callback();
                } else {
                    retryCount++;
                    winston.log('warn', 'Waiting for coin daemon [%s:%d] to come online - retry: %d', context.config.daemon.host, context.config.daemon.port, retryCount);
                    setTimeout(check, 1000);
                }
            });
        }
        
        check();
    }
    
    function cmd(method, params, callback) {
        
        var request = JSON.stringify({
            method: method,
            params: params,
            id: Date.now() + Math.floor(Math.random() * 10)
        });
        
        makeHttpRequest(request, function (error, result) {
            callback(error, result);
        });
    }
    
    function batch(methods, callback) {
        
        var requests = [];
        
        for (var i = 0; i < methods.length; i++) {
            requests.push({
                method: methods[i][0],
                params: methods[i][1],
                id: Date.now() + Math.floor(Math.random() * 10) + i
            });
        }
        
        var json = JSON.stringify(requests);
        
        makeHttpRequest(json, function (error, results) {
            callback(error, results);
        });
    }
    
    function makeHttpRequest(requestData, callback) {
        
        var options = {
            hostname: (typeof (context.config.daemon.host) == 'undefined' ? '127.0.0.1' : context.config.daemon.host), // default to 127.0.0.1
            port: context.config.daemon.port,
            method: 'POST', 
            auth: context.config.daemon.username + ':' + context.config.daemon.password,
            headers: {
                'Content-Length': requestData.length
            }
        }
        
        var request = http.request(options, function (response) {
            var data = '';
            response.setEncoding('utf8');
            response.on('data', function (chunk) {
                data += chunk;
            });
            response.on('end', function () {
                parseResponse(response, data);
            });
        });
        
        request.on('error', function (e) {
            callback(e);
        });
        
        request.end(requestData);
        
        var parseResponse = function (response, responseData) {

            var json;
            
            // handle 401 - Unauthorized
            if (response.statusCode === 401) 
            {
                winston.log('error', 'Unauthorized RPC access - invalid RPC username or password');
                return;
            }
            
            try {
                json = JSON.parse(responseData);
            } catch (e) {
                winston.log('error', 'Could not parse rpc data from coin daemon; \n request: ' + requestData + '\nresponse: ' + responseData);
                callback(e);
            }            

            if (json)
                callback(json.error, json);
        }
    }
}
daemon.prototype.__proto__ = events.EventEmitter.prototype;