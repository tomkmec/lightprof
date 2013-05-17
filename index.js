var _ = require('underscore');


var Profiler = module.exports = function Profiler(options) {
	options = options || {};
	this.options = _.defaults(options, {
		instances: [],
		classes: [],
		allowStrings: false
	});
	this.log = {};
	this.instrumented = [];
}

Profiler.prototype.start = function(what) {
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
}

Profiler.prototype.stop = function() {
	var prof = this;

	this.instrumented.forEach(function(x) {
		var o = x.orig;
		o.obj[o.name] = o.fn;
	})

	return prof.log;
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
			var start = process.hrtime();

			var r = orig.apply(obj, arguments);

			var diff = process.hrtime(start);
			var innerTime = prof.stack.pop()
			var totalTime = diff[0] * 1e9 + diff[1];
			
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