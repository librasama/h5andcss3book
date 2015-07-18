var express = require('express');
var router = new express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
    user.list(function(usrs){
        res.render('index', { title: '�û�ϵͳ', 'users':usrs});
    });
});

router.get('/info', function(req, res, next){
    res.render('readOnly', {title:'�鿴�û���Ϣ'});
});

router.get('/edit', function(req, res, next){
    res.render('edit', {title:'�鿴�û���Ϣ'});
});

router.get('/readOnly', function(req, res, next){
    res.render('readOnly', {title:'�鿴�û���Ϣ'});
});

router.get('/ws',function(req, res, next) {
    res.render('webStore', {title:'sessionStore����'});
});


router.get('/note',function(req, res, next) {
    res.render('notebook', {title:'web�����Ա�'});
});


router.get('/easydb', function(req, res, next){
    res.render('easydb', {title:'�������ݿ�'});
});

router.get('/watchStorage', function(req, res, next){
    res.render('watchStorage', {title:'�޸�web storage�е�����'});
});

module.exports = router;
