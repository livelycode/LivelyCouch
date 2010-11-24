var http = require('http');
var url = require('url');
var sys = require('sys');
var EventEmitter = require('events').EventEmitter;
var viewLib = require('./lib/viewlib');
var couchdb = viewLib.couchdb;

var viewPath;

var client = couchdb.createClient(5984, '127.0.0.1', 'lively', 'lively');
var livelyHandlersDbName = 'lively_handlers';

var livelyHandlersDb = client.db(livelyHandlersDbName);

var localClient = http.createClient(5984, '127.0.0.1');

var eventNamespace = 'lively_handlers';
viewLib.setEventNamespace(eventNamespace);

var emitEvents = true;

var startUpEvent = 'lively_handlers_started';
var stopEvent = 'lively_handlers_stopped';

var viewExecuted = 'handler_executed';
var viewError = 'handler_error';

var stats = {};

var launchHTTPHandler = function() {
  http.createServer(function (request, response) {
    var urlObject = url.parse(request.url, true);
    var pathName = urlObject.pathname;
    var eventArguments = {requestMethod: request.method, pathName: pathName};
    if(request.method == 'POST') {
      var postData = '';
      request.on('data', function(data) {
        postData += data;
      });
      request.on('end', function() {
        eventArguments.postData = postData;
        handleView(pathName, eventArguments, response);
      });
    } else {
      eventArguments.query = urlObject.query;
      handleView(pathName, eventArguments, response);
    }
  }).listen(8126);
  
  viewLib.emitLivelyEvent(startUpEvent);
  console.log('LivelyCouch HTTP Handler running at http://127.0.0.1:8126/');
}

handleView = function(path, viewArguments, response) {
  console.log(viewPath);
  livelyHandlersDb.view('lively_handlers', 'url-handler', {key: path}, function(err, resp) {
    var rows = resp.rows;
    try {
      executeView(rows[0].value, viewArguments, response);
      viewLib.emitLivelyEvent(viewExecuted, {viewName: path});
    } catch(err) {
      viewLib.emitLivelyEvent(viewError, {viewName: path})
      console.log('error in view: ' + path);
      console.log(err);
      response.writeHead(200, {'Content-Type': 'text/plain'});
      response.write('error in view');
      response.end();
      //error HTTP response
    }
  });
}

executeView = function(viewFilePath, viewArguments, response) {
  console.log("running view: " + viewFilePath);
  var view = require(viewPath + viewFilePath);
  view.run(viewArguments, response, viewLib);
}

var openStdin = function() {
  var stdin = process.openStdin();
  
  stdin.on('data', function(d) {
    server.listen(parseInt(JSON.parse(d)));
  });
  
  stdin.on('end', function () {
    viewLib.emitLivelyEvent(stopEvent);
    console.log('lively-handlers.js exits');
    process.exit(0);
  });
}

var toQuery = function(query) {
  if(query) {
    for (var k in query) {
      if (['key', 'startkey', 'endkey'].indexOf(k) != -1) {
        query[k] = JSON.stringify(query[k]);
      } else {
        query[k] = String(query[k]);
      }
    }
    return querystring.stringify(query);
  } else {
    return ''
  }
};
client.request('/_config/lively', function(err, response) {
  console.log(response);
  viewPath = response.view_path;
  launchHTTPHandler();
  openStdin();
});