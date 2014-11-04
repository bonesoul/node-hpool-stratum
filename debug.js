// 
//     hpool-stratum - sratum protocol module for hpool-server
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

var events = require('events');
var winston = require('winston');
var stratum = require('./lib/pool.js');

winston.log('info', 'hpool-stratum <debug> starting..');

var options = {
    wallet: {
        address: 'n1DdGwwc3fFX4wP7aS7wvVFvaGLocoUGna'
    },
    daemon: 
        {
            host: '10.0.0.40',
            port: 9337,
            username: 'user',
            password: 'password',
            timeout: 30000
        }
}

// Actually we are in scope of a module and we shouldn't be run on our own.
// This file is just here for debugging purposes.
var pool = new stratum.Pool(options);

// listen for log messages
pool.on('log', function (severity, text) {
    winston.log(severity, text);
}).start();
