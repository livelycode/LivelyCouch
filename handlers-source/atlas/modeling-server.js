
exports.run = function(parameters, response, viewLib) {
  var couchdb = viewLib.couchdb;
  var mustache = viewLib.mustache;
  var client = couchdb.createClient(5984, '127.0.0.1', 'admin', 'atlas3557');
  
  var modeling = (function (ns) {
	ns.cachedNames = {};
    ns.cachedRelNames = {};
    ns.path = "/atlas1/_design/modeling/";
    
    ns.nameLookupForItemIds = function (ids, callback) {
      client.request({method: "POST", data: {keys:ids}, path: this.path + '_view/id_name'}, function(err, response) {
        var rows = response.rows;
        var lookup = {};
        for (var i in rows) {
          var id = rows[i].key;
          var name = rows[i].value;
          lookup[id] = name
        }
        callback(lookup);
      });
    }

    
    ns.revision = function (id, callback) {
      client.request(this.path + '_view/id_rev?key="'+id+'"', function(err, response) {
        callback(response.rows[0].value)
      });
    }
    
    ns.getRelationships = function (id, callback) {
      client.request(this.path + '_view/relationships?startkey=["'+id + '"]&endkey=["' +id+ '",[]]&reduce=false', function(err, response) {
        var result = [];
        var rows = response.rows;
        for (var rowid in rows) {
          var targetId = (rows[rowid].key)[1];
          var relDetails = rows[rowid].value;
          relDetails.target = targetId;
          result.push(relDetails);
        }
        callback(result);
      });
    }
    
    ns.loadSearchData = function (name, callback) {
      var data = [];
      var row;
      var query = {startkey: '"' + name + '"', endkey: '"' + name + '\ufff0"', limit: 10};
      client.request(this.path + '_view/name_id?' + viewLib.toQueryString(query), function(err, response) {
        response = response.rows
        for (var rowid in response) {
          data.push({name: response[rowid].key, id: response[rowid].id});
        }
        callback(response);      
      });
    }
    
    ns.loadJitFormat = function (startid, levels, callback) {
      var that = this;
      var jit = [];
      var nodes = [];
      var itemIdsToResolve = [];
      var adjToClose = [];
      var relnode;
      function nodeToJit(id, rels) {
        var newnodes = [];
        var node = {
          "id": id,
          "name": null,
          "data": {"type": "item"}
        };
        newnodes.push(node);
        var adj = [];
        for (var relnum in rels) {
          relnode = {
            "id": rels[relnum].relid.replace('|','-'),
            "name": rels[relnum].desc,
            "data": {"type": "relationship", "$type": "star", "source": id, "target": rels[relnum].target, "desc": rels[relnum].desc, "descInv": rels[relnum].descInverse},
            "adjacencies": [{"nodeTo": rels[relnum].target}, {"nodeTo": id}]
          };
          newnodes.push(relnode);
          adj.push({"nodeTo": rels[relnum].relid.replace('|','-'), "data": {}});
        }
        node.adjacencies = adj;
        return newnodes;
      }
      function addAllRelated(id, levels, addAllRelatedCallback) {
        //if(nodes.indexOf(id) != -1) {return false}
        nodes.push(id);
        var recursionCount = 0;
        var recursionDone = function(level) {
          recursionCount += -1;
          if(recursionCount == 0) {
            addAllRelatedCallback();          
          }
        }
        that.getRelationships(id, function(response) {
          var newjit = nodeToJit(id, response);
          jit = jit.concat(newjit);
          if (levels > 0) {
            for (var relid in newjit) {
              if(relid > 0) {
                recursionCount ++;
              }
            }
            if(recursionCount == 0) {addAllRelatedCallback(levels)};
            for (var relid in newjit) {
              if(relid > 0) {
                addAllRelated(newjit[relid].adjacencies[0].nodeTo, levels-1, recursionDone);
              }
            }
          }
          else {
            for (var relid in newjit) {
              if(relid > 0) {
                adjToClose.push(newjit[relid].adjacencies[0].nodeTo);
              }
            }
            addAllRelatedCallback(levels);
          }
        });
      }
      
      function addOuterNodes() {
        for(var adj in adjToClose) {
          if(nodes.indexOf(adjToClose[adj]) == -1) {
            var id = adjToClose[adj];
            jit.push(outerNode(adjToClose[adj], null));
          }
        }
      }
      function outerNode(id, name) {
        nodes.push(id);
        return {"id":id, "name": name, "data": {"type": "item"}, "adjacencies":[]};
      }
      function resolveNodeNames(callback) {
        ns.nameLookupForItemIds(nodes, function(lookup) {
          for(var i in jit) {
            if(jit[i].data.type == 'item') {
              jit[i].name = lookup[jit[i].id];            
            }
          }
          callback();
        });
      }
      addAllRelated(startid, levels, function(data) {
        addOuterNodes();
        resolveNodeNames(function() {
          callback(jit);        
        });
      });
    }
    
    return ns;
  }) ({});
  
  var respond = function() {
    var query = parameters.query;
    var user = query.user;
    var startid = query.startid;
    var levels = query.levels;
    modeling.path = '/' + user + '/_design/modeling/';
    modeling.loadJitFormat(startid, levels, function(data) {
      response.writeHead(200, {'Content-Type': 'text/plain'});
      response.write(JSON.stringify(data));
      response.end();    
    });
  };
  respond();
}

/*modeling.loadSearchData('joh', function(data) {
  console.log(JSON.stringify(data));
});
modeling.getRelationships('33acfcfde0a33b03760eed66e603935b', function(data) {
  console.log(data);
});*/
/*modeling.loadJitFormat('c50632bb4dfa49fd7ae4a88bf9031782', 1, function(data) {
  console.log("############################################");
  console.log(data);
});*/
/*modeling.itemIDsToNames({keys:["c123682eea2538dc9efb384696bbd1a9", "f0c7d484838d575f6744db5384767971", "fa10df37e34c186f0d72a5277c1fd570"]}, function(response) {
  console.log(response);
});*/
/*modeling.revision('c123682eea2538dc9efb384696bbd1a9', function(response) {
  console.log(response);
});*/