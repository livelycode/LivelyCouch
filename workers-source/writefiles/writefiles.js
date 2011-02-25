
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var client = workerLib.client;

var name = 'writefiles';
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
  var folderPath = event.parameters.path;
  var docId = event.parameters.docid;
  var dbName = event.parameters.db;
  var login = event.parameters.login;
  var password = event.parameters.password;
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
