var mongodb = require('mongoose');
mongodb.connect("mongodb://localhost/historyapi");
module.exports.mongoose = mongodb;