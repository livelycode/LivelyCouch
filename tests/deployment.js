var vows = require('vows'),
assert = require('assert');
var config = require('../config');
var workerLib = require('../lib/workerlib');
workerLib.initialize('lively_events');
var client = workerLib.client;
var deployment = require('../lib/deployment');
deployment.initialize({workerLib: workerLib});
var myutils = require('../lib/myutils');

vows.describe('deployment').addBatch({
  'configuration':  {
    topic: function() {
      var that = this;
      client.request('/_config/lively', function(err, response) {
        that.callback(null, {
          workerPath: response.worker_path,
          workerSourcePaths: JSON.parse(response.worker_source_paths),
          eventSourcePaths: JSON.parse(response.event_source_paths)
        });
      })
    },
    'isValid': function(err, config) {
      assert.include(config, 'workerPath');
      assert.include(config, 'workerSourcePaths');
      assert.include(config, 'eventSourcePaths');
    },
    'deployment process:' : {
      topic: function(configData) {
        var that = this;
        deployment.checkAndDeploy( function() {
          var data = {
            directories: {},
            databases: {
            }
          };
          myutils.arrayForEach([config.livelyEventsDb, config.livelyWorkersDb, config.livelyLogsDb], function(each, cb) {
            each.exists( function(err, exists) {
              data.databases[each.name] = exists;
              cb();
            });
          }, function() {
            that.callback(null, data);
          });
        })
      },
      'has created directories': function(err, data) {
        assert.include(data, 'directories');
      },
      'has created databases': function(err, data) {
        assert.isTrue(data.databases[config.livelyEventsDb.name]);
        assert.isTrue(data.databases[config.livelyWorkersDb.name]);
        assert.isTrue(data.databases[config.livelyLogsDb.name]);
      }
    }
  }
}).export(module);
