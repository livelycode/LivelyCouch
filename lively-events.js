var http = require('http');
var url = require('url');
var sys = require('sys');
var fs = require('fs');
var path = require('path');
var spawn = require('child_process').spawn;
var Script = process.binding('evals').Script;
var EventEmitter = require('events').EventEmitter;
var workerLib = require('./lib/workerlib');
var couchDb = workerLib.couchdb;
var mustache = require('./lib/mustache');
var watch = require('./lib/watch');

//values are being initialized in startup()
var workerPath;
var handlerPath;
var workerSourcePaths = [];
var eventSourcePaths = [];
var logEvents = false;


var internalWorkers = {};

var client = couchDb.createClient(5984, '127.0.0.1', 'lively', 'lively');
var livelyEventsDbName = 'lively_events';
var livelyWorkersDbName = 'lively_workers';
var livelyHandlersDbName = 'lively_handlers';
var livelyLogsDbName = 'lively_logs';

var eventNamespace = 'lively_events';
workerLib.setEventNamespace(eventNamespace);

//configurable event emits
var emitEvents = true;
var startUpEvent = 'lively_events_started';
var stopEvent = 'lively_events_stopped';

var workerChangeListenerStarted = 'worker_change_listener_started';
var workerChangeListenerStopped = 'worker_change_listener_started';

var workerStart = 'worker_started';
var workerExecuted = 'worker_executed';
var workerStop = 'worker_stopped';
var workerWritten = 'worker_written';
var workerError = 'worker_error';
var workerSourceChanged = 'worker_source_changed';
var workerReady = 'worker_ready';
var workerReset = 'worker_reset';

var livelyEventsDb = client.db(livelyEventsDbName);
var livelyWorkersDb = client.db(livelyWorkersDbName);
var livelyHandlersDb = client.db(livelyHandlersDbName);
var livelyLogsDb = client.db(livelyLogsDbName);

var runningWorkers = {};
var readyWorkers = {};
var workerQueue = [];
var stats = {};

var launchEventSystem = function() {
  http.createServer(function (request, response) {
    var urlObject = url.parse(request.url, true);
    var pathName = urlObject.pathname;
    var eventArguments = {requestMethod: request.method, event: pathName};
    if (request.method == 'POST') {
      var postData = '';
      request.on('data', function(data) {
        postData += data;
      });
      request.on('end', function() {
        eventArguments.postData = postData;
        handleHTTPEvent(pathName, eventArguments, response);
      });
    } else {
      eventArguments.query = {};
      for(var queryParam in urlObject.query) {
        try {
          eventArguments.query[queryParam] = JSON.parse(urlObject.query[queryParam]);     
        } catch(e) {
          eventArguments.query[queryParam] = urlObject.query[queryParam];
        }
      }
      if(!eventArguments.query) eventArguments.query = {};
      handleHTTPEvent(pathName, eventArguments, response);
    }
  }).listen(8125);
  workerLib.emitLivelyEvent(startUpEvent, {});
  console.log('LivelyCouch Event System running at http://127.0.0.1:8125/');
}

var handleHTTPEvent = function(eventName, eventArguments, response) {
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.end(JSON.stringify({received: true}));
  livelyEventsDb.view('lively_events', 'triggering-urls', {key: eventName}, function(err, resp) {
    var rows = resp.rows;
    var triggeredWorkers = [];
    for (var i in rows) {
      for (var workerName in rows[i].value) {
        var parameters = rows[i].value[workerName];
        for (var param in parameters) {
          if(!eventArguments.query[param]) {
            eventArguments.query[param] = parameters[param];          
          }
        }
        triggeredWorkers.push({workerName: workerName, eventArguments: eventArguments});
        executeWorker(workerName, eventArguments);
      }
    }
    logEvent({eventMessage: eventName, eventArguments: eventArguments, triggeredWorkers: triggeredWorkers});
  });    
}

var logEvent = function(log) {
  if(logEvents) {
    var doc = {log: log, timestamp: new Date().getTime()};
    livelyLogsDb.saveDoc(doc);
  }
}

var createLivelyWorkerChangeListener = function(failCount) {
  var changeListener = createChangeListener(livelyWorkersDbName);
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
  changeEmitter = DbInstance.changesStream();
  return changeEmitter;
}

var writeOutLivelyWorkerCode = function(id, callback) {
  writeOutAttachments(livelyWorkersDbName, id, callback);
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
      })
      monitor.on('removed', function (f) {
        //removeSourceFromCouch(f);
      })
      monitor.on('content_changed', function (f) {
        workerChanged(f, workerSourcePaths[i], function() {});
      })
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
  writeWorkerPaths(copyArray(workerSourcePaths), cb);
}

var writeAllEventsToCouch = function(cb) {
  var writeEventPaths = function(eventPaths, writeEventPathsCb) {
    var eventPath = eventPaths.pop();
    fs.readdir(eventPath, function(err, eventFiles) {
      var writeEventFiles = function(filePaths, writeEventFilesCb) {
        var filePath = eventPath + filePaths.pop();
        if(path.extname(filePath) == '.json') {
          var docId = path.basename(filePath, path.extname(filePath));
          writeDocToCouch(filePath, livelyEventsDb, docId, function() {
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
  writeEventPaths(copyArray(eventSourcePaths), cb);
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
  livelyWorkersDb.allDocs(function(err, data) {
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
  writeDocToCouch(file, livelyWorkersDb, docId, cb);
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
  livelyWorkersDb.getDoc(docId, function(er, doc) {
    if(doc) {
      livelyWorkersDb.saveAttachment(file, docId, {rev: doc._rev}, function(err, data) {
        cb();
      });
    } else {
      livelyWorkersDb.saveDoc(docId, {}, function(err, newDoc) {
        livelyWorkersDb.saveAttachment(file, docId, {rev: newDoc.rev}, function(err, data) {
          cb();
        });
      });
    }
  });
}

var openStdin = function() {
  var stdin = process.openStdin();
  
  stdin.on('data', function(d) {
    server.listen(parseInt(JSON.parse(d)));
  });
  
  stdin.on('end', function() {
    workerLib.emitLivelyEvent(stopEvent);
    console.log('lively-events.js exits');
    process.exit(0);
  });
}

var workerIsReady = function(workerName) {
  readyWorkers[workerName] = true;
  var workersToExecute = [];
  workerQueue = workerQueue.filter(function(queuedWorker) {
    if(queuedWorker.workerName == workerName) {
      workersToExecute.push(queuedWorker);
      return false
    } else {
      return true
    }
  });
  workersToExecute.forEach(function(queuedWorker) {
    executeWorker(queuedWorker.workerName, queuedWorker.eventArguments);  
  });
}

var isWorkerReady = function(workerName) {
  if(readyWorkers[workerName]) {
    return true
  } else {
    return false
  }
}

var queueWorker = function(workerName, eventArguments) {
  workerQueue.push({workerName: workerName, eventArguments: eventArguments});
}

var executeWorker = function(workerName, eventArguments) {
  switch(workerName) {
    case 'reset_worker':
      internalWorkers.resetWorker(eventArguments);
      break;
    case 'write_worker_to_disk':
      internalWorkers.writeWorkerToDisk(eventArguments);
      break;
    case 'write_worker_to_couch':
      internalWorkers.writeWorkerToCouch(eventArguments);
      break;
    case 'worker_source_changelistener':
      internalWorkers.workerSourceChangeListener(eventArguments);
      break;
    default:
      if(isWorkerReady(workerName)) {
        executeExternalWorker(workerName, eventArguments);
      } else {
        queueWorker(workerName, eventArguments);
      }
  }
}

var executeExternalWorker = function(workerName, eventArguments) {
  livelyWorkersDb.getDoc(workerName, function(error, doc) {
    if(error) {
      workerLib.emitLivelyEvent(workerError + '/' + workerName, {workername: workerName});
    } else {
      var scriptName = doc.delegate;
      var arguments = doc.arguments;
      arguments.path = workerPath + workerName + '/';
      arguments.eventArguments = eventArguments;
      
      if(runningWorkers[workerName]) {
        var worker = runningWorkers[workerName].worker;
      } else {
        var worker = spawn('node', [workerPath + workerName + '/' + scriptName], {cwd: workerPath});
        runningWorkers[workerName] = {worker: worker};
        workerLib.emitLivelyEvent(workerStart + '/' + workerName, {docid: doc._id, workername: workerName});
      }
      worker.stdout.on('data', function (data) {
        console.log('stdout: ' + data);
      });
      worker.stderr.on('data', function (data) {
        sys.print('stderr: ' + data);
      });
      worker.on('exit', function (code) {
        runningWorkers[workerName] = null;
        workerLib.emitLivelyEvent(workerStop + '/' + workerName, {docid: doc._id, workername: workerName});
      });
      workerLib.emitLivelyEvent(workerExecuted + '/' + workerName, {docid: doc._id, workername: workerName});
      // it can happen that multiple arguments get read at once in the worker's stdin - thats why we mark them with a trailing \n
      worker.stdin.write(JSON.stringify(arguments) + '\n');     
    }
  });
}

// start internal Workers
internalWorkers.resetWorker = function(params) {
  workerName = params.query.workername;
  if(runningWorkers[workerName]) {
    var oldWorker = runningWorkers[workerName].worker;
    runningWorkers[workerName] = null;
    oldWorker.stdin.end();
    workerLib.emitLivelyEvent(workerReset + '/' + workerName);
  } else {
    workerLib.emitLivelyEvent(workerReady + '/' + workerName);  
  }
  workerIsReady(workerName);
}

internalWorkers.writeWorkerToDisk = function(params) {
  workerName = params.query.workername;
  writeOutLivelyWorkerCode(workerName, function(workerNameWritten) {
    if(workerNameWritten) {
      //console.log('###original: ' + workerName + ' got back: ' + workerNameWritten);
      workerLib.emitLivelyEvent(workerWritten, {docid: workerNameWritten, workername: workerNameWritten})
    }
  });
}

internalWorkers.writeWorkerToCouch = function(params) {
  var workersDir = params.query.workersdirectory;
  var workerName = workerName = params.query.workername;
  writeWorkerToCouch(workersDir, workerName, function() {
    //worker written
  });
}

internalWorkers.workerSourceChangeListener = function(params) {
  createSourceChangeListener();
}

// end internal Workers

var startup = function() {
  var checkDirectories = function() {
    var checkDirectory = function(dir) {
      try {
        fs.statSync(dir);
      } catch(e) {
        fs.mkdirSync(dir, 0777);
      }    
    }
    var paths = [handlerPath, workerPath];
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
              var designDoc = require(designDocFile).ddoc;
              stringifyFunctions(designDoc);
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
    
    checkDatabase(livelyEventsDb, './designdocs/lively_events', '_design/lively_events', function() {
      checkDatabase(livelyWorkersDb, null, null, function() {
        checkDatabase(livelyHandlersDb, './designdocs/lively_handlers', '_design/lively_handlers', function() {
          checkDatabase(livelyLogsDb, './designdocs/lively_logs', '_design/lively_logs', function() {
            checkDatabasesCb();
          })
        })
      })
    })
  };
  
  client.request('/_config/lively', function(err, response) {
    handlerPath = response.handler_path;
    workerPath = response.worker_path;
    workerSourcePaths = JSON.parse(response.worker_source_paths);
    eventSourcePaths = JSON.parse(response.event_source_paths);
    logEvents = JSON.parse(response.log_to_couch);
    openStdin();
    checkDirectories();
    checkDatabases(function() {
      writeAllEventsToCouch(function() {
        writeAllWorkersToCouch(function() {
            launchEventSystem();
            createLivelyWorkerChangeListener();
        });
      });
    });

  });
}

function object(o) {
    function F() {}
    F.prototype = o;
    return new F();
}
function copyArray(a) {
  return a.map(function(value) {return value});
}
var stringifyFunctions = function (x) {
  for (i in x) {
    if (i[0] != '_') {
      if (typeof x[i] == 'function') {
        x[i] = x[i].toString()
      }
      if (typeof x[i] == 'object') {
        stringifyFunctions(x[i])
      }
    }
  }
}


startup();