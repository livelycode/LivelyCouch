var couchdb = require('./lib-external/couchdb');
exports.livelyPort = 8125;

exports.couchdbPort = 5984;
exports.couchdbHost = '127.0.0.1';
exports.couchdbUser = 'lively';
exports.couchdbPassword = 'lively';
var client = couchdb.createClient(exports.couchdbPort, exports.couchdbHost, exports.couchdbUser, exports.couchdbPassword);

exports.couchdb = couchdb;
exports.client = client;

exports.rootPath = __dirname;
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