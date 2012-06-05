var App = {
    model: {},
    collection: {},
    view: {},
};

/**
 * My extension to backbone models
 * Take a value and return the color value
 * no magic here, the value should be like an id (eg: 4ef2f3d5fba0375c241b69a8)
 */
Backbone.Model.prototype.valueToColor = function(value) {
    return "#"+ value.substr(0, 6);
}

/**
 * Prefs model
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
    url: '/trello/members/me'
});

/**
 * Card model
 */
App.model.Card = Backbone.Model.extend({
    url: function() {
        return '/trello/cards/'+ this.id;
    },

    boardColor: function() {
        return this.valueToColor(this.get('idBoard'));
    }
});

/**
 * Cards collection
 */
App.collection.Cards = Backbone.Collection.extend({
    model: App.model.Card,

    url: function() {
        return '/trello/boards/'+ this.options.board.id +'/cards';
    },

    initialize: function(models, options) {
        this.options = options;
    },

    fetch: function(options) {
        (options = options || {});
        var filter = options.not_archived ? 'visible' : 'all';
        options.data = _.extend({}, options.data, {badges: true,
                                                   filter: filter});
        return Backbone.Collection.prototype.fetch.call(this, options);
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
        this.on('change:hidden', this._saveStateToLocalStorage, this);
        this._cards = new App.collection.Cards([], {board: this});
    },

    cards: function() {
        return this._cards;
    },

    color: function() {
        return this.valueToColor(this.id);
    },

    _initFromLocalStorage: function() {
        var value = this._getValue("false");
        this.set({hidden: (value === "true")});
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

    url: '/trello/members/my/boards',

    fetch: function(options) {
        (options = options || {});
        options.data = _.extend({}, options.data, {filter: 'open'});
        return Backbone.Collection.prototype.fetch.call(this, options);
    }
});

/**
 * Render a card on fullcalendar
 */
App.view.Card = Backbone.View.extend({
    initialize: function() {
        this.model.on('change', this.render, this);
    },

    render: function() {
        if (this.model.get('hidden')) {
            this.$el.fullCalendar('removeEvents', this.model.id);
        } else {
            this.$el.fullCalendar('removeEvents', this.model.id);
            this.$el.fullCalendar('renderEvent', {
                backboneModel: this.model,
                id: this.model.id,
                allDay: false,
                title: this.model.get('name'),
                start: this.model.get('badges').due,
                color: this.model.boardColor(),
                url: this.model.get('url')
            }, true);
        }
        return this;
    },

    remove: function() {
        this.$el.fullCalendar('removeEvents', this.model.id);
    }
});

/**
 * Render cards of one board
 */
App.view.CardsBoard = Backbone.View.extend({
    initialize: function() {
        this.views = [];
        this.model.cards().on('reset', this.render, this);
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
        this.collection.on('reset', this.render, this);
    },

    render: function() {
        this.collection.each(_.bind(function(board) {
            new App.view.CardsBoard({model: board,
                                     el: this.el}).render();
        }, this));
        return this;
    }

});

/**
 * Render a generic filter
 */
App.view.Filter = Backbone.View.extend({
    events: {
        "click": "click"
    },

    tagName: 'li',

    click: function(e) {
        e.stopPropagation();

        var checked = $(e.target).is(':checked');
        this.model.set(this.options.name, checked);
        this.model.save();
        this.$el.toggleClass('checked');
    },

    render: function() {
        var input = this.make('input', {type: 'checkbox',
                                        checked: this.model.get(this.options.name)});
        this.$el.addClass((this.model.get(this.options.name) ? 'checked': ''));
        var span = this.make('span', {}, this.options.label);
        var label = $(this.make('label')).append(input).append(span);
        this.$el.append(label);
        return this;
    }
});

/**
 * Render a board filter
 */
App.view.Board = Backbone.View.extend({
    events: {
        "click": "click"
    },

    tagName: 'li',

    initialize: function() {
        this.model.on('change:waiting', this._renderWaiting, this);
    },

    click: function(e) {
        e.stopPropagation();

        if (e.target != this.$('input').get(0)) return;

        var hidden = !$(e.target).is(':checked');
        console.log(e, hidden);
        this.model.set({hidden: hidden});
        if (hidden)
            this.$('.square').css({'background-color': ''});
        else
            this.$('.square').css({'background-color': this.model.color()});
    },

    render: function() {
        var label = this.make('label');
        var input = this.make('input', {type: 'checkbox',
                                        name: this.model.id,
                                        value: this.model.id,
                                        checked: !this.model.get('hidden')});
        var box = this.make('span', {'class': 'square'});

        var span = this.make('span', {}, this.model.get('name'));

        $(label).attr('title', 'Show cards from the board '+  this.model.get('name'))
                .append(input)
                .append(box)
                .append(span);

        if (!this.model.get('hidden') === true)
            $(box).css({'background-color': this.model.color()});
        this.$el.append(label);
        this._renderWaiting();
        return this;
    },

    _renderWaiting: function() {
        if (this.model.get('waiting')) {
            this.$el.prepend(this.make('img', {src: 'img/spinner.gif'}));
        } else {
            this.$('img').remove();
        }
    }
});

/**
 * List of boards filters
 */
App.view.Boards = Backbone.View.extend({
    initialize: function() {
        this.collection.on('reset', this.render, this);
    },

    render: function() {
        this.collection.each(_.bind(function(board) {
            var view = new App.view.Board({model: board}).render();
            this.$('.dropdown-menu').append(view.el);
        }, this));
    }
});

/**
 * Main view
 */
App.view.Calendar = Backbone.View.extend({
    events: {
        'click .quit': 'quit'
    },

    initialize: function() {
        this.boards = new App.collection.Boards();
        this.currentUser = this.options.currentUser;

        this.prefs = new App.model.Prefs();
        this.prefs.on('change:only_me', this._updateBoardsVisibility, this);
        this.prefs.on('change:not_archived', this._getCards, this);
        this.prefs.fetch();

        this.boards.on('reset', this._getCards, this);
        this.boards.on('change:hidden', this._updateBoardVisibility, this);
        this.boards.fetch();
    },

    render: function() {
        this._createCalendar();
        new App.view.Boards({collection: this.boards,
                             el: this.$('.filters .boards').get(0)}).render();
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
            this.$('.options .dropdown-menu').append(filter.render().el);
        }, this));

        this._renderCurrentUser();
        return this;
    },

    _renderCurrentUser: function() {
        this.$('.me .name').text(this.currentUser.get('fullName'));
    },

    quit: function(e) {
        e.preventDefault();
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
            board.set({waiting: true});
            board.cards().on('reset', _.bind(this._updateBoardVisibility, this, board));
            board.cards().fetch({
                not_archived: this.prefs.get('not_archived'),
                success: function() {
                    board.set({waiting: false});
                }
            });
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
            eventAfterRender: function(event, element, view) {
                $(element).attr('title', event.backboneModel.get('desc'));
            },
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
    var currentUser = new App.model.CurrentUser();
    currentUser.fetch().done(function() {
        new App.view.Calendar({
            el: $('body').get(0),
            currentUser: currentUser
        }).render();
    }).fail(function(xhr) {
        $('<p>').text('Trello error: try to reload the page').appendTo($('body'));
    });
});
