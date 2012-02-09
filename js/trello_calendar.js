var App = {
    model: {},
    collection: {},
    view: {},
};

/**
 * Pref model
 * Stored in localStorage
 */
App.model.Prefs = Backbone.Model.extend({
    defaults: {
        only_me: false
    },

    sync: function(method, model, options) {
        if (method == 'create' || method == 'update') {
            localStorage.setItem('prefs', JSON.stringify(model.toJSON()));
        } else if (method == 'read') {
            var prefs = localStorage.getItem('prefs');
            if (prefs) {
                try {
                    prefs = JSON.parse(prefs);
                } catch(e) {}
                options.success(prefs);
            }
        } else {
            throw "not (yet) supported";
        }
    }
});

/**
 * Card model
 */
App.model.Card = Backbone.Model.extend({
    sync: function(method, model, options) {
        if (method == 'update') {
            // only support update due date
            return Trello.put('/cards/'+ model.id, {due: model.get('badges').due}, options.success, options.error);
        } else {
            throw "not (yet) supported";
        }
    }
});

/**
 * Cards collection
 */
App.collection.Cards = Backbone.Collection.extend({
    model: App.model.Card,

    initialize: function(models, options) {
        this.options = options;
    },

    sync: function(method, model, options) {
        if (method == 'read') {
            if (options.only_me) {
                return Trello.get('/members/me/cards/all', {badges: true}, options.success, options.error);
            } else {
                return Trello.get('/boards/'+ this.options.board.id +'/cards/all', {badges: true}, options.success, options.error);
            }
        } else {
            throw "not (yet) supported";
        }
    }
});

/**
 * Board model
 */
App.model.Board = Backbone.Model.extend({
    defaults: {
        hidden: false
    },

    initialize: function() {
        this._initFromLocalStorage();
        this.bind('change:hidden', this._saveStateToLocalStorage, this);
        this._cards = new App.collection.Cards([], {board: this});
    },

    cards: function() {
        return this._cards;
    },

    _initFromLocalStorage: function() {
        var value = this._getValue("false");
        if (value === "true" || value === "false") {
            this.set({hidden: (value === "true")});
        }
    },

    _saveStateToLocalStorage: function() {
        if (!window.localStorage) return;
        var key = 'board-state-'+ this.id +"-hidden";
        var value = window.localStorage.setItem(key, this.get('hidden'));
    },

    _getValue: function(defaultValue) {
        if (!window.localStorage) return defaultValue;
        var key = 'board-state-'+ this.id +"-hidden";
        var value = window.localStorage.getItem(key);
        if (value === null)
            return defaultValue;
        return value;
    }
});

/**
 * Board collection
 */
App.collection.Boards = Backbone.Collection.extend({
    model: App.model.Board,

    sync: function(method, model, options) {
        if (method == 'read') {
            return Trello.get('/members/my/boards', {filter: 'open'}, options.success, options.error);
        } else {
            throw "not (yet) supported";
        }
    }
});

/**
 * Render a card on fullcalendar
 */
App.view.Card = Backbone.View.extend({
    initialize: function() {
        this.model.bind('change', this.render, this);
    },

    render: function() {
        if (this.model.get('hidden')) {
            $(this.el).fullCalendar('removeEvents', this.model.id);
        } else {
            $(this.el).fullCalendar('removeEvents', this.model.id);
            var color = "#"+this.model.get('idBoard').substr(0, 6);
            $(this.el).fullCalendar('renderEvent', {
                backboneModel: this.model,
                id: this.model.id,
                allDay: false,
                title: this.model.get('name'),
                start: this.model.get('badges').due,
                color: color,
                url: this.model.get('url')
            }, true);
        }
        return this;
    },

    remove: function() {
        $(this.el).fullCalendar('removeEvents', this.model.id);
    }
});

/**
 * Render cards of one board
 */
App.view.CardsBoard = Backbone.View.extend({
    initialize: function() {
        this.views = [];
        this.model.bind('change:hidden', this._toggleVisibily, this);
        this.model.cards().bind('reset', this.render, this);
    },

    render: function() {
        // remove previously events
        _(this.views).each(function(view) {
            view.remove();
        });
        this.views = this.model.cards().chain().map(_.bind(function(card) {
            // no arm, no chocolate
            if (!card.get('badges').due) return;
            card.set({hidden: this.model.get('hidden')});
            return new App.view.Card({model: card,
                                      el: this.el}).render();
        }, this)).filter(function(view) {
            return view;
        }).value();
        return this;
    },

    _toggleVisibily: function() {
        var model = this.model;
        this.model.cards().each(function(card) {
            card.set({hidden: model.get('hidden')});
        });
    }
});

/**
 * Render all cards from all boards
 */
App.view.Cards = Backbone.View.extend({
    initialize: function() {
        this.collection.bind('reset', this.render, this);
    },

    render: function() {
        this.collection.each(_.bind(function(board) {
            new App.view.CardsBoard({model: board,
                                     el: this.el}).render();
        }, this));
        return this;
    }

});

App.view.Filter = Backbone.View.extend({
    events: {
        "click input": "click"
    },

    tagName: 'label',

    click: function(e) {
        var only_me = false;
        if ($(e.target).is(':checked')) {
            only_me = true;
        }
        this.model.set({only_me: only_me});
        this.model.save();
        $(this.el).toggleClass('checked');
    },

    render: function() {
        var input = this.make('input', {type: 'checkbox',
                                        value: "onlyme",
                                        checked: this.model.get('only_me')});
        $(this.el).text("Show only cards assigned to me")
                  .addClass((this.model.get('only_me') ? 'checked': ''))
                  .append(input);
        return this;
    }
});

/**
 * Render a board filter
 */
App.view.Board = Backbone.View.extend({
    events: {
        "click input": "click"
    },

    tagName: 'label',

    click: function(e) {
        var hidden = true;
        if ($(e.target).is(':checked')) {
            hidden = false;
        }
        this.model.set({hidden: hidden});
        $(this.el).toggleClass('checked');
    },

    render: function() {
        var input = this.make('input', {type: 'checkbox',
                                        value: this.model.id,
                                        checked: !this.model.get('hidden')});
        var color = "#"+this.model.id.substr(0, 6);
        $(this.el).css({'background-color': color})
                  .attr('title', 'Show cards from the board '+  this.model.get('name'))
                  .text(this.model.get('name'))
                  .append(input);
        if (!this.model.get('hidden') === true)
            $(this.el).addClass('checked');
        return this;
    }
});

/**
 * List of boards filters
 */
App.view.Boards = Backbone.View.extend({
    initialize: function() {
        this.collection.bind('reset', this.render, this);
    },

    render: function() {
        this.collection.each(_.bind(function(board) {
            var view = new App.view.Board({model: board}).render();
            $(view.el).appendTo(this.el);
        }, this));
    }
});

/**
 * Main view
 */
App.view.Calendar = Backbone.View.extend({
    initialize: function() {
        this.boards = new App.collection.Boards();
        this.prefs = new App.model.Prefs();
        this.prefs.fetch();
        this.prefs.bind('change', this._getCards, this);

        this.boards.bind('reset', this._getCards, this);
        this.boards.fetch();
    },

    render: function() {
        this._createCalendar();
        new App.view.Boards({collection: this.boards,
                             el: this.$('#boards').get(0)}).render();
        new App.view.Cards({collection: this.boards,
                            el: this.$('#calendar').get(0)}).render();
        var filter = new App.view.Filter({model: this.prefs}).render();
        this.$('#prefs').append(filter.el);
        return this;
    },

    _getCards: function() {
        this.boards.each(_.bind(function(board) {
            board.cards().fetch({only_me: this.prefs.get('only_me')});
        }, this));
    },

    _createCalendar: function() {
        var calendar = this.$('#calendar').fullCalendar({
            header: {
	        left: 'prev,next today',
	        center: 'title',
	        right: 'month,agendaWeek,agendaDay'
	    },
            height: $(document).height() - 50,
            editable: true,
            disableResizing: true,
            ignoreTimezone: false,
            timeFormat: "H'h'(mm)",
            eventDrop: function(event, dayDelta, minuteDelta, allDay, revertFunc) {
                var card = event.backboneModel;
                var date = moment(event.start).format("YYYY-MM-DDTHH:mm:ssZ");
                var badges = _.extend({}, card.get('badges'), {due: date});
                card.set({badges: badges});
                card.save();
            }
        });
        $(window).resize(function() {
            calendar.fullCalendar('option', 'height', $(document).height() - 50);
        });
    }
});

$(document).ready(function() {
    var defaultOptions = {
        scope: {
            write: true
        },
        success: onAuthorize
    };
    /**
     * Authentication dance
     *  1. try to get a token from a previous session
     *  2. if no authorized token found, ask a token
     *  3. start application
     */
    Trello.authorize(_.extend({}, defaultOptions, {
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }

    function onAuthorize() {
        if (!Trello.authorized()) return Trello.authorize(defaultOptions);
        new App.view.Calendar({el: $('body').get(0)}).render();
    }
});
