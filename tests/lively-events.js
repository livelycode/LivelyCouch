var vows = require('vows'),
assert = require('assert');

var livelyEvents = require('../lively-events');
console.log(livelyEvents);
vows.describe('lively-events').addBatch({
  'startup:' : {
    topic: function() {
      var that = this;
      livelyEvents.statusEmitter.on('started', function() {
        that.callback(null, true)
      });
    },
    'has started': function(topic) {
      assert.
      true(topic);
    }
  }
}).export(module);
