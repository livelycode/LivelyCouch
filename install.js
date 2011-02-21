var http = require('http');
var sys = require('sys');
var workerLib = require('./lib/workerlib');
var client = workerLib.client;

var couchSettings = [
  ['httpd_global_handlers', '_events', '{couch_httpd_proxy, handle_proxy_req, <<"http://127.0.0.1:8125">>}'],
  ['os_daemons', 'livelyevents_daemon', 'node ' + __dirname + '/lively-events.js'],
];

couchSettings.reverse();

var saveSettings = function(settings, cb) {
  var setting = settings.pop();
  client.request({
      method: 'PUT',
      path: '/_config/' + setting[0] + '/' + setting[1],
      data: JSON.stringify(setting[2]),
      responseEncoding: 'binary'
    }, function(err, res) {
      resObj = JSON.parse(res);
      if(err) {
      	console.log("cannot connect to CouchDB!");
      	return;
      }
      if(resObj.error) {
        console.log(resObj);
      } else {
        if(settings.length > 0) {
          saveSettings(settings, cb);
        } else {
          cb();
        }
      }
  });
}



  saveSettings(couchSettings, function() {
    console.log('Installation successful. LivelyCouch has started. Time to live.');
  });
