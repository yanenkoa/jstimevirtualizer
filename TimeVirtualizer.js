/*
 * TimeVirtualizer allows to move into/out of virtual time mode.
 * Time is advanced manually using advanceTimeMS() method
 * when in virtual time mode. This solution uses special Worker
 * that provides stable setTimeout style functionality that
 * (for now) doesn't depend on browser tab active/inactive state.
 *
 * TimeVirtualizer script should be included on the page ASAP
 * because it needs to track all the time related calls on the page.
 * As this script should be included early, it can't depend on other libraries.
 * TimeVirtualizer should be instantiated as singleton.
 * See singleton creation in the bottom.
 *
 * Copyright 2015 Eugene Batalov https://github.com/eabatalov/
 * MIT Licence.
 */

(function() {

function assert(assertion, msg) {
    if (!assertion) {
        throw new Error(msg);
    }
}

function isUndefOrNull(val) {
    return val === null || (typeof val === 'undefined');
}

function isString(val) {
    return typeof val === 'string';
}

if (isUndefOrNull(window.performance)){
    window.performance = {};
}

var nowOffset = Date.now();
if (window.performance.timing && window.performance.timing.navigationStart){
    nowOffset = window.performance.timing.navigationStart;
}
if(!window.performance.now) {
    window.performance.now = function(){
        return Date.now() - nowOffset;
    };
}

var LOG_TAG = '[TimeVirtualizer]';

function TimeVirtualizer() {
    this._virtualized = false;
    this._timeouts = [];
    this._requestAnimFrames = [];
    this._virtTSMS = 0;
    this._isCallingTimerHandlers = false;
    this._virtTimeToAdvanceMS = 0;
    this._timeoutWorker = new Worker('TimeVirtualizerTimeoutWorker.js');
    this._timeoutWorker.onmessage = this._onTimeoutWorkerMessage.bind(this);
    this._realTimeoutFuncs = {};
    this._realTimeoutFuncsIdCntr = 0;
    this._reals = {
        requestAnimationFrame : null,
        cancelAnimationFrame : null,
        setInterval : null,
        clearInterval : null,
        setTimeout : null,
        clearTimeout : null,
        Date : null,
        performance : null
    };

    this._reals.requestAnimationFrame =
        window.requestAnimationFrame ||
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;
    this._reals.cancelAnimationFrame =
        window.cancelAnimationFrame ||
        window.mozCancelAnimationFrame;
    this._reals.setInterval = window.setInterval;
    this._reals.clearInterval = window.clearInterval;
    this._reals.setTimeout = window.setTimeout;
    this._reals.clearTimeout = window.clearTimeout;
    this._reals.Date = window.Date;
    this._reals.performance = window.performance;

    window.requestAnimationFrame = this._requestAnimationFrame.bind(this);
    window.cancelAnimationFrame = this._cancelAnimationFrame.bind(this);
    window.setInterval = this._setInterval.bind(this);
    window.clearInterval = this._clearInterval.bind(this);
    window.setTimeout = this._setTimeout.bind(this);
    window.clearTimeout = this._clearTimeout.bind(this);
    this._virtDate = new TimeVirtualizer._Date(this);
    this._virtPerformance = new TimeVirtualizer._Performance(this);
}

// XXX this is not tested and probably broken
TimeVirtualizer.prototype.destroy = function() {
    this.unVirtualize();
    window.requestAnimationFrame = this._reals.requestAnimationFrame;
    window.cancelAnimationFrame = this._reals.cancelAnimationFrame;
    window.setInterval = this._reals.setInterval;
    window.clearInterval = this._reals.clearInterval;
    window.setTimeout = this._reals.setTimeout;
    window.clearTimeout = this._reals.clearTimeout;

    this._timeoutWorker.terminate();

    delete this._timeouts;
    delete this._requestAnimFrames;
    delete this._virtTSMS;
    delete this._virtualized;
    delete this._reals;
    delete this._virtDate;
    delete this._virtPerformance;
    delete this._isCallingTimerHandlers;
    delete this._virtTimeToAdvanceMS;
    delete this._timeoutWorker;
    delete this._realTimeoutFuncs;
    delete this._realTimeoutFuncsIdCntr;
};

TimeVirtualizer.prototype.virtualize = function() {
    this._virtualized = true;
    this._virtTSMS = this._reals.Date.now();
    for (var i = 0; i < this._timeouts.length; ++i) {
        var timeout = this._timeouts[i];
        timeout.virtualize();
        timeout.virtFireTSMS = this._virtTSMS + timeout.getDelayMS();
    }
    for (var i = 0; i < this._requestAnimFrames.length; ++i) {
        var requestAnimFrame = this._requestAnimFrames[i];
        requestAnimFrame.virtualize();
    }
    this._virtDate.virtualize();
    this._virtPerformance.virtualize();
};

TimeVirtualizer.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }

    this._virtualized = false;

    // Extra protection from timers callbacks side effects needed
    var timeoutsToUnvirt = this._timeouts.slice();
    for (var i = 0; i < timeoutsToUnvirt.length; ++i) {
        var timeout = timeoutsToUnvirt[i];
        if (timeout.isValid()) {
            timeout.unVirtualize();
        }
    }

    // Extra protection from anim frames callbacks side effects needed
    var animFramesToUnvirt = this._requestAnimFrames.slice();
    for (var i = 0; i < animFramesToUnvirt.length; ++i) {
        var requestAnimFrame = animFramesToUnvirt[i];
        if (requestAnimFrame.isValid()) {
            requestAnimFrame.unVirtualize();
        }
    }

    this._virtDate.unVirtualize();
    this._virtPerformance.unVirtualize();
};

TimeVirtualizer.prototype.advanceTimeMS = function(durationMS) {
    assert(this._virtualized, 'Virtualized time is advanced');
    this._virtTimeToAdvanceMS += durationMS;
    this._timeoutWorker.postMessage({ name : 'immediateTimeout' });
};

/*
 * Tab activity/inactivity agnostic wallclock timeout.
 * Returns void. Timeout can't be cleared.
 */
TimeVirtualizer.prototype.realSetTimeout = function(func, delayMS) {
    var funcId = this._realTimeoutFuncsIdCntr++;
    this._realTimeoutFuncs[funcId] = func;
    this._timeoutWorker.postMessage(
        { name : 'setTimeout', delayMS : delayMS, funcId : funcId }
    );
};

TimeVirtualizer.prototype.realDateNow = function() {
    return this._virtDate.realNow();
};

TimeVirtualizer.prototype._onTimeoutWorkerMessage = function(event) {
    // TODO need to handle this well in time virtualizer destroy()
    if (event.data.name === 'immediateTimeout') {

        var durationMS = this._virtTimeToAdvanceMS;
        this._virtTimeToAdvanceMS = 0;
        this._advanceTimeMSInSafeContext(durationMS);

    } else if (event.data.name === 'setTimeout') {

        var func = this._realTimeoutFuncs[event.data.funcId];
        delete this._realTimeoutFuncs[event.data.funcId];
        if (!isUndefOrNull(func)) {
            func();
        }

    }
};

TimeVirtualizer.prototype._advanceTimeMSInSafeContext = function(durationMS) {
    if (!this._virtualized) { return; } // probably was unVirtualized already

    this._virtTSMS += durationMS;
    // Extra protection from anim frames callbacks side effects needed
    var animFramesToFire = this._requestAnimFrames.slice();
    for(var i = 0; i < animFramesToFire.length; ++i) {
        var animFrame = animFramesToFire[i];
        if (animFrame.isValid()) {
            animFrame.virtFire();
        }
    }

    var timeoutsToProc = this._timeouts.slice();
    for(var i = 0; i < timeoutsToProc.length; ++i) {
        var timeout = timeoutsToProc[i];
        if ((timeout.virtFireTSMS <= this._virtTSMS) && timeout.isValid()) {
            timeout.virtFireTSMS = this._virtTSMS + timeout.getDelayMS();
            timeout.virtFire();
        }
    }
};

// Virtual timestamp in milliseconds
TimeVirtualizer.prototype.getVirtTSMS = function() {
    return this._virtTSMS;
};

TimeVirtualizer.prototype._requestAnimationFrame = function(callback) {
    var virtAnimationFrameRequest =
        new TimeVirtualizer._AnimationFrameRequest(
            this._reals.requestAnimationFrame, this._cancelAnimationFrame,
            callback
        );
    if (this._virtualized) {
        virtAnimationFrameRequest.virtualize();
    }
    this._requestAnimFrames.push(virtAnimationFrameRequest);
    return virtAnimationFrameRequest.getId();
};

TimeVirtualizer.prototype._cancelAnimationFrame = function(animFrameId) {
    var virtAnimationFrameRequestIx = -1;
    for (var i = 0; i < this._requestAnimFrames.length; ++i) {
        var inst = this._requestAnimFrames[i];
        if (inst.getId() === animFrameId) {
            virtAnimationFrameRequestIx = i;
            break;
        }
    }
    if (virtAnimationFrameRequestIx === -1) { return; }

    var virtAnimationFrameRequest = this._requestAnimFrames[virtAnimationFrameRequestIx];
    this._reals.cancelAnimationFrame.call(window, virtAnimationFrameRequest.getId());
    virtAnimationFrameRequest.destroy();
    this._requestAnimFrames.splice(virtAnimationFrameRequestIx, 1);
};

TimeVirtualizer.prototype._setInterval = function(func, delayMS) {
    if (isString(func)) {
        console.warn(LOG_TAG, 'Non function arguments to setInterval are not supported');
        return;
    }
    if (isUndefOrNull(delayMS)) {
        delayMS = 0;
    }
    var funcParams = [];
    for (var i = 2; i < arguments.length; ++i) {
        funcParams.push(arguments[i]);
    }
    var timeout = new TimeVirtualizer._Timeout(
        this._reals.setInterval, this._clearInterval,
        true, delayMS, func, funcParams);
    timeout.virtFireTSMS = this._virtTSMS + delayMS;
    if (this._virtualized) {
        timeout.virtualize();
    }
    this._timeouts.push(timeout);
    return timeout.getId();
};

TimeVirtualizer.prototype._clearInterval = function(timeoutId) {
    var timeoutIx = -1;
    for (var i = 0; i < this._timeouts.length; ++i) {
        var inst = this._timeouts[i];
        if (inst.getIsPeriodic() && (inst.getId() === timeoutId)) {
            timeoutIx = i;
            break;
        }
    }
    if (timeoutIx === -1) { return; }

    var timeout = this._timeouts[timeoutIx];
    this._reals.clearInterval.call(window, timeout.getId());
    timeout.destroy();
    this._timeouts.splice(timeoutIx, 1);
};

TimeVirtualizer.prototype._setTimeout = function(func, delayMS) {
    if (isString(func)) {
        console.warn(LOG_TAG, 'Non function arguments to setInterval are not supported');
        return;
    }
    if (isUndefOrNull(delayMS)) {
        delayMS = 0;
    }
    var funcParams = [];
    for (var i = 2; i < arguments.length; ++i) {
        funcParams.push(arguments[i]);
    }
    var timeout = new TimeVirtualizer._Timeout(
        this._reals.setTimeout, this._clearTimeout,
        false, delayMS, func, funcParams
    );
    if (this._virtualized) {
        timeout.virtualize();
    }
    timeout.virtFireTSMS = this._virtTSMS + delayMS;
    this._timeouts.push(timeout);
    return timeout.getId();
};

TimeVirtualizer.prototype._clearTimeout = function(timeoutId) {
    var timeoutIx = -1;
    for (var i = 0; i < this._timeouts.length; ++i) {
        var inst = this._timeouts[i];
        if ((!inst.getIsPeriodic()) && (inst.getId() === timeoutId)) {
            timeoutIx = i;
            break;
        }
    }
    if (timeoutIx === -1) { return; }

    var timeout = this._timeouts[timeoutIx];
    this._reals.clearTimeout.call(window, timeout.getId());
    timeout.destroy();
    this._timeouts.splice(timeoutIx, 1);
};

// Date
TimeVirtualizer._Date = function(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realDate = window.Date;
    this._realDateNow = window.Date.now;
    this._virtualized = false;
};

TimeVirtualizer._Date.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realDate;
    delete this._realDateNow;
    delete this._virtualized;
};

TimeVirtualizer._Date.prototype.realNow = function() {
    return this._realDateNow.call(this._realDate);
};

TimeVirtualizer._Date.prototype.now = function() {
    if (this._virtualized) {
        return this._timeVirtualizer.getVirtTSMS();
    } else {
        return this._realDateNow.call(this._realDate);
    }
};

TimeVirtualizer._Date.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.Date.now = this.now.bind(this);
};

TimeVirtualizer._Date.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.Date.now = this._realDateNow;
};

// Performance
TimeVirtualizer._Performance = function(timeVirtualizer) {
    this._timeVirtualizer = timeVirtualizer;
    this._realPerformance = window.performance;
    this._realPerformanceNow = window.performance.now;
    this._virtualized = false;
};
TimeVirtualizer._Performance.prototype.destroy = function() {
    this.unVirtualize();
    delete this._timeVirtualizer;
    delete this._realPerformance;
    delete this._realPerformanceNow;
    delete this._virtualized;
};

TimeVirtualizer._Performance.prototype.now = function() {
    if (this._virtualized) {
        return this._timeVirtualizer.getVirtTSMS() - nowOffset + 0.0;
    } else {
        return this._realPerformanceNow.call(this._realPerformance);
    }
};

TimeVirtualizer._Performance.prototype.virtualize = function() {
    if (this._virtualized) { return; }
    this._virtualized = true;
    window.performance.now = this.now.bind(this);
};

TimeVirtualizer._Performance.prototype.unVirtualize = function() {
    if (!this._virtualized) { return; }
    this._virtualized = false;
    window.performance.now = this._realPerformanceNow;
};

// realFunc : real setInterval or real setTimeout
// killMeVirtualizerFunc: virtualized clearInterval or clearTimeout
TimeVirtualizer._Timeout = function(realSetFunc, killMeVirtualizerFunc, isPeriodic,
    delayMS, callback, parameters) {
    // Id should be equal to real to allow user to cancel timeout after
    // unvirtualization is performed.
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
    this._virtFireTSMS = 0;
};

TimeVirtualizer._Timeout.prototype.getId = function() {
    return this._realId;
};

TimeVirtualizer._Timeout.prototype.getIsPeriodic = function() {
    return this._isPeriodic;
};

TimeVirtualizer._Timeout.prototype.getDelayMS = function() {
    return this._delayMS;
};

Object.defineProperty(TimeVirtualizer._Timeout.prototype, 'virtFireTSMS', {
    get : function() {
        return this._virtFireTSMS;
    },
    set : function(value) {
        this._virtFireTSMS = value;
    }
});

TimeVirtualizer._Timeout.prototype.virtFire = function() {
    this._isVirtFired = true;
    this._callCallback();
};

TimeVirtualizer._Timeout.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }

    this._isVirtMode = true;
};

TimeVirtualizer._Timeout.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }

    this._isVirtMode = false;
    if (!this._isPeriodic && !this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

TimeVirtualizer._Timeout.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

TimeVirtualizer._Timeout.prototype._onRealTimeoutFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

TimeVirtualizer._Timeout.prototype._callCallback = function() {
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
    }
};

TimeVirtualizer._Timeout.prototype.destroy = function() {
    delete this._realId;
    delete this._killMeVirtualizerFunc;
    delete this._isPeriodic;
    delete this._callback;
    delete this._parameters;
    delete this._delayMS;
    delete this._isVirtFired;
    delete this._isRealFired;
    delete this._isVirtMode;
    delete this._virtFireTSMS;
};

// AnimationFrameRequest
// killMeFunc timeVirtualizer.(animFrameRequest id)
TimeVirtualizer._AnimationFrameRequest = function(
    realRequestAnimationFrameFunc, killMeVirtualizerFunc, callback) {
    this._realId = realRequestAnimationFrameFunc.call(
        window, this._onRealAnimationFrameFired.bind(this));
    this._callback = callback;
    this._killMeVirtualizerFunc = killMeVirtualizerFunc;

    this._isVirtFired = false;
    this._isRealFired = false;
    this._isVirtMode = false;
};

TimeVirtualizer._AnimationFrameRequest.prototype.getId = function() {
    return this._realId;
};

TimeVirtualizer._AnimationFrameRequest.prototype.virtFire = function() {
    assert(this._isVirtMode, 'VirtFire in virt mode');
    this._isVirtFired = true;
    this._callCallback();
};

TimeVirtualizer._AnimationFrameRequest.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }
    this._isVirtMode = true;
};

TimeVirtualizer._AnimationFrameRequest.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }
    this._isVirtMode = false;

    if (!this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

TimeVirtualizer._AnimationFrameRequest.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

TimeVirtualizer._AnimationFrameRequest.prototype._onRealAnimationFrameFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

TimeVirtualizer._AnimationFrameRequest.prototype._callCallback = function() {
    if (this._callback) {
        this._callback(window.timeVirtualizer._virtPerformance.now());
    }
    // This one may be destroyed in callback. Do additional check.
    if (!this.isValid()) { return; }
    this._killMeVirtualizerFunc.call(window.timeVirtualizer, this.getId());
};

TimeVirtualizer._AnimationFrameRequest.prototype.destroy = function() {
    delete this._realId;
    delete this._callback;
    delete this._killMeVirtualizerFunc;
    delete this._isVirtMode;
    delete this._isVirtFired;
    delete this._isRealFired;
};

window.timeVirtualizer = new TimeVirtualizer();
})();