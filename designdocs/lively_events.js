exports.ddoc = {
  "_id":"lively_events",
  "language": "javascript",
  "views": {
    "triggering-urls": {
      "map": function(doc) {
        if(!doc.disabled) {
          for (var i in doc.trigger) {
            var workers = {};
            doc.workers.map(function(each) {
              var params = each.parameters;
              if(!params) params = {};
              workers[each.name] = params;
            })
            emit(doc.trigger[i].path, workers);
          }
        }
      }
    },
    "triggering-urls-new": {
      "map": function(doc) {
        if(!doc.disabled) {
          for (var i in doc.trigger) {
            emit(doc.trigger[i].path, {trigger: doc.trigger[i], workers: doc.workers});
          }
        }
      }
    }
  }
}