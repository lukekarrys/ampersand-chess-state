// http://benalman.com/news/2012/09/partial-application-in-javascript/#partial-application-from-the-left

module.exports = function partial(fn) {
    var slice = Array.prototype.slice;
    var args = slice.call(arguments, 1);
    return function () {
        return fn.apply(this, args.concat(slice.call(arguments, 0)));
    };
};