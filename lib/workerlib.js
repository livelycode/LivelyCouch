var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var config = require('../config');
var couchClient = config.client;
var livelyWorkersDb = config.workersDb;
var stdin = process.openStdin();
var workerName = 'lively';
var localClient = http.createClient(5984, '127.0.0.1');
var localEventClient = {client: localClient, basePath: '/_events/'};
var workerParameters;
var eventQueue = [];
var internalEventStream = new process.EventEmitter();

exports.client = couchClient;
exports.initialize = function(name, cb) {
  workerName = name;
  process.title = 'node_' + workerName;
  if(cb) {
    startEventQueueing();
    loadWorkerParameters(cb);
  }
}
var startEventQueueing = function() {
  var stdin = process.openStdin();
  stdin.on('data', function(d) {
    var objects = d.toString().split('\n');
    objects.pop();
    for (var i in objects) {
      try {
        eventQueue.push(JSON.parse(objects[i]));
        internalEventStream.emit('event');
      } catch(e) {
        console.log(e);
      }
    }
  });
  stdin.on('end', function () {
    internalEventStream.emit('end');
  });
}
exports.openEventStream = function() {
  var stream = new process.EventEmitter();
  var emitEventQueue = function() {
    for(var i=0; i<eventQueue.length; i++) {
      stream.emit('event', eventQueue.pop());
    }
  }
  internalEventStream.on('event', emitEventQueue);
  internalEventStream.on('end', function() {
    stream.emit('end')
  });
  process.nextTick(emitEventQueue);
  return stream;
}
var loadWorkerParameters = function(cb) {
  livelyWorkersDb.getDoc(workerName, function(err, doc) {
    if(doc) {
      if(doc.parameters)
        workerParameters = doc.parameters;
      cb();
    } else {
      cb();
    }
  });
}
exports.emitLivelyEvent = function(event, params, cb) {
  if(!params)
    params = {};
  var client = localEventClient.client;
  var basePath = localEventClient.basePath;
  var postData = JSON.stringify(params);
  var request = localClient.request('POST', basePath + workerName + '/' + event,
  {'host':'127.0.0.1:5984', "Content-Type": "text/json", "Content-Length": postData.length});
  request.write(postData);
  request.end();
  request.on('response', function(response) {
    if(cb)
      cb();
  });
}
var toQueryString = function(obj) {
  var str = [];
  for(var p in obj)
    str.push(p + "=" + obj[p]);
  return str.join("&");
}
exports.couchdb = config.couchdb;
exports.toQueryString = toQueryString;
exports.workerParameters = workerParameters;
exports.workerName = workerName;
exports.config = config;