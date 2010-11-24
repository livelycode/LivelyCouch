exports.ddoc = {
  "_id":"lively_events",
  "language": "javascript",
  "views": {
    "triggering-urls": {
      "map": function(doc) {
        for (var url in doc.trigger) {
          if(!doc.disabled) {
            emit(url, doc.workers);
          }
        }
      }
    }
  }
}