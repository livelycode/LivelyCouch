
var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var workerLib = require('../../lib/workerlib');
var watch = require('../../lib/watch');

var couchdb = workerLib.couchdb;

var name = 'handler_source_changelistener';
workerLib.setEventNamespace(name);

var dataStream = workerLib.createDataListener();

dataStream.on('data', function(d) {
  execute(d);
});

dataStream.on('end', function() {
  process.exit(0);
});

var execute = function(parameters) {
  handlerSourcePaths = JSON.parse(parameters.eventArguments.query.paths);
  for(var i in handlerSourcePaths) {
    startChangeListener(handlerSourcePaths[i]);    
  }
  workerLib.emitLivelyEvent("started");
}

var startChangeListener = function(path) {
  markFilesInFolderChanged(path);
  watch.createMonitor(path, {'ignoreDotFiles':true}, function (monitor) {
    monitor.on('created', function (f) {
      var fileType = validFileType(f);
      if(fileType) {
        emitMessage('handler_source_changed', fileType, f);       
      }
    })
    monitor.on('removed', function (f) {
      var fileType = validFileType(f);
      if(fileType) {
        emitMessage('handler_source_removed', fileType, f);  
      }
    })
    monitor.on('content_changed', function (f) {
      var fileType = validFileType(f);
      if(fileType) {
        emitMessage('handler_source_changed', fileType, f);
      }
    })
  });
}

var validFileType = function(path) {
  var fileEndings = ['.json', '.html', '.js'];
  for(var i in fileEndings) {
    if(path.indexOf('.') == -1) return 'folder'
    if(path.indexOf(fileEndings[i]) > -1) {
      var fileType = fileEndings[i].substr(1, fileEndings[i].length);
      return fileType;
    }
  }
  return false
}

var emitMessage = function(message, fileType, path) {
  var filePathSplit = path.split('/');
  if(fileType == 'folder') {
    var handlerName = filePathSplit[filePathSplit.length-1];
    var params = {folderpath: path, handlername: handlerName, docid: handlerName};
    markFilesInFolderChanged(path + '/');
  } else {
    var handlerName = filePathSplit[filePathSplit.length-2];
    var params = {filepath: path, handlername: handlerName, docid: handlerName};  
  }
  workerLib.emitLivelyEvent(message + '/' + fileType, params); 
}

var markFilesInFolderChanged = function(folderPath) {
  var files = fs.readdirSync(folderPath);
  for (var i in files) {
    var fileType = validFileType(files[i]);
    if(fileType) {
      emitMessage('handler_source_changed', fileType, folderPath + files[i]);       
    }
  }
}