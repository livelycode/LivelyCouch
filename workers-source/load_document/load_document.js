var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;
var path = require('path');

workerLib.initialize('load_document', function() {
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  
  eventStream.on('end', function() {
    process.exit(0);
  });
});

var execute = function(event) {
  var filePath = event.parameters.filepath;
  var docId = event.parameters.docid;
  if(!docId) {
    docId = path.basename(filePath, path.extname(filePath));
  }
  var dbName = event.parameters.db;
  var db = workerLib.client.db(dbName);
  writeDocToCouch(filePath, db, docId, function() {
    workerLib.emitLivelyEvent('document_loaded', {filepath: filePath, docid: docId, db: dbName});
  });
}

var writeDocToCouch = function(file, db, docId, cb) {
  fs.readFile(file, 'utf8', function(err, data) {
    var json = JSON.parse(data);
    db.getDoc(docId, function(er, doc) {
      if(doc) {
        json._attachments = doc._attachments;
        json._rev = doc._rev;
      }
      db.saveDoc(docId, json, function(err, newDoc) {
        cb();
      });
    });
  });
}