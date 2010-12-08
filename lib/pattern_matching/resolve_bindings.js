var fs = require('fs');
var myutils = require('../myutils');

var resolve = function (message, bindings, cb) {
  var workers = [];
  var messageTokens = tokenizePath(message.path);
  var messageParameters = tokenizeMessageParameters(message.parameters);

  myutils.arrayForEach(bindings, function (binding, bindingCb) {
    var triggerTokens = tokenizePath(binding.trigger.path);
    var triggerParameters = tokenizeTriggerParameters(binding.trigger.parameters);
    var pathMatch = checkPath(messageTokens, triggerTokens);
    var parameterMatch = checkParameters(messageParameters, triggerParameters);
    if (pathMatch && parameterMatch) {
      var componentMapping = bindPathValues(messageTokens, triggerTokens);
      var parameterMapping = bindParameterValues(messageParameters, triggerParameters);
      for (i in binding.workers) {
        var worker = binding.workers[i].name;
        var mappedParameters = mapValues(binding.workers[i].parameters, componentMapping, parameterMapping);
        workers.push({
          worker: worker,
          parameters: mappedParameters
        })
      }
    }
    bindingCb();
  }, function() {cb(workers)});
}

var tokenizePath = function (path) {
  var tokens = [];
  var components = path.split("/");
  components.shift();
  components.forEach(function (component) {
    var type = "component";
    if (component.charAt(0) == ":") {
      type = "variable";
    }
    if (component == "*") {
      type = "tail";
    }
    tokens.push({
      type: type,
      value: component
    })
  })
  return tokens;
}

var tokenizeMessageParameters = function (parameters) {
  var tokens = {};
  var type = "component";
  for (key in parameters) {
    tokens[key] = {
      type: type,
      value: parameters[key]
    }
  }
  return tokens;
}

var tokenizeTriggerParameters = function (parameters) {
  var tokens = {};
  var type = "component";
  for (key in parameters) {
    if (parameters[key].charAt(0) == ":") {
      type = "variable";
    }
    tokens[key] = {
      type: type,
      value: parameters[key]
    }
  }
  return tokens;
}

var checkPath = function (messageTokens, triggerTokens) {
  var doesMatch = true;
  var length = messageTokens.length;
  for (index in triggerTokens) {
    if (triggerTokens[index].type == "component") {
      length = length - 1;
      if(messageTokens[index]) {
        if (triggerTokens[index].value != messageTokens[index].value) {
          doesMatch = false;
        }
      } else {
        doesMatch = false;
      }
    }
    if (triggerTokens[index].type == "variable") {
      length = length - 1;
    }
    if (triggerTokens[index].type == "tail") {
      length = 0;
    }
  }
  if (length != 0) {
    doesMatch = false;
  }
  return doesMatch;
}

var checkParameters = function (messageParameters, triggerParameters) {
  var doesMatch = true;
  for (key in triggerParameters) {
    if (triggerParameters[key].type == "component") {
      if(messageParameters[key]) {
        if (triggerParameters[key].value != messageParameters[key].value) {
          doesMatch = false;
        }
      } else {
        doesMatch = false;  
      }
    }
  }
  return doesMatch;
}

var bindPathValues = function (messageTokens, triggerTokens) {
  var mapping = {};
  for (index in triggerTokens) {
    var token = triggerTokens[index];
    if (token.type == "variable") {
      mapping[token.value] = messageTokens[index].value;
    }
    if (token.type == "tail") {
      var tail = [];
      messageTokens.slice(index).forEach(function (token) {
        tail.push(token.value);
        mapping["*"] = tail.join("/");
      })
    }
  }
  return mapping;
}

var bindParameterValues = function (messageTokens, triggerTokens) {
  var mappedKeys = [];
  var mapping = {};
  var notMapped = {};
  for (key in triggerTokens) {
    var token = triggerTokens[key];
    if (token.type == "variable") {
      mapping[token.value] = messageTokens[key].value;
      mappedKeys.push(key);
    }
  }
  for(var key in messageTokens) {
    if(mappedKeys.indexOf(key) == -1) {
      notMapped[key] = messageTokens[key].value;
    }
  }
  return {mapped: mapping, nonMapped: notMapped};
}

var mapValues = function (values, pathMappings, parameterMappings) {
  //when extending pattern matching to nested mapping we need to do deep copy
  var newValues = {};
  for(var key in values) {
    newValues[key] = values[key];
  }
  var parametersMapped = parameterMappings.mapped;
  var parametersNonMapped = parameterMappings.nonMapped;

  for (valueKey in newValues) {
    for (mappingKey in pathMappings) {
      if (newValues[valueKey] == mappingKey) {
        newValues[valueKey] = pathMappings[mappingKey];
      }
    }
    for (mappingKey in parametersMapped) {
      if (newValues[valueKey] == mappingKey) {
        newValues[valueKey] = parametersMapped[mappingKey];
      }
    }  
  }
  for(key in parametersNonMapped) {
    newValues[key] = parametersNonMapped[key];
  }
  return newValues;
}

exports.resolve = resolve;