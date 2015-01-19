var curry = require('curry');
var GUARD_KEY = '__engine_guard';

module.exports = curry(function runEngine (prop, method, guard) {
    return {
        // guard means this property will be "frozen" once the game is finished
        deps: prop.concat(guard ? ['finished', 'freezeOnFinish'] : []),
        fn: function () {
            var value;

            if (typeof method === 'function') {
                value = method.call(this);
            } else {
                value = this.engine[method]();
            }

            // Only update these status properties if the game is not finished
            // This allows for replay of games where 'checkmate' (for example)
            // will always be true based on the result
            if (guard && this.freezeOnFinish && this._cache.hasOwnProperty(guard) && this.finished) {
                // If this is the first time computing thie property since the game
                // has finished, then do one more calculation of the value
                // to get the true end-of-game value
                var hasBeenGuarded = (this[GUARD_KEY] || (this[GUARD_KEY] = {}))[guard];
                this[GUARD_KEY][guard] = true; // Now it has been guarded
                return hasBeenGuarded ? this._cache[guard] : value;
            }

            return value;
        }
    };
});