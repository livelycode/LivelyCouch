// This worker is still under development!! 
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var name = 'messagerewriter';
var runningListeners = {};

workerLib.initialize(name, function() {
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  
  eventStream.on('end', function() {
    process.exit(0);
  });
});

var execute = function(event) {
  var event = event.path;
  var id = event.parameters.rewriteid;
  if (event == 'rewrite/stop') {
    stopRewriteListener(id);
  } else {
    var rewrites = event.parameters.rewrites;
    var filter = event.parameters.filter;

    client = couchdb.createClient(5984, '127.0.0.1', login, password);
    startRewriteListener(id, dbName, filter, events);  
  }
}

var startRewriteListener = function(id, dbName, filter, events) {
  stopChangeListener(id);
  var changeListener = createChangeListener(dbName);
  changeListener.on('data', function(event) {
    for (var i in events) {
      workerLib.emitLivelyEvent(events[i], {docid: data.id, db: dbName, listenerid: id});  
    }
  });
  runningListeners[id] = changeListener;
  workerLib.emitLivelyEvent("started", {listenerid: id});
}

var createChangeListener = function(db, query) {
  var dbInstance = client.db(db);
  changeEmitter = dbInstance.changesStream();
  return changeEmitter;
}


var stopChangeListener = function(id) {
  if(runningListeners[id]) {
    runningListeners[id].end();
    workerLib.emitLivelyEvent("stopped", {listenerid: id});
  }
}