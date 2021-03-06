# Calendar for Trello

A calendar with all cards shown by due date.

It provides both HTML calendar and ics feeds.

If you have any features suggestion, post on the Trello board: https://trello.com/board/trello-calendar/4f0d53d03ca0f7f83f03cad0.

## Install

Check that you have node and redis.

    npm install

    NODE_ENV=production ./bin/trellocalendar

Go to http://localhost:4000.

## Configuration

Copy *config.json.sample* to *config.json*.

Edit *config.json* and add the current url. Default is *http://localhost:4000*

    "url": "http://localhost:4000"

### Trello

Edit *config.json* and enter the key and secret from https://trello.com/1/appKey/generate.

    "trello": {
      "token": {
        "name": "Calendar for Trello",
        "expiration": "never",
        "scope": "read,write"
      },
      "key": "",
      "secret": ""
    }

### Redis

If you have some specific redis conf, you can also add the *host*, *port* and *pass*.

Add to *config.json*

    "redis": {
         "host": "",
         "port": "",
         "pass": ""
    }

## For old users of the HTML only page

The HTML/JS only page is no more available. If node is not your cup of tea, you can use the tag html-only.

## Disclaimer

Trello is a registered trademark of Fog Creek Software, Inc. This service is not affiliated with Fog Creek Software, Inc.

## License

(c) 2012 François de Metz

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
