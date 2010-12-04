function object(o) {
    function F() {}
    F.prototype = o;
    return new F();
}
function copyArray(a) {
  return a.map(function(value) {return value});
}

function doParallel(functions, cb) {
  var count = functions.length;
  functions.forEach(function(each) {
    process.nextTick(function() {
      each(function() {
        count--;
        if(count == 0) cb();
      });
    });
  });
}

function doLinear(functions, cb) {
  functions.reverse();
  if(functions.length > 0) {
    var currentFunction = functions.pop();
    currentFunction(function() {
        doLinear(functions, cb);
    });
  }
  else {
    cb();
  }
}

function stringifyFunctions(x) {
  for (i in x) {
    if (i[0] != '_') {
      if (typeof x[i] == 'function') {
        x[i] = x[i].toString()
      }
      if (typeof x[i] == 'object') {
        stringifyFunctions(x[i])
      }
    }
  }
}

function arrayForEach(array, fn, cb) {
  doParallel(array.map(function(each) {
    return function(eachCb) {fn(each, eachCb)}
  }), cb);
}

exports.object = object;
exports.copyArray = copyArray;
exports.doParallel = doParallel;
exports.doLinear = doLinear;
exports.stringifyFunctions = stringifyFunctions;
exports.arrayForEach = arrayForEach;