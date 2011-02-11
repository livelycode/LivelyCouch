var workerLib = require('./lib/workerlib');
var deployment = require('./lib/deployment');
var subscriptionHandling = require('./lib/subscription_handling');
var workerManagement = require('./lib/worker_management');
var EventEmitter = require('events').EventEmitter;
var statusEmitter = new EventEmitter();
deployment.initialize({workerLib: workerLib});
workerManagement.initialize({workerLib: workerLib});
subscriptionHandling.initialize({workerLib: workerLib, deployment: deployment, workerManagement: workerManagement});

var myutils = require('./lib/myutils');

var openStdin = function() {
  var stdin = process.openStdin();
  
  stdin.on('data', function(d) {
    server.listen(parseInt(JSON.parse(d)));
  });
  
  stdin.on('end', function() {
    workerLib.emitLivelyEvent(stopEvent);
    console.log('lively-events.js exits');
    process.exit(0);
  });
}

var startup = function(startupCb) {
  openStdin();
  myutils.doLinear([
    function(cb) {workerLib.initialize('lively_events', cb)},
    function(cb) {deployment.checkAndDeploy(cb)},
    function(cb) {subscriptionHandling.createEventsChangeListener(cb)},
    function(cb) {subscriptionHandling.launchEventSystem(cb)},
    function(cb) {deployment.createWorkerChangeListener(); cb();}
  ], function() {
    startupCb();
  });
}

startup(function() {
	statusEmitter.emit('started');
});

exports.statusEmitter = statusEmitter;