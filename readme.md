lightprof
=========

A lightweight profiling tool for javascript.

Impersonates functions in target objects or prototypes, traces execution time and reports results.

Doesn't utilize V8 profiler or anything terribly node-specific at its core so browser version should be possible and could appear someday.

Status
------

Early development version. Usable, but anything can change in following versions.

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

//... do your stuff ...

// stop profiling, replace traced functions with originals
profiler.stop();

//
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

* `profile()` method replaces functions of objects and classes (constructor functions) passed as arguments to it. 
	Instances of profiled classes which were created before `profile` was called will keep their original functions and will not be profiled.
* 'class' names in reports are in fact names of constructor functions. You need to have named constructor function to see it 	in report: `var Class = function Class() { ... }` (and not anonymous: `var Class = function() { ... }`)

API
---

### Profiler constructor options

<table>
    <tr>
		<th>Option</th>
		<th>Type</th>
		<th>Default</th>
		<th>Description</th>
	</tr>
	<tr>
		<td><code>evalStrings</code></td>
		<td>boolean</td>
		<td><code>false</code></td>
		<td>When true, objects and classes in `profile()` arguments can be strings and will be evaled in that case</td>
	</tr>
	<tr>
		<td><code>startPaused</code></td>
		<td>boolean</td>
		<td><code>false</code></td>
		<td>When true, `profile()` will start paused (not recording function calls, just tracing call stack)</td>
	</tr>
</table>

### .profile( what... )

### .stop()

### .pause()

### .resume()

### .reportPlain()

### .reportTree()


What's next
-----------

* Total profile time in reports
* Tree report improvements 
* Events
* Hotspots reporting
* Asynchronous
* Proper tests
* Browser version?