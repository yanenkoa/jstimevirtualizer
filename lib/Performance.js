util = require('./util');
assert = util.assert;
isUndefOrNull = util.isUndefOrNull;
isString = util.isString;
nowOffset = util.nowOffset;

_Performance = function(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realPerformance = window.performance;
    this._realPerformanceNow = window.performance.now;
    this._virtualized = false;
};
_Performance.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realPerformance;
    delete this._realPerformanceNow;
    delete this._virtualized;
};

_Performance.prototype.now = function() {
    if (this._virtualized) {
        return this._timeVirtualizer.getVirtTSMS() - nowOffset + 0.0;
    } else {
        return this._realPerformanceNow.call(this._realPerformance);
    }
};

_Performance.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.performance.now = this.now.bind(this);
};

_Performance.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.performance.now = this._realPerformanceNow;
};

module.exports = _Performance;