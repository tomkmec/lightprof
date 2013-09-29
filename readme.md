lightprof
=========

A lightweight profiling tool for javascript.

Wraps standalone functions or member functions in objects and classes, traces execution time and reports results.

Doesn't utilize V8 profiler or anything terribly node-specific at its core so browser version should appear someday soon.

Features
--------

* Profile *standalone functions*, *all functions in object*, or *all functions in a class prototype*.
* *Customize profiler granurality* - differentiate method calls by arguments or group several methods together.
* Don't worry about *synchronous callbacks* - they are treated as `return` by default.
* Choose from one of three report types to get perspective you need:
	* *Plain report*, sortable by number of calls, total execution time, or own execution time (excl. nested executions)
	* *Tree report* to get perspective of the call stack
	* *Hotspots report* to identify and track most time consuming calls

Status
------

This is kind of release candidate. I'm trying to finalize basic features and API for initial stable version (1.0.0). 
I do not plan any dramatic API changes at this point, unless I realize some serious design flaw.

Example use and output
----------------------

Use lightprof like this:

```javascript
// import and initialize Profiler
var Profiler = require('lightprof').Profiler,
    profiler = new Profiler();

//something to profile
var Class = function Class() { ... }
Class.prototype.method = function() { ... }
var instance = new SomethingElse();

// start profiling 'instance' object and any instances of 'Class' created after this point
profiler.profile(instance, Class);

//... do your stuff, e.g. 'instance.foobar()' and 'new Class().method()' ...

// stop profiling, replace traced functions with originals
profiler.stop();

// output a tree report
console.log(profiler.reportTree());
```

To get results like this:

	function                                       calls     total time [ms]
	├Class.method3                                    2         2015.961540
	│├Class.method                                    4         1512.021972
	││└Class.method2                                  4         1439.995954
	│└Class.method2                                   2          479.940796
	├Class.method                                     1          315.033041
	│└Class.method2                                   1          299.979859
	├Class.method2                                    1          179.981357
	├SomethingElse.foobar                             1           97.053809
	│├SomethingElse.bar                               1           48.971801
	│└SomethingElse.foo                               1           23.983303
	├SomethingElse.foo                                2           44.518808
	└SomethingElse.bar                                1           20.926568

Important notes
---------------

* 'class' names in reports are in fact names of constructor functions. 
  You need to have named constructor function to see it in report: 
  `var Class = function Class() { ... }` (and not anonymous: `var Class = function() { ... }`)
* the same applies for standalone functions: do not profile anonymous functions (`var fn = function() { ... }`)

API
---

### Profiler constructor options

#### evalStrings

Boolean, default: `false`

When set to true, arguments passed to `profile()` may be strings which will be evaled to - 
names of objects or classes to profile.

#### startPaused

Boolean, default `false`.

When true, `profile()` will start paused (not recording function calls, just tracing call stack). 
Call `resume()` to start recording in such case.

#### treatCallbackAsReturn

Boolean, default `true`

Tells the profiler whether calling a callback function should be considered as end of function execution. 
Callback is assumed to be the last argument passed to the profiled method (if it is a function).

#### nameFn

Function(constructorName, functionName, args)

Default:
```javascript
function (constructorName, functionName, args) {
  return (constructorName? constructorName + '.' : '') + functionName;
}
```

Assigns a name to method call. Default implementation produces names in form of 'ClassName.methodName', 
which results in expected profiler behavior. 

However, by overriding this function, you can

* add more granurality by generating different names for method calls with different arguments or 
* reduce granurality by grouping different method calls in one name, or
* i don't know, whatever ;)

##### Example:

```javascript
var profiler = new Profiler({
	nameFn: function (constructorName, functionName, args) {
		var argTypes = _.chain(args).flatten()
			.map(function(arg){ return typeof(arg) })
			.value().join(', ');
  		return (constructorName? constructorName + '.' : '') + functionName + '(' + argTypes + ')';
	}
})

function doSomething() {
	...
}

doSomething = profiler.profile(doSomething);

doSomething();
doSomething(1, 2);

profiler.stop();
profiler.reportPlain();
// ==>
//  function                                calls       own time [ms]     total time [ms]
//  doSomething()                              1               12.48               12.48
//  doSomething(number, number)                1               15.01               15.01
```

### .profile( what... )

Accepts any number of arguments, each of which can be:
* Class (= constructor function). Wraps all functions in its `prototype` object.
* Object. Wraps all its functions.
* Function (with empty `prototype` object). 
  Returns wrapped function (does not continue wrapping following arguments if any). 
  Note that you need to call wrapped function (not the original) to allow profiling - see the example above.

### .pause()

Temporarily stops recording calls and execution times.
All data and wrappers are left intact, ready to resume recording.

### .resume()

Resume recording after paused.

### .stop()

Stops profiling and replaces wrappers back with original functions.
Collected data are kept for report methods.

### .reportPlain( options )

default options:
```javascript
{
    orderBy: 'timeOwn', // one of ['timeOwn', 'timeTotal', 'calls']
    timeUnit: 'ms' // one of [s, ms, us, ns]
}
```

example output:

	function                   calls       own time [ms]     total time [ms]
	Class.method2                 8             2399.88             2399.88
	Class.method                  5               87.05             1827.04
	SomethingElse.bar             2               69.89               69.89

### .reportTree( options )

default options:
```javascript
{
	timeUnit: 'ms' // one of [s, ms, us, ns]
}
```

example output:

	function                                       calls     total time [ms]
	├Class.method3                                    2         2015.961540
	│├Class.method                                    4         1512.021972
	││└Class.method2                                  4         1439.995954
	│└Class.method2                                   2          479.940796
	└SomethingElse.bar                                1           20.926568

### .reportHotspots( options )

default options:
```javascript
{
	timeUnit: 'ms', // one of [s, ms, us, ns]
	records: 10 // number of hotspots reported.
}
```

example output:

	function                                       calls       own time [ms]
	Class.method3
	└Class.method
	 └Class.method2                                   4             1440.01
	Class.method3
	└Class.method2                                    2              479.93
	Class.method
	└Class.method2                                    1              299.99
	Class.method2                                     1              179.95


### .reinit()

Reinitializes profiler, clearing all data. Call this only to reuse existing Profiler instance - 
in between `.stop(); .reportXXX()` and another `.profile()`


What's next
-----------

* Proper tests
* Better documentation
* Browser version