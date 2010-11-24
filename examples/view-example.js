
exports.run = function(parameters, response, viewLib) {
  var client = viewLib.couchdb.createClient(5984, '127.0.0.1', 'user', 'password');
  var userDb = client.db('people');
  
  var hairColour = parameters.query.haircolour;
  var startAge = parameters.query.startage;
  var endAge = parameters.query.endage;
  // calling a view to get all people between 30 and 40
  userDb.view('my-design-doc', 'people-per-age', {startkey=startAge, endkey=endAge}, function(data) {
  
    // filtering all rows that have the specified hair colour:
    var filteredRows = data.rows.filter(function(row) {
      return row.value.haircolor == hairColour;
    });
    
    // writing out all filtered rows to the response:
    response.writeHead(200, {'Content-Type': 'text/plain'});
    response.write(JSON.stringify(filteredRows));
    response.end();
    
  }) 
}