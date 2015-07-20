var readline = require('readline');

var rl = readline.createInterface({
    input : process.stdin,
    output: process.stdout
});

/**
 * question 接口测试
 */
rl.question("What do you think of node.js ?", function(answer){
    console.log("Thank you for your valuable feedback  : ", answer);
    rl.close();
});


/**
 * 简单的交互CLI
 */
var os = require('os');

rl.setPrompt('From ' + os.hostname() +'`s computer On ' + os.platform() +'`s AI> ');
rl.prompt();
//console.log(require('process').platform);
rl.on('line', function(line){
    switch (line.trim()) {
        case 'hello' :
            console.log("world");
            break;
        case 'q':
            rl.close();
            break;
        default :
            console.log("Say what? I might have heard `" + line.trim() + '`');
            break;
    }
    rl.prompt();
}).on('close', function () {
    console.log("Have a nice day!");
    process.exit(0);
});