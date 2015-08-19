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

describe("Time advancing function", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    it("changes virtual time", function() {

        var formerTS = timeVirtualizer.virtDateNow();
        // The following string should actually call timeVirtualizer.advanceTimeMS
        // The reason it doesn't is that jasmine seems to not work with web workers
        timeVirtualizer._advanceTimeMSInSafeContext(10000);
        expect(timeVirtualizer.virtDateNow()).toEqual(formerTS + 10000);
    });

    it("triggers timeouts", function() {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutID = setTimeout(timerCallback, 100);

        // Same thing with timeVirtualizer.advanceTimeMS here
        timeVirtualizer._advanceTimeMSInSafeContext(101);
        expect(timerCallback).toHaveBeenCalled();
    });

    it("triggers intervals", function() {
        var timerCallback = jasmine.createSpy("timerCallback");
        var timeoutID = setInterval(timerCallback, 100);

        // Same thing with timeVirtualizer.advanceTimeMS here
        timeVirtualizer._advanceTimeMSInSafeContext(150);
        expect(timerCallback.calls.count()).toBe(1);
        timeVirtualizer._advanceTimeMSInSafeContext(51);
        expect(timerCallback.calls.count()).toBe(2);
    });
});

describe("Real setTimeout function", function() {
    it("should set real timeouts", function() {
        timerCallback = jasmine.createSpy("timerCallback");

        // The following string should actually call timeVirtualizer.realSetTimeout
        // The reason it doesn't is exactly the same as with advanceTimeMS
        // Therefore, this test right now is useless. It is left here as a placeholder
        var timeoutID = timeVirtualizer._reals.setTimeout.call(window, timerCallback, 100);

        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalled();
    });
});
