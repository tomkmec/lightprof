var _ = require('underscore');

_.str = require('underscore.string');
_.mixin(_.str.exports());

var timeUnits = { ns: 1, us: 1000, ms: 1000000, s: 1000000000 };

var Profiler = module.exports.Profiler = function Profiler(options) {
  options = options || {};
  this.options = _.defaults(options, {
    // when true, profiled objects and classes can be passed as Strings to .profile() method and will be evaled
    evalStrings: false, 

    // suppose a method ends as soon as a callback (last argument of a method call if it is a function) is called.
    treatCallbackAsReturn: true, 

    // generate a key (name) for profiled method call. 
    // This can be used to differentiate method calls for different arguments, or group different methods under one key.
    nameFn: function (constructorName, functionName, args) {
      return (constructorName? constructorName + '.' : '') + functionName;
    },

    // should the profiling start immediately (true), or after .resume() is called (false)
    startPaused: false
  });
}

Profiler.prototype.profile = function( /* what... */ ) {
  if (!this._initialized) this.reinit();


  for (var i=0; i<arguments.length; i++) {
    var arg = arguments[i];
    if (this.options.evalStrings && _.isString(arg)) arg = eval(arg);

    if (_.isFunction(arg) && _.isObject(arg.prototype) && _.size(arg.prototype)>0) { // class (constructor function)
      this._classes.push(arg);
      this._measureObj(arg.prototype);

    } else if (_.isFunction(arg)) { // plain function
      this._functions.push(arg);
      return this._wrap(arg, null, arg.prototype.constructor.name);

    } else if (_.isObject(arg)) { // object instance
      this._instances.push(arg);
      this._measureObj(arg);

    }
  }

}

Profiler.prototype.reinit = function() {
  this.log = {};
  this.totalTime = 0;
  this.treelog = {__parent: false};
  this.instrumented = [];
  this._functions = [];
  this._instances = [];
  this._classes = [];

  this.stack = [];
  this.treetop = this.treelog;
  this.running = false;

  this.running = !this.options.startPaused;
  this.totalTime = 0;
  this.startTime = this.running? process.hrtime() : false;

  this._initialized = true;
}

Profiler.prototype.stop = function() {
  this.running = false;

	if (this.startTime) {
		var diff = process.hrtime(this.startTime);
		this.totalTime += diff[0] * 1e9 + diff[1];
		this.startTime = false;
	}

  this.instrumented.forEach(function(x) {
    var o = x.orig;
    o.obj[o.name] = o.fn;
  });
  this.instrumented = [];
}

Profiler.prototype.pause = function() {
	this.running = false;

	if (this.startTime) {
		var diff = process.hrtime(this.startTime);
		this.totalTime += diff[0] * 1e9 + diff[1];
		this.startTime = false;
	}
}

Profiler.prototype.resume = function() {
	if (!this.startTime) {
		this.startTime = process.hrtime();
	}

	this.running = true;
}

Profiler.prototype._wrap = function(fn, className, fnName) {
  var prof = this;

  return function() {

    var key = prof.options.nameFn(className, fnName, arguments);
    if ( typeof(prof.log[key]) == 'undefined' ) prof.log[key] = {calls:0, timeTotal:0, timeOwn:0}

    prof.stack.push(0);
    if (!prof.treetop[key]) prof.treetop[key] = {__calls:0, __timeTotal:0, __timeOwn:0, __parent: prof.treetop}
    prof.treetop = prof.treetop[key];

    var start = process.hrtime();
    var ended = false;
    var _end = function() {
      if (ended) return;
      ended = true;
      var diff = process.hrtime(start);

      var innerTime = prof.stack.pop()
      prof.treetop = prof.treetop.__parent;
      if (prof.running) {
        var totalTime = diff[0] * 1e9 + diff[1];

        prof.treetop[key].__calls++;  
        prof.treetop[key].__timeTotal+= totalTime;  
        prof.treetop[key].__timeOwn+= totalTime - innerTime;  
        
        prof.log[key].calls++;
        prof.log[key].timeTotal+= totalTime;
        prof.log[key].timeOwn+= totalTime - innerTime;
        if (prof.stack.length>0) prof.stack[prof.stack.length-1]+= totalTime;
      }
    }

    if (prof.options.treatCallbackAsReturn && typeof(arguments[arguments.length-1])=='function') {
      var origCallback = arguments[arguments.length-1];
      arguments[arguments.length-1] = function() {
        _end();
        origCallback.apply(this, arguments);//this?
      }
    }

    var r = fn.apply(this, arguments);
    _end();

    return r;
  }
}


Profiler.prototype._measureObj = function(obj) {
  var prof = this;

  _.chain(obj).functions().each(function(fn) {
    var orig = obj[fn];
    obj[fn] = prof._wrap(orig, obj.constructor.name, fn);
    obj[fn].orig = {obj:obj, name:fn, fn:orig};
    prof.instrumented.push(obj[fn]);
  });
}


Profiler.prototype.reportPlain = function(options) {

  options = _.defaults(options || {}, {

    // one of ['timeOwn', 'timeTotal', 'calls']
    orderBy: 'timeOwn',

    // one of [s, ms, us, ns]
    timeUnit: 'ms' 
  });

  var maxFnNameLength = _.chain(this.log)
    .pairs()
    .map(function(p) { return p[0].length })
    .max()
    .value()

  var header = 
    _.rpad("function", maxFnNameLength+1) + 
    _.lpad("calls", 11) + 
    _.lpad("own time [" + options.timeUnit + "]", 20) + 
    _.lpad("total time [" + options.timeUnit + "]", 20)

  var format = function(fn, record) {
    return _.rpad(fn, maxFnNameLength) + 
      _.lpad(record.calls, 11) +
      _.lpad(record.timeOwn.toFixed(2), 20) + 
      _.lpad(record.timeTotal.toFixed(2), 20);
  }

  var rows = _.chain(this.log)
    .pairs()
    .reject(function(pair) { return pair[1].calls == 0 })
    .sortBy(function(pair) { return -pair[1][options.orderBy] })
    .map(function(pair) {
      return format(
        pair[0], 
        { 
          timeOwn: pair[1].timeOwn/timeUnits[options.timeUnit], 
          timeTotal: pair[1].timeTotal/timeUnits[options.timeUnit], 
          calls: pair[1].calls 
        }
      )
    })
    .value();
  
  return [header].concat(rows).join('\n');
}

Profiler.prototype.reportTree = function(options) {

  options = _.defaults(options || {}, {
    timeUnit: 'ms' // s, ms, us, ns
  });

  var maxFnNameLength = 40; //TODO

  var header = 
    _.rpad("function", maxFnNameLength+1) + 
    _.lpad("calls", 11)  + 
    _.lpad("total time ["+options.timeUnit+"]", 20)

  var format = function(fn, record, prefix, firstChild, lastChild) {
    var ascii = prefix + (lastChild? '\u2514' : '\u251C');
    return _.rpad(ascii+fn, maxFnNameLength) + 
      _.lpad(record.calls, 11) + 
      _.lpad(record.timeTotal.toFixed(2), 20);
  }

  var printLevel = function(root, prefix) {
    return _.chain(root)
      .pairs()
      .reject(function(p) { return p[0].indexOf('__') == 0 || p[1].__calls == 0 })
      .sortBy(function(p) { return -p[1].__timeTotal })
      .map(function(p,i,l) {
        var thisLevel = format(
          p[0], 
          { 
            timeTotal: p[1].__timeTotal/timeUnits[options.timeUnit], 
            timeOwn: p[1].__timeOwn/timeUnits[options.timeUnit], 
            calls: p[1].__calls 
          },
          prefix,
          i==0,
          i==l.length-1
        );
        var subLevels = printLevel( p[1], prefix + (i==l.length-1? '\u2514' : '\u2502').replace('\u2514',' ') )

        return [thisLevel].concat(subLevels); 
      })
      .flatten()
      .value()
  }

  return [header].concat(printLevel(this.treelog, '')).join('\n');
}

Profiler.prototype.reportHotspots = function(options) {
  options = _.defaults(options || {}, {
    timeUnit: 'ms', // s, ms, us, ns
    records: 10
  });

  var maxFnNameLength = 40; //TODO

  var header = 
    _.rpad("function", maxFnNameLength+1) + 
    _.lpad("calls", 11) + 
    _.lpad("own time ["+options.timeUnit+"]", 20);

  var format = function(timeUnit, record) {
    var res = '';
    for (var i=0; i<record.stack.length; i++) {
      res += (i>0? (_.repeat(' ',i-1)+'\u2514') : '') + record.stack[i] + "\n";
    }

    return res + 
      _.rpad((record.stack.length>0? (_.repeat(' ',record.stack.length-1)+'\u2514') : '') + record.fn, 40) + 
      _.lpad(record.calls, 11) + 
      _.lpad(record.time.toFixed(2), 20);
  }

  var hotspots = [];

  var sweep = function(root, stack) {
    for (var key in root) if (key.indexOf('__') !== 0) {
      hotspots.push({ 
        fn: key, 
        time: root[key].__timeOwn/timeUnits[options.timeUnit], 
        calls: root[key].__calls, stack: stack 
      });
      sweep(root[key], stack.concat([key]));
    }
  }

  sweep(this.treelog, []);

  hotspots = _.sortBy(hotspots, function(r) {return -r.time});

  var rows = _.map(
    hotspots.slice(0, options.records), 
    function(r) {
      return format(options.timeUnit, r)
    }
  );

  return [header].concat(rows).join('\n');

}
