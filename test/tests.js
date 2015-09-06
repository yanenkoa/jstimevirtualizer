describe("Neccessary operations", function() {
    jasmine.clock().install();
    require('../lib/TimeVirtualizer');
});

describe("Virtualize function", function() {
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

describe("Virtualize function", function() {
    beforeAll(function() {
        timeVirtualizer.unVirtualize();
    });

    var timerCallback1;
    var timerCallback2;
    var timeoutID;

    beforeEach(function(done) {
        timerCallback1 = jasmine.createSpy("timer callback 1");
        timerCallback2 = jasmine.createSpy("timer callback 2");

        timeoutID = setTimeout(timerCallback2, 2000);

        timeVirtualizer.realSetTimeout(timerCallback1, 1000);

        // done() function in this case is not guaranteed to be called exactly after 1000 ms
        // It will usually be 10-20 ms later than that
        spyOn(timeVirtualizer._timeoutWorker, "onmessage").and.callFake(function() {
            done();
        });
    });

    it("resolves timeouts correctly", function() {
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

    it("triggers intervals", function() {
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

describe("timeVirtualizer._timeouts array", function() {
    it("is sorted", function(){
        var timerCallback1 = jasmine.createSpy("timer callback 1");
        var timerCallback2 = jasmine.createSpy("timer callback 2");
        var timerCallback3 = jasmine.createSpy("timer callback 3");

        var timeoutID1 = setTimeout(timerCallback1, 2000);
        var timeoutID2 = setTimeout(timerCallback3, 1000);
        var timeoutID3 = setTimeout(timerCallback2, 3000);

        for (var i = 0; i < timeVirtualizer.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i]).toBeLessThan(timeVirtualizer._timeouts[i+1]);
        }

        clearTimeout(timeoutID1);
        clearTimeout(timeoutID2);
        clearTimeout(timeoutID3);
    });
});

describe("Timeouts and intervals", function() {
    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    it("trigger callbacks with proper arguments in non-virtualized time", function() {
        timeVirtualizer.unVirtualize();
        var foo = {};

        var timerCallback = jasmine.createSpy("timer callback");
        setTimeout(timerCallback, 100, foo);
        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalledWith(foo);

        var intervalID = setInterval(timerCallback, 100, foo);
        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalledWith(foo);

        clearInterval(intervalID);
    });

    it("trigger callbacks with proper arguments in virtualized time", function() {
        timeVirtualizer.virtualize();
        var foo = {};

        var timerCallback = jasmine.createSpy("timer callback");
        setTimeout(timerCallback, 100, foo);
        timeVirtualizer._advanceTimeMSInSafeContext(100);
        expect(timerCallback).toHaveBeenCalledWith(foo);

        var intervalID = setInterval(timerCallback, 100, foo);
        timeVirtualizer._advanceTimeMSInSafeContext(100);
        expect(timerCallback).toHaveBeenCalledWith(foo);

        clearInterval(intervalID);
    });

    it("timeouts destroy themselves after firing in non-virtualized time", function() {
        expect(timeVirtualizer._timeouts.length).toBe(0);
        timeVirtualizer.unVirtualize();

        var timerCallback = jasmine.createSpy("timer callback");
        setTimeout(timerCallback, 100);
        expect(timeVirtualizer._timeouts.length).toBe(1);
        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalled();
        expect(timeVirtualizer._timeouts.length).toBe(0);
    });

    it("timeouts destroy themselves after firing in virtualized time", function() {
        expect(timeVirtualizer._timeouts.length).toBe(0);
        timeVirtualizer.virtualize();

        var timerCallback = jasmine.createSpy("timer callback");
        setTimeout(timerCallback, 100);
        expect(timeVirtualizer._timeouts.length).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(100);
        expect(timerCallback).toHaveBeenCalled();
        expect(timeVirtualizer._timeouts.length).toBe(0);
    });
});
