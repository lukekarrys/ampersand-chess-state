var test = require('tape');
var Chess = require('../ampersand-chess');
Function.prototype.bind = require('function-bind');


test('Initialize', function (t) {
    var chess = new Chess({
        fen: '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25'
    });

    t.equal(chess.checkmate, false, 'checkmate');
    t.equal(chess.check, false, 'check');
    t.equal(chess.draw, false, 'draw');

    t.end();
});

test('Move will update', function (t) {
    var chess = new Chess({
        fen: '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25'
    });
    chess.move('Rxe3+');

    t.equal(chess.checkmate, false, 'checkmate');
    t.equal(chess.check, true, 'check');
    t.equal(chess.draw, false, 'draw');

    t.end();
});

test('Events', function (t) {
    var chess = new Chess({
        fen: '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25'
    });

    chess.on('change:check', function (model, check) {
        t.equal(model.check, true);
        t.equal(check, true);
        t.end();
    });

    chess.move('Rxe3+');
});

test('Errors', function (t) {
    var chess = new Chess({
        fen: '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25'
    });

    t.equal(chess.valid, true, 'valid');
    t.equal(chess.errorMessage, '', 'error message');

    chess.fen = 'wooo';

    t.equal(chess.valid, false, 'valid');
    t.equal(chess.errorMessage, 'FEN string must contain six space-delimited fields.', 'error message');

    t.end();
});

test('Default', function (t) {
    var chess = new Chess();

    t.equal(chess.start, true);
    t.end();
});

test('Clear', function (t) {
    var chess = new Chess();

    chess.clearEngine();

    t.equal(chess.empty, true);
    t.end();
});

test('Undo/redo', function (t) {
    var start = '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25';
    var chess = new Chess({
        fen: start
    });

    t.equal(chess.history.length, 0);
    t.equal(chess.canUndo, false);
    t.equal(chess.canRedo, false);

    chess.move('Rxe3+');
    t.equal(chess.history.length, 1);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);

    chess.move('Kd1');
    chess.move('c5');

    t.equal(chess.history.length, 3);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);

    chess.undo();
    t.equal(chess.history.length, 2);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, true);

    chess.undo();
    chess.undo();
    t.equal(chess.history.length, 0);
    t.equal(chess.canUndo, false);
    t.equal(chess.canRedo, true);

    chess.redo();
    t.equal(chess.history.length, 1);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, true);

    chess.redo();
    chess.redo();
    t.equal(chess.history.length, 3);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);

    t.end();
});

test('First/last', function (t) {
    var start = '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25';
    var moves = ['Rxe3+', 'Kd1', 'c5'];
    var reverseMoves = moves.slice(0).reverse();
    var finish;
    var chess = new Chess({
        fen: start
    });

    chess.move(moves[0]);
    chess.move(moves[1]);
    chess.move(moves[2]);
    finish = chess.fen;

    t.equal(chess.history.length, 3);
    t.equal(chess.future.length, 0);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);
    t.equal(moves.join(','), chess.history.join(','));

    chess.first();
    t.equal(chess.fen, start);
    t.equal(chess.history.length, 0);
    t.equal(chess.future.length, 3);
    t.equal(chess.canUndo, false);
    t.equal(chess.canRedo, true);
    t.equal(reverseMoves.join(','), chess.future.join(','));

    chess.last();
    t.equal(chess.history.length, 3);
    t.equal(chess.future.length, 0);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);
    t.equal(moves.join(','), chess.history.join(','));

    t.end();
});

test('Overdo undo/redo', function (t) {
    var start = '2n1r3/p1k2pp1/B1p3b1/P7/5bP1/2N1B3/1P2KP2/2R5 b - - 4 25';
    var moves = ['Rxe3+', 'Kd1', 'c5'];
    var chess = new Chess({
        fen: start
    });

    chess.move(moves[0]);
    chess.move(moves[1]);
    chess.move(moves[2]);

    chess.undo();
    chess.undo();
    chess.undo();
    chess.undo();
    chess.undo();
    chess.undo();

    t.equal(chess.history.length, 0);
    t.equal(chess.future.length, 3);
    t.equal(chess.canUndo, false);
    t.equal(chess.canRedo, true);

    chess.redo();
    chess.redo();
    chess.redo();
    chess.redo();
    chess.redo();
    chess.redo();

    t.equal(chess.history.length, 3);
    t.equal(chess.future.length, 0);
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);

    t.end();
});

test('Repetition', function (t) {
    var chess = new Chess({fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'});
    t.equal(chess.threefoldRepetition, false);

    chess.move('Nf3');
    chess.move('Nf6');
    chess.move('Ng1');
    chess.move('Ng8');
    t.equal(chess.threefoldRepetition, false);
    t.equal(chess.draw, false);

    chess.move('Nf3');
    chess.move('Nf6');
    chess.move('Ng1');
    chess.move('Ng8');
    t.equal(chess.threefoldRepetition, true);
    t.equal(chess.draw, true);

    t.end();
});

test('Repetition', function (t) {
    var chess = new Chess({fen: '4k3/4P3/4K3/8/8/8/8/8 b - - 0 78'});
    t.equal(chess.stalemate, true);
    t.equal(chess.draw, true);

    t.end();
});

test('Checkmate/winner', function (t) {
    var chess = new Chess({fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'});
    t.equal(chess.checkmate, false);
    t.equal(chess.gameOver, false);
    t.equal(chess.winner, void 0);

    chess.move('Qxf7#');
    t.equal(chess.checkmate, true);
    t.equal(chess.gameOver, true);
    t.equal(chess.winner, 'white');

    t.end();
});

test('Moves with history', function (t) {
    var moves = ['h4', 'g5', 'f3', 'Bh6', 'h5', 'd6', 'e3', 'Kf8', 'f4', 'Qd7'];
    var chess = new Chess();

    for (var i = 0; i < moves.length; i++) {
        chess.move(moves[i]);
    }

    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);
    t.equal(chess.history.length, 10);
    t.equal(chess.future.length, 0);

    for (i = 0; i < 4; i++) {
        chess.undo();
    }

    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, true);
    t.equal(chess.history.length, 6);
    t.equal(chess.future.length, 4);

    chess.move('Nh3');
    t.equal(chess.canUndo, true);
    t.equal(chess.canRedo, false);
    t.equal(chess.history.length, 7);
    t.equal(chess.future.length, 0);


    t.end();
});

test('Once a game has been over it is always finished', function (t) {
    var chess = new Chess({
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'
    });

    t.equal(chess.checkmate, false);
    t.equal(chess.finished, false);
    t.equal(chess.gameOver, false);

    chess.move('Qxf7#');
    t.equal(chess.checkmate, true);
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, true);

    chess.undo();
    t.equal(chess.checkmate, false);
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, false);

    chess.redo();
    t.equal(chess.checkmate, true);
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, true);

    chess = new Chess({
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4',
        freezeOnFinish: true
    });

    t.equal(chess.checkmate, false);
    t.equal(chess.finished, false);
    t.equal(chess.gameOver, false);

    chess.move('Qxf7#');
    t.equal(chess.checkmate, true);
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, true);

    chess.undo();
    t.equal(chess.checkmate, true, 'freeze checkmate');
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, true);

    chess.redo();
    t.equal(chess.checkmate, true);
    t.equal(chess.finished, true);
    t.equal(chess.gameOver, true);

    t.end();
});

test('timing', function (t) {
    var startTime = 1000 * 60 * 5;
    var chess = new Chess({
        blackTime: startTime,
        whiteTime: startTime
    });

    chess.on('change:blackTime', function (model, time) {
        if (time < startTime - 500) {
            chess.random();
            chess.off('change:blackTime');
        }
    });

    chess.on('change:whiteTime', function (model, time) {
        if (time < startTime - 500) {
            chess.off('change:whiteTime');
            t.end();
        }
    });

    chess.random();
});

test('pgn', function (t) {
    var chess = new Chess();

    chess.pgn = '1. e4 e5 2. f4 Nc6 3. fxe5 Qh4+ 4. g3 Qxh2 5. Rxh2 Ke7 6. Rxh7 f6 7. Rxh8 a6 8. Rxg8 a5 9. Rxf8 Nd8 10. Rxd8 Kf7 11. Rxc8 Rb8 12. Rxb8 Ke6 13. Rxb7 Ke7 14. Rxc7 g6 15. Rxd7+ Kf8 16. Rf7+ Ke8 17. Rxf6 Kd8 18. Rxg6 Kd7 19. Ra6 Ke7 20. Rxa5 Kd8 21. d4 Kc8 22. e6 Kb8 23. e7 Kb7 24. e8=Q Kc7 25. Ra7+ Kd6 26. Qe5+ Kc6 27. Ra5 Kd7 28. Ra6 Kd8 29. Qe7+ Kc8 30. Ra8#';

    t.equal(chess.valid, true);
    t.equal(chess.history.slice(0, 4).join(' '), 'e4 e5 f4 Nc6');
    t.equal(chess.pgnArray[29].ply1.active, true);

    t.end();
});
