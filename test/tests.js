describe("Neccessary operations", function(){
    jasmine.clock().install();
    require('../lib/TimeVirtualizer');
});

describe("Virtualize function", function(){
    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    it("stops time", function() {
        timerCallback = jasmine.createSpy("timerCallback");
        var timeoutID = setTimeout(timerCallback, 100);

        timeVirtualizer.virtualize();
        jasmine.clock().tick(101);
        expect(timerCallback).not.toHaveBeenCalled();

        clearTimeout(timeoutID);
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

        timeVirtualizer._advanceTimeMSInSafeContext(timeoutDelay + 50);
        expect(timerCallback.calls.count()).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(timeoutDelay - 40);
        expect(timerCallback.calls.count()).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(timeoutDelay - 59);
        expect(timerCallback.calls.count()).toBe(2);
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
