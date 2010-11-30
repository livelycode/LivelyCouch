LivelyCouch
=====

LivelyCouch is a framework that integrates Node.js with CouchDB and is driven by HTTP events. It is designed to fill the gap between CouchApps and a full-fledged web application.
All your LivelyCouch applications can be stored in CouchDB and replicated just like CouchApps.

LivelyCouch takes the event-model of Node.js to the HTTP layer, allowing you to write small decoupled Workers that only communicate through HTTP events and event subscriptions.

To read more about LivelyCouch, have a look at our website:
[www.livelycouch.org](http://livelycouch.org)

##Installation

First install the latest version of CouchDB - easiest way is to use build-couchdb:
    git clone git@github.com:livelycouch/build-couchdb.git
    cd build-couchdb
    git submodule init
    git submodule update
    
    rake git="git://github.com/apache/couchdb.git trunk"

Launch CouchDB:
    build/bin/couchdb
    
Add an Admin user with login: "lively" and password: "lively".

Make sure you have [Node.js](http://www.nodejs.org) installed.

Now, get the LivelyCouch source and run the install script:
    git clone git@github.com:livelycouch/LivelyCouch.git
    cd LivelyCouch
    node install.js

If everything went well, LivelyCouch should now be running.
From now on it will be automatically launched by CouchDB on startup.