
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var couchdb = require('./couchdb');
var mustache = require('./mustache');

var eventNamespace = 'lively';
var localClient = http.createClient(5984, '127.0.0.1');
var localEventClient = {client: localClient, basePath: '/_events/'};

exports.setEventNamespace = function(namespace) {
  eventNamespace = namespace;
  process.title = 'node_' + namespace;
}

exports.emitLivelyEvent = function(event, params, method) {
  if(!params) params = {};
  var client = localEventClient.client;
  var basePath = localEventClient.basePath;
  if(method == 'POST') {
    var postData = JSON.stringify(params);
    var request = localClient.request('POST', basePath + eventNamespace + '/' + event,
      {'host':'127.0.0.1:5984', "Content-Type": "text/plain", "Content-Length": postData.length});
    request.write(postData);
    request.end();
    request.on('response', function(response) {});  
  } else {
    var query = toQueryString(params);
    var request = localClient.request('GET', basePath + eventNamespace + '/' + event + '?' + query);
    request.end();
    request.on('response', function(response) {});
  }
}

var toQueryString = function(obj) {
  var str = [];
  for(var p in obj)
     str.push(p + "=" + obj[p]);
  return encodeURI(str.join("&"));
}

exports.couchdb = couchdb;
exports.mustache = mustache;
exports.toQueryString = toQueryString;