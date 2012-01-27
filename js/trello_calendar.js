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
                        calendar.fullCalendar('renderEvent', {
                            id: card.id,
                            title: card.name,
                            start: card.badges.due,
                            color: _(card.idMembers).include(me.id) ? 'red' : 'green',
                            url: card.url
                        }, true);
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
