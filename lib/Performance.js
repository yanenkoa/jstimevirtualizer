module.exports = Performance;

var Util = require('./Util');
var nowOffset = Util.nowOffset;

function Performance(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realPerformance = window.performance;
    this._realPerformanceNow = window.performance.now;
    this._virtualized = false;
};

Performance.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realPerformance;
    delete this._realPerformanceNow;
    delete this._virtualized;
};

Performance.prototype.now = function() {
    if (this._virtualized) {
        return this._timeVirtualizer.virtDateNow() - nowOffset + 0.0;
    } else {
        return this._realPerformanceNow.call(this._realPerformance);
    }
};

Performance.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.performance.now = this.now.bind(this);
};

Performance.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.performance.now = this._realPerformanceNow;
};

