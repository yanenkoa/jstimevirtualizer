util = require('./util');
assert = util.assert;
isUndefOrNull = util.isUndefOrNull;
isString = util.isString;
nowOffset = util.nowOffset;

// AnimationFrameRequest
// killMeFunc timeVirtualizer.(animFrameRequest id)
_AnimationFrameRequest = function(
    realRequestAnimationFrameFunc, killMeVirtualizerFunc, callback) {
    this._realId = realRequestAnimationFrameFunc.call(
        window, this._onRealAnimationFrameFired.bind(this));
    this._callback = callback;
    this._killMeVirtualizerFunc = killMeVirtualizerFunc;

    this._isVirtFired = false;
    this._isRealFired = false;
    this._isVirtMode = false;
};

_AnimationFrameRequest.prototype.getId = function() {
    return this._realId;
};

_AnimationFrameRequest.prototype.virtFire = function() {
    assert(this._isVirtMode, 'VirtFire in virt mode');
    this._isVirtFired = true;
    this._callCallback();
};

_AnimationFrameRequest.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }
    this._isVirtMode = true;
};

_AnimationFrameRequest.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }
    this._isVirtMode = false;

    if (!this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

_AnimationFrameRequest.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

_AnimationFrameRequest.prototype._onRealAnimationFrameFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

_AnimationFrameRequest.prototype._callCallback = function() {
    if (this._callback) {
        this._callback(window.timeVirtualizer._virtPerformance.now());
    }
    // This one may be destroyed in callback. Do additional check.
    if (!this.isValid()) { return; }
    this._killMeVirtualizerFunc.call(window.timeVirtualizer, this.getId());
};

_AnimationFrameRequest.prototype.destroy = function() {
    delete this._realId;
    delete this._callback;
    delete this._killMeVirtualizerFunc;
    delete this._isVirtMode;
    delete this._isVirtFired;
    delete this._isRealFired;
};

module.exports = _AnimationFrameRequest;