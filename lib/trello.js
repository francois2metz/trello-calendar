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
        requestToken: function(callback) {
            return oa.getOAuthRequestToken(callback);
        },

        redirect: function(token, params) {
            params.oauth_token = token;
            var qs = querystring.stringify(params);
            return createUrl('/OAuthAuthorizeToken?'+ qs);
        },

        accessToken: function(token, tokenSecret, verifier, callback) {
            oa.getOAuthAccessToken(token,
                                   tokenSecret,
                                   verifier,
                                   callback);
        },

        middleware: function() {
            return function(req, res, next) {
                if (req.session.accessToken) {
                    req.trello = Models.buildFor(clientId,
                                                 req.session.accessToken);
                }
                next();
            };
        }
    }
}
