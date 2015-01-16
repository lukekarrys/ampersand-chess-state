var State = require('ampersand-state');
var Engine = require('chess.js').Chess;
var slice = Array.prototype.slice;
var emptyArray = function () {
    return [];
};

var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
var EMPTY_FEN = '8/8/8/8/8/8/8/8 w - - 0 1';


module.exports = State.extend({
    props: {
        fen: ['string', true, START_FEN],
        start: 'boolean',
        empty: 'boolean',
        checkmate: 'boolean',
        check: 'boolean',
        draw: 'boolean',
        stalemate: 'boolean',
        threefoldRepetition: 'boolean',
        insufficientMaterial: 'boolean',
        gameOver: 'boolean',
        ascii: 'string',
        pgn: 'string',
        turn: {
            type: 'string',
            values: ['black', 'white']
        },
        moves: ['array', true, emptyArray],
        history: ['array', true, emptyArray],
        future: ['array', true, emptyArray],
        valid: 'boolean',
        errorMessage: 'string'
    },


    derived: {
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
            deps: ['checkmate', 'turn'],
            fn: function () {
                if (this.checkmate) {
                    return this.turn === 'black' ? 'white' : 'black';
                }
            }
        },
        endResult: {
            deps: ['gameOver', 'draw', 'stalemate', 'threefoldRepetition', 'insufficientMaterial'],
            fn: function () {
                var result;
                if (this.gameOver) {
                    if (this.checkmate) {
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


    initialize: function () {
        this.engine = new Engine();
        this.on('change:fen', this._testFen);
        this._testFen(this, this.fen);
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
    random: function () {
        var move = this.moves[Math.floor(Math.random() * this.moves.length)];
        if (move) {
            this.move(move);
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
                this.engine.load(this.fen);
            }
            this._updateStatus(options);
        } else {
            this.errorMessage = validity.error;
            this.valid = false;
        }
    },
    _updateStatus: function () {
        this.valid = true;
        this.errorMessage = '';
        this.start = this.engine.fen() === START_FEN;
        this.empty = this.engine.fen() === EMPTY_FEN;
        this.checkmate = this.engine.in_checkmate();
        this.check = this.engine.in_check();
        this.draw = this.engine.in_draw();
        this.stalemate = this.engine.in_stalemate();
        this.threefoldRepetition = this.engine.in_threefold_repetition();
        this.insufficientMaterial = this.engine.insufficient_material();
        this.gameOver = this.engine.game_over();
        this.ascii = this.engine.ascii();
        this.pgn = this.engine.pgn();
        this.turn = this.engine.turn() === 'b' ? 'black' : 'white';
        this.history = this.engine.history();
        this.moves = this.engine.moves();
    }
});