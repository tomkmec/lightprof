var _ = require('underscore');

_.str = require('underscore.string');
_.mixin(_.str.exports());

var divs = { ns: 1, us: 1000, ms: 1000000, s: 1000000000 };

var Profiler = module.exports.Profiler = function Profiler(options) {
  options = options || {};
  this.options = _.defaults(options, {
    evalStrings: false, // when true, profiled objects and classes can be passed as Strings to .profile() method and will be evaled
    startPaused: false,
    treatCallbackAsReturn: true //suppose a method ends as soon as a callback (last argument of a method call if it is a function) is called.
  });
}

Profiler.prototype.profile = function() {
  this.log = {};
  this.totalTime = 0;
  this.treelog = {__parent: false};
  this.instrumented = [];
  this._instances = [];
  this._classes = [];

  var prof = this;
  _.chain(arguments).flatten().each(function (w) {
    if (prof.options.evalStrings && _.isString(w)) w = eval(w);
    if(_.isFunction(w) && _.isObject(w.prototype)) prof._classes.push(w);
    if(_.isObject(w)) prof._instances.push(w);
  });

  this.stack = [];
  this.treetop = this.treelog;
  this.running = false;

  _.each(prof._instances, prof._measure.bind(prof));
  _.chain(prof._classes).pluck('prototype').each(prof._measure.bind(prof));

  this.running = !this.options.startPaused;
  this.totalTime = 0;
  this.startTime = this.running? process.hrtime() : false;
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

Profiler.prototype._measure = function(obj) {
  var prof = this;

  _.chain(obj).functions().each(function(fn) {
    var orig = obj[fn];
    var key = obj.constructor.name+'.'+fn;
    prof.log[key] = {calls:0, timeTotal:0, timeOwn:0}
    obj[fn] = function() {
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
      var r = orig.apply(this, arguments);
      _end();

      return r;
    }
    obj[fn].orig = {obj:obj, name:fn, fn:orig};
    prof.instrumented.push(obj[fn]);
  });
}



Profiler.prototype.reportPlain = function(options) {

  options = _.defaults(options || {}, {
    omitZeroCalls: true,
    orderBy: 'timeOwn',
    timeUnit: 'ms', // s, ms, us, ns
    format: function(fn, record, timeUnit) {
		  var maxFnNameLength = 40; //TODO
      if (!fn) return _.rpad("function", maxFnNameLength+1) + _.lpad("calls", 11)  + _.lpad("own time ["+timeUnit+"]", 20) + _.lpad("total time ["+timeUnit+"]", 20);
      else return _.rpad(fn, maxFnNameLength+1) + _.lpad(record.calls, 11)  + _.lpad(record.timeOwn, 20) + _.lpad(record.timeTotal, 20);
    }
  });


  var rows = _.chain(this.log)
    .pairs()
    .reject(function(pair) {return options.omitZeroCalls && pair[1].calls == 0; })
    .sortBy(function(pair) {return -pair[1][options.orderBy]})
    .map(function(pair) {
      return options.format(
        pair[0], 
        { timeOwn: pair[1].timeOwn/divs[options.timeUnit], timeTotal: pair[1].timeTotal/divs[options.timeUnit], calls: pair[1].calls }, 
        options.timeUnit) 
    })
    .value();
  
  return [options.format(false,false, options.timeUnit)].concat(rows).join('\n');
}

Profiler.prototype.reportTree = function(options) {

  options = _.defaults(options || {}, {
    timeUnit: 'ms', // s, ms, us, ns
    format: function(fn, record, timeUnit, prefix, firstChild, lastChild) {
		  var maxFnNameLength = 40; //TODO
      if (!fn) return _.rpad("function", maxFnNameLength+1) + _.lpad("calls", 11)  + _.lpad("total time ["+timeUnit+"]", 20);
      else {
    	   var ascii = prefix + (lastChild?'\u2514':'\u251C');
         return _.rpad(ascii+fn, maxFnNameLength) + _.lpad(record.calls, 11) + _.lpad(record.timeTotal, 20)/* + _.lpad(record.timeOwn, 20)*/;
       }
    }
  });

  var printLevel = function(root, prefix) {
    return _.chain(root)
      .pairs()
      .reject(function(p) {return p[0].indexOf('__')==0})
      .sortBy(function(p) {return -p[1].__timeTotal})
      .map(function(p,i,l) {
        return [options.format(
          p[0], 
          { timeTotal: p[1].__timeTotal/divs[options.timeUnit], timeOwn: p[1].__timeOwn/divs[options.timeUnit], calls: p[1].__calls },
          options.timeUnit,
          prefix,
          i==0,
          i==l.length-1
        )].concat(printLevel(p[1],(prefix+(i==l.length-1?'\u2514':'\u2502').replace('\u2514',' ')))); 
      })
      .flatten()
      .value()
  }

  return [options.format(false,false, options.timeUnit)].concat(printLevel(this.treelog, '')).join('\n');

}

Profiler.prototype.reportHotspots = function(options) {
  options = _.defaults(options || {}, {
    timeUnit: 'ms', // s, ms, us, ns
    rows: 10,
    format: function(timeUnit, record) {
      var maxFnNameLength = 40; //TODO
      if (!record) return _.rpad("function", maxFnNameLength+1) + _.lpad("calls", 11)  + _.lpad("own time ["+timeUnit+"]", 20);
      else {
        var res = '';
        for (var i=0; i<record.stack.length; i++) {
          res += (i>0? (_.repeat(' ',i-1)+'\u2514') : '') + record.stack[i] + "\n";
        }

        return res + _.rpad((record.stack.length>0? (_.repeat(' ',record.stack.length-1)+'\u2514') : '') + record.fn, 40) + _.lpad(record.calls, 11) + _.lpad(record.time, 20)
      }
    }
  });

  var hotspots = [];
  var sweep = function(root, stack) {
    for (var key in root) if (key.indexOf('__') !== 0) {
      hotspots.push({ fn: key, time: root[key].__timeOwn/divs[options.timeUnit], calls: root[key].__calls, stack: stack });
      sweep(root[key], stack.concat([key]));
    }
  }

  sweep(this.treelog, []);

  hotspots = _.sortBy(hotspots, function(r) {return -r.time});

  return [options.format(options.timeUnit)]
    .concat(_.map(hotspots.slice(0,options.rows), function(r) {return options.format(options.timeUnit, r)})).join('\n');

}
