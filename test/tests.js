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

    var foo = null;
    var timerCallback1;
    var timerCallback2;

    beforeEach(function (done) {
        timerCallback1 = jasmine.createSpy("timer callback 1");
        timerCallback2 = jasmine.createSpy("timer callback 2");

        setTimeout(timerCallback2, 2000);

        dump(timeVirtualizer.realDateNow());
        timeVirtualizer.realSetTimeout(timerCallback1, 1000);

        // done() function in this case is not guaranteed to be called exactly after 1000 ms
        // It will usually be 10-20 ms later than that
        spyOn(timeVirtualizer._timeoutWorker, "onmessage").and.callFake(function () {
            done();
        });
    });

    it("resolves timeouts correctly", function () {
        dump(timeVirtualizer.realDateNow());
        timeVirtualizer.virtualize();
        expect(timerCallback2).not.toHaveBeenCalled();

        timeVirtualizer._advanceTimeMSInSafeContext(500);
        expect(timerCallback2).not.toHaveBeenCalled();
        timeVirtualizer._advanceTimeMSInSafeContext(500);
        expect(timerCallback2).toHaveBeenCalled();
    });
});

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
        setTimeout(timerCallback, timeoutDelay);
        timeVirtualizer._advanceTimeMSInSafeContext(timeoutDelay + 1);
        expect(timerCallback).toHaveBeenCalled();
    });

    it("triggers intervals", function () {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutDelay = 100;
        setInterval(timerCallback, timeoutDelay);

        timeVirtualizer._advanceTimeMSInSafeContext(150);
        expect(timerCallback.calls.count()).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(60);
        expect(timerCallback.calls.count()).toBe(2);
        timeVirtualizer._advanceTimeMSInSafeContext(80);
        expect(timerCallback.calls.count()).toBe(2);
        timeVirtualizer._advanceTimeMSInSafeContext(10);
        expect(timerCallback.calls.count()).toBe(3);
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
