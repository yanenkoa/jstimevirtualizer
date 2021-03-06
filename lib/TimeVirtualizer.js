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

require('./TimeEnvNormalizer');
var work = require('webworkify');

var LOG_TAG = '[TimeVirtualizer]';

function TimeVirtualizer() {
    this._virtualized = false;
    this._timeouts = [];
    this._requestAnimFrames = [];
    this._virtTSMS = 0;
    this._virtTimeToAdvanceMS = 0;
    this._timeoutWorker = work(require('./Worker'));
    this._timeoutWorker.onmessage = this._onTimeoutWorkerMessage.bind(this);
    this._intervalForAnimFramesMS = 0;
    this._lastAnimFrameFireMS = 0;
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

TimeVirtualizer.prototype.setFPS = function(FPS) {
    if (FPS == 0) {
        this._intervalForAnimFramesMS = 0;
    } else {
        this._intervalForAnimFramesMS = Math.floor(1000/FPS);
        this._lastAnimFrameFireMS = timeVirtualizer._virtDate.now();
    };
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

TimeVirtualizer.prototype._swapInTimeouts = function(a, b) {
    var tmp = this._timeouts[a];
    this._timeouts[a] = this._timeouts[b];
    this._timeouts[b] = tmp;
}

TimeVirtualizer.prototype._sortTimeouts = function() {
    // This function sorts '_timeouts' array by '_fireTSMS' parameter
    // Insertion Sort is used because in both cases, when this function is used,
    // it would be linear
    var len = this._timeouts.length;
    for (var j = 0; j < len; j++) {
        var i;

        i = j;
        while(i+1 < len &&
              this._timeouts[i].getFireTSMS() > this._timeouts[i+1].getFireTSMS()) {
            this._swapInTimeouts(i, i+1);
            i++;
        }

        i = j;
        while(i > 0 &&
              this._timeouts[i].getFireTSMS() < this._timeouts[i-1].getFireTSMS()) {
            this._swapInTimeouts(i, i-1);
            i--;
        }
    }
};

TimeVirtualizer.prototype._getProceedTime = function(upperBorder) {
    var timeout = this._timeouts[0];
    // As this._timeouts is sorted, in the beginning of the array
    // is the timeout with lowest getFireTSMS().
    var nextAnimFrameFire = this._lastAnimFrameFireMS + this._intervalForAnimFramesMS;

    var proceedTime;
    if (isUndefOrNull(timeout)) {
        if (this._intervalForAnimFramesMS == 0) {
            proceedTime = upperBorder;
        } else {
            proceedTime = Math.min(upperBorder, nextAnimFrameFire - this._virtTSMS);
        }
    } else {
        if (this._intervalForAnimFramesMS == 0) {
            proceedTime = Math.min(timeout.getFireTSMS() - this._virtTSMS,
                                   upperBorder);
        } else {
            proceedTime = Math.min(timeout.getFireTSMS() - this._virtTSMS,
                                   nextAnimFrameFire - this._virtTSMS,
                                   upperBorder);
        }
    }

    return proceedTime;
};

TimeVirtualizer.prototype._fireTimeout = function() {
    var timeout = this._timeouts[0];
    if (!isUndefOrNull(timeout) &&
        timeout.getFireTSMS() <= this._virtTSMS &&
        timeout.isValid()) {

        timeout.virtFire();
        if (timeout.getIsPeriodic()) {
            this._sortTimeouts();
        }
    }
};

TimeVirtualizer.prototype._fireAnimFrames = function() {
    if (this._virtTSMS - this._lastAnimFrameFireMS >= this._intervalForAnimFramesMS) {
        var animFramesToFire = this._requestAnimFrames.slice();
        for (var i = 0; i < animFramesToFire.length; ++i) {
            var animFrame = animFramesToFire[i];
            if (animFrame.isValid()) {
                animFrame.virtFire();
            }
        }
        this._lastAnimFrameFireMS = this._virtTSMS;
    }
};

TimeVirtualizer.prototype._advanceTimeMSInSafeContext = function(durationMS) {
    if (!this._virtualized) { return; } // probably was unVirtualized already

    while (durationMS > 0) {
        var proceedTime = this._getProceedTime(durationMS);
        this._virtTSMS += proceedTime;
        durationMS -= proceedTime;

        this._fireTimeout();
        if (this._intervalForAnimFramesMS != 0)
            this._fireAnimFrames();
    }

    if (this._intervalForAnimFramesMS == 0)
        this._fireAnimFrames();
};

// Virtual timestamp in milliseconds
TimeVirtualizer.prototype.virtDateNow = function() {
    return this._virtTSMS;
};

TimeVirtualizer.prototype._requestAnimationFrame = function(callback) {
    var virtAnimationFrameRequest = new AnimationFrameRequest(callback);
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

TimeVirtualizer.prototype._setIntervalOrTimeout = function(func, delayMS, isPeriodic, funcParams) {
    if (isString(func)) {
        console.warn(LOG_TAG, 'Non function arguments to setTimeout are not supported');
        return;
    }
    if (isUndefOrNull(delayMS)) {
        delayMS = 0;
    }

    var timeout = new Timeout(isPeriodic, delayMS, func, funcParams);

    if (this._virtualized) {
        timeout.virtualize();
    }

    this._timeouts.push(timeout);
    this._sortTimeouts();

    return timeout.getId();
};

TimeVirtualizer.prototype._clearIntervalOrTimeout = function(timeoutId, isPeriodic) {
    var timeoutIx = -1;
    for (var i = 0; i < this._timeouts.length; ++i) {
        var inst = this._timeouts[i];
        if ((inst.getIsPeriodic() == isPeriodic) && (inst.getId() === timeoutId)) {
            timeoutIx = i;
            break;
        }
    }
    if (timeoutIx === -1) {
        return;
    }
    var timeout = this._timeouts[timeoutIx];
    var realClearFunc;
    if (isPeriodic) {
        this._reals.clearInterval.call(window, timeout.getId());
    } else {
        this._reals.clearTimeout.call(window, timeout.getId());
    }
    timeout.destroy();
    this._timeouts.splice(timeoutIx, 1);
};

TimeVirtualizer.prototype._setInterval = function(func, delayMS) {
    var funcParams = [];
    for (var i = 2; i < arguments.length; ++i) {
        funcParams.push(arguments[i]);
    }
    return this._setIntervalOrTimeout(func, delayMS, true, funcParams);
};

TimeVirtualizer.prototype._clearInterval = function(timeoutId) {
    this._clearIntervalOrTimeout(timeoutId, true);
};

TimeVirtualizer.prototype._setTimeout = function(func, delayMS) {
    var funcParams = [];
    for (var i = 2; i < arguments.length; ++i) {
        funcParams.push(arguments[i]);
    }
    return this._setIntervalOrTimeout(func, delayMS, false, funcParams);
};

TimeVirtualizer.prototype._clearTimeout = function(timeoutId) {
    this._clearIntervalOrTimeout(timeoutId, false);
};


var VirtDate = require('./VirtDate');
var Performance = require('./Performance');
var Timeout = require('./Timeout');
var AnimationFrameRequest = require('./AnimationFrameRequest');

window.timeVirtualizer = new TimeVirtualizer();
})();
