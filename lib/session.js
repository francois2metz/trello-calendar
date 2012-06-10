var uuid = require('node-uuid');
var redis = require("redis");

var client = redis.createClient();

exports.middleware = function() {
    return function(req, res, next) {
        /**
         * Store the access token into redis
         * The first parameter of the callback is the uuid for later usage
         */
        req.store = function(accessToken, callback) {
            var id = uuid.v4();
            client.hset(id, "token", accessToken, function(err, result) {
                callback(id, err, result);
            });
        }

        /**
         * Return the access token corresponding to the uuid
         */
        req.getToken = function(id, callback) {
            client.hget(id, "token", callback);
        }
        next();
    }
}
