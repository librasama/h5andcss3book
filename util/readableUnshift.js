// Pull off a header delimited by \n\n
// use unshift() if we get too much
// Call the callback with (error, header, stream )
// 大概是把消费的buf再吐出来的意思（x

var StringDecoder = require('string_decoder').StringDecoder;

function parseHeader(stream, callback) {
    stream.on('error', callback);
    stream.on('readable', onReadable);
    var decoder = new StringDecoder('utf8');
    var header = '';
    function onReadable() {
        var chunk;
        while(null !== (chunk = stream.read())) {
            var str = decoder.write(chunk);
            if(str.match(/\n\r\n\r/g)) {
                //console.log("str"+str);
                // found the header boundary
                var split = str.split(/\n\r\n\r/);
                header += split.shift();
                var remaining = split.join('\n\n');
                var buf = new Buffer(remaining, 'utf8');
                if(buf.length)
                    stream.unshift(buf);
                stream.removeListener('error', callback);
                stream.removeListener('readable', onReadable);
                callback(null, header, stream);
            } else {
                // still reading the header.
                header += str;
            }
        }
    }
}

var fs = require('fs');
var ins = fs.createReadStream('../npm-debug.log');
parseHeader(ins,function(err, header, stream){
    console.log("header: " + header);
    console.log("stream: " + JSON.stringify(stream));
});