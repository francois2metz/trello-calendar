var OAuth = require('oauth').OAuth;
var querystring = require('querystring');

var Models = require('./models');

var baseDomain = 'https://trello.com/1';

function createUrl(url) {
    return baseDomain + url;
}

module.exports = function(clientId, clientSecret) {
    var oa = new OAuth(createUrl('/OAuthGetRequestToken'),
                       createUrl('/OAuthGetAccessToken'),
                       clientId,
                       clientSecret,
                       "1.0",
                       null,
                       "HMAC-SHA1");

    return {
        /**
         * Request the request oAuth token
         */
        requestToken: function(callback) {
            return oa.getOAuthRequestToken(callback);
        },

        /**
         * Create the URL for the oAuth dance
         */
        redirect: function(token, params) {
            params.oauth_token = token;
            var qs = querystring.stringify(params);
            return createUrl('/OAuthAuthorizeToken?'+ qs);
        },

        /**
         * Get the oAuth access token
         */
        accessToken: function(token, tokenSecret, verifier, callback) {
            oa.getOAuthAccessToken(token,
                                   tokenSecret,
                                   verifier,
                                   callback);
        },

        /**
         * Trello middleware to attach trello models to the request
         * Only if the session uuid is found
         */
        middleware: function() {
            var that = this;
            return function(req, res, next) {
                if (req.session.uuid) {
                    that.buildFor(req.session.uuid, req, next);
                } else {
                    next();
                }
            };
        },

        /**
         * Attach the trello models to the request if possible
         */
        buildFor: function(uuid, req, next) {
            req.getToken(uuid,
                         function(err, result) {
                             req.accessToken = result;
                             req.trello = Models.buildFor(clientId,
                                                          result);
                             next();
                         });
        }
    }
}
