(function(){
    function initUsrs() {
        var User = require('../models/User.js');
        var u1 = {}, u2 = {};
        u1.uname = 'umaso';
        u1.type = '0';
        u1.uid = '0';
        u2.uname = 'aki';
        u2.type = '1';
        u2.uid = '1';
        User.add(u1, function(rs){console.log("u1 add result:"+rs);});
        User.add(u2, function(rs){console.log("u2 add result:"+rs);});
    }
    initUsrs();
})();