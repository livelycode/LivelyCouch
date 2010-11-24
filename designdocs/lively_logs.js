exports.ddoc = {
  "_id":"lively_logs",
  "language": "javascript",
  "views": {
    "latest-logs": {
      "map": function(doc) {
        emit(doc.timestamp, doc.log);
      }
    }
  }
}