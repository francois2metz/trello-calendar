var icalendar = require('icalendar');

exports.generateIcal = function(boards) {
    var ical = new icalendar.iCalendar();
    boards.each(function(board) {
        board.cards().each(function(card) {
            // no arm, no chocolate
            if (!card.get('badges').due) return;
            var event = new icalendar.VEvent();
            event.setSummary(card.get('name'));
            event.setDescription(card.get('description'));
            event.setDate(card.get('badges').due);
            event.addProperty('ATTACH', card.get('url'));
            ical.addComponent(event);
        });
    });
    return ical;
}
