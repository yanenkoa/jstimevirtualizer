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
