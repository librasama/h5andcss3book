var mongo = require('./mongo.js');

var UserSchema = new mongo.mongoose.Schema({
    uid: String,
    uname : String,
    type : Number
});

var User = mongo.mongoose.model('user', UserSchema);
var UserDAO = function(){};

UserDAO.prototype.list = function(cb) {
    User.find({}, function(err, doc){
        if(err) throw err;
        cb(doc);
    });
};

UserDAO.prototype.upd = function() {

};

UserDAO.prototype.add = function(obj, cb) {
    var instance = new User(obj);
    instance.save(null, function(cb){
        cb();
    });
}

module.exports = new UserDAO();
