var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;
var path = require('path');

var name = 'load_document';
workerLib.setEventNamespace(name);

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(parameters) {
  var filePath = parameters.eventArguments.query.filepath;
  var docId = parameters.eventArguments.query.docid;
  if(!docId) {
    docId = path.basename(filePath, path.extname(filePath));
  }
  var dbName = parameters.eventArguments.query.db;
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