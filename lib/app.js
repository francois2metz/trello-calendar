var express = require('express');
var RedisStore = require('connect-redis')(express);
var sts = require('connect-sts');

var Seq = require('seq');
var querystring = require('querystring');

var Models = require('./models');
var generateIcal = require('./calendar').generateIcal;

var app = express.createServer();

var config = JSON.parse(require('fs').readFileSync(__dirname +'/../config.json', 'utf8'));

var trello = require('./trello')(config.trello.key, config.trello.secret);

app.set('view engine', 'jade');

app.use(express.static(__dirname + '/../public'));
app.use(express.cookieParser());
app.use(express.bodyParser());
var maxAge = 3600000 * 24 * 30 * 12;
app.use(sts(maxAge, false));
app.use(express.session({secret: config.trello.secret,
                         cookie: {maxAge: maxAge},
                         store: new RedisStore(config.redis)}));
app.use(require('./session').middleware(config));
app.use(trello.middleware());
app.use(require('connect-assets')({src: __dirname +'/../assets'}));
app.use(app.router);

app.set('views', __dirname + '/views');

app.configure('development', function() {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

/**
 * Index page
 */
app.get('/', function(req, res) {
    if (req.trello) {
        res.render('index_logged', {uuid: req.session.uuid});
    } else {
        res.render('index_unlogged',{https: req.protocol == 'https'});
    }
});

/**
 * Start the authentication dance
 */
app.get('/login', function(req, res) {
    trello.requestToken(function(error, token, tokenSecret) {
        if (error) return res.send("error", 500);
        req.session.tokenSecret = tokenSecret;
        res.redirect(trello.redirect(token, {
            name: 'Trello calendar',
            expiration: 'never',
            scope: 'read,write',
            return_url: config.url+'/login/callback'
        }));
    });
});

/**
 * OAuth callback
 */
app.get('/login/callback', function(req, res) {
    trello.accessToken(req.query.oauth_token,
                       req.session.tokenSecret,
                       req.query.oauth_verifier,
                       function(error, token, tokenSecret) {
                           if (error) return res.send("error", 500);
                           req.store(token, function(id, error, result) {
                               if (error) return res.send("error", 500);
                               req.session.uuid = id;
                               res.redirect('/');
                           });
                       });
});

/**
 * Unauthorize the application
 */
app.delete('/deauthorize', function(req, res) {
    if (!req.trello) return res.send("no session", 401);
    req.trello.del('/tokens/'+ req.accessToken, function(err, data) {
        if (err) return res.send("error", 500);
        req.remove(req.session.uuid, function(err) {
            if (err) return res.send("redis error", 500);
            req.session.uuid = null;
            res.send("", 204);
        });
    });
});

/**
 * Trello proxy
 * We don't want to expose all operations, except read operations
 */
app.get(/\/trello\/(.+)/, function(req, res) {
    if (!req.trello) return res.send("no session", 401);
    req.trello.get('/'+ req.params[0], req.query, function(err, data) {
        if (err) return res.send("error", 500);
        res.json(data);
    });
});

/**
 * Only allow update due date on a card
 */
app.put(/\/trello\/cards\/(.+)/, function(req, res) {
    if (!req.trello) return res.send("no session", 401);
    req.trello.put('/cards/'+ req.params[0], {due: req.body.badges.due}, function(err, data) {
        if (err) return res.send("error", 500);
        res.json(data);
    });
});

app.param('uuid', function(req, res, next, uuid) {
    trello.buildFor(uuid, req, next);
});

/**
 * Return the calendar of all boards for the current token
 */
app.get('/calendar/:uuid/all.ics', function(req, res) {
    function error(e) {
        res.send("error", 500);
    }
    if (!req.trello) return error();

    var models = req.trello;

    function fetchCardsAndGenerate(boards) {
        var seq = new Seq(boards.models).parEach(function(board) {
            var self = this;
            board.cards().fetch({
                success: function() { self(); },
                error: error
            });
        }).seq(function() {
            res.charset = 'utf8';
            res.contentType('ics');
            res.send(generateIcal(boards).toString());
        });
    }

    var boards = new models.Boards();
    boards.fetch({
        success: fetchCardsAndGenerate,
        error: error
    });
});

module.exports = app;
