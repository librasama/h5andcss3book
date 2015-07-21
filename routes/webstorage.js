var express = require('express');
var router = new express.Router();
router.get('/note', function (req, res, next) {
    res.render('webstorage/noteWithdb', {title:'使用数据库实现留言本'});
});

module.exports = router;