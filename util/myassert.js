var assert = require('assert');
assert.equal(1,1);
assert.ok(2,2); // 写法一样的啦~！

//assert.notequal('sb', 'sb'); // 其实是相等的，和java不一样呢
assert.deepEqual('sb', 'sb');  // 卧勒个大槽，不仅相等，还深度相等...
console.log('aaaa' === 'aaaa'); //真的咧...颠覆了我的字符串观 --|||


console.log("'1' ==1 的结果"+("1" == 1)); // 看看..这个
console.log("'1' ===1 的结果"+("1" === 1)); // = =|||

//assert.strictEqual('1',1); // 呵呵，过不去的。和deepEquals一样


//断言会抛异常。很醉，销魂~~
assert.throws(function () {
    throw new Error('Wrong value');
}, function (err) {
    if(err instanceof Error && /value/.test(err)) {
        console.log("Wooo, 看他抛了抛了异常呢");
        return true;
    }
},
"unexpected error"
);

// 断言Error:assert.ifError????怎么用？？？
var fs = require('fs');
fs.open('xxx.txt', 'r', function(err, content){
    assert.ifError(err);
});
