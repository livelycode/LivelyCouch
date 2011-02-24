var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;
var client;
var runningListeners = {};

var name = 'changelistener';

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
  var eventPath = event.path;
  var id = event.parameters.listenerid;
  if(event.parameters.stop) {
    stopChangeListener(id);
  } else {
    var dbName = event.parameters.db;
    var filter = event.parameters.filter;
    client = workerLib.client;
    startChangeListener(id, dbName, filter);
  }
}
var startChangeListener = function(id, dbName, filter) {
  stopChangeListener(id);
  var changeListener = createChangeListener(dbName);
  changeListener.on('data', function(data) {
    workerLib.emitLivelyEvent('document_changed', {docid: data.id, db: dbName, listenerid: id});
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