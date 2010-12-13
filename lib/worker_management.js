var deployment = require('./deployment');
var workerLib = require('./workerlib');
var config = require('../config');
var spawn = require('child_process').spawn;

var workerWritten = 'worker_written';
var workerReady = 'worker_ready';
var workerReset = 'worker_reset';
var workerStart = 'worker_started';
var workerExecuted = 'worker_executed';
var workerStop = 'worker_stopped';
var workerError = 'worker_error';

var runningWorkers = {};
var readyWorkers = {};
var workerQueue = [];
var stats = {};

var internalWorkers = {};

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
  config.livelyWorkersDb.getDoc(workerName, function(error, doc) {
    if(error) {
      workerLib.emitLivelyEvent(workerError + '/' + workerName, {workername: workerName});
    } else {
      var scriptName = doc.delegate;
      var arguments = {
        event: eventArguments
      };
      
      if(runningWorkers[workerName]) {
        var worker = runningWorkers[workerName].worker;
      } else {
        arguments.worker = {
          parameters: doc.parameters,
          source_path: deployment.workerPath + workerName + '/',
        };
        var worker = spawn('node', [deployment.workerPath + workerName + '/' + scriptName], {cwd: deployment.workerPath});
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
  workerName = params.parameters.workername;
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
  workerName = params.parameters.workername;
  deployment.writeOutLivelyWorkerCode(workerName, function(workerNameWritten) {
    if(workerNameWritten) {
      //console.log('###original: ' + workerName + ' got back: ' + workerNameWritten);
      workerLib.emitLivelyEvent(workerWritten, {docid: workerNameWritten, workername: workerNameWritten})
    }
  });
}

internalWorkers.writeWorkerToCouch = function(params) {
  var workersDir = params.parameters.workersdirectory;
  var workerName = workerName = params.parameters.workername;
  deployment.writeWorkerToCouch(workersDir, workerName, function() {
    //worker written
  });
}

internalWorkers.workerSourceChangeListener = function(params) {
  deployment.createSourceChangeListener();
}

// end internal Workers

exports.executeWorker = executeWorker;
