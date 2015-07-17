var user = require('../models/User.js');
var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  user.list(function(usrs){
    res.render('index', { title: '用户系统', 'users':usrs});
  });
});

router.get('/info', function(req, res, next){
  res.render('readOnly', {title:'查看用户信息'});
});

router.get('/edit', function(req, res, next){
  res.render('edit', {title:'查看用户信息'});
});

router.get('/readOnly', function(req, res, next){
  res.render('readOnly', {title:'查看用户信息'});
});

router.get('/ws',function(req, res, next) {
  res.render('webStore', {title:'sessionStore测试'});
});


router.get('/note',function(req, res, next) {
  res.render('notebook', {title:'web简单留言本'});
});


router.get('/easydb', function(req, res, next){
  res.render('easydb', {title:'简易数据库'});
});

router.get('/watchStorage', function(req, res, next){
  res.render('watchStorage', {title:'修改web storage中的数据'});
});

module.exports = router;
