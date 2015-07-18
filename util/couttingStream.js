var Readable = require('stream').Readable;
var util = require('util');
util.inherits(Counter, Readable);

function Counter(opt) {
    Readable.call(this, opt);
    this._max = 1000000;
    this._index = 1;
}

Counter.prototype._read = function() {
    var i = this._index++;
    if(i > this._max) {
        this.push(null);
    } else {
        var str = '' + i;
        var buf = new Buffer(str, 'ascii');
        this.push(buf);
    }

};

var c = new Counter("fs");
chunk = '';
c.on('data', function(data) {
    chunk += data;
});
c.on('end', function(){
    console.log(Buffer.toString(chunk));
});
c.read();


