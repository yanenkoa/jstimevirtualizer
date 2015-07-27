function assert(assertion, msg) {
    if (!assertion) {
        throw new Error(msg);
    }
}

function isUndefOrNull(val) {
    return val === null || (typeof val === 'undefined');
}

function isString(val) {
    return typeof val === 'string';
}

if (isUndefOrNull(window.performance)){
    window.performance = {};
}

var nowOffset = Date.now();
if (window.performance.timing && window.performance.timing.navigationStart){
    nowOffset = window.performance.timing.navigationStart;
}

exports.assert = assert;
exports.isUndefOrNull = isUndefOrNull;
exports.isString = isString;
exports.nowOffset = nowOffset;