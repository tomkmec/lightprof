lightprof 0.0
=============

A lightweight profiling tool for javascript.

What can I do
--------------

Give me some objects, or classes (you know, prototype fuctions, whatever) 
and I'll record how many times their functions are executed and how slo.. err.. fast they are.

How do I work
-------------

Oh.. well. I just impersonate your precious functions. Simple as it is, this approach has a few implications:

* **Simple to use**. You don't have to be V8 profiling ninja to use this
* **Invasive**. You have to put my code in your code. If this is too intimate for you, become a V8 profiling ninja.
* Performance drain. Slightly, depending on your code granurality. But hey, it's profiling. Just don't run it on production environment, ok?

Simple example
--------------

	var Profiler = require('lightprof'),
	    profiler = new Profiler(); // options will be documented later. Or check the source.

	var something = new Something();

	profiler.start(something);

	... do your stuff ...

	var log = profiler.stop();
	// -> { "Something.method1": {calls:..., timeOwn:..., timeTotal:...} , ... }

