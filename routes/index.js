var user = require('../models/User.js');
var express = require('express');
var router = new express.Router();
var fs = require('fs');


router.get('/', function(req, res, next){
    var uri_path = '../routes';
    var list = fs.readdirSync(uri_path);
    console.log("list: "+list);
    //遍历目录列表？？？
    list.forEach(function(item){
        var f_content = fs.readFileSync(uri_path+'/'+item);

    });
    res.render('overview', {title:list});

});
module.exports = router;
