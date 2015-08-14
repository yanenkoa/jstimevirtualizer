describe("Test test", function() {
    isUndefOrNull = require('../lib/util').isUndefOrNull;
    it("returns true if undefined or null", function() {
        expect(isUndefOrNull(undefined)).toBe(true);
    });
});

describe("Virtualize function", function(){
    beforeAll(function() {
        jasmine.clock().install();
        require('../lib/TimeVirtualizer');
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
        jasmine.clock().uninstall();
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
        jasmine.clock().install();
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
        jasmine.clock().uninstall();
    });

    it("changes virtual time", function() {
        dump(Object.keys(timeVirtualizer));
        dump(typeof(timeVirtualizer._timeoutWorker));

        var formerTS = timeVirtualizer.getVirtTSMS();
        timeVirtualizer._advanceTimeMSInSafeContext(10000);
        dump(timeVirtualizer.getVirtTSMS() - formerTS);
        expect(timeVirtualizer.getVirtTSMS()).toEqual(formerTS + 10000);
    });
});

describe("Real setTimeout function", function() {
    beforeAll(function() {
        jasmine.clock().install();
        timeVirtualizer.virtualize();
    });

    afterAll(function() {
        timeVirtualizer.unVirtualize();
        jasmine.clock().uninstall();
    });

    it("should set real timeouts", function() {
        timerCallback = jasmine.createSpy("timerCallback");
        var timeoutID = timeVirtualizer._reals.setTimeout.call(window, timerCallback, 100);

        jasmine.clock().tick(101);
        expect(timerCallback).toHaveBeenCalled();
    });
});

/*
describe("Unvirtualize function", function() {
    beforeAll(function() {
        jasmine.clock().install();
    });

    afterAll(function() {
        jasmine.clock().uninstall();
    });

    it("makes timeouts work as if there were no virtualization", function() {
        expect(timeVirtualizer._virtualized).toBe(false);
        
    });
});
*/