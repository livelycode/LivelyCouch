exports.init = function(options) {
  var http = require('http');
  var sys = require('sys');
  var path = require('path');
  var url = require('url');
  var EventEmitter = require('events').EventEmitter;

  var workerLib = options.workerLib;
  var workerManagement = options.workerManagement;
  var config = workerLib.config;
  var client = workerLib.client;

  var myutils = require('./myutils');
  var resolveEventBindings = require('./pattern_matching/resolve_bindings');
  var logger = myutils.logger('./lively.log');

  var emitEvents = true;
  var startUpEvent = 'lively_events_started';
  var stopEvent = 'lively_events_stopped';

  var eventChangeListenerStarted = 'event_change_listener_started';
  var eventChangeListenerStopped = 'event_change_listener_started';
  var eventDefinitionsUpdated = 'event_definitions_updated';

  var _eventDefinitions = [];

  var launchEventSystem = function(cb) {
    http.createServer( function (request, response) {
      var urlObject = url.parse(request.url, true);
      var pathName = urlObject.pathname;
      var event = {method: request.method, path: pathName, parameters: {}};
      if (event.method == 'POST') {
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
                event.parameters[key] = JSON.parse(postDataParsed[key]);
              } catch(err1) {
                event.parameters[key] = postDataParsed[key];
              }
            }
          } catch(error) {
            event.parameters.data = postData;
          }
          handleHTTPEvent(event, response);
        });
      } else {
        for(var queryParam in urlObject.query) {
          if(queryParam != '') {
            try {
              event.parameters[queryParam] = JSON.parse(urlObject.query[queryParam]);
            } catch(e) {
              event.parameters[queryParam] = urlObject.query[queryParam];
            }
          }
        }
        handleHTTPEvent(event, response);
      }
    }).listen(8125);
    workerLib.emitLivelyEvent(startUpEvent, {});
    console.log('LivelyCouch Event System running at http://127.0.0.1:8125/');
    cb();
  }
  var handleHTTPEvent = function(event, response) {
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.end(JSON.stringify({received: true}));
    var triggeredWorkers = [];
    resolveEventBindings.resolve(event, eventDefinitions(), function(workers) {
      workers.forEach( function(each) {
        workerManagement.executeWorker(each.worker, {
          method: event.method,
          path: event.path,
          parameters: each.parameters,
          forward: each.forward
        });
        triggeredWorkers.push(each);
      });
      logEvent({event: event, triggeredWorkers: triggeredWorkers});
    });
  }
  var logEvent = function(log) {
    if(config.logToCouch) {
      var doc = {log: log, timestamp: new Date().getTime()};
      config.logsDb.saveDoc(doc);
    }
  }
  var createEventsChangeListener = function(cb) {
    config.eventsDb.changes({}, function(err, res) {
      workerLib.emitLivelyEvent(eventChangeListenerStarted);
      if(res.last_seq) {
        var changeListener = createChangeListener(config.eventsDbName, {since: res.last_seq});
      } else {
        var changeListener = createChangeListener(config.eventsDbName, {since: res.last_seq});
      }
      changeListener.on('data', function(data) {
        updateEventDefinitions( function() {
        });
      });
      changeListener.on('end', function(err) {
        workerLib.emitLivelyEvent(eventChangeListenerStopped);
      });
      updateEventDefinitions( function() {
        cb();
      })
    });
  }
  var eventDefinitions = function() {
    return _eventDefinitions;
  }
  var updateEventDefinitions = function(cb) {
    config.eventsDb.view('lively_events', 'triggering-urls', {}, function(err, resp) {
      var rows = resp.rows;
      _eventDefinitions = resp.rows.map( function(each) {
        return each.value
      });
      workerLib.emitLivelyEvent(eventDefinitionsUpdated, {});
      cb();
    });
  }
  var createChangeListener = function(Db, query) {
    var DbInstance = client.db(Db);
    changeEmitter = DbInstance.changesStream(query);
    return changeEmitter;
  }
  return {
    launchEventSystem: launchEventSystem,
    createEventsChangeListener: createEventsChangeListener
  }
}