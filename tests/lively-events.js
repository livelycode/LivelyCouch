var vows = require('vows'),
    assert = require('assert');
    
var livelyEvents = require('../lively-events');

vows.describe('lively-events').addBatch({
	'startup:' : {
		topic: function() {
			return 5
		},
		'is 5': function(topic) {
			assert.equal(topic, 5);
		}
	}
}).export(module);
