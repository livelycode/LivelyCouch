function(head, req) {
var Mustache = require("vendor/couchapp/lib/mustache");
var row;
var that = this;
provides('html', function() {
  send('<html><head></head><body><table>');
  while (row = getRow()) {
    var eventData = row.value;
    eventData.time = new Date(row.key);
    var params = eventData.event.parameters;
    eventData.event.parameters = [];
    for(var key in params) {
      eventData.event.parameters.push({name: key, value: JSON.stringify(params[key])})
    }
    eventData.triggeredWorkers = eventData.triggeredWorkers.map( function(each) {
      var params = each.parameters;
      each.parameters = [];
      for(var key in params) {
        each.parameters.push({name: key, value: JSON.stringify(params[key])})
      }
      return each;
    });
    send(Mustache.to_html(that.templates.history, row.value));
  }
  return '</table></body></html>';
});
}