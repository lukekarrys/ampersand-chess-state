/* global console */

var Chess = require('../ampersand-chess-state');
var chess = new Chess();
var log = function (prefix, model, value) { console.log(prefix, JSON.stringify(value)); };

chess.on('change:fen', log.bind(null, 'FEN'));
chess.on('change:pgn', log.bind(null, 'PGN'));
chess.on('change:move', log.bind(null, 'MOVE'));

// Use the move method
chess.move('e4');
// FEN "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1"
// PGN "1. e4"
// MOVE {"color":"w","from":"e2","to":"e4","flags":"b","piece":"p","san":"e4"}

chess.move('e5');
// FEN "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2"
// PGN "1. e4 e5"
// MOVE {"color":"b","from":"e7","to":"e5","flags":"b","piece":"p","san":"e5"}

// Or append to the pgn property
chess.pgn += ' 2. f4';
// FEN "rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR b KQkq f3 0 2"
// MOVE {"color":"w","from":"f2","to":"f4","flags":"b","piece":"p","san":"f4"}
// PGN "1. e4 e5 2. f4"
