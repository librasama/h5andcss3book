var util = require('util');
var events = require('events');

function MyStream1(){
    events.EventEmitter.call(this);
}

util.inherits(MyStream1, events.EventEmitter);

MyStream1.prototype.write = function(data) {
    this.emit('data', data);
}

var stream = new MyStream1();
//卧勒个大槽，stream instanceof events.EventEmitter的地方必须加()才行哦，否则 stream会优先和前面的字符串结合，那种怪物自然不是events.EventEmitter的实例啊！！！
// 细节小心 = =
console.log("测试一下MyStream类型的对象是否是EventEmiiter:"+ (stream instanceof events.EventEmitter)); //
console.log("测试一下构造函数又怎么样呢:"+ (MyStream1.super_ === events.EventEmitter));

stream.on('data', function(data){
    console.log("Recived data:"+data);
});

stream.write('Wooo~~I am gay~');

