
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var couchdb = workerLib.couchdb;

var runningTimers = {};

var name = 'timer';
workerLib.setEventNamespace(name);

var stdin = process.openStdin();

stdin.on('data', function(d) {
  execute(JSON.parse(d.toString()));
});

stdin.on('end', function () {

});

var execute = function(parameters) {
  var timerID = parameters.eventArguments.query.timerid;
  var event = parameters.eventArguments.event;
  if (event == 'timer/stop') {
    stopTimer(timerID);
  } else {
    var interval = parameters.eventArguments.query.interval;
    var emittingEvents = JSON.parse(parameters.eventArguments.query.emittingevents);
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