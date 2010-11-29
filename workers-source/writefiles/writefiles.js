
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var name = 'writefiles';
workerLib.setEventNamespace(name);

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

var execute = function(parameters) {
  var folderPath = parameters.event.parameters.path;
  var docId = parameters.event.parameters.docid;
  var dbName = parameters.event.parameters.db;
  var login = parameters.event.parameters.login;
  var password = parameters.event.parameters.password;
  var client = couchdb.createClient(5984, '127.0.0.1', login, password);
  writeOutAttachments(client,dbName, docId, folderPath, function() {
    workerLib.emitLivelyEvent('attachments_written', {docid:docId, dbname:dbName, folderpath:folderPath})
  });
}

var writeOutAttachments = function(client, db, docId, folderPath, callback) {
  var db = client.db(db);

  db.getDoc(docId, function (error, doc) {
    if(doc) {
      if (doc._attachments) {
        var attachments = doc._attachments;
        var attachmentNames = [];
        if (attachments) {
          for(var attachmentName in attachments) {
            attachmentNames.push(attachmentName);
          }
          var writeOutAttachment = function(fileNames) {
            var currFileName = fileNames[fileNames.length-1];
            db.getAttachment(docId, currFileName, function(err, attachment) {
              try {
                fs.statSync(folderPath + doc._id + '/');
              } catch(e) {
                fs.mkdirSync(folderPath + doc._id + '/', 0777);
              }
              fs.writeFileSync(folderPath + doc._id + '/' + currFileName, attachment, encoding='utf8');
              fileNames.pop();
              if(fileNames.length > 0) {
                writeOutAttachment(fileNames);          
              } else {
                callback(attachmentNames)
              }
            });  
          }
          writeOutAttachment(attachmentNames);
        }
      }
    }
  })
}
