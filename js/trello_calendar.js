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
        only_me: false,
        not_archived: false
    },

    sync: function(method, model, options) {
        if (!window.localStorage) return;
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
 * Current User model
 */
App.model.CurrentUser = Backbone.Model.extend({
    sync: function(method, model, options) {
        if (method == 'read') {
            return Trello.get('/members/me', {}, options.success, options.error);
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
            if (options.not_archived) {
                return Trello.get('/boards/'+ this.options.board.id +'/cards/visible', {badges: true}, options.success, options.error);
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
            return new App.view.Card({model: card,
                                      el: this.el}).render();
        }, this)).filter(function(view) {
            return view;
        }).value();
        return this;
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
        var checked = $(e.target).is(':checked');
        var data = {};
        data[this.options.name] = checked;
        this.model.set(data);
        this.model.save();
        $(this.el).toggleClass('checked');
    },

    render: function() {
        var input = this.make('input', {type: 'checkbox',
                                        value: "onlyme",
                                        checked: this.model.get(this.options.name)});
        $(this.el).text(this.options.label)
                  .addClass((this.model.get(this.options.name) ? 'checked': ''))
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
        var hidden = !$(e.target).is(':checked');
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
        this.currentUser = new App.model.CurrentUser();

        this.prefs = new App.model.Prefs();
        this.prefs.fetch();
        this.prefs.bind('change:only_me', this._updateBoardsVisibility, this);
        this.prefs.bind('change:not_archived', this._getCards, this);

        this.currentUser.fetch().done(_.bind(function() {
            this.boards.fetch();
        }, this));

        this.boards.bind('reset', this._getCards, this);
        this.boards.bind('change:hidden', this._updateBoardVisibility, this);
    },

    render: function() {
        this._createCalendar();
        new App.view.Boards({collection: this.boards,
                             el: this.$('#boards').get(0)}).render();
        new App.view.Cards({collection: this.boards,
                            el: this.$('#calendar').get(0)}).render();
        var filters = [
            new App.view.Filter({model: this.prefs,
                                 name: 'only_me',
                                 label: "Show only cards assigned to me"
                                }),
            new App.view.Filter({model: this.prefs,
                                 name: 'not_archived',
                                 label: "Show only cards not archived"
                                })
        ];
        _(filters).each(_.bind(function(filter) {
            this.$('#prefs').append(filter.render().el);
        }, this));
        return this;
    },

    _updateBoardsVisibility: function() {
        this.boards.each(_.bind(function(board) {
            this._updateBoardVisibility(board);
        }, this));
    },

    _updateBoardVisibility: function(board) {
        board.cards().each(_.bind(function(card) {
            var hidden = board.get('hidden');
            if (!hidden && this.prefs.get('only_me') && !_(card.get('idMembers')).include(this.currentUser.id)) {
                hidden = true;
            }
            card.set({hidden: hidden});
        }, this));
    },

    _getCards: function() {
        this.boards.each(_.bind(function(board) {
            board.cards().bind('reset', _.bind(this._updateBoardVisibility, this, board));
            board.cards().fetch({not_archived: this.prefs.get('not_archived')});
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
