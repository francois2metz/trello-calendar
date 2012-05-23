var express = require('express');
var Seq = require('seq');

var Models = require('./models');
var generateIcal = require('./calendar').generateIcal;

var app = express.createServer();

app.use(express.static(__dirname + '/../public'));

app.configure('development', function() {
    app.use(express.errorHandler({
        dumpExceptions: true,
        showStack: true
    }));
});

app.configure('production', function() {
    app.use(express.errorHandler());
});

app.get('/calendar/:token', function(req, res) {
    var models = Models.buildFor("80be6f1a85a3b09655f98bb9e3d95809",
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
