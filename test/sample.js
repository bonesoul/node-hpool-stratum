describe('sample', function() {

    var data;

    before(function(done) {
        data = {
            name: 'sample'
        };
    });

    it('should', function() {
        data.should.have.property('name', 'sample');
    });
});