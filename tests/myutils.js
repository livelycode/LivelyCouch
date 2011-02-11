var vows = require('vows'),
assert = require('assert');

var myutils = require('../lib/myutils');

vows.describe('myutils').addBatch({
  'object:' : {
    topic: function() {
      var protoObj = {a: 1};
      return myutils.object(protoObj);
    },
    'has property': function(topic) {
      assert.equal(topic.a, 1);
    },
    'does inherit property': function(topic) {
      assert.isFalse(topic.hasOwnProperty('a'));
    }
  },
  'callback convenience functions:': {
    topic: function() {
      return function(method, outerCb) {
        var data = [];
        method([
        function(cb) {
          process.nextTick( function() {
            data.push(1);
            cb();
          })
        },
        function(cb) {
          data.push(2);
          cb();
        },
        function(cb) {
          data.push(3);
          cb();
        },
        function(cb) {
          data.push(4);
          cb();
        }
        ], function() {
          outerCb(null, data)
        })
      }
    },
    'doLinear': {
      topic: function(topic) {
        topic(myutils.doLinear, this.callback);
      },
      'executes linear': function(err, result) {
        assert.deepEqual(result, [1,2,3,4]);
      }
    },
    'doParallel:': {
      topic: function(topic) {
        topic(myutils.doParallel, this.callback);
      },
      'does execute all': function(err, result) {
        assert.length(result, 4);
      },
      'order is not sequential': function(err, result) {
        assert.equal(result[0],2);
      }
    }},
  'arrayForEach': {
    topic: function() {
      var that = this;
      var data = [];
      myutils.arrayForEach([1,2,3,4], function(each, cb) {
        if(each == 1) {
          process.nextTick( function() {
            data.push('last');
            cb();
          })
        } else {
        	data.push(each +1);
        	cb();
        }
      }, function() {
        that.callback(null, data)
      });
    },
    'iterates async': function(topic) {
      assert.deepEqual(topic, [3,4,5,'last']);
    }
  }
}).export(module);
