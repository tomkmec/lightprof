var _ = require('underscore');

_.str = require('underscore.string');
_.mixin(_.str.exports());

var divs = { ns: 1, us: 1000, ms: 1000000, s: 1000000000 };

var Profiler = module.exports = function Profiler(options) {
	options = options || {};
	this.options = _.defaults(options, {
		instances: [],
		classes: [],
		allowStrings: false
	});
	this.log = {};
	this.treelog = {__parent: false};
	this.instrumented = [];
}

Profiler.prototype.profile = function(what) {
	var prof = this;

	if (!_.isUndefined(what)) {
		if (!_.isArray(what)) what = [what];
		what.forEach(function (w) {
			if (prof.options.allowStrings && _.isString(w)) w = eval(w);
			if(_.isFunction(w) && _.isObject(w.prototype)) prof.options.classes.push(w);
			if(_.isObject(w)) prof.options.instances.push(w);
		});
	}

	_.each(prof.options.instances, prof._measure.bind(prof));
	_.chain(prof.options.classes).pluck('prototype').each(prof._measure.bind(prof));
	prof.stack = [];
	prof.treetop = this.treelog;
}

Profiler.prototype.stop = function() {
	var prof = this;

	this.instrumented.forEach(function(x) {
		var o = x.orig;
		o.obj[o.name] = o.fn;
	})

	return prof.log;
}

Profiler.prototype.report = function(options) {

	options = _.defaults(options || {}, {
		omitZeroCalls: true,
		orderBy: 'timeOwn',
		timeUnit: 'ms', // s, ms, us, ns
		format: function(fn, record, timeUnit, maxFnNameLength) {
			if (!fn) return _.rpad("function", maxFnNameLength+1) + _.lpad("calls", 11)  + _.lpad("own time ["+timeUnit+"]", 20) + _.lpad("total time ["+timeUnit+"]", 20);
 			else return _.rpad(fn, maxFnNameLength+1) + _.lpad(record.calls, 11)  + _.lpad(record.timeOwn, 20) + _.lpad(record.timeTotal, 20);
		}
	});

  var maxFnNameLength = 40; //TODO

	var rows = _.chain(this.log)
		.pairs()
		.reject(function(pair) {return options.omitZeroCalls && pair[1].calls == 0; })
		.sortBy(function(pair) {return -pair[1][options.orderBy]})
		.map(function(pair) {
			return options.format(
				pair[0], 
				{ timeOwn: pair[1].timeOwn/divs[options.timeUnit], timeTotal: pair[1].timeTotal/divs[options.timeUnit], calls: pair[1].calls }, 
				options.timeUnit, 
				maxFnNameLength) 
		})
		.value()
		return [options.format(false,false, options.timeUnit, maxFnNameLength)].concat(rows).join('\n');
}

Profiler.prototype.reportTree = function(options) {

	options = _.defaults(options || {}, {
		timeUnit: 'ms', // s, ms, us, ns
		format: function(fn, record, timeUnit, fnPadding, level, firstChild, lastChild) {
			if (!fn) return _.rpad("function", fnPadding+1) + _.lpad("calls", 11)  + _.lpad("total time ["+timeUnit+"]", 20);
 			else {
 				var ascii = level>0? _.lpad(lastChild?'\u2514':'\u251C', level) : '';
 				return _.rpad(ascii+fn, fnPadding) + _.lpad(record.calls, 11) + _.lpad(record.timeTotal, 20);
 			}
		}
	});

	var maxFnNameLength = 40; //TODO
	var printLevel = function(root, level) {
		return _.chain(root)
			.pairs()
			.reject(function(p) {return p[0].indexOf('__')==0})
			// .sortBy
			.map(function(p,i,l) {
				return [options.format(
					p[0], 
					{ timeTotal: p[1].__timeTotal/divs[options.timeUnit], calls: p[1].__calls },
					options.timeUnit, 
					maxFnNameLength,
					level,
					i==0,
					i==l.length-1
				)].concat(printLevel(p[1],level+1)); 
			})
			.flatten()
			.value()
	}

	return [options.format(false,false, options.timeUnit, maxFnNameLength)].concat(printLevel(this.treelog, 0)).join('\n');

}

Profiler.prototype._measure = function(obj) {
	var prof = this;

	//TODO check and do something wise when obj is already measured.
	_.chain(obj).functions().each(function(fn) {
		var orig = obj[fn];
		var key = obj.constructor.name+'.'+fn;
		prof.log[key] = {calls:0, timeTotal:0, timeOwn:0}
		obj[fn] = function() {
			prof.stack.push(0);
			if (!_.has(prof.treetop, key)) prof.treetop[key] = {__calls:0, __timeTotal:0, __parent: prof.treetop}
			prof.treetop = prof.treetop[key];
			var start = process.hrtime();

			var r = orig.apply(this, arguments);

			var diff = process.hrtime(start);
			var innerTime = prof.stack.pop()
			var totalTime = diff[0] * 1e9 + diff[1];

			prof.treetop = prof.treetop.__parent;
			prof.treetop[key].__calls++;  
			prof.treetop[key].__timeTotal+=totalTime;  
			
			prof.log[key].calls++;
			prof.log[key].timeTotal+= totalTime;
			prof.log[key].timeOwn+= totalTime - innerTime;
			if (prof.stack.length>0) prof.stack[prof.stack.length-1]+= totalTime;
			return r;
		}
		obj[fn].orig = {obj:obj, name:fn, fn:orig};
		prof.instrumented.push(obj[fn]);
	});
}