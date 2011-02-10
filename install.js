var http = require('http');
var sys = require('sys');
var workerLib = require('./lib/workerlib');
var client = workerLib.client;

var livelyPath = process.cwd();

var livelySettings = [
  ['lively', 'worker_path', livelyPath + '/workers_deployed/'],
  ['lively', 'worker_source_paths', '["' + livelyPath + '/workers-source/"]'],
  ['lively', 'event_source_paths', '["' + livelyPath + '/events-source/"]'],
  ['lively', 'log_to_couch', 'true']
];

var couchSettings = [
  ['httpd_global_handlers', '_events', '{couch_httpd_proxy, handle_proxy_req, <<"http://127.0.0.1:8125">>}'],
  ['os_daemons', 'livelyevents_daemon', 'node ' + livelyPath + '/lively-events.js'],
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
      if(err) {
        console.log(err);
      } else {
        if(settings.length > 0) {
          setTimeout(function() {saveSettings(settings, timeout, cb)}, timeout);
        } else {
          cb();
        }
      }
  });
}



saveSettings(livelySettings, 0, function() {
  saveSettings(couchSettings, 1000, function() {
    console.log('Installation successful. LivelyCouch has started. Time to live.');
  });
});