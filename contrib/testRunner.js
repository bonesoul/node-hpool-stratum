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

// originally based on http://stackoverflow.com/questions/9779700/mocha-requires-make-cant-find-a-make-exe-that-works-on-windows

var program = require('commander');
var path = require('path');

program
    .version('0.0.1')
    .option('-u, --unit', 'Run unit tests.')
    .option('-f, --functional', 'Run functional tests.')
    .option('-i, --integration', 'Run integration tests.')
    .on('--help', function () {
        console.log('Executes the test suites.');
        console.log('');
    })
   .parse(process.argv);

if (!program.unit && !program.functional && !program.integration) {
    console.log();
    console.log('Specify the test suites you want to run.');
    console.log('Run help (-h) for detailed instructions.');
    console.log();
}

if (program.unit || program.functional) {
    console.log('Test suite not ready');
    console.log();
}

if (program.integration) {
    var mocha = path.join(__dirname, '../node_modules/mocha/bin/mocha');
    var tests = path.join(__dirname, '../test/integration');
    require('child_process').exec('node ' + mocha + ' -u bdd -R spec --recursive -c ' + tests, standardOutput);
}

/**
 * Standard output.
 *
 * @method standardOutput
 * @param {Object} error
 * @param {String} stdout the cli standard output
 * @param {String} stderr output of errors
 */
function standardOutput(error, stdout, stderr) {
    console.log(stdout);
    console.log(stderr);
}