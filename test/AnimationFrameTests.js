describe("AnimationFrameRequest", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    it("triggers required number of times when FPS is set", function() {
        var afCallback = jasmine.createSpy("AF callback");
        var frameID = requestAnimationFrame(afCallback);

        var timeoutCallback = jasmine.createSpy("timeout callback");
        var intervalID = setInterval(timeoutCallback, 10);

        timeVirtualizer.setFPS(60);

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        expect(afCallback.calls.count()).
            toBe(Math.floor(1000 / Math.floor(1000 / 60)));

        clearInterval(intervalID);
        cancelAnimationFrame(frameID);
    });

    it("triggers once when FPS is not set", function() {
        timeVirtualizer.setFPS(0);
        var afCallback = jasmine.createSpy("AF callback");
        requestAnimationFrame(afCallback);

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        expect(afCallback.calls.count()).toBe(1);
    });

    it("disappears after calling cancelAnimationFrame", function() {
        var afCallback = jasmine.createSpy("AF callback");
        var frameID = requestAnimationFrame(afCallback);

        var timeoutCallback = jasmine.createSpy("timeout callback");
        var intervalID = setInterval(timeoutCallback, 10);

        timeVirtualizer.setFPS(60);

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        expect(afCallback.calls.count()).
            toBe(Math.floor(1000 / Math.floor(1000 / 60)));
        var prevCallCount = afCallback.calls.count();

        cancelAnimationFrame(frameID);
        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        expect(afCallback.calls.count()).toBe(prevCallCount);

        clearInterval(intervalID);
    });

    afterAll(function() {
        timeVirtualizer.setFPS(0);
        timeVirtualizer.unVirtualize();
    });
});
