var Backbone = require("backbone");
var Trello = require("node-trello");
var _ = require('underscore');

/**
 * We create objects models for the context of each tokens
 */
function buildFor(key, token) {
    var trello = new Trello(key, token);

    var sync = function(method, model, options) {
        if (method == 'read') {
            var url = _.isFunction(model.url) ? model.url() : model.url;

            trello.get('/1'+ url, function(err, data) {
                if (err) return options.error();
                options.success(data);
            });
        } else {
            throw "method "+ method +" not (yet) supported";
        }
    }

    var exports = {};

    _(['get', 'put', 'post', 'del']).each(function(verb) {
        exports[verb] = function(url, params, callback) {
            trello[verb]('/1'+ url, params, callback);
        };
    });

    /**
     * Current User model
     */
    exports.CurrentUser = Backbone.Model.extend({
        url: '/members/me',

        sync: sync
    });

    /**
     * Card model
     */
    exports.Card = Backbone.Model.extend({
        url: function() {
            return '/cards/'+ this.id;
        },

        sync: sync
    });

    /**
     * Cards collection
     */
    exports.Cards = Backbone.Collection.extend({
        model: exports.Card,

        initialize: function(models, options) {
            this.options = options;
        },

        url: function() {
            return '/boards/'+ this.options.board.id +'/cards';
        },

        sync: sync
    });

    /**
     * Board model
     */
    exports.Board = Backbone.Model.extend({
        initialize: function() {
            this._cards = new exports.Cards([], {board: this});
        },

        cards: function() {
            return this._cards;
        },

        sync: sync
    });

    /**
     * Board collection
     */
    exports.Boards = Backbone.Collection.extend({
        model: exports.Board,

        url: '/members/my/boards',

        sync: sync
    });

    return exports;
};


module.exports = {
    buildFor: buildFor
};
