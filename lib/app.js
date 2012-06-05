var express = require('express');
var Seq = require('seq');
var querystring = require('querystring');

var Models = require('./models');
var generateIcal = require('./calendar').generateIcal;

var app = express.createServer();

var config = {
    trello: JSON.parse(require('fs').readFileSync(__dirname +'/../config.json', 'utf8'))
};

var trello = require('./trello')(config.trello.key, config.trello.secret);

app.set('view engine', 'jade');

app.use(express.static(__dirname + '/../public'));
app.use(express.cookieParser());
app.use(express.bodyParser());
app.use(express.session({secret: config.trello.secret}));
app.use(trello.middleware());
app.use(require('connect-assets')());
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
        res.render('index_logged');
    } else {
        res.render('index_unlogged');
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
            expiration: 'never',
            scope: 'read,write',
            return_url: 'http://localhost:4000/login/callback'
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
                           req.session.accessToken = token;
                           res.redirect('/');
                       });
});

/**
 * Trello proxy
 */
app.get(/\/trello\/(.+)/, function(req, res) {
    if (!req.trello) return res.send("no session", 401);
    req.trello.get('/'+ req.params[0], req.query, function(err, data) {
        if (err) return res.send("error", 500);
        res.json(data);
    });
});

/**
 * Return the calendar of all boards for the current token
 *
 * TODO: Generate another token to not expose some security hole
 */
app.get('/calendar/:token.ics', function(req, res) {
    var models = Models.buildFor(config.trello.key,
                                 req.params.token);

    function error(e) {
        res.send("error", 500);
    }

    function fetchCardsAndGenerate(boards) {
        var seq = new Seq(boards.models).parEach(function(board) {
            var self = this;
            board.cards().fetch({
                success: function() { self(); },
                error: error
            });
        }).seq(function() {
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
