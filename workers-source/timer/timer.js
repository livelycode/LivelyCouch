
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
  var event = event.path;
  if (event == 'timer/stop') {
    stopTimer(timerID);
  } else {
    var interval = event.parameters.interval;
    var emittingEvents = event.parameters.emittingevents;
    startTimer(timerID, interval, emittingEvents);  
  }
}

var startTimer = function(timerID, interval, emittingEvents) {
  stopTimer(timerID);
  var intervalID = setInterval(function() {
    for (var i in emittingEvents) {
      workerLib.emitLivelyEvent(emittingEvents[i], {});    
    }
  }, interval*1000);
  runningTimers[timerID] = intervalID;
  workerLib.emitLivelyEvent('timer_started', {timerID: timerID});
}

var stopTimer = function(timerID) {
  if(runningTimers[timerID]) {
    clearInterval(runningTimers[timerID]);
  }
}