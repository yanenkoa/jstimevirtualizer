module.exports = function(self) {
    self.addEventListener('message', function(event) {
        if (event.data.name === 'immediateTimeout') {
            setTimeout(function() {
                postMessage({ name: 'immediateTimeout' });
            }, 0);
        } else if (event.data.name === 'setTimeout') {
            setTimeout(function() {
                postMessage(event.data);
            }, event.data.delayMS);
        }
    });
};
