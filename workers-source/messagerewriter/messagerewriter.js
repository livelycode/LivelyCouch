
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var name = 'messagerewriter';
//var messages = {stop: };
workerLib.eventNamespace = name;
//workerLib.messages = messages;

var client;

var runningListeners = {};

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(parameters) {
  var event = parameters.event.path;
  var id = parameters.event.parameters.rewriteid;
  if (event == 'rewrite/stop') {
    stopRewriteListener(id);
  } else {
    var rewrites = JSON.parse(parameters.event.parameters.rewrites);
    var filter = parameters.event.parameters.filter;

    client = couchdb.createClient(5984, '127.0.0.1', login, password);
    startRewriteListener(id, dbName, filter, events);  
  }
}

var startRewriteListener = function(id, dbName, filter, events) {
  stopChangeListener(id);
  var changeListener = createChangeListener(dbName);
  changeListener.on('data', function(data) {
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