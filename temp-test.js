var P = require('./index.js');

var X = function X() {}

X.prototype.test1 = function(i1, i2) {
	var a = (new Date()).getTime();
	while ((new Date()).getTime()-a<i1) {};
	console.log(1)
	this.test2(i2)
}

X.prototype.test2 = function(i2) {
	var a = (new Date()).getTime();
	while ((new Date()).getTime()-a<i2) {};
	console.log(2)
}


var x1 = new X()
var x2 = new X()

var p = new P();

p.start([x1,x2]);

x1.test1(12,34);
x2.test1(12,34);

console.log(p.stop());

x1.test1(12,34);


console.log(p.constructor.name)
console.log(Date.prototype.constructor.name)
console.log(X.prototype.constructor.name)