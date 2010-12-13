var http = require('http');
var sys = require('sys');
var path = require('path');
var url = require('url');

var EventEmitter = require('events').EventEmitter;
var workerLib = require('./workerlib');
var deployment = require('./deployment');
var resolveEventBindings = require('./pattern_matching/resolve_bindings');
var workerManagement = require('./worker_management');
var config = require('../config');

var client = workerLib.client;

var emitEvents = true;
var startUpEvent = 'lively_events_started';
var stopEvent = 'lively_events_stopped';

var eventChangeListenerStarted = 'event_change_listener_started';
var eventChangeListenerStopped = 'event_change_listener_started';
var eventDefinitionsUpdated = 'event_definitions_updated';

var eventDefinitions = [];

// end event emits

var launchEventSystem = function(cb) {
  http.createServer(function (request, response) {
    var urlObject = url.parse(request.url, true);
    var pathName = urlObject.pathname;
    var eventArguments = {requestMethod: request.method, event: pathName, query: {}};
    if (request.method == 'POST') {
      var postData = '';
      request.setEncoding('utf8');
      request.on('data', function(data) {
        postData = postData + data;
      });
      request.on('end', function() {
        try {
          var postDataParsed = JSON.parse(postData);
          for(var key in postDataParsed) {
            try {
              eventArguments.query[key] = JSON.parse(postDataParsed[key]);
            } catch(err1) {
              eventArguments.query[key] = postDataParsed[key];            
            }
          }
        } catch(error) {
          eventArguments.query.data = postData;
        }
        handleHTTPEvent(pathName, eventArguments, response);
      });
    } else {
      eventArguments.query = {};
      for(var queryParam in urlObject.query) {
        if(queryParam != '') {
          try {
            eventArguments.query[queryParam] = JSON.parse(urlObject.query[queryParam]);     
          } catch(e) {
            eventArguments.query[queryParam] = urlObject.query[queryParam];
          }
        }
      }
      handleHTTPEvent(pathName, eventArguments, response);
    }
  }).listen(8125);
  workerLib.emitLivelyEvent(startUpEvent, {});
  console.log('LivelyCouch Event System running at http://127.0.0.1:8125/');
  cb();
}

var handleHTTPEvent = function(eventName, eventArguments, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end(JSON.stringify({received: true}));
  var triggeredWorkers = [];
  var event = {path: eventName, parameters: eventArguments.query, method: eventArguments.requestMethod};
  if(eventArguments.postData) event.postData = eventArguments.postData;
  resolveEventBindings.resolve(event, eventDefinitions, function(workers) {
    workers.forEach(function(each) {
      workerManagement.executeWorker(each.worker, {
        requestMethod: eventArguments.requestMethod,
        path: eventName,
        parameters: each.parameters});
      triggeredWorkers.push({workerName: each.worker, eventArguments: each.parameters});
    });
    logEvent({eventMessage: eventName, eventArguments: eventArguments, triggeredWorkers: triggeredWorkers});  
  });
}

var logEvent = function(log) {
  if(deployment.logEvents) {
    var doc = {log: log, timestamp: new Date().getTime()};
    config.livelyLogsDb.saveDoc(doc);
  }
}

var createLivelyEventsChangeListener = function(cb) {
  config.livelyEventsDb.changes({},function(err, res) {
    workerLib.emitLivelyEvent(eventChangeListenerStarted);
    if(res.last_seq) {
      var changeListener = createChangeListener(config.livelyEventsDbName, {since: res.last_seq});    
    } else {
      var changeListener = createChangeListener(config.livelyEventsDbName, {since: res.last_seq});
    }
    changeListener.on('data', function(data) {
      updateEventDefinitions(function() {});
    });
    changeListener.on('end', function(err) {
      workerLib.emitLivelyEvent(eventChangeListenerStopped);
    });
    updateEventDefinitions(function() {
      cb();    
    })
  });
}

var updateEventDefinitions = function(cb) {
  config.livelyEventsDb.view('lively_events', 'triggering-urls', {}, function(err, resp) {
    var rows = resp.rows;
    eventDefinitions = resp.rows.map(function(each) {return each.value});
    workerLib.emitLivelyEvent(eventDefinitionsUpdated, {});
    cb();
  });
}

var createChangeListener = function(Db, query) {
  var DbInstance = client.db(Db);
  changeEmitter = DbInstance.changesStream(query);
  return changeEmitter;
}

exports.launchEventSystem = launchEventSystem;
exports.createLivelyEventsChangeListener = createLivelyEventsChangeListener;