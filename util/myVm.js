var vm = require('vm');
var localVar = 'initial value';

var vmResult = vm.runInThisContext('localVar="vm";');

console.log("vmResult: ", vmResult);
console.log("localVar: ", localVar);

var evalResult = eval('localVar = "eval";');
console.log("evalResult: ", evalResult);
console.log("localVar:" , localVar);

/**
 * vm.runInContext 的示例
 */
var util = require('util');

var sandbox = {globalVal:1};
vm.createContext(sandbox);
for(var i=0;i<10;i++) {
    vm.runInContext('globalVal *= 2', sandbox);
}

console.log(util.inspect(sandbox));


/**
 * 测试creatContext之后变为sandbox，
 *
 * TODO runInNewContext和runInContext到底有嘛区别？？？
 */
var sandboxnew = vm.createContext({animal:'cat', count:2});

vm.runInNewContext('count+=1;name="kitty"', sandboxnew);
vm.runInContext('count+=1;name="kitty"', sandboxnew);
console.log(util.inspect(sandboxnew));
var f=vm.isContext(sandboxnew);
console.log("是否被环境变量(?)了：", f);


/**
 * 测试Script类。vm就是对Script的一层封装而已
 * @type {number}
 */
global.g1 = 0;
var script = new vm.Script('g1 += 1', {filename:'myfile.vm'});

for(var i=0;i<1000;++i) {
    script.runInThisContext();
}
console.log("global.g1="+g1);

/**
 * Script类的runInNewContext
 * vm.Script('xxxx').runInThisContext(ctx);
 * @type {*[]}
 */

var s3 = [{}, {}, {}];
var script = new vm.Script('globalVar = "set"');
s3.forEach(function(s){
    script.runInNewContext(s);
});

console.log(util.inspect(s3));