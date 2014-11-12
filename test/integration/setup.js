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

global.config = {
    enabled: true,
    coin: {
        name: 'Earthcoin',
        symbol: 'EAC',
        algorithm: 'scrypt',
        site: 'http://getearthcoin.com/',
        blockExplorer: {
            block: 'http://earthchain.info/block/2',
            tx: 'http://earthchain.info/tx/',
            address: 'http://earthchain.info/address/'
        },
        capatabilities: {
            txMessage: true
        }
    },
    meta: {
        motd: 'Welcome to hpool, enjoy your stay! - http://www.hpool.org',
        txMessage: 'http://www.hpool.org'
    },
    wallet: {
        address: 'n1DdGwwc3fFX4wP7aS7wvVFvaGLocoUGna'
    },
    rewards: {
        'myxWybbhUkGzGF7yaf2QVNx3hh3HWTya5t': 1
    },
    poller: {
        interval: 1000,
    },
    daemon: 
    {
        host: 'localhost',
        port: 9337,
        username: 'user',
        password: 'password',
        timeout: 30000
    },
    stratum: {
        enabled: true,
        ports: {
            '3337': {
                vardiff: {
                    'enabled': true,
                    'minDiff': 8,
                    'maxDiff': 512,
                    'targetTime': 15,
                    'retargetTime': 90,
                    'variancePercent': 30
                }
            }
        }
    }
}
