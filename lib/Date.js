_Date = function(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realDate = window.Date;
    this._realDateNow = window.Date.now;
    this._virtualized = false;
};

_Date.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realDate;
    delete this._realDateNow;
    delete this._virtualized;
};

_Date.prototype.realNow = function() {
    return this._realDateNow.call(this._realDate);
};

_Date.prototype.now = function() {
    if (this._virtualized) {
        return this._getVirtTSMS();
    } else {
        return this._realDateNow.call(this._realDate);
    }
};

_Date.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.Date.now = this.now.bind(this);
};

_Date.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.Date.now = this._realDateNow;
};
module.exports = _Date;