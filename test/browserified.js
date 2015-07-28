(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
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
},{"./util":6}],2:[function(require,module,exports){
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
},{}],3:[function(require,module,exports){
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
},{"./util":6}],4:[function(require,module,exports){
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

util = require('./util');
assert = util.assert;
isUndefOrNull = util.isUndefOrNull;
isString = util.isString;
nowOffset = util.nowOffset;

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

var workerText = "onmessage = function(event) { if (event.data.name === 'immediateTimeout') { setTimeout(function() { postMessage({ name: 'immediateTimeout' }); }, 0); } else if (event.data.name === 'setTimeout') { setTimeout(function() { postMessage(event.data); }, event.data.delayMS); }};";

function TimeVirtualizer() {
    this._virtualized = false;
    this._timeouts = [];
    this._requestAnimFrames = [];
    this._virtTSMS = 0;
    this._isCallingTimerHandlers = false;
    this._virtTimeToAdvanceMS = 0;
    this._timeoutWorker = makeWorker(workerText);
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


TimeVirtualizer._Date = require('./Date');
TimeVirtualizer._Performance = require('./Performance');
TimeVirtualizer._Timeout = require('./Timeout');
TimeVirtualizer._AnimationFrameRequest = require('./AnimationFrameRequest');

window.timeVirtualizer = new TimeVirtualizer();
})();
},{"./AnimationFrameRequest":1,"./Date":2,"./Performance":3,"./Timeout":5,"./util":6}],5:[function(require,module,exports){
// realFunc : real setInterval or real setTimeout
// killMeVirtualizerFunc: virtualized clearInterval or clearTimeout
_Timeout = function(realSetFunc, killMeVirtualizerFunc, isPeriodic,
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

_Timeout.prototype.getId = function() {
    return this._realId;
};

_Timeout.prototype.getIsPeriodic = function() {
    return this._isPeriodic;
};

_Timeout.prototype.getDelayMS = function() {
    return this._delayMS;
};

Object.defineProperty(_Timeout.prototype, 'virtFireTSMS', {
    get : function() {
        return this._virtFireTSMS;
    },
    set : function(value) {
        this._virtFireTSMS = value;
    }
});

_Timeout.prototype.virtFire = function() {
    this._isVirtFired = true;
    this._callCallback();
};

_Timeout.prototype.virtualize = function() {
    if (this._isVirtMode) { return; }

    this._isVirtMode = true;
};

_Timeout.prototype.unVirtualize = function() {
    if (!this._isVirtMode) { return; }

    this._isVirtMode = false;
    if (!this._isPeriodic && !this._isVirtFired && this._isRealFired) {
        this._callCallback();
    }
};

_Timeout.prototype.isValid = function() {
    return !isUndefOrNull(this._realId);
};

_Timeout.prototype._onRealTimeoutFired = function() {
    this._isRealFired = true;
    if (!this._isVirtMode) {
        this._callCallback();
    }
};

_Timeout.prototype._callCallback = function() {
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

_Timeout.prototype.destroy = function() {
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

module.exports = _Timeout;
},{}],6:[function(require,module,exports){
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

exports.assert = assert;
exports.isUndefOrNull = isUndefOrNull;
exports.isString = isString;
exports.nowOffset = nowOffset;
},{}],7:[function(require,module,exports){
$(document).ready(function(){
	//time virtualizer stuff
	require('../lib/TimeVirtualizer');

	timeVirtualizer.virtualize();
	var advanceMS = 10;
	//Slowing down/speeding up time is achieved through changing this variable
	advanceTime = function () {
		timeVirtualizer.advanceTimeMS(advanceMS);
	}
	//Every 10ms the time is advanced for 'advanceMS' milliseconds, thus, changing this variable
	//can change the speed of ingame time
	var intervalId = timeVirtualizer._reals.setInterval.call(window, advanceTime, 10);

	//Snake game code mostly taken from 
	//http://thecodeplayer.com/walkthrough/html5-game-tutorial-make-a-snake-game-using-html5-canvas-jquery

	//Canvas stuff
	var canvas = $("#canvas")[0];
	var ctx = canvas.getContext("2d");
	var w = $("#canvas").width();
	var h = $("#canvas").height();
	
	var cw = 10;
	var d;
	var food;
	var score;
	
	var snake_array; //an array of cells to make up the snake
	
	function init()
	{
		d = "right"; //default direction
		create_snake();
		create_food();
		score = 0;
		
		if(typeof game_loop != "undefined") clearInterval(game_loop);
		game_loop = setInterval(paint, 60);
	}
	init();
	
	function create_snake()
	{
		var length = 5;
		snake_array = [];
		for(var i = length-1; i>=0; i--)
		{
			snake_array.push({x: i, y:0});
		}
	}
	
	//Lets create the food now
	function create_food()
	{
		food = {
			x: Math.round(Math.random()*(w-cw)/cw), 
			y: Math.round(Math.random()*(h-cw)/cw), 
		};
	}
	
	function paint()
	{
		//To avoid the snake trail we need to paint the BG on every frame
		ctx.fillStyle = "white";
		ctx.fillRect(0, 0, w, h);
		ctx.strokeStyle = "black";
		ctx.strokeRect(0, 0, w, h);
		
		var nx = snake_array[0].x;
		var ny = snake_array[0].y;
		
		if(d == "right") nx++;
		else if(d == "left") nx--;
		else if(d == "up") ny--;
		else if(d == "down") ny++;
		
		//This will restart the game if the snake hits the wall or bumps into its body
		if(nx == -1 || nx == w/cw || ny == -1 || ny == h/cw || check_collision(nx, ny, snake_array))
		{
			//restart game
			init();
			return;
		}
		
		//The movement code
		//The logic is simple
		//If the new head position matches with that of the food,
		//create a new head instead of moving the tail.
		//If not, pop out the tail cell and place it in front of the head cell
		if(nx == food.x && ny == food.y)
		{
			var tail = {x: nx, y: ny};
			score++;
			//Create new food
			create_food();
		}
		else
		{
			var tail = snake_array.pop(); //pops out the last cell
			tail.x = nx; tail.y = ny;
		}

		snake_array.unshift(tail); //puts back the tail as the first cell
		
		for(var i = 0; i < snake_array.length; i++)
		{
			var c = snake_array[i];
			//Lets paint 10px wide cells
			paint_cell(c.x, c.y);
		}
		
		//Lets paint the food
		paint_cell(food.x, food.y);
		//Lets paint the score
		var score_text = "Score: " + score;
		ctx.fillText(score_text, 5, h-5);
		//Lets paint the speed of the game
		var speed_text = "Speed: " + advanceMS*10 + "% of normal";
		ctx.fillText(speed_text, 50, h-5);
	}
	
	function paint_cell(x, y)
	{
		ctx.fillStyle = "blue";
		ctx.fillRect(x*cw, y*cw, cw, cw);
		ctx.strokeStyle = "white";
		ctx.strokeRect(x*cw, y*cw, cw, cw);
	}
	
	function check_collision(x, y, array)
	{
		//This function will check if the provided x/y coordinates exist
		//in an array of cells or not
		for(var i = 0; i < array.length; i++)
		{
			if(array[i].x == x && array[i].y == y)
			 return true;
		}
		return false;
	}
	
	//Keyboard controls
	$(document).keydown(function(e){
		var key = e.which;
		//Movement control
		if(key == "37" && d != "right") d = "left";
		else if(key == "38" && d != "down") d = "up";
		else if(key == "39" && d != "left") d = "right";
		else if(key == "40" && d != "up") d = "down";

		//Speed control
		else if (key == "90" && advanceMS > 1) {
			console.log("time down");
			advanceMS--;
		} else if (key == "88" && advanceMS < 20) {
			console.log("time up");
			advanceMS++;
		} else if (key == "83") {
			console.log("unvirtualizing");
			timeVirtualizer._reals.clearInterval.call(window, intervalId);
			timeVirtualizer.unVirtualize();
		}
	})
});

},{"../lib/TimeVirtualizer":4}]},{},[7]);
