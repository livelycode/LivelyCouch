
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

var execute = function(data) {
  var timerID = data.event.parameters.timerid;
  var event = data.event.path;
  if (event == 'timer/stop') {
    stopTimer(timerID);
  } else {
    var interval = data.event.parameters.interval;
    var emittingEvents = data.event.parameters.emittingevents;
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