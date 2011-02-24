var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var runningTimers = {};

workerLib.initialize('timer', function() {
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  eventStream.on('end', function() {
    process.exit(0);
  });
});
var execute = function(event) {
  var timerID = event.parameters.timerid;
  if (event.parameters.stop) {
    stopTimer(timerID);
  } else {
    var interval = event.parameters.interval;
    var emittingEvent = event.parameters.event;
    startTimer(timerID, interval, emittingEvent);
  }
}
var startTimer = function(timerID, interval, emittingEvent) {
  stopTimer(timerID);
  var intervalID = setInterval( function() {
    workerLib.emitLivelyEvent(emittingEvent, {});
  }, interval*1000);
  runningTimers[timerID] = intervalID;
  workerLib.emitLivelyEvent('started', {timerid: timerID});
}
var stopTimer = function(timerID) {
  if(runningTimers[timerID]) {
    clearInterval(runningTimers[timerID]);
    workerLib.emitLivelyEvent('stopped', {timerid: timerID});
  }
}