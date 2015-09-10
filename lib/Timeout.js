module.exports = Timeout;

var isUndefOrNull = require('./Util').isUndefOrNull;

function Timeout(isPeriodic, delayMS, callback, parameters) {
    // Id should be equal to real to allow user to cancel timeout after
    // unvirtualization is performed.

    var realSetFunc;
    var killMeVirtualizerFunc;
    if(isPeriodic) {
        realSetFunc = timeVirtualizer._reals.setInterval;
        killMeVirtualizerFunc = timeVirtualizer._clearInterval;
    } else {
        realSetFunc = timeVirtualizer._reals.setTimeout;
        killMeVirtualizerFunc = timeVirtualizer._clearTimeout;
    }

    this._realId = realSetFunc.call(window,
        this._onRealTimeoutFired.bind(this), delayMS);
    this._killMeVirtualizerFunc = killMeVirtualizerFunc;
    this._isPeriodic = isPeriodic;
    this._callback = callback;
    this._parameters = parameters;
    this._delayMS = delayMS;

    this._isVirtFired = false;
    this._isRealFired = false;
    this._isVirtMode = false;
    this._fireTSMS = timeVirtualizer._virtDate.now() + delayMS;
};

Timeout.prototype.getId = function() {
    return this._realId;
};

Timeout.prototype.getIsPeriodic = function() {
    return this._isPeriodic;
};

Timeout.prototype.getDelayMS = function() {
    return this._delayMS;
};

Timeout.prototype.getFireTSMS = function() {
    return this._fireTSMS;
};

Timeout.prototype.virtFire = function() {
    this._isVirtFired = true;
    this._callCallback();
};

Timeout.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }

    this._isVirtMode = true;
};

Timeout.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }

    this._isVirtMode = false;
    if (!this._isPeriodic && !this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

Timeout.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

Timeout.prototype._onRealTimeoutFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

Timeout.prototype._callCallback = function() {
    if (this._callback) {
        if (this._parameters.length) {
            this._callback.apply(null, this._parameters);
        } else {
            this._callback();
        }
    }

    // This one may be destroyed in callback. Do additional check.
    if (!this.isValid()) { return; }

    if (!this.getIsPeriodic()) {
        this._killMeVirtualizerFunc.call(window.timeVirtualizer, this.getId());
    } else {
        this._fireTSMS += this.getDelayMS();
    }
};

Timeout.prototype.destroy = function() {
    delete this._realId;
    delete this._killMeVirtualizerFunc;
    delete this._isPeriodic;
    delete this._callback;
    delete this._parameters;
    delete this._delayMS;
    delete this._isVirtFired;
    delete this._isRealFired;
    delete this._isVirtMode;
    delete this._fireTSMS;
};
