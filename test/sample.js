var should = require('should');

﻿describe('sample', function() {

    var data;

    before(function(done) {
        data = {
            name: 'sample'
        };
	done();
    });

    it('should', function(done) {
        data.should.have.property('name', 'sample');
	done();
    });
});
