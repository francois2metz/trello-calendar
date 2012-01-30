var App = {
    model: {},
    collection: {},
    view: {},
};

/**
 * Card model
 */
App.model.Card = Backbone.Model.extend({});

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
            $(this.el).fullCalendar('renderEvent', {
                id: this.model.id,
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
    Trello.authorize({
        interactive: false,
        success: onAuthorize
    });

    if (!Trello.authorized()) {
        return Trello.authorize({ success: onAuthorize });
    }

    var calendar = $('#calendar').fullCalendar({
        height: $(document).height() - 50
    });
    $(window).resize(function() {
        calendar.fullCalendar('option', 'height', $(document).height() - 50);
    });

    var currentUser;
    var boards = new App.collection.Boards();
    var cards = new App.collection.Cards();

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
        if (!Trello.authorized()) return Trello.authorize({ success: onAuthorize });

        Trello.members.get('me').done(showMe);
    }
});
