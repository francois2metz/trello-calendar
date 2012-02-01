var App = {
    model: {},
    collection: {},
    view: {},
};

/**
 * Card model
 */
App.model.Card = Backbone.Model.extend({
    sync: function(method, model, options) {
        if (method == 'update') {
            // only support update due date
            Trello.put('/cards/'+ model.id, {due: model.get('badges').due}, options.success, options.error);
        }

    }
});

/**
 * Cards collection
 */
App.collection.Cards = Backbone.Collection.extend({});

/**
 * Board model
 */
App.model.Board = Backbone.Model.extend({});

/**
 * Board collection
 */
App.collection.Boards = Backbone.Collection.extend({});

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
            $(this.el).fullCalendar('renderEvent', {
                id: this.model.id,
                allDay: false,
                title: this.model.get('name'),
                start: this.model.get('badges').due,
                color: _(this.model.get('idMembers')).include(this.options.me.id) ? 'red' : 'green',
                url: this.model.get('url')
            }, true);
        }
        return this;
    }
});

App.view.Board = Backbone.View.extend({
    events: {
        "click input": "click"
    },

    tagName: 'label',

    click: function(e) {
        var hidden = true;
        if ($(e.target).is(':checked')) {
            hidden = false
        }
        this.model.set({hidden: hidden});
    },

    render: function() {
        var input = this.make('input', {type: 'checkbox',
                                        value: this.model.id,
                                        checked: true});
        $(this.el).text(this.model.get('name')).append(input);
        return this;
    }
});

$(document).ready(function() {
    var defaultOptions = {
        scope: {
            write: true
        },
        success: onAuthorize
    }
    Trello.authorize(_.extend({}, defaultOptions, {
        interactive: false
    }));

    if (!Trello.authorized()) {
        return Trello.authorize(defaultOptions);
    }

    var currentUser;
    var boards = new App.collection.Boards();
    var cards = new App.collection.Cards();

    var calendar = $('#calendar').fullCalendar({
        header: {
	    left: 'prev,next today',
	    center: 'title',
	    right: 'month,agendaWeek,agendaDay'
	},
        height: $(document).height() - 50,
        editable: true,
        disableResizing: true,
        ignoreTimezone: false,
        eventDrop: function(event, dayDelta, minuteDelta, allDay, revertFunc) {
            var card = cards.get(event.id);
            var date = moment(event.start).format("YYYY-MM-DDTHH:mm:ssZ");
            var badges = _.extend({}, card.get('badges'), {due: date});
            card.set({badges: badges});
            card.save();
        }
    });
    $(window).resize(function() {
        calendar.fullCalendar('option', 'height', $(document).height() - 50);
    });

    function renderCard(card) {
        new App.view.Card({model: card,
                           me: currentUser,
                           el: calendar.get(0)}).render();
    }

    function renderBoard(board) {
        var view = new App.view.Board({model: board}).render();
        $(view.el).appendTo($('#boards'));
        board.bind('change:hidden', function() {
            cards.chain().filter(function(card) {
                return card.get('idBoard') == board.id;
            }).each(function(card) {
                card.set({hidden: board.get('hidden')});
            });
        });
    }

    cards.bind('add', renderCard);
    boards.bind('add', renderBoard);

    function listBoards(me) {
        return function(tBoards) {
            _(tBoards).each(function(board) {
                boards.add(new App.model.Board(board));
                Trello.get('/boards/'+ board.id +'/cards/all', {badges: true}).done(function(tCards) {
                    _(tCards).each(function(card) {
                        if (!card.badges.due) return;
                        cards.add(new App.model.Card(card));
                    });
                });
            });
        }
    }

    function showMe(me) {
        currentUser = me;
        Trello.get('/members/my/boards', {filter: 'open'}).done(listBoards(me));
    }

    function onAuthorize() {
        if (!Trello.authorized()) return Trello.authorize(defaultOptions);

        Trello.members.get('me').done(showMe);
    }
});
