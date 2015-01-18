var State = require('ampersand-state');
var Engine = require('chess.js').Chess;
var raf = require('raf');
var slice = Array.prototype.slice;
var emptyArray = function () {
    return [];
};
var runEngine = function (method, key, deps) {
    return {
        deps: ['fen'].concat(key ? ['finished', 'freezeOnFinish'] : []).concat(deps ? deps : []),
        fn: function () {
            // Only update these status properties if the game is not finished
            // This allows for replay of games where 'checkmate' will always be true
            // based on the result
            if (key && this._cache.hasOwnProperty(key) && this.finished && this.freezeOnFinish)  {
                return this._cache[key];
            }

            if (typeof method === 'function') {
                return method.call(this);
            }

            return this.engine[method]();
        }
    };
};

var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';


module.exports = State.extend({
    props: {
        blackTime: ['number', true, -1],
        whiteTime: ['number', true, -1],
        fen: ['string', true, START_FEN],
        future: ['array', true, emptyArray],
        history: ['array', true, emptyArray],
        valid: 'boolean',
        errorMessage: 'string',
        freezeOnFinish: ['boolean', true, false]
    },

    derived: {
        // All these properties are guarded by this.finished
        // meaning if the game is finished none of these properties will change
        // unless freezeOnFinish is false
        start: runEngine(function () { return this.fen === START_FEN; }, 'start'),
        empty: runEngine(function () { return this.fen === EMPTY_FEN; }, 'empty'),
        checkmate: runEngine('in_checkmate', 'checkmate'),
        check: runEngine('in_check', 'check'),
        draw: runEngine('in_draw', 'draw'),
        stalemate: runEngine('in_stalemate', 'stalemate'),
        threefoldRepetition: runEngine('in_threefold_repetition', 'threefoldRepetition'),
        insufficientMaterial: runEngine('insufficient_material', 'insufficientMaterial'),
        engineOver: runEngine('game_over', 'engineOver'),
        finalPgn: runEngine(function () {
            return this.engine.pgn({max_width: 1, newline_char: '|'}).split('|');
        }, 'finalPgn', ['pgn']),
        pgn: runEngine('pgn', 'pgn'),
        turn: runEngine(function () { return this.engine.turn() === 'b' ? 'black' : 'white'; }, 'turn'),

        ascii: runEngine('ascii'),
        moves: runEngine('moves'),
        engineHistory: {
            deps: ['fen', 'history'],
            fn: function () {
                this.history = this.engine.history();
                return this.history;
            }
        },

        pgnArray: {
            deps: ['canUndo', 'canRedo', 'history', 'finalPgn'],
            fn: function () {
                var pgn = this.finalPgn;

                if (this.canUndo || this.canRedo) {
                    var current = this.history.length;
                    var count = 0;
                    pgn = pgn.map(function (move) {
                        var isMove = move.match(/^\d+\.\s/);
                        var plys, result = {};

                        if (isMove) {
                            plys = move.replace(isMove[0], '').split(' ');
                            result.move = isMove[0].replace('. ', '');
                            result.ply1 = {san: plys[0]};
                            result.ply2 = {san: plys[1] || ''};

                            count++;

                            if (count === current) {
                                result.ply1.active = true;
                            }

                            if (result.ply2.san) {
                                count++;
                                if (count === current) {
                                    result.ply2.active = true;
                                }
                            }

                            return result;
                        }

                        return move;
                    });
                }

                return pgn;
            }
        },

        canRedo: {
            deps: ['future'],
            fn: function () {
                return this.future.length > 0;
            }
        },
        canUndo: {
            deps: ['history'],
            fn: function () {
                return this.history.length > 0;
            }
        },
        winner: {
            deps: ['checkmate', 'turn', 'blackTime', 'whiteTime'],
            fn: function () {
                if (this.blackTime === 0) {
                    return 'white';
                }
                else if (this.whiteTime === 0) {
                    return 'black';
                }
                else if (this.checkmate) {
                    return this.turn === 'black' ? 'white' : 'black';
                }
            }
        },
        gameOver: {
            deps: ['engineOver', 'lostOnTime'],
            fn: function () {
                return this.engineOver || this.lostOnTime;
            }
        },
        endResult: {
            deps: ['gameOver', 'lostOnTime', 'draw', 'stalemate', 'threefoldRepetition', 'insufficientMaterial'],
            fn: function () {
                var result;
                if (this.gameOver) {
                    if (this.lostOnTime) {
                        result = 'Lost on time';
                    }
                    else if (this.checkmate) {
                        result = 'Checkmate';
                    }
                    else if (this.draw) {
                        result = 'Draw';
                        if (this.stalemate) {
                            result += ' - Stalemate';
                        }
                        else if (this.threefoldRepetition) {
                            result += ' - Threefold Repetition';
                        }
                        else if (this.insufficientMaterial) {
                            result += ' - Insufficient Material';
                        }
                    }
                }
                return result;
            }
        },
        lostOnTime: {
            deps: ['blackTime', 'whiteTime'],
            fn: function () {
                return this.whiteTime === 0 || this.blackTime === 0;
            }
        },
        finished: {
            deps: ['gameOver'],
            fn: function () {
                // Once a game is over it is always "finished"
                if (typeof this._cache.finished !== 'undefined' && this._cache.finished) {
                    return true;
                }

                return this.gameOver;
            }
        }
    },


    initialize: function () {
        this.engine = new Engine();
        this.on('change:fen', this._testFen);
        this._testFen(this, this.fen);
        this.once('change:start', this.startGame);
    },

    // ------------------------
    // Turn timing
    // ------------------------
    startGame: function () {
        this.startTurn(this, this.turn);
        this.on('change:turn', this.startTurn);
    },
    startTurn: function (model, turn) {
        this._now = Date.now();

        // Cancel previous turn
        if (this._countdownId) {
            raf.cancel(this._countdownId);
        }

        this._countdownId = raf(this.continueTurn.bind(this, model, turn));
    },
    continueTurn: function (model, turn) {
        var now = Date.now();
        var elapsed = now - this._now;
        this._now = now;
        var key = turn === 'black' ? 'blackTime' : 'whiteTime';
        this[key] = Math.max(0, this[key] - elapsed);
        this._countdownId = raf(this.continueTurn.bind(this, model, turn));
    },

    // ------------------------
    // Engine proxy methods
    // ------------------------
    // ------------------------
    // Getters
    // ------------------------
    getSquare: function (square) {
        return this._proxy('get', square);
    },
    getSquareColor: function (square) {
        return this._proxy('square_color', square);
    },
    addPgnHeader: function () {
        return this._proxy.apply(this, ['header'].concat(slice.call(arguments)));
    },
    // ------------------------
    // Setters
    // ------------------------
    load: function (fen, options) {
        return this._proxyAndUpdate('load', fen, options);
    },
    loadPgn: function (pgn, newlineChar, options) {
        return this._proxyAndUpdate('load_pgn', pgn, newlineChar ? {newline_char: newlineChar} : {}, options);
    },
    move: function (move, options) {
        if (this.canRedo) {
            this.future = [];
        }
        return this._proxyAndUpdate('move', move, options);
    },
    put: function (piece, square, options) {
        return this._proxyAndUpdate('put', piece, square, options);
    },
    remove: function (square, options) {
        return this._proxyAndUpdate('remove', square, options);
    },
    reset: function (options) {
        return this._proxyAndUpdate('reset', options);
    },
    undo: function (options) {
        var move;
        if (options && options.silent) {
            move = this._proxy('undo');
        } else {
            move = this._proxyAndUpdate('undo', options);
        }
        if (move) {
            this.future = this.future.concat(move);
        }
        return move;
    },
    redo: function (options) {
        var move = this.future[this.future.length - 1];
        if (move) {
            if (options && options.silent) {
                this._proxy('move', move);
            } else {
                this._proxyAndUpdate('move', move, options);
            }
            this.future = this.future.slice(0, this.future.length - 1);
        }
        return move;
    },
    first: function () {
        var move, moves = this.history.length;
        while (moves--) {
            move = this.undo({silent: true});
        }
        this.future = this.history.reverse();
        this.history = [];
        this._updateFenFromEngine({multipleMoves: true});
        return move;
    },
    last: function () {
        var move, moves = this.future.length;
        while (moves--) {
            move = this.redo({silent: true});
        }
        this.history = this.future.reverse();
        this.future = [];
        this._updateFenFromEngine({multipleMoves: true});
        return move;
    },
    random: function (options) {
        var move = this.moves[Math.floor(Math.random() * this.moves.length)];
        if (move) {
            this.move(move, options);
        }
        return move;
    },
    clearEngine: function (options) {
        this._proxyAndUpdate('clear', options);
    },

    // ------------------------
    // This proxies a method and updates our state object with
    // the latest fen
    // ------------------------
    _proxyAndUpdate: function () {
        var response = this._proxy.apply(this, arguments);
        var last = arguments[arguments.length - 1];
        var options = typeof last === 'object' ? last : undefined;
        this._updateFenFromEngine(options);
        return response;
    },
    _proxy: function () {
        var method = arguments[0];
        var next = slice.call(arguments, 1);
        return this.engine[method].apply(this.engine, next);
    },

    // ------------------------
    // Private methods
    // ------------------------
    _updateFenFromEngine: function (options) {
        options || (options = {});
        options.fromEngine = true;
        this.set('fen', this.engine.fen(), options);
    },
    _testFen: function (model, fen, options) {
        var validity = this.engine.validate_fen(fen);
        if (validity.valid) {
            if (!options || !options.fromEngine) {
                // Loading a fen into the enginge will
                // disrupt the current game, clearing the history
                // and resetting the pgn so we until do this action
                // if the fen change did not come from the engine
                this.engine.load(fen);
            }
            this.errorMessage = '';
            this.valid = true;
        } else {
            this.errorMessage = validity.error;
            this.valid = false;
        }
    }
});
