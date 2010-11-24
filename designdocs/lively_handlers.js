exports.ddoc = {
  "_id":"lively_events",
  "language": "javascript",
  "views": {
    "url-handler": {
      "map":  function(doc) {
         for(var path in doc.mapping) {
           emit('/' + doc._id + path, doc._id + '/' + doc.mapping[path]);
           if(path == '/') {
             emit('/' + doc._id, doc._id + '/' + doc.mapping[path]);
           }
         }
       }
    }
  }
}