var workerLib = require('./lib/workerlib');
var deployment = require('./lib/deployment');
var subscriptionHandling = require('./lib/subscription_handling');
var myutils = require('./lib/myutils');

//these values are being initialized in startup()

workerLib.setEventNamespace('lively_events');

// configurable event emits

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

var startup = function() {
  openStdin();
  myutils.doLinear([
    function(cb) {deployment.checkAndDeploy(cb)},
    function(cb) {subscriptionHandling.launchEventSystem(cb)},
    function(cb) {deployment.createLivelyWorkerChangeListener()},
    function(cb) {subscriptionHandling.createLivelyEventsChangeListener(cb)}
  ], function() {
  
  });
}

startup();