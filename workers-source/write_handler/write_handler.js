
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
  var client = workerLib.client;
  client.request('/_config/lively', function(err, response) {
    var handlerPath = response.handler_path;
    var docId = parameters.eventArguments.parameters.docid;
    var dbName = 'lively_handlers';
    writeOutAttachments(client,dbName, docId, handlerPath, function() {
      workerLib.emitLivelyEvent('attachments_written', {docid:docId, dbname:dbName, folderpath:handlerPath})
    });
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
