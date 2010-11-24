
exports.run = function(parameters, response, viewLib) {
  var couchdb = viewLib.couchdb;
  var mustache = viewLib.mustache;
  var client = couchdb.createClient(5984, '127.0.0.1', 'admin', 'atlas3557');
  
  var respond = function() {
    var query = parameters.query;
    var user = query.user;
    var dbName = user;
    var userDb = client.db(dbName);
    var userRoles = [user + '_read', user + '_write'];
    userDb.create(function(err, response1) {
      secObj = {
        admins:{
          names:[user],
          roles: [user, 'admin']
        },
        readers: {
          names: [],
          roles: []
        }
      };
      client.request({method: 'PUT', path: '/' + dbName + '/_security', data:secObj}, function(err1, response2) {
        client.request({
            method: 'PUT',
            path: '/_users/_design/_auth/_update/roles/org.couchdb.user:' + user,
            query: {roles: JSON.stringify(userRoles)}
          }, function(err, response3) {
            response.writeHead(200, {'Content-Type': 'text/plain'});
            response.write('{"success":true}');
            response.end();
            client.replicate('atlas_template', dbName);    
          }
        ); 
      })
    })
  };
  respond();
}
