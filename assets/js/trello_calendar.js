var App = {
    model: {},
    collection: {},
    view: {},
    router: {}
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

    initialize: function(attrs, options) {
        this.options = options;
    },

    sync: function(method, model, options) {
        if (!window.localStorage) return;
        var item_name = this.options.key;
        if (method == 'create' || method == 'update') {
            localStorage.setItem(item_name, JSON.stringify(model.toJSON()));
        } else if (method == 'read') {
            var prefs = localStorage.getItem(item_name);
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
                card_url: this.model.get('url')
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
        "click input": "click"
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

App.view.SelectOption = Backbone.View.extend({
    events: {
        "change": "change"
    },

    tagName: 'li',

    change: function(e) {
        e.stopPropagation();

        var value = $(e.target).val();
        this.model.set(this.options.name, value);
        this.model.save();
    },

    render: function() {
        var current_value = this.model.get(this.options.name);
        var options = _(this.options.options).map(_.bind(function(key, value) {
            return this.make('option', {value: value, selected: value == current_value}, key);
        }, this));
        var select = this.make('select', {type: 'checkbox'}, options);
        var span = this.make('span', {}, this.options.label);
        var label = $(this.make('label')).append(select).append(span);
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
            this.$('label').append(this.make('img', {src: 'img/spinner.gif'}));
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
            this.$el.append(view.el);
        }, this));
    }
});

/**
 * Calendar view
 */
App.view.Calendar = Backbone.View.extend({
    initialize: function() {
        this.boards = this.collection;
        this.currentUser = this.options.currentUser;

        this.prefs = new App.model.Prefs({}, {key: 'prefs'});
        this.prefs.fetch();
        this.prefs.on('change:only_me', this._updateBoardsVisibility, this);
        this.prefs.on('change:not_archived', this._getCards, this);
        this.prefs.on('change:first_day_of_week', this._updateFirstDayOfWeek, this);

        this.boards.on('reset', this._getCards, this);
        this.boards.on('change:hidden', this._updateBoardVisibility, this);
    },

    render: function() {
        this._createCalendar();
        this._renderBoards();
        this._renderCards();
        this._renderFilters();
        return this;
    },

    _renderBoards: function() {
        new App.view.Boards({collection: this.boards,
                             el: this.$('.boards').get(0)}).render();
    },

    _renderCards: function() {
        new App.view.Cards({collection: this.boards,
                            el: this.$('.content').get(0)}).render();
    },

    _renderFilters: function() {
        var filters = [
            new App.view.Filter({
                model: this.prefs,
                name: 'only_me',
                label: "Show only cards assigned to me"
            }),
            new App.view.Filter({
                model: this.prefs,
                name: 'not_archived',
                label: "Hide archived cards"
            }),
            new App.view.SelectOption({
                model: this.prefs,
                name: 'first_day_of_week',
                options: {
                    0: "Sunday",
                    1: "Monday",
                    2: "Tuesday",
                    3: "Wednesday",
                    4: "Thursday",
                    5: "Friday",
                    6: "Saturday"
                },
                label: "First day of the week"
            })
        ];
        _(filters).each(_.bind(function(filter) {
            this.$('.options').append(filter.render().el);
        }, this));
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

    _updateFirstDayOfWeek: function() {
        // full calendar doesn't allow to update dynamically the first of the
        // week. So we destroy the calendar and rerender it.
        this._destroyAndReRender();
    },

    _getFirstDayOfTheWeek: function() {
        return this.prefs.get('first_day_of_week');
    },

    /**
     * Apocalypse!
     */
    _destroyAndReRender: function() {
        this.$('.content').fullCalendar('destroy');
        this._createCalendar();
        this._renderCards();
    },

    _createCalendar: function() {
        var calendar = this.$('.content').fullCalendar({
            header: {
	        left: 'prev,next today',
	        center: 'title',
	        right: 'month,agendaWeek,agendaDay'
	    },
            height: $(document).height() - 20,
            editable: true,
            disableResizing: true,
            ignoreTimezone: false,
            firstDay: this._getFirstDayOfTheWeek(),
            timeFormat: "H'h'(mm)",
            eventClick: function(calEvent, jsEvent, view) {
                window.open(calEvent.card_url, "_blank");
                return false;
            },
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
            calendar.fullCalendar('option', 'height', $(document).height() - 20);
        });
    }
});

/**
 * Feed view
 */
App.view.Feed = Backbone.View.extend({
    events: {
        "click input": "selectAll"
    },

    initialize: function() {
        this.prefs = new App.model.Prefs({}, {key: 'feed_prefs'});
        this.prefs.fetch();
        this.collection.on('reset', this._renderBoards, this);
        this.prefs.on('change', this.render, this);
    },

    render: function() {
        this._renderOptions();
        this._renderIcsUrl();
        this._renderBoards()
    },

    _renderOptions: function() {
        this.$('.options').empty();
        var options = [
            new App.view.Filter({
                model: this.prefs,
                name: 'only_me',
                label: "Show only cards assigned to me"
            }),
            new App.view.SelectOption({
                model: this.prefs,
                name: 'alarm',
                options: {
                    "-1": "No reminder",
                    "PT0s": "0 minute before",
                    "-PT5M": "5 minutes before",
                    "-PT15M": "15 minutes before",
                    "-PT30M": "30 minutes before",
                    "-PT60M": "1 hour before",
                    "-PT1D": "1 day before"
                },
                label: "Reminder"
            })
        ];
        _(options).each(_.bind(function(option) {
            this.$('.options').append(option.render().el);
        }, this));
    },

    _renderIcsUrl: function() {
        this.$('input').val(this._formatIcsUrl('all'));
    },

    _formatIcsUrl: function(type) {
        var uuid = this.$('#ics').data('uuid');
        var url = document.location.protocol +'//'+ document.location.host;
        var path = '/calendar/'+ uuid +'/'+ type +'.ics?'+ $.param(this.prefs.toJSON());
        return url + path;
    },

    _renderBoards: function() {
        this.$('.boards').empty();
        this.collection.each(_.bind(this._renderBoard, this));
    },

    _renderBoard: function(board) {
        var input = this.make('input', {'class': 'span9', type: 'text', readonly: 'readonly', value:this._formatIcsUrl(board.id)});
        var title = this.make('strong', {'class': 'span3'}, board.get('name'));
        var div = this.make('div', {'class': 'row-fluid'});
        this.$('.boards').append($(div).append(title).append(input));
    },

    selectAll: function(e) {
        e.target.select();
    }
});

App.view.CurrentUser = Backbone.View.extend({
    events: {
        'click .quit': 'quit'
    },

    quit: function(e) {
        e.preventDefault();
        $.ajax({
            type: 'DELETE',
            url: '/deauthorize',
            success: function() {
                location.reload();
            }
        });
    },

    render: function() {
        this.$('.name').text(this.model.get('fullName'));
        return this;
    }
});

App.router.TrelloRouter = Backbone.Router.extend({
    routes: {
        ""      : "calendar",
        "/feed" : "feed"
    },

    initialize: function(options) {
        this.currentUser = options.currentUser;
        this.boards = new App.collection.Boards();
        this.boards.fetch();
    },

    render: function() {
        this.calendar =  new App.view.Calendar({
            el: $('#calendar').get(0),
            collection: this.boards,
            currentUser: this.currentUser
        }).render();
        this.feed = new App.view.Feed({
            el: $('#feed').get(0),
            collection: this.boards,
            currentUser: this.currentUser
        }).render();
        new App.view.CurrentUser({
            el: $('#me').get(0),
            model: this.currentUser
        }).render();
    },

    calendar: function() {
        this._showPane('calendar');
    },

    feed: function() {
        this._showPane('feed');
    },

    _showPane: function(pane) {
        $('#switch .active').removeClass('active');
        $('#switch .'+pane).addClass('active');
        $('#'+ pane).show();
        _(['calendar', 'feed']).chain().without(pane).each(function(pane) {
            $('#'+ pane).hide();
        });
    }
});
(function() {
    var currentUser = new App.model.CurrentUser();
    var router = new App.router.TrelloRouter({currentUser: currentUser});
    $(document).ready(function() {
        currentUser.fetch().done(function() {
            router.render();
            Backbone.history.start();
        }).fail(function(xhr) {
            $('<p>').text('Trello error: try to reload the page').appendTo($('body'));
        });
    });
})();
