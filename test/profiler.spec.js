var Profiler = require('../index.js').Profiler;

var TestClass1 = function TestClass1(values) { this.values = values;}
TestClass1.prototype.method1 = function(time) {
  _sleep(time);
  return this.values[0] + this.method2(time*2);
}
TestClass1.prototype.method2 = function(time) {
  _sleep(time);
  return this.values[1];
}
TestClass1.prototype.methodWithCallback1 = function(time, callback) {
  _sleep(time);
  callback();
}


describe("Profiler with default options", function() {
  var profiler;

  beforeEach(function(){
    profiler = new Profiler();
  })

  it("records method calls on instance", function() {
    var instance1 = new TestClass1(["Alice", "1"]);
    var instance2 = new TestClass1(["Bob", "2"]);

    profiler.profile(instance1);
    instance1.method1(20);
    instance1.method2(20);
    // instance2.method1(20);
    profiler.stop();
    var log = profiler.log;

    expect(log['TestClass1.method1'].calls).toBe(1);
    expect(log['TestClass1.method2'].calls).toBe(2);
    expect(log['TestClass1.method2'].timeOwn).toEqual(log['TestClass1.method2'].timeTotal);
    expect(log['TestClass1.method1'].timeOwn).toBeLessThan(log['TestClass1.method1'].timeTotal);

    console.log(profiler.reportPlain())
    console.log(profiler.reportTree())
   });

  //TODO
  it("records method calls on prototype");

  //TODO
  it("does not change profiled methods outcome");


  it("somehow deals with apply/call/bind", function() {
    var instance1 = new TestClass1(["Alice", "1"]);
    var instance2 = new TestClass1(["Bob", "2"]);

    profiler.profile(instance1);
    var result = instance1.method1.bind(instance2)(20);
    profiler.stop();
    var log = profiler.log;

    expect(result).toBe("Bob2");
    expect(log['TestClass1.method1'].calls).toBe(1); // called on instance1 (so it is recorded), but with 'this' pointing to instance2!
    expect(log['TestClass1.method2'].calls).toBe(0); // called on instance2 and not recorded.
  })

  it("works with callbacks!", function() {
    var instance;
    var done=false;

    runs(function(){
      instance = new TestClass1(["Alice", "1"]);
      profiler.profile(instance);
      instance.methodWithCallback1(100, function() {_sleep(100); done=true })
    })

    waitsFor(function() {return done});

    runs(function() {
      profiler.stop();
      var log = profiler.log;
      console.log(profiler.reportTree());
      expect(log['TestClass1.methodWithCallback1'].timeTotal).toBeGreaterThan(99*1000000)
      expect(log['TestClass1.methodWithCallback1'].timeTotal).toBeLessThan(199*1000000)
    })

  })

});

function _sleep(ms) {
  var a = (new Date()).getTime();
  while ((new Date()).getTime()-a < ms) {};
}