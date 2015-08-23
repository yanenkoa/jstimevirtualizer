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

	var timerCallback;
	var timeoutDelay;

	beforeEach(function(done) {
        timerCallback = jasmine.createSpy("timerCallback");
		timeoutDelay = 10;
        setTimeout(timerCallback, timeoutDelay);

        timeVirtualizer.advanceTimeMS(timeoutDelay+1);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function (event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
	});

    it("triggers timeouts", function() {
        expect(timerCallback).toHaveBeenCalled();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });
});

describe("Real setTimeout function", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

    it("should set real timeouts", function() {
        var timerCallback = jasmine.createSpy("timerCallback");

        // The following string should actually call timeVirtualizer.realSetTimeout
        // The reason it doesn't is exactly the same as with advanceTimeMS
        // Therefore, this test right now is useless. It is left here as a placeholder
        var timeoutID = timeVirtualizer._reals.setTimeout.call(window, timerCallback, 100);

        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalled();
    });
});

describe("Time advancing function", function() {
    var formerTS;
    var virtTimeChange;

    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
    });

	beforeEach(function(done) {
		formerTS = timeVirtualizer.virtDateNow();
		virtTimeChange = 10;

        timeVirtualizer.advanceTimeMS(virtTimeChange);
        spyOn(timeVirtualizer._timeoutWorker, 'onmessage').and.callFake(function (event) {
            timeVirtualizer._onTimeoutWorkerMessage(event);
            done();
        });
	});

    it("advances virtual time", function() {
        var currTS = timeVirtualizer.virtDateNow();
        expect(currTS).toBe(formerTS + virtTimeChange);
    });
});
