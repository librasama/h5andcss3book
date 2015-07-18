var fs = require('fs');
var readable = fs.createReadStream('../views/overview.jade', {'encoding':'utf8'});
var assert = require('assert');
var zlib = require('zlib');

//readable.resume();
readable.on('data', function(chunk){
    assert.equal(typeof chunk, 'string');
    console.log("got %d charactors of string data", chunk.length);
});
readable.on('end', function(chunk){
    console.log("got to the end, but did not read anything."+chunk);
});

var writable = fs.createWriteStream('out_overview.jade');

//结束在末尾添加
readable.on('end', function(){
    writable.end('\nGoodbye~\n');
});

readable.pipe(writable, {end:false});

var z = zlib.createGzip();
var w = fs.createWriteStream('out_overview.jade.gz');

readable.pipe(z).pipe(w); // 压缩成gz文件,不能和writable在一个语句里一起使用
