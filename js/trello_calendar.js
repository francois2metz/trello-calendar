var App = {
    model: {},
    view: {}
};

/**
 * Card model
 */
App.model.Card = Backbone.Model.extend({});

/**
 * Render a card on fullcalendar
 */
App.view.Card = Backbone.View.extend({
    render: function() {
        $(this.el).fullCalendar('renderEvent', {
            id: this.model.id,
            title: this.model.get('name'),
            start: this.model.get('badges').due,
            color: _(this.model.get('idMembers')).include(this.options.me.id) ? 'red' : 'green',
            url: this.model.get('url')
        }, true);
        return true;
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

    function listBoards(me) {
        return function(boards) {
            _(boards).each(function(board) {
                Trello.get('/boards/'+ board.id +'/cards/all', {badges: true}).done(function(cards) {
                    _(cards).each(function(card) {
                        if (!card.badges.due) return;
                        var model = new App.model.Card(card);
                        new App.view.Card({model: model,
                                           me: me,
                                           el: calendar.get(0)}).render();
                    });
                });
            });
        }
    }

    function showMe(me) {
        Trello.get('/members/my/boards', {filter: 'open'}).done(listBoards(me));
    }

    function onAuthorize() {
        if (!Trello.authorized()) return Trello.authorize({ success: onAuthorize });

        Trello.members.get('me').done(showMe);
    }
});
