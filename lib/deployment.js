var workerLib;
var config;
var client;
var fs = require('fs');
var path = require('path');
var myutils = require('./myutils');
var watch = require('../lib-external/watch');

var workerPath;
var workerSourcePaths = [];
var eventSourcePaths = [];
var logEvents = false;

var workerChangeListenerStarted = 'worker_change_listener_started';
var workerChangeListenerStopped = 'worker_change_listener_started';

var workerSourceChanged = 'worker_source_changed';

var initialize = function(options) {
  workerLib = options.workerLib;
  config = workerLib.config;
  client = workerLib.client;
}

var createLivelyWorkerChangeListener = function(failCount) {
  var changeListener = createChangeListener(config.livelyWorkersDbName);
  workerLib.emitLivelyEvent(workerChangeListenerStarted);
  changeListener.on('data', function(data) {
    workerLib.emitLivelyEvent(workerSourceChanged, {docid: data.id, workername: data.id});
  });
  changeListener.on('end', function(hadError) {
    workerLib.emitLivelyEvent(workerChangeListenerStopped);
    if(failCount) {
      if(failCount < 5) {
        createLivelyWorkerChangeListener(failCount + 1);
      }
    } else {
      failCount = 1;
      createLivelyWorkerChangeListener(failCount);
    }
  });
}

var createChangeListener = function(Db, query) {
  var DbInstance = client.db(Db);
  changeEmitter = DbInstance.changesStream(query);
  return changeEmitter;
}

var writeOutLivelyWorkerCode = function(id, callback) {
  writeOutAttachments(config.livelyWorkersDbName, id, callback);
}

var writeOutAttachments = function(Db, myDocId, callback) {
  var Db = client.db(Db);
  Db.getDoc(myDocId, function (error, doc) {
    if(doc) {
      var attachmentNames = [];
      if (doc._attachments) {
        var attachments = doc._attachments;
        for(var attachmentName in attachments) {
          attachmentNames.push(attachmentName);
        }
        var writeOutAttachment = function(fileNames) {
          var currFileName = fileNames[fileNames.length-1];
          Db.getAttachment(myDocId, currFileName, function(err, attachment) {
            try {
              fs.statSync(workerPath + myDocId);
            } catch(e) {
              fs.mkdirSync(workerPath + myDocId, 0777);
            }
            fs.writeFileSync(workerPath + myDocId + '/' + currFileName, attachment, encoding='utf8');
            fileNames.pop();
            if(fileNames.length > 0) {
              writeOutAttachment(fileNames);          
            } else {
              //here happens something strange - it looks like myDocId passed to the callback
              //is sometimes different to myDocId passed into the function...
              callback(myDocId)
            }
          });  
        }
        writeOutAttachment(attachmentNames);
      } else {
        callback(false);
      }
    } else {
      callback(false);
    }
  })
}

var createSourceChangeListener = function() {
  for (var i in workerSourcePaths) {
    watch.createMonitor(workerSourcePaths[i], function (monitor) {
      monitor.on('created', function (f) {
        workerChanged(f, workerSourcePaths[i], function() {});
      });
      monitor.on('removed', function (f) {
        //removeSourceFromCouch(f);
      });
      monitor.on('content_changed', function (f) {
        workerChanged(f, workerSourcePaths[i], function() {});
      });
    });
  }
}

var writeAllWorkersToCouch = function(cb) {
  var writeWorkerPaths = function(workerPaths, writeWorkerPathsCb) {
    var workerPath = workerPaths.pop();
    fs.readdir(workerPath, function(err, workerFolders) {
      var writeFolder = function(foldersLeft, writeFolderCb) {
        var folder = foldersLeft.pop();
        writeWorkerToCouch(workerPath, folder, function() {
          if(foldersLeft.length > 0) {
            writeFolder(foldersLeft, writeFolderCb);
          } else {
            writeFolderCb();
          }
        });
      }
      writeFolder(workerFolders, function() {
        if(workerPaths.length > 0) {
          writeWorkerPaths(workerPaths, writeWorkerPathsCb);
        } else {
          writeWorkerPathsCb();
        }
      })
    });
  }
  writeWorkerPaths(myutils.copyArray(workerSourcePaths), cb);
}

var writeAllEventsToCouch = function(cb) {
  var writeEventPaths = function(eventPaths, writeEventPathsCb) {
    var eventPath = eventPaths.pop();
    fs.readdir(eventPath, function(err, eventFiles) {
      var writeEventFiles = function(filePaths, writeEventFilesCb) {
        var filePath = eventPath + filePaths.pop();
        if(path.extname(filePath) == '.json') {
          var docId = path.basename(filePath, path.extname(filePath));
          writeDocToCouch(filePath, config.livelyEventsDb, docId, function() {
            if(filePaths.length > 0) {
              writeEventFiles(filePaths, writeEventFilesCb);
            } else {
              writeEventFilesCb();
            }
          });        
        } else {
          writeEventFilesCb();
        }
      };
      writeEventFiles(eventFiles, function() {
        if(eventPaths.length > 0) {
          writeEventPaths(eventPaths, writeEventPathsCb);
        } else {
          writeEventPathsCb();
        }
      });
    });
  }
  writeEventPaths(myutils.copyArray(eventSourcePaths), cb);
}

var writeWorkerToCouch = function(workerSourcePath, folderName, cb) {
  fs.readdir(workerSourcePath + folderName, function(err, files) {
    if(files) {
      var writeFiles = function(filesLeft, writeFilesCb) {
        var currFile = filesLeft.pop();
        workerChanged(workerSourcePath + folderName + '/' + currFile, workerSourcePath, function() {
          if(filesLeft.length > 0) {
            writeFiles(filesLeft, writeFilesCb);
          } else {
            writeFilesCb();
          }
        });
      };
      writeFiles(files, cb);
    } else {
      cb();
    }    
  });
}

var writeAllWorkerSourcesToDisk = function(cb) {
  config.livelyWorkersDb.allDocs(function(err, data) {
    var writeWorkers = function(workersLeft, writeWorkersCb) {
      var currWorker = workersLeft.pop();
      writeOutLivelyWorkerCode(currWorker.id, function() {
        if(workersLeft.length > 0) {
          writeWorkers(workersLeft, writeWorkersCb);
        } else {
          writeWorkersCb();
        }
      });
    }
    writeWorkers(data.rows, cb);
  });
}

var workerChanged = function(file, sourcePath, cb) {
  var sourcePathSplit = sourcePath.split('/');
  var filePathSplit = file.split('/');
  if((filePathSplit.length - sourcePathSplit.length) == 1) {
    var fileName = filePathSplit[filePathSplit.length - 1];
    var docId = filePathSplit[filePathSplit.length - 2];
    if(fileName == 'doc.json') {
      writeWorkerDocToCouch(file, docId, function() {
        cb();
      });
    } else {
      writeWorkerSourceFileToCouch(file, docId, function() {
        cb();
      })
    }
  } else {
    cb();
  }
}

var writeWorkerDocToCouch = function(file, docId, cb) {
  writeDocToCouch(file, config.livelyWorkersDb, docId, cb);
}

var writeDocToCouch = function(file, Db, docId, cb) {
  fs.readFile(file, 'utf8', function(err, data) {
    var json = JSON.parse(data);
    Db.getDoc(docId, function(er, doc) {
      if(doc) {
        json._attachments = doc._attachments;
        json._rev = doc._rev;
      }
      Db.saveDoc(docId, json, function(err, newDoc) {
        cb();
      });
    });
  });
}

var writeWorkerSourceFileToCouch = function(file, docId, cb) {
  config.livelyWorkersDb.getDoc(docId, function(er, doc) {
    if(doc) {
      config.livelyWorkersDb.saveAttachment(file, docId, {rev: doc._rev}, function(err, data) {
        cb();
      });
    } else {
      config.livelyWorkersDb.saveDoc(docId, {}, function(err, newDoc) {
        config.livelyWorkersDb.saveAttachment(file, docId, {rev: newDoc.rev}, function(err, data) {
          cb();
        });
      });
    }
  });
}

var checkAndDeploy = function(checkAndDeployCb) {
  var checkDirectories = function() {
    var checkDirectory = function(dir) {
      try {
        fs.statSync(dir);
      } catch(e) {
        fs.mkdirSync(dir, 0777);
      }
    }
    var paths = [workerPath];
    paths.forEach(function(path) {checkDirectory(path)});
  }
  var checkDatabases = function(checkDatabasesCb) {
    var checkDatabase = function(db, designDocFile, designDocName, cb) {
      db.exists(function(exists) {
        if(exists) {
          cb();
        } else {
          db.create(function() {
            if(designDocFile) {
              var designDoc = require('../' + designDocFile).ddoc;
              myutils.stringifyFunctions(designDoc);
              db.saveDoc(designDocName, designDoc, function(err, res) {
                cb();
              });            
            } else {
              cb();
            }
          });
        }
      });    
    };
    
    myutils.doParallel([
      function(cb) {checkDatabase(config.livelyEventsDb, './designdocs/lively_events', '_design/lively_events', cb)},
      function(cb) {checkDatabase(config.livelyWorkersDb, null, null, cb)},
      function(cb) {checkDatabase(config.livelyLogsDb, './designdocs/lively_logs', '_design/lively_logs', cb)}
    ], checkDatabasesCb);
  };
  
  client.request('/_config/lively', function(err, response) {
    workerPath = response.worker_path;
    workerSourcePaths = JSON.parse(response.worker_source_paths);
    eventSourcePaths = JSON.parse(response.event_source_paths);
    logEvents = JSON.parse(response.log_to_couch);
    exports.workerPath = workerPath;
    exports.logEvents = logEvents;
    checkDirectories();
    myutils.doLinear([
        function(cb) {checkDatabases(cb)},
        function(cb) {writeAllEventsToCouch(cb)},
        function(cb) {writeAllWorkersToCouch(cb)},
      ], function() {
        checkAndDeployCb();
      }
    );
  });
}

exports.initialize = initialize;
exports.checkAndDeploy = checkAndDeploy;
exports.createLivelyWorkerChangeListener = createLivelyWorkerChangeListener;
exports.createSourceChangeListener = createSourceChangeListener;
exports.writeOutLivelyWorkerCode = writeOutLivelyWorkerCode;
exports.workerPath = workerPath;
exports.logEvents = logEvents;