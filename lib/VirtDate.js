module.exports = VirtDate;

function VirtDate(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realDate = window.Date;
    this._realDateNow = window.Date.now;
    this._virtualized = false;
};

VirtDate.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realDate;
    delete this._realDateNow;
    delete this._virtualized;
};

VirtDate.prototype.realNow = function() {
    return this._realDateNow.call(this._realDate);
};

VirtDate.prototype.now = function() {
    if (this._virtualized) {
        return this._getVirtTSMS();
    } else {
        return this._realDateNow.call(this._realDate);
    }
};

VirtDate.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.Date.now = this.now.bind(this);
};

VirtDate.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.Date.now = this._realDateNow;
};
