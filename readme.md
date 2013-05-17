lightprof 0.0
=============

A lightweight profiling tool for javascript.

Totally minimal at this point, hopefully will get back to it soon and add some cool stuff.

Usage
-----


	var profiled1 		= new Something();
	var not_profiled 	= new Something();
	var profiled2 		= new SomethingElse();
	var profiled3 		= new SomethingElse();

	var Profiler = require('lightprof');

	var profiler = new Profiler(); // options will be documented later. Or check the source.
	profiler.start([profiled1, SomethingElse]); // array of profiled instances and classes

	... do your stuff ...

	var log = profiler.stop();
	// -> { "Something.method1": {calls:..., timeOwn:..., timeTotal:...} , ... }

