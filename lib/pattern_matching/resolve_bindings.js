var fs = require('fs');

var resolve = function (message, bindings) {
  var workers = [];
  bindings.forEach(function (binding) {
    var messageTokens = tokenizePath(message.path);
    var triggerTokens = tokenizePath(binding.trigger.path);
    var messageParameters = tokenizeMessageParameters(message.parameters);
    var triggerParameters = tokenizeTriggerParameters(binding.trigger.parameters);
    var pathMatch = checkPath(messageTokens, triggerTokens);
    var parameterMatch = checkParameters(messageParameters, triggerParameters);
    if (pathMatch && parameterMatch == true) {
      var componentMapping = bindPathValues(messageTokens, triggerTokens);
      var parameterMapping = bindParameterValues(messageParameters, triggerParameters);
      for (i in binding.workers) {
        var worker = binding.workers[i].name;
        workers.push({
          worker: worker,
          parameters: mapValues(binding.workers[i].parameters, componentMapping, parameterMapping)
        })
      }
    }
  })
  return workers;
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
    if (triggerParameters.type == "component") {
      if (triggerParameters[key] != messageParameters[key]) {
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
  if(!values) values = {};
  var parametersMapped = parameterMappings.mapped;
  var parametersNonMapped = parameterMappings.nonMapped;

  for (valueKey in values) {
    for (mappingKey in pathMappings) {
      if (values[valueKey] == mappingKey) {
        values[valueKey] = pathMappings[mappingKey];
      }
    }
    for (mappingKey in parametersMapped) {
      if (values[valueKey] == mappingKey) {
        values[valueKey] = parametersMapped[mappingKey];
      }
    }  
  }
  for(key in parametersNonMapped) {
    values[key] = parametersNonMapped[key];
  }
  return values;
}

exports.resolve = resolve;