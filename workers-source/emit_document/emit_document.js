
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var name = 'emit_document';
workerLib.setEventNamespace(name);

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

var execute = function(data) {
  var docId = data.event.parameters.docid;
  var dbName = data.event.parameters.db;
  var event = data.event.parameters.event;
  emitDocument(dbName, docId, event);
}

var emitDocument = function(dbName, docId, event) {
  var db = workerLib.client.db(dbName);
  db.getDoc(docId, function (error, doc) {
    if(doc) {
      workerLib.emitLivelyEvent(event, doc);
      console.log(doc);
    }
  })
}