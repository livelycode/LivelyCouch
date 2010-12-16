
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var watch = require('../../lib-external/watch');

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
  workerLib.client.request('/_config/lively', function(err, response) {
    for(var entry in response) {
      if(entry.indexOf('paths') > -1) {
        workerLib.emitLivelyEvent(entry, {
          paths: response[entry],
          value: response[entry]
        });      
      } else {
        if(entry.indexOf('path') > -1) {
          workerLib.emitLivelyEvent(entry, {path: response[entry], value: response[entry]});
        } else {
          workerLib.emitLivelyEvent(entry, {value: response[entry]});        
        }
      }
    }
  })
}