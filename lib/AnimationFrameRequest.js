module.exports = AnimationFrameRequest;

var Util = require('./Util');
var assert = Util.assert;
var isUndefOrNull = Util.isUndefOrNull;

// AnimationFrameRequest
// killMeFunc timeVirtualizer.(animFrameRequest id)
function AnimationFrameRequest(callback) {

    this._realId = timeVirtualizer._reals.requestAnimationFrame.call(
            window, this._onRealAnimationFrameFired.bind(this));
    this._killMeVirtualizerFunc = timeVirtualizer._cancelAnimationFrame();

    this._callback = callback;

    this._isVirtFired = false;
    this._isRealFired = false;
    this._isVirtMode = false;
};

AnimationFrameRequest.prototype.getId = function() {
    return this._realId;
};

AnimationFrameRequest.prototype.virtFire = function() {
    assert(this._isVirtMode, 'VirtFire in virt mode');
    this._isVirtFired = true;
    this._callCallback();
};

AnimationFrameRequest.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }
    this._isVirtMode = true;
};

AnimationFrameRequest.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }
    this._isVirtMode = false;

    if (!this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

AnimationFrameRequest.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

AnimationFrameRequest.prototype._onRealAnimationFrameFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

AnimationFrameRequest.prototype._callCallback = function() {
    if (this._callback) {
        this._callback(window.timeVirtualizer._virtPerformance.now());
    }
    // This one may be destroyed in callback. Do additional check.
    if (!this.isValid()) { return; }
};

AnimationFrameRequest.prototype.destroy = function() {
    delete this._realId;
    delete this._callback;
    delete this._killMeVirtualizerFunc;
    delete this._isVirtMode;
    delete this._isVirtFired;
    delete this._isRealFired;
};
