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
    it("is always sorted", function() {
        var timerCallback1 = jasmine.createSpy("timer callback 1");
        var timerCallback2 = jasmine.createSpy("timer callback 2");
        var timerCallback3 = jasmine.createSpy("timer callback 3");

        var timeoutID1 = setInterval(timerCallback1, 2000);
        var timeoutID2 = setInterval(timerCallback3, 1000);
        var timeoutID3 = setInterval(timerCallback2, 3000);

        for (var i = 0; i < timeVirtualizer._timeouts.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i].getFireTSMS()).
                toBeLessThan(timeVirtualizer._timeouts[i+1].getFireTSMS());
        }

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        for (var i = 0; i < timeVirtualizer._timeouts.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i].getFireTSMS()).
                toBeLessThan(timeVirtualizer._timeouts[i+1].getFireTSMS());
        }

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        for (var i = 0; i < timeVirtualizer._timeouts.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i].getFireTSMS()).
                toBeLessThan(timeVirtualizer._timeouts[i+1].getFireTSMS());
        }

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        for (var i = 0; i < timeVirtualizer._timeouts.length - 1; i++) {
            expect(timeVirtualizer._timeouts[i].getFireTSMS()).
                toBeLessThan(timeVirtualizer._timeouts[i+1].getFireTSMS());
        }

        clearInterval(timeoutID1);
        clearInterval(timeoutID2);
        clearInterval(timeoutID3);
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
