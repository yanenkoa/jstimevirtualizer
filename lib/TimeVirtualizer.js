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

Util = require('./Util');
assert = Util.assert;
isUndefOrNull = Util.isUndefOrNull;
isString = Util.isString;
nowOffset = Util.nowOffset;

if (isUndefOrNull(window.performance)){
    window.performance = {};
}

if(!window.performance.now) {
    window.performance.now = function(){
        return Date.now() - nowOffset;
    };
}

var LOG_TAG = '[TimeVirtualizer]';

function makeWorker(script) {
    var URL = window.URL || window.webkitURL;
    var Blob = window.Blob;
    var Worker = window.Worker;
 
    if (!URL || !Blob || !Worker || !script) {
        return null;
    }
 
    var blob = new Blob([script]);
    var worker = new Worker(URL.createObjectURL(blob));
    return worker;
}

function TimeVirtualizer() {
    this._virtualized = false;
    this._timeouts = [];
    this._requestAnimFrames = [];
    this._virtTSMS = 0;
    this._isCallingTimerHandlers = false;
    this._virtTimeToAdvanceMS = 0;
    // this._timeoutWorker = makeWorker(workerText);
    this._timeoutWorker = makeWorker(require('./Worker').toString());
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
    this._virtDate = new TimeVirtualizer.VirtDate(this);
    this._virtPerformance = new TimeVirtualizer.Performance(this);
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
        new TimeVirtualizer.AnimationFrameRequest(
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
    var timeout = new TimeVirtualizer.Timeout(
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
    var timeout = new TimeVirtualizer.Timeout(
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
        } } if (timeoutIx === -1) { return; } var timeout = this._timeouts[timeoutIx]; this._reals.clearTimeout.call(window, timeout.getId());
    timeout.destroy();
    this._timeouts.splice(timeoutIx, 1);
};


TimeVirtualizer.VirtDate = require('./VirtDate');
TimeVirtualizer.Performance = require('./Performance');
TimeVirtualizer.Timeout = require('./Timeout');
TimeVirtualizer.AnimationFrameRequest = require('./AnimationFrameRequest');

window.timeVirtualizer = new TimeVirtualizer();
})();
