var workerLib = require('./lib/workerlib');
var client = workerLib.client;

exports.livelyEventsDbName = 'lively_events';
exports.livelyWorkersDbName = 'lively_workers';
exports.livelyHandlersDbName = 'lively_handlers';
exports.livelyLogsDbName = 'lively_logs';


exports.livelyEventsDb = client.db(exports.livelyEventsDbName);
exports.livelyWorkersDb = client.db(exports.livelyWorkersDbName);
exports.livelyHandlersDb = client.db(exports.livelyHandlersDbName);
exports.livelyLogsDb = client.db(exports.livelyLogsDbName);