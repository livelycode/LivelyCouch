
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
  var event = event.path;
  var id = event.parameters.listenerid;
  if(event == 'changelistener/stop') {
    stopChangeListener(id);
  } else {
//    var events = event.parameters.events;
    var dbName = event.parameters.db;
    var filter = event.parameters.filter;
    var login = event.parameters.login;
    var password = event.parameters.password;
    if(login & password) {
      client = couchdb.createClient(5984, '127.0.0.1', login, password);    
    } else {
      client = workerLib.client;
    }
    startChangeListener(id, dbName, filter);  
  }
}

var startChangeListener = function(id, dbName, filter) {
  stopChangeListener(id);
  var changeListener = createChangeListener(dbName);
  changeListener.on('data', function(event) {
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