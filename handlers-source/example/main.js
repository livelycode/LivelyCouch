

exports.run = function(arguments, response, viewLib) {
  var couchdb = viewLib.couchdb;
  var mustache = viewLib.mustache;
  response.writeHead(200, {'Content-Type': 'text/plain'});
  response.write('test');
  response.end();
}