describe("advanceTimeMS function" , function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    var timeChange = 10;

    beforeEach(function(done) {
        spyOn(timeVirtualizer, "_advanceTimeMSInSafeContext");

        timeVirtualizer.advanceTimeMS(timeChange);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function(event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
    });

	it("calls _advanceTimeMSInSafeContext", function() {
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

    beforeEach(function(done) {
        timeoutDelay = 10;
        timerCallback = jasmine.createSpy("timerCallback");

        timeVirtualizer.realSetTimeout(timerCallback, timeoutDelay);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function(event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
    });

    it("sets real timeouts", function() {
        expect(timerCallback).toHaveBeenCalled();
    });
});
