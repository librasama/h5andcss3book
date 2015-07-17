(function(){
    //≤‚ ‘≤È—Ø
    function testlist(){
        var usr = require('../models/User.js');
        usr.list(function(docs){
            console.log("usr.list:"+JSON.stringify(docs));
        });
    }
    testlist();
})();