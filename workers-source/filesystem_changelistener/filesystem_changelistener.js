
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var path = require('path');
var workerLib = require('../../lib/workerlib');
var watch = require('../../lib-external/watch');

var couchdb = workerLib.couchdb;
var runningListeners = {};

var name = 'filesystem_changelistener';
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
  var eventPath = event.path;
  var listenerId = event.parameters.listenerid;
  if (event.parameters.stop) {
    stopChangeListener(id);
  } else {
    if(event.parameters.path) var paths = [event.parameters.path];
    if(event.parameters.paths) var paths = event.parameters.paths;
    var fileEndings = event.parameters.fileendings;
    var markChangedOnInit = event.parameters.mark_changed_on_start;
    var options = {};
    if (fileEndings) options.fileEndings = fileEndings;
    if (markChangedOnInit) options.markChangedOnInit = markChangedOnInit;
    startChangeListener(listenerId, paths, options);  
  }
}

var startChangeListener = function(listenerId, paths, options) {
  stopChangeListener(listenerId);
  var validFile = function(filePath) {
    if(options.fileEndings) {
      for(var i in options.fileEndings) {
        if(path.extname(filePath) == options.fileEndings[i]) {
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
      fs.readdir(folderPath + files[i], function(err, files1) {
        if(files1) {
          markFilesInFolderChanged(folderPath + files[i] + '/');
        }
      })
      if (validFile(files[i])) {
        emitEvent('file_changed', folderPath + files[i], listenerId);
      }
    }
  }
  
  for (var i in paths) {
    var currpath = paths[i];
    if(options.markChangedOnInit) {
      markFilesInFolderChanged(currpath);
    }
    watch.createMonitor(currpath, {'ignoreDotFiles':true}, function (monitor) {
      monitor.on('created', function (f) {
        if(validFile(f)) {
          emitEvent('file_created', f, listenerId); 
        }
      })
      monitor.on('removed', function (f) {
        if(validFile(f)) {
          emitEvent('file_removed', f, listenerId); 
        }
      })
      monitor.on('content_changed', function (f) {
        if(validFile(f)) {
          emitEvent('file_changed', f, listenerId); 
        } 
      })
      if(!runningListeners[listenerId]) runningListeners[listenerId] = [];
      runningListeners[listenerId].push(monitor);
      workerLib.emitLivelyEvent("started", {listenerid: listenerId});
    });
  }
}


var emitEvent = function(event, filePath, listenerId) {
  workerLib.emitLivelyEvent(event, {
    listenerid: listenerId,
    filepath: filePath,
    fileending: path.extname(filePath),
    filename: path.basename(filePath, path.extname(filePath)),
    foldername: path.dirname(filePath).split('/').pop()
  }); 
}


var stopChangeListener = function(id) {
  if(runningListeners[id]) {
    for(var i in runningListeners[id]) {
      runningListeners[id][i].end();    
    }
    workerLib.emitLivelyEvent("stopped", {listenerid: id});
  }
}