var workerLib = require('../../lib/workerlib');
var config = workerLib.config;
var logger = workerLib.logger('hello_world');

workerLib.initialize('hello_world', function() {
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  eventStream.on('end', function() {
    process.exit(0);
  });
});
var execute = function(event) {
  logger.log('Hello World!');
  workerLib.emitLivelyEvent('hello');
}