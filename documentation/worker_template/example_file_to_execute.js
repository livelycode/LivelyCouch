
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

//set the namespace of events emitted by this worker:
workerLib.setEventNamespace('worker_name');

var dataStream = workerLib.createDataListener();

// everytime the worker is triggered, dataStream emits all Event parameters:
dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(data) {
  //example to access Event parameters:
  var sampleParameter = data.event.parameters.parameter_name;
  
  //sample emit of an Event
  workerLib.emitLivelyEvent('some_event', {sample_parameter: "blub"});
  
  //the rest of your code
}