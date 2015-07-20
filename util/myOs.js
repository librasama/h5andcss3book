var os = require('os');
var util = require('util');


//1，5，15分钟的负载。在windows上一直是000
console.log("loadavg:"+util.inspect(os.loadavg()));

// 系统的temp目录
console.log("当前系统tmpdir : " + os.tmpdir());

// CPU 排序架构：
console.log("about Cpu -> 架构：" + os.arch() + " ;  大端小端："+ os.endianness());

// CPU 详情
console.log("CPU详细参数:   "+util.inspect(os.cpus()));

// 操作系统相关:
console.log("系统名：" + os.platform() + "  系统类型："+os.type() + " 系统版本号：" + os.release() + " 用户名：" + os.hostname());

// 内存相关(win下freemem() 不行，NAN)
console.log("总内存：" + os.totalmem() / Math.pow(1024, 3) + "GB    " + "空余内存："+os.freemem()/Math.pow(1024*2) + "MB");

// 行尾结束符(?????WTF)
console.log("很重要的行尾结束符为："+os.EOL);

// 网络连接情况
console.log("os netowrk status:"+util.inspect(os.networkInterfaces()));