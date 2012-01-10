$(document).ready(function() {
    Trello.authorize({
        type: "popup",
        success: onAuthorize
    });

    var calendar = $('#calendar').fullCalendar({});

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
                            color: _(card.idMembers).include(me.id) ? 'red' : 'green'
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
        if (!Trello.authorized()) return Trello.authorize();

        Trello.members.get('me').done(showMe);
    }
});
