
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');

var couchdb = workerLib.couchdb;

var name = 'loadfiles';
workerLib.setEventNamespace(name);

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(parameters) {
  var folderPath = parameters.eventArguments.query.folderpath;
  var filePath = parameters.eventArguments.query.filepath;
  var docId = parameters.eventArguments.query.docid;
  var dbName = parameters.eventArguments.query.db;
  var client = workerLib.client;
  var db = client.db(dbName);
  db.getDoc(docId, function(er, doc) {
    if(doc) {
      if(folderPath) {
        loadFolder(folderPath, db, docId, doc._rev);  
      }
      if(filePath) {
        loadFile(filePath, db, docId, doc._rev);    
      }
    } else {
      db.saveDoc(docId, {}, function(err, newDoc) {
        if(!newDoc) return execute(parameters);
        if(folderPath) {
          loadFolder(folderPath, db, docId, newDoc.rev);  
        }
        if(filePath) {
          loadFile(filePath, db, docId, newDoc.rev);    
        }
      })
    }
  });
}

var loadFolder = function(folderPath, db, docId, rev1) {
  var files = fs.readdirSync(folderPath);
  var loadFile = function(fileNames, rev) {
    var filePath = folderPath + '/' + fileNames[fileNames.length-1];
    db.saveAttachment(filePath, docId, {rev: rev}, function(err, data) {
      if(fileNames.length > 0) {
        fileNames.pop();
        loadFile(fileNames, data.rev);
      } else {
        workerLib.emitLivelyEvent('handler_loaded', {handlername: docId, docid: docId});
      }       
    });
  };
  loadFile(files, rev1); 
}

var loadFile = function(filePath, db, docId, rev) {
  db.saveAttachment(filePath, docId, {rev: rev}, function(err, data) {
    if(err) {
    if(err.error == 'conflict') {
      db.getDoc(docId, function(er, doc) {
        loadFile(filePath, db, docId, doc._rev);
      })
    }
    }
    workerLib.emitLivelyEvent('handler_loaded', {handlername: docId, docid: docId});
  })
}