var raf = require('raf');
var slice = Array.prototype.slice;
var State = require('ampersand-state');
var Engine = require('chess.js').Chess;
var runOnFen = require('./lib/runEngine');

// Used for loading possibly invalid pgns without
// changing the actual state engine
var internalEngine = new Engine();

var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';


module.exports = State.extend({
    props: {
        blackTime: ['number', true, -1],
        whiteTime: ['number', true, -1],
        fen: ['string', true, START_FEN],
        pgn: ['string', true, ''],
        freezeOnFinish: ['boolean', true, false]
    },

    session: {
        future: ['array', true, function () { return []; }],
        history: ['array', true, function () { return []; }],
        _finalPgn: ['string', true, ''],
        valid: 'boolean',
        errorMessage: 'string'
    },

    derived: {
        start: runOnFen(function () { return this.fen === START_FEN; }, 'start'),
        empty: runOnFen(function () { return this.fen === EMPTY_FEN; }, 'empty'),

        // Turn must be before any of the ending state properties because
        // otherwise `winner` will incorrect for a tick while `checkmate` is
        // true but the turn has not yet changed. There is a test for this.
        turn: runOnFen(function () {
            return this.engine.turn() === 'b' ? 'black' : 'white';
        }, 'turn'),

        checkmate: runOnFen('in_checkmate', 'checkmate'),
        check: runOnFen('in_check', 'check'),
        draw: runOnFen('in_draw', 'draw'),
        stalemate: runOnFen('in_stalemate', 'stalemate'),
        threefoldRepetition: runOnFen('in_threefold_repetition', 'threefoldRepetition'),
        insufficientMaterial: runOnFen('insufficient_material', 'insufficientMaterial'),
        ascii: runOnFen('ascii', null),
        moves: runOnFen('moves', null),

        // Some "internal" derived properties
        _engineOver: runOnFen('game_over', '_engineOver'),
        _engineHistory: {
            deps: ['fen', 'pgn', 'history'],
            fn: function () {
                this.history = this.engine.history();
                return this.history;
            }
        },

        pgnArray: {
            deps: ['canUndo', 'canRedo', 'history', '_finalPgn'],
            fn: function () {
                var pgn = this._finalPgn.split(/\s?\d+\.\s/).slice(1);

                if (this.canUndo || this.canRedo) {
                    var current = this.history.length;
                    var count = 0;
                    pgn = pgn.map(function (move, index) {
                        var plys = move.split(' '), result = {};

                        result.move = index + 1;
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
                return '';
            }
        },
        gameOver: {
            deps: ['_engineOver', 'lostOnTime'],
            fn: function () {
                return this._engineOver || this.lostOnTime;
            }
        },
        _finished: {
            deps: ['gameOver'],
            fn: function () {
                // Once a game is over it is always "finished"
                if (typeof this._cache._finished !== 'undefined' && this._cache._finished) {
                    return true;
                }

                return this.gameOver;
            }
        },
        lostOnTime: {
            deps: ['blackTime', 'whiteTime'],
            fn: function () {
                return this.whiteTime === 0 || this.blackTime === 0;
            }
        },
        endResult: {
            deps: ['gameOver', 'lostOnTime', 'draw', 'stalemate', 'threefoldRepetition', 'insufficientMaterial'],
            fn: function () {
                var result = '';
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
        }
    },


    initialize: function (attrs) {
        this.engine = new Engine();

        if (attrs && attrs.fen && attrs.pgn) {
            throw new Error('You cannot set both `fen` and `pgn` during initialization.');
        }

        this.setInitialValues(this);

        this.on('change:fen', this._testFen);
        this.on('change:pgn', this._testPgn);
        this.once('change:start', this._startGame);
        this.once('change:_finished', this._cancelTurn);
    },
    setInitialValues: function (attrs) {
        if (attrs.pgn) {
            this._testPgn(this, attrs.pgn);
        }
        else {
            this._testFen(this, attrs.fen || this.fen);
        }
    },


    // ------------------------
    // Turn timing
    // ------------------------
    _startGame: function () {
        this._startTurn(this, this.turn);
        this.on('change:turn', this._startTurn);
    },
    _startTurn: function (model, turn) {
        this._now = Date.now();
        this._cancelTurn();
        this._countdownId = raf(this._continueTurn.bind(this, model, turn));
    },
    _continueTurn: function (model, turn) {
        var now = Date.now();
        var elapsed = now - this._now;
        this._now = now;
        var key = turn === 'black' ? 'blackTime' : 'whiteTime';

        if (this[key] === -1 || this[key] === 0) {
            return this._cancelTurn();
        }

        this[key] = Math.max(0, this[key] - elapsed);
        this._countdownId = raf(this._continueTurn.bind(this, model, turn));
    },
    _cancelTurn: function () {
        this._countdownId && raf.cancel(this._countdownId);
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
        var result = this._proxyAndUpdate('move', move, options);
        if (result) {
            this.trigger('change:move', this, result, options);
        }
        return result || null;
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
            this.future = this.future.concat(move.san);
        }
        return move || null;
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
        return move || null;
    },
    first: function () {
        var move, moves = this.history.length;
        while (moves--) {
            move = this.undo({silent: true});
        }
        this.future = this.history.reverse();
        this.history = [];
        this._updateAllFromEngine({multipleMoves: true});
        return move || null;
    },
    last: function () {
        var move, moves = this.future.length;
        while (moves--) {
            move = this.redo({silent: true});
        }
        this.history = this.future.reverse();
        this.future = [];
        this._updateAllFromEngine({multipleMoves: true});
        return move || null;
    },
    random: function (options) {
        var move = this.moves[Math.floor(Math.random() * this.moves.length)];
        if (move) {
            move = this.move(move, options);
        }
        return move || null;
    },
    clearEngine: function (options) {
        return this._proxyAndUpdate('clear', options);
    },


    // ------------------------
    // This proxies a method and updates our state object with
    // the latest fen
    // ------------------------
    _proxyAndUpdate: function () {
        var response = this._proxy.apply(this, arguments);
        var last = arguments[arguments.length - 1];
        var options = typeof last === 'object' ? last : undefined;
        this._updateAllFromEngine(options);
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
    _updateFromEngine: function (key, options) {
        options || (options = {});
        options.fromEngine = true;
        this.set(key, this.engine[key](), options);
    },
    _updateAllFromEngine: function (options) {
        options || (options = {});
        // This prevents syncing from pgn <--> fen
        // since we are setting both
        options.preventSync = true;
        this._updateFromEngine('fen', options);
        this._updateFromEngine('pgn', options);
    },
    _testFen: function (model, fen, options) {
        var fromEngine = options && options.fromEngine;
        var preventSync = options && options.preventSync;
        var validity = fromEngine ? {valid: true} : internalEngine.validate_fen(fen);

        if (validity.valid) {
            if (!fromEngine) {
                // Loading a fen into the enginge will
                // disrupt the current game, clearing the history
                // and resetting the pgn so we until do this action
                // if the fen change did not come from the engine
                this.engine.load(fen);
            }
            if (!preventSync) {
                this._updateFromEngine('pgn', options);
            }
            this.errorMessage = '';
            this.valid = true;
        } else {
            this.errorMessage = validity.error;
            this.valid = false;
        }
    },
    _diffPgn: function (pgn) {
        var current = this.previous('pgn');

        // If there is no current pgn or the new one
        // doesnt start with the old one
        if (!current || pgn.indexOf(current) !== 0) {
            return null;
        }

        var moves = pgn.replace(current, '').replace(/\d\.\s/g, '').trim();
        return moves.length && moves.length > 0 ? moves.split(' ') : null;
    },
    _getFurthestPgn: function (pgn) {
        var finalPgn = this._finalPgn;
        var previous = this.previous('pgn');
        var valid = pgn && previous && pgn !== previous;

        // The new pgn is a substring of the previous
        if (valid && previous.indexOf(pgn) === 0) {
            if (!finalPgn) {
                return previous;
            }
            else {
                if (finalPgn.indexOf(pgn) === 0) {
                    return finalPgn;
                } else {
                    return pgn;
                }
            }
        } else {
            return pgn;
        }
    },
    _testPgn: function (model, pgn, options) {
        var fromEngine = options && options.fromEngine;
        var preventSync = options && options.preventSync;
        var valid = fromEngine ? true : internalEngine.load_pgn(pgn);
        var nextMoves;

        if (valid || pgn === '') {
            this._finalPgn = this._getFurthestPgn(pgn);
            if (!fromEngine) {
                nextMoves = this._diffPgn(pgn);
                if (nextMoves) {
                    for (var i = 0, m = nextMoves.length; i < m; i++) {
                        this.move(nextMoves[i], options);
                    }
                }
                else {
                    // Loading a pgn into the enginge will
                    // disrupt the current game, clearing the history
                    // and resetting the pgn so we until do this action
                    // if the fen change did not come from the engine
                    this.engine.load_pgn(pgn);
                }
            }
            if (!preventSync) {
                this._updateFromEngine('fen', options);
            }
            this.errorMessage = '';
            this.valid = true;
        } else {
            this.errorMessage = 'Invalid pgn';
            this.valid = false;
        }
    }
});
