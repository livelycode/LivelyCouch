var couchdb = require('./lib-external/couchdb');
var client = couchdb.createClient(5984, '127.0.0.1', 'lively', 'lively');
exports.couchdb = couchdb;
exports.client = client;

exports.eventsSource = [__dirname + '/events-source/'];
exports.workersSource = [__dirname + '/workers-source/'];
exports.workersDeployed = __dirname + '/workers-deployed/';
exports.logPath = __dirname + '/logs/';

exports.eventsDbName = 'lively_events';
exports.workersDbName = 'lively_workers';
exports.logsDbName = 'lively_logs';

exports.logToCouch = true;

exports.eventsDb = client.db(exports.eventsDbName);
exports.workersDb = client.db(exports.workersDbName);
exports.logsDb = client.db(exports.logsDbName);

