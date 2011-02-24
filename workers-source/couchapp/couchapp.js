var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var spawn = require('child_process').spawn;
var workerLib = require('../../lib/workerlib');
var config = workerLib.config;
var myutils = require('../../lib/myutils');
var couchdb = workerLib.couchdb;

var name = 'couchapp';
workerLib.initialize(name, function() {
  var eventStream = workerLib.openEventStream();
  eventStream.on('event', function(event) {
    execute(event);
  });
  eventStream.on('end', function() {
    process.exit(0);
  });
});
var execute = function(event) {
  var folder = event.parameters.folderpath;
  var db = event.parameters.db;
  var pushURL = 'http://' + config.couchdbUser + ':' + config.couchdbPassword + '@'
  + config.couchdbHost + ':' + config.couchdbPort + '/' + db;
  var couchapp = spawn('couchapp', ['push', folder, pushURL], {cwd: config.rootPath});
  var error = false;
  couchapp.stderr.on('data', function (data) {
    console.log('stderr: ' + data);
    error = true;
    workerLib.emitLivelyEvent('error', {error: 'stderr: ' + data});
  });
  couchapp.on('exit', function (code) {
    if(!error) {
      workerLib.emitLivelyEvent('pushed', {folderpath: folder, db: db});
    }
  });
}