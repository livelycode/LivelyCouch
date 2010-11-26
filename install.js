var http = require('http');
var sys = require('sys');
var workerLib = require('./lib/workerlib');
var client = workerLib.client;

var livelyPath = process.cwd();

var livelySettings = [
  ['lively', 'handler_path', livelyPath + '/handlers-deployed/'],
  ['lively', 'worker_path', livelyPath + '/workers_deployed/'],
  ['lively', 'handler_source_paths', '["' + livelyPath + '/handlers-source/"]'],
  ['lively', 'worker_source_paths', '["' + livelyPath + '/workers-source/"]'],
  ['lively', 'event_source_paths', '["' + livelyPath + '/events-source/"]'],
  ['lively', 'log_to_couch', 'true']
];

var couchSettings = [
  ['httpd_global_handlers', '_node', '{couch_httpd_proxy, handle_proxy_req, <<"http://127.0.0.1:8126">>}'],
  ['httpd_global_handlers', '_events', '{couch_httpd_proxy, handle_proxy_req, <<"http://127.0.0.1:8125">>}'],
  ['os_daemons', 'livelyevents_daemon', 'node ' + livelyPath + '/lively-events.js'],
  ['os_daemons', 'livelyviews_daemon', 'node ' + livelyPath + '/lively-handlers.js']
];

livelySettings.reverse();
couchSettings.reverse();

var saveSettings = function(settings, timeout, cb) {
  var setting = settings.pop();
  client.request({
      method: 'PUT',
      path: '/_config/' + setting[0] + '/' + setting[1],
      data: JSON.stringify(setting[2]),
      responseEncoding: 'binary'
    }, function(err, res) {
      console.log(err);
      console.log(res);
      if(settings.length > 0) {
        setTimeout(function() {saveSettings(settings, timeout, cb)}, timeout);
      } else {
        cb();
      }
  });
}



saveSettings(livelySettings, 0, function() {
  console.log('done');
});
saveSettings(couchSettings, 1000, function() {
  console.log('done');
});