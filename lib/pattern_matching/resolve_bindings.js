var resolve = function (message, bindings) {
  var workers = [];
  bindings.forEach(function (binding) {
    var messageTokens = tokenizePath(message.path);
    var triggerTokens = tokenizePath(binding.trigger.path);
    var messageParameters = tokenizeParameters(message.parameters);
    var triggerParameters = tokenizeParameters(binding.trigger.parameters);
    var pathMatch = checkPath(messageTokens, triggerTokens);
    var parameterMatch = checkParameters(messageParameters, triggerParameters);
    if (pathMatch && parameterMatch == true) {
      var componentMapping = bindValues(messageTokens, triggerTokens);
      var parameterMapping = bindValues(messageParameters, triggerParameters);
      for (worker in binding.workers) {
        workers.push({
          worker: worker,
          parameters: mapValues(binding.workers[worker], [componentMapping, parameterMapping])
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

var tokenizeParameters = function (parameters) {
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
      if (triggerTokens[index].value != messageTokens[index].value) {
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

var bindValues = function (messageTokens, triggerTokens) {
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

var mapValues = function (values, mappings) {
  for (valueKey in values) {
    for (index in mappings) {
      for (mappingKey in mappings[index]) {
        if (values[valueKey] == mappingKey) {
          values[valueKey] = mappings[index][mappingKey];
        }
      }
    }
  }
  return values;
}

exports.resolve = resolve;