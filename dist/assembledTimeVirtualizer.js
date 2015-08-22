(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = AnimationFrameRequest;

var Util = require('./Util');
var assert = Util.assert;
var isUndefOrNull = Util.isUndefOrNull;

// AnimationFrameRequest
// killMeFunc timeVirtualizer.(animFrameRequest id)
function AnimationFrameRequest(
    realRequestAnimationFrameFunc, killMeVirtualizerFunc, callback) {

    this._realId = realRequestAnimationFrameFunc.call(
        window, this._onRealAnimationFrameFired.bind(this));
    this._callback = callback;
    this._killMeVirtualizerFunc = killMeVirtualizerFunc;

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
    this._killMeVirtualizerFunc.call(window.timeVirtualizer, this.getId());
};

AnimationFrameRequest.prototype.destroy = function() {
    delete this._realId;
    delete this._callback;
    delete this._killMeVirtualizerFunc;
    delete this._isVirtMode;
    delete this._isVirtFired;
    delete this._isRealFired;
};

},{"./Util":6}],2:[function(require,module,exports){
module.exports = Performance;

var Util = require('./Util');
var assert = Util.assert;
var isUndefOrNull = Util.isUndefOrNull;
var isString = Util.isString;
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


},{"./Util":6}],3:[function(require,module,exports){
var Util = require('./Util');
var isUndefOrNull = Util.isUndefOrNull;
var nowOffset = Util.nowOffset;

if (isUndefOrNull(window.performance)){
    window.performance = {};
}

if(!window.performance.now) {
    window.performance.now = function(){
        return Date.now() - nowOffset;
    };
}

if(!window.requestAnimationFrame) {
    window.requestAnimationFrame = 
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;
}

if(!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = window.mozCancelAnimationFrame;
}

},{"./Util":6}],4:[function(require,module,exports){
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

var Util = require('./Util');
var assert = Util.assert;
var isUndefOrNull = Util.isUndefOrNull;
var isString = Util.isString;

require('./TimeEnvNormalizer.js');
var makeWorker = require('./WorkerMaker.js');

var LOG_TAG = '[TimeVirtualizer]';

function TimeVirtualizer() {
    this._virtualized = false;
    this._timeouts = [];
    this._requestAnimFrames = [];
    this._virtTSMS = 0;
    this._virtTimeToAdvanceMS = 0;
    // this._timeoutWorker = makeWorker(workerText);
    this._timeoutWorker = makeWorker(require('./Worker.js').toString());
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

    this._reals.requestAnimationFrame = window.requestAnimationFrame;
    this._reals.cancelAnimationFrame = window.cancelAnimationFrame;
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
    this._virtDate = new VirtDate(this);
    this._virtPerformance = new Performance(this);
}

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
            timeout.virtFireTSMS += timeout.getDelayMS();
            timeout.virtFire();
        }
    }
};

// Virtual timestamp in milliseconds
TimeVirtualizer.prototype.virtDateNow = function() {
    return this._virtTSMS;
};

TimeVirtualizer.prototype._requestAnimationFrame = function(callback) {
    var virtAnimationFrameRequest =
        new AnimationFrameRequest(
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
    var timeout = new Timeout(
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
    var timeout = new Timeout(
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
    if (timeoutIx === -1) {
        return;
    }
    var timeout = this._timeouts[timeoutIx];
    this._reals.clearTimeout.call(window, timeout.getId());
    timeout.destroy();
    this._timeouts.splice(timeoutIx, 1);
};


var VirtDate = require('./VirtDate');
var Performance = require('./Performance');
var Timeout = require('./Timeout');
var AnimationFrameRequest = require('./AnimationFrameRequest');

window.timeVirtualizer = new TimeVirtualizer();
})();

},{"./AnimationFrameRequest":1,"./Performance":2,"./TimeEnvNormalizer.js":3,"./Timeout":5,"./Util":6,"./VirtDate":7,"./Worker.js":8,"./WorkerMaker.js":9}],5:[function(require,module,exports){
module.exports = Timeout;

var isUndefOrNull = require('./Util').isUndefOrNull;

// realFunc : real setInterval or real setTimeout
// killMeVirtualizerFunc: virtualized clearInterval or clearTimeout
function Timeout(realSetFunc, killMeVirtualizerFunc, isPeriodic,
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

Timeout.prototype.getId = function() {
    return this._realId;
};

Timeout.prototype.getIsPeriodic = function() {
    return this._isPeriodic;
};

Timeout.prototype.getDelayMS = function() {
    return this._delayMS;
};

Object.defineProperty(Timeout.prototype, 'virtFireTSMS', {
    get : function() {
        return this._virtFireTSMS;
    },
    set : function(value) {
        this._virtFireTSMS = value;
    }
});

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
    delete this._virtFireTSMS;
};


},{"./Util":6}],6:[function(require,module,exports){
exports.assert = assert;
exports.isUndefOrNull = isUndefOrNull;
exports.isString = isString;
exports.nowOffset = nowOffset;

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

var nowOffset = Date.now();
if (window.performance.timing && window.performance.timing.navigationStart){
    nowOffset = window.performance.timing.navigationStart;
}

},{}],7:[function(require,module,exports){
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
        return this._timeVirtualizer.getVirtTSMS();
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

},{}],8:[function(require,module,exports){
var onmessage = function(event) {
    if (event.data.name === 'immediateTimeout') {
        setTimeout(function() {
            postMessage({ name: 'immediateTimeout' });
        }, 0);
    } else if (event.data.name === 'setTimeout') {
        setTimeout(function() {
            postMessage(event.data);
        }, event.data.delayMS);
    }
};

module.exports = onmessage;

},{}],9:[function(require,module,exports){
function makeWorker(script) {
    var URL = window.URL || window.webkitURL;
    var Blob = window.Blob;
    var Worker = window.Worker;
 
    if (!URL || !Blob || !Worker || !script) {
        console.warn("Can't create worker");
        return null;
    }
 
    var blob = new Blob([script]);
    var worker = new Worker(URL.createObjectURL(blob));
    return worker;
}

module.exports = makeWorker;

},{}]},{},[4]);
