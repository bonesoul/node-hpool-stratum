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
var crypto = require('crypto');
var blockTemplate = require('./blockTemplate.js');

var JobManager = module.exports = function JobManager(poolInfo) {
    
    // private members.
    var _this = this;
    _this.jobCounter = new jobCounter();
    
    // public members.
    this.extraNonceCounter = new extraNonceCounter();
    this.extraNoncePlaceholder = new Buffer('f000000ff111111f', 'hex');
    this.extraNonce2Size = this.extraNoncePlaceholder.length - this.extraNonceCounter.size;
    
    this.current = null;
    this.jobs = {};

    queryNetwork(); // initially query for the block once.
    setupBlockPoller();


    function queryNetwork() {
        this.daemon.cmd('getblocktemplate',
        [{ capabilities: ["coinbasetxn", "workid", "coinbase/append"] }], function (response) {
            if (_this.current === null || response.result.height != _this.current.data.height) {

                var job = new blockTemplate(
                    _this.jobCounter.next(), 
                response.result,
                poolInfo
                );
                
                _this.current = job;
                _this.jobs[job.id] = job;
                _this.emit('newJob', job);
            } 
        });
    }

    function setupBlockPoller() {
        setInterval(function () {
            queryNetwork();
        }, poolInfo.config.poller.interval);
    }
};
JobManager.prototype.__proto__ = events.EventEmitter.prototype;

//Unique job per new block template
var jobCounter = function () {
    
    var counter = 0;
    
    this.next = function () {
        counter++;
        if (counter % 0xffff === 0)
            counter = 1;
        return this.current();
    };
    
    this.current = function () {
        return counter.toString(16);
    };
}

var extraNonceCounter = function () {
    
    var instanceId = crypto.randomBytes(4).readUInt32LE(0);
    var counter = instanceId << 27;
    
    this.next = function () {
        var extraNonce = util.packUInt32BE(Math.abs(counter++));
        return extraNonce.toString('hex');
    }
    
    this.size = 4;
}