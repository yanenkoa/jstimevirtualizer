describe("Neccessary operations", function(){
    jasmine.clock().install();
    require('../lib/TimeVirtualizer');
});

describe("Virtualize function", function(){
    beforeAll(function() {
        timeVirtualizer.unVirtualize();
    });

    afterEach(function() {
        timeVirtualizer.unVirtualize();
    });

    it("stops time", function() {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutID = setTimeout(timerCallback, 100);

        timeVirtualizer.virtualize();
        jasmine.clock().tick(101);
        expect(timerCallback).not.toHaveBeenCalled();

        clearTimeout(timeoutID);
    });
});

describe("Virtualize function", function () {
    beforeAll(function() {
        timeVirtualizer.unVirtualize();
    });

    var timerCallback1;
    var timerCallback2;
    var timeoutID;

    beforeEach(function (done) {
        timerCallback1 = jasmine.createSpy("timer callback 1");
        timerCallback2 = jasmine.createSpy("timer callback 2");

        timeoutID = setTimeout(timerCallback2, 2000);

        timeVirtualizer.realSetTimeout(timerCallback1, 1000);

        // done() function in this case is not guaranteed to be called exactly after 1000 ms
        // It will usually be 10-20 ms later than that
        spyOn(timeVirtualizer._timeoutWorker, "onmessage").and.callFake(function () {
            done();
        });
    });

    it("resolves timeouts correctly", function () {
        timeVirtualizer.virtualize();
        expect(timerCallback2).not.toHaveBeenCalled();

        timeVirtualizer._advanceTimeMSInSafeContext(500);
        expect(timerCallback2).not.toHaveBeenCalled();
        timeVirtualizer._advanceTimeMSInSafeContext(500);
        expect(timerCallback2).toHaveBeenCalled();

        clearTimeout(timeoutID);
    });
});

describe("_advanceTimeMSInSafeContext function", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    it("advances virtual time", function() {
        var formerTS = timeVirtualizer.virtDateNow();
        var timeChange = 10;
        timeVirtualizer._advanceTimeMSInSafeContext(timeChange);
        expect(timeVirtualizer.virtDateNow()).toBe(formerTS + timeChange);
    });

    it("triggers timeouts", function() {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutDelay = 10;
        var timeoutID = setTimeout(timerCallback, timeoutDelay);
        timeVirtualizer._advanceTimeMSInSafeContext(timeoutDelay + 1);
        expect(timerCallback).toHaveBeenCalled();

        clearTimeout(timeoutID);
    });

    it("triggers intervals", function () {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutDelay = 100;
        var intervalID = setInterval(timerCallback, timeoutDelay);

        timeVirtualizer._advanceTimeMSInSafeContext(150);
        expect(timerCallback.calls.count()).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(60);
        expect(timerCallback.calls.count()).toBe(2);
        timeVirtualizer._advanceTimeMSInSafeContext(80);
        expect(timerCallback.calls.count()).toBe(2);
        timeVirtualizer._advanceTimeMSInSafeContext(10);
        expect(timerCallback.calls.count()).toBe(3);

        clearInterval(intervalID);
    });

    it("triggers intervals multiple times", function() {
        var timerCallback1 = jasmine.createSpy("timerCallback");
        var intervalID1 = setInterval(timerCallback1, 100);

        timeVirtualizer._advanceTimeMSInSafeContext(50);
        expect(timerCallback1.calls.count()).toBe(0);

        var timerCallback2 = jasmine.createSpy("timerCallback");
        var intervalID2 = setInterval(timerCallback2, 100);

        timeVirtualizer._advanceTimeMSInSafeContext(350);
        expect(timerCallback1.calls.count()).toBe(4);
        expect(timerCallback2.calls.count()).toBe(3);

        clearInterval(intervalID1);
        clearInterval(intervalID2);
    });
});

describe("timeVirtualizer._timeouts array", function (){
    it("is sorted", function(){
        var timerCallback1 = jasmine.createSpy("timer callback 1");
        var timerCallback2 = jasmine.createSpy("timer callback 2");
        var timerCallback3 = jasmine.createSpy("timer callback 3");

        setTimeout(timerCallback1, 2000);
        setTimeout(timerCallback3, 1000);
        setTimeout(timerCallback2, 3000);

        for (var i = 0; i < timeVirtualizer.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i]).toBeLessThan(timeVirtualizer._timeouts[i+1]);
        }
    });
});


// Worker tests


describe("advanceTimeMS function" , function () {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function () {
        timeVirtualizer.unVirtualize();
    });

    var timeChange = 10;

    beforeEach(function (done) {
        spyOn(timeVirtualizer, "_advanceTimeMSInSafeContext");

        timeVirtualizer.advanceTimeMS(timeChange);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function (event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
    });

	it("calls _advanceTimeMSInSafeContext", function () {
        expect(timeVirtualizer._advanceTimeMSInSafeContext).toHaveBeenCalledWith(timeChange);
    });
});

describe("realSetTimeout function", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    var timerCallback;
    var timeoutDelay;

    beforeEach(function (done) {
        timeoutDelay = 10;
        timerCallback = jasmine.createSpy("timerCallback");

        timeVirtualizer.realSetTimeout(timerCallback, timeoutDelay);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function (event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
    });

    it("sets real timeouts", function() {
        expect(timerCallback).toHaveBeenCalled();
    });
});
