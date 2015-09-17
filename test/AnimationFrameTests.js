describe("AnimationFrameRequest", function() {
    beforeAll(function() {
        timeVirtualizer.virtualize();
    });

    it("works", function() {
        var afCallback = jasmine.createSpy("AF callback");
        requestAnimationFrame(afCallback);
        timeVirtualizer.setFPS(60);

        timeVirtualizer._advanceTimeMSInSafeContext(1000);
        expect(afCallback.calls.count()).not.toBeLessThan(60);
    });

    afterAll(function() {
        timeVirtualizer.setFPS(0);
    });
});
