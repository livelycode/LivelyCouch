exports.init = function(options) {
  var deployment = options.deployment;
  var workerLib = options.workerLib;
  var config = workerLib.config;
  var client = workerLib.client;

  var sys = require('sys');
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
    workerQueue = workerQueue.filter( function(queuedWorker) {
      if(queuedWorker.workerName == workerName) {
        workersToExecute.push(queuedWorker);
        return false
      } else {
        return true
      }
    });
    workersToExecute.forEach( function(queuedWorker) {
      executeWorker(queuedWorker.workerName, queuedWorker.event);
    });
  }
  var isWorkerReady = function(workerName) {
    if(readyWorkers[workerName]) {
      return true
    } else {
      return false
    }
  }
  var queueWorker = function(workerName, event) {
    workerQueue.push({workerName: workerName, event: event});
  }
  var executeWorker = function(workerName, event) {
    switch(workerName) {
      case 'reset_worker':
        internalWorkers.resetWorker(event);
        break;
      case 'write_worker_to_disk':
        internalWorkers.writeWorkerToDisk(event);
        break;
      case 'write_worker_to_couch':
        internalWorkers.writeWorkerToCouch(event);
        break;
      case 'worker_source_changelistener':
        internalWorkers.workerSourceChangeListener(event);
        break;
      default:
        if(isWorkerReady(workerName)) {
          executeExternalWorker(workerName, event);
        } else {
          queueWorker(workerName, event);
        }
    }
  }
  var executeExternalWorker = function(workerName, event) {
    config.workersDb.getDoc(workerName, function(error, doc) {
      if(error) {
        workerLib.emitLivelyEvent(workerError + '/' + workerName, {workername: workerName});
      } else {
        var scriptName = doc.delegate;
        if (runningWorkers[workerName]) {
          var worker = runningWorkers[workerName].worker;
        } else {
          var worker = spawn('node', [config.workersDeployed + workerName + '/' + scriptName], {cwd: config.workersDeployed});
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
        worker.stdin.write(JSON.stringify(event) + '\n');
      }
    });
  }
  // start internal Workers
  internalWorkers.resetWorker = function(event) {
    workerName = event.parameters.workername;
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
  internalWorkers.writeWorkerToDisk = function(event) {
    workerName = event.parameters.workername;
    deployment.writeOutWorkerCode(workerName, function(workerNameWritten) {
      if(workerNameWritten) {
        workerLib.emitLivelyEvent(workerWritten, {docid: workerNameWritten, workername: workerNameWritten})
      }
    });
  }
  internalWorkers.writeWorkerToCouch = function(event) {
    var workersDir = event.parameters.workersdirectory;
    var workerName = workerName = event.parameters.workername;
    deployment.writeWorkerToCouch(workersDir, workerName, function() {
      //worker written
    });
  }
  internalWorkers.workerSourceChangeListener = function(event) {
    deployment.createSourceChangeListener();
  }
  // end internal Workers
  return {
    executeWorker: executeWorker
  }
}
