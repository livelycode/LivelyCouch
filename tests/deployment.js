var vows = require('vows'),
assert = require('assert');
var workerLib = require('../lib/workerlib');
workerLib.initialize('lively_events');
var client = workerLib.client;
var deployment = require('../lib/deployment');
deployment.initialize({workerLib: workerLib});
var myutils = require('../lib/myutils');
var config = require('../config');

vows.describe('deployment').addBatch({
  'configuration':  {
    topic: function() {
      return config;
    },
    'isValid': function(config) {
      assert.include(config, 'workersDeployed');
      assert.include(config, 'workersSource');
      assert.include(config, 'eventsSource');
    },
    'deployment process:' : {
      topic: function(config) {
        var that = this;
        deployment.checkAndDeploy( function() {
          var data = {
            directories: {},
            databases: {}
          };
          myutils.arrayForEach([config.eventsDb, config.workersDb, config.logsDb], function(each, cb) {
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
        assert.isTrue(data.databases[config.eventsDb.name]);
        assert.isTrue(data.databases[config.workersDb.name]);
        assert.isTrue(data.databases[config.logsDb.name]);
      }
    }
  }
}).export(module);
