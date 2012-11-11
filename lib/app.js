function trelloCalendarApp(config) {
    var express = require('express');
    var Seq = require('seq');
    var generateIcal = require('./calendar').generateIcal;
    var _ = require('underscore');

    var app = express.createServer();

    app.set('view engine', 'jade');
    app.set('views', __dirname + '/views');

    app.use(express.static(__dirname + '/../public'));
    app.use(require('connect-assets')({src: __dirname +'/../assets'}));

    function sendError(res) {
        app.emit('error');
        res.send("error", 500);
    }

    /**
     * Index page
     */
    app.get('/', function(req, res) {
        if (req.trello) {
            app.emit('rootLogged');
            res.render('index_logged', {logged: true, uuid: req.session.uuid, config: config});
        } else {
            app.emit('rootUnlogged');
            res.render('index_unlogged', {logged: false, https: req.protocol == 'https', config: config});
        }
    });

    /**
     * Trello proxy
     * We don't want to expose all operations, except read one
     */
    app.get(/\/trello\/(.+)/, function(req, res) {
        if (!req.trello) return res.send("no session", 401);
        req.trello.get('/'+ req.params[0], req.query, function(err, data) {
            if (err) return sendError(res);
            app.emit('trelloApiGet');
            res.json(data);
        });
    });

    /**
     * Only allow update due date on a card
     */
    app.put(/\/trello\/cards\/(.+)/, function(req, res) {
        if (!req.trello) return res.send("no session", 401);
        req.trello.put('/cards/'+ req.params[0], {due: req.body.badges.due}, function(err, data) {
            if (err) return sendError(res);
            app.emit('trelloApiPut');
            res.json(data);
        });
    });

    app.param('uuid', function(req, res, next, uuid) {
        var trello = require('trello_baseapp/lib/trello')(config.trello.key, config.trello.secret);
        trello.buildFor(uuid, req, next);
    });

    /**
     * Return the calendar of all boards for the current token
     */
    app.get('/calendar/:uuid/all.ics', function(req, res) {
        function error(e) {
            sendError(res);
        }
        if (!req.trello) return error();

        app.emit('calendarAll');
        app.emit('calendar');

        var models = req.trello;

        function fetchCardsAndGenerate(boards) {
            var seq = new Seq(boards.models).parEach(function(board) {
                board.cards().fetch({
                    success: function() { this(); }.bind(this),
                    error: error
                });
            }).seq(function() {
                res.charset = 'utf8';
                res.contentType('ics');
                res.send(generateIcal(currentUser, boards, req.query).toString());
            });
        }

        function fetchBoards() {
            var boards = new models.Boards();
            boards.fetch({
                success: fetchCardsAndGenerate,
                error: error
            });
        }

        var currentUser = new models.CurrentUser();
        currentUser.fetch({
            success: fetchBoards,
            error: error
        });
    });

    /**
     * Return the calendar for a board
     */
    app.get('/calendar/:uuid/board/:board/:name.ics', function(req, res) {
        function error(e) {
            sendError(res);
        }
        if (!req.trello) return error();

        app.emit('calendarBoard');
        app.emit('calendar');

        var models = req.trello;

        function fetchCardsAndGenerate() {
            var board = new models.Board({id: req.params.board})
            board.cards().fetch({
                success: function() {
                    res.charset = 'utf8';
                    res.contentType('ics');
                    res.send(generateIcal(currentUser, _([board]), req.query).toString());
                },
                error: error
            });
        }

        var currentUser = new models.CurrentUser();
        currentUser.fetch({
            success: fetchCardsAndGenerate,
            error: error
        });
    });

    return app;
}

module.exports = trelloCalendarApp;
