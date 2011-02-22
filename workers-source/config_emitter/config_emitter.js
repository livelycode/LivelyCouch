var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var config = workerLib.config;
var watch = require('../../lib-external/watch');
var myutils = require('../../lib/myutils');
var couchdb = workerLib.couchdb;

var name = 'config_emitter';
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
  myutils.arrayForEach([
  {setting: 'worker_source_paths', paths: config.workersSource},
  {setting: 'event_source_paths', paths: config.eventsSource}
  ], function(each, cb) {
    workerLib.emitLivelyEvent(each.setting, {paths: each.paths}, cb);
  }, function() {
    //process.exit(0);
  });
}