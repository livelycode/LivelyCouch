
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var watch = require('../../lib/watch');

var couchdb = workerLib.couchdb;

var name = 'filesystem_changelistener';
workerLib.setEventNamespace(name);

var runningListeners = {};

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(parameters) {
  var event = parameters.event.path;
  var listenerId = parameters.event.parameters.listenerid;
  if (event == 'filesystem_changelistener/stop') {
    stopChangeListener(id);
  } else {
    if(parameters.event.parameters.path) var paths = [parameters.event.parameters.path];
    if(parameters.event.parameters.paths) var paths = parameters.event.parameters.paths;
    var fileEndings = parameters.event.parameters.fileendings;
    var markChangedOnInit = parameters.event.parameters.mark_changed_on_start;
    var options = {};
    if (fileEndings) options.fileEndings = fileEndings;
    if (markChangedOnInit) options.markChangedOnInit = markChangedOnInit;
    console.log(options);
    startChangeListener(listenerId, paths, options);  
  }
}

var startChangeListener = function(listenerId, paths, options) {
  stopChangeListener(listenerId);
  var validFile = function(path) {
    if(options.fileEndings) {
      for(var i in options.fileEndings) {
        if(path.indexOf(options.fileEndings[i]) > -1) {
          return true
        }
      }
      return false
    } else {
      return true
    }
  }
  var markFilesInFolderChanged = function(folderPath) {
    var files = fs.readdirSync(folderPath);
    for (var i in files) {
      if (validFile(files[i])) {
        workerLib.emitLivelyEvent(listenerId + '/file_changed', {filepath: folderPath + files[i]});       
      }
    }
  }
  
  for (var i in paths) {
    var path = paths[i];
    if(options.markChangedOnInit) {
      markFilesInFolderChanged(path);
    }
    watch.createMonitor(path, {'ignoreDotFiles':true}, function (monitor) {
      monitor.on('created', function (f) {
        if(validFile(f)) {
          workerLib.emitLivelyEvent(listenerId + '/' + 'file_created', {filepath: f});        
        }
      })
      monitor.on('removed', function (f) {
        if(validFile(f)) {
          workerLib.emitLivelyEvent(listenerId + '/' + 'file_removed', {filepath: f});  
        }
      })
      monitor.on('content_changed', function (f) {
        if(validFile(f)) {
          workerLib.emitLivelyEvent(listenerId + '/' + 'file_changed', {filepath: f}); 
        } 
      })
      if(!runningListeners[listenerId]) runningListeners[listenerId] = [];
      runningListeners[listenerId].push(monitor);
      workerLib.emitLivelyEvent("started", {listenerid: listenerId});
    });
  }
}



var stopChangeListener = function(id) {
  if(runningListeners[id]) {
    for(var i in runningListeners[id]) {
      runningListeners[id][i].end();    
    }
    workerLib.emitLivelyEvent("stopped", {listenerid: id});
  }
}