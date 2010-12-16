
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var name = 'emit_document';
workerLib.initialize(name, function() {
  var eventStream = workerLib.openEventStream();
  
  eventStream.on('event', function(event) {
    execute(event);
  });
});

var execute = function(event) {
  var docId = event.parameters.docid;
  var dbName = event.parameters.db;
  var event = event.parameters.event;
  emitDocument(dbName, docId, event);
}

var emitDocument = function(dbName, docId, event) {
  var db = workerLib.client.db(dbName);
  db.getDoc(docId, function (error, doc) {
    if(doc) {
      workerLib.emitLivelyEvent(event, doc);
    }
  })
}