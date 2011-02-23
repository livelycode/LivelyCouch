var couchdb = require('./lib-external/couchdb');
exports.couchdbPort = 5984;
exports.couchdbHost = '127.0.0.1';
var client = couchdb.createClient(exports.couchdbPort, exports.couchdbHost, 'lively', 'lively');

exports.couchdb = couchdb;
exports.client = client;

exports.eventsSource = [__dirname + '/event-subscribers/'];
exports.workersSource = [__dirname + '/workers-source/'];
exports.workersDeployed = __dirname + '/workers-deployed/';
exports.logPath = __dirname + '/logs/';

exports.eventsDbName = 'lively_subscribers';
exports.workersDbName = 'lively_workers';
exports.logsDbName = 'lively_logs';

exports.logToCouch = true;

exports.eventsDb = client.db(exports.eventsDbName);
exports.workersDb = client.db(exports.workersDbName);
exports.logsDb = client.db(exports.logsDbName);