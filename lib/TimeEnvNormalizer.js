if (isUndefOrNull(window.performance)){
    window.performance = {};
}

if(!window.performance.now) {
    window.performance.now = function(){
        return Date.now() - nowOffset;
    };
}

if(!window.requestAnimationFrame) {
    window.requestAnimationFrame = 
        window.mozRequestAnimationFrame ||
        window.webkitRequestAnimationFrame ||
        window.msRequestAnimationFrame;
}

if(!window.cancelAnimationFrame) {
    window.cancelAnimationFrame = window.mozCancelAnimationFrame;
}
