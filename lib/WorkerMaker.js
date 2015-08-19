function makeWorker(script) {
    var URL = window.URL || window.webkitURL;
    var Blob = window.Blob;
    var Worker = window.Worker;
 
    if (!URL || !Blob || !Worker || !script) {
        console.warn("Can't create worker");
        return null;
    }
 
    var blob = new Blob([script]);
    var worker = new Worker(URL.createObjectURL(blob));
    return worker;
}

module.exports = makeWorker;
