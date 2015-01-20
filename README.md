ampersand-chess-state
-------------------------

[![Build Status](https://travis-ci.org/lukekarrys/ampersand-chess-state.png?branch=master)](https://travis-ci.org/lukekarrys/ampersand-chess-state)
[![NPM](https://nodei.co/npm/ampersand-chess-state.png)](https://nodei.co/npm/ampersand-chess-state/)


## Install
`npm install ampersand-chess-state`


## What?

`ampersand-chess-state` is an [`ampersand-state`](https://npmjs.org/ampersand-state) wrapper around the awesome [`chess.js`](https://npmjs.org/chess.js) library.

The main reason for the wrapper is to allow for listening to changes in properties like `checkmate` or `check` when moving pieces without needing to call the synchronous chess.js methods like `chess.in_checkmate()` or `chess.in_check()`.

This also adds a few other conveniences not found in `chess.js`:

- A `redo/last/first` methods to go along with `undo`
- Optionally keeping time for each side
- Getting the pgn as an array with the active ply flagged
- A helper derived property for getting the reason for an ended game
- The ability to "freeze" certain properties based on their end state when replaying a game


## Example

**Load a starting position and listen for pgn/fen changes and moves**
```js
var Chess = require('../ampersand-chess');
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
```


## API

## `props`

#### `fen` (string)
#### `pgn` (string)

Either of these can be set as strings on the state object, but only one may be set on initialization. If neither is set, it default to normal starting position.

Setting `fen` will wipe out all previous move and pgn history.

Appending a new move to `pgn` will not cause any history to be lost and will instead call `move()` with the newest move. But making a wholesale `pgn` change will reset all history.

#### `blackTime` (number)
#### `whiteTime` (number)

A number in milliseconds to start with for the time for that color. This number will decrease (using requestAnimationFrame) while it is that color's turn.

#### `freezeOnFinish` (boolean, false)

This is a flag that if `true` will cause certain properties to be "frozen" once a game has been finished. This allows for the position to be changed (by `undo/redo` for example) but still have the properties keep the same value that they did at the end of the game. See the freezable tag on the derived property documentation for which ones will be frozen.

You're most likely going to want to set this to `true` for legal games but leave it as the default for things like analysis boards, etc.


## `derived`

#### `future` (array)
#### `history` (array)
#### `canUndo` (boolean)
#### `canRedo` (boolean)
`history` and `future` are arrays containing any previous or future moves relative to the current position when replaying a game which can be done with the `undo`, `redo`, `first`, `last` methods.

`canUndo` and `canRedo` are booleans which trigger based on if the corresponding array has `length > 0`.

#### `valid` (boolean)
#### `errorMessage` (string)
These contain information about whether the position is valid and the possible resulting error message when setting the `fen` or `pgn`. These won't be triggered when using any of the methods such as `move`. Those will instead return `null` if they move was invalid.

#### `start` (boolean, freezable)
Triggers whenever the board is in the starting position.

#### `empty` (boolean, freezable)
Triggers whenever the board is empty. This wouldn't ever get triggered during a legal game.

#### `turn` (string, ["black", "white"], freezable)
Triggers with the color whose turn it is.

#### `checkmate` (boolean, freezable)
#### `check` (boolean, freezable)
#### `draw` (boolean, freezable)
#### `stalemate` (boolean, freezable)
#### `threefoldRepetition` (boolean, freezable)
#### `insufficientMaterial` (boolean, freezable)
#### `lostOnTime` (boolean, freezable)
#### `gameOver` (boolean, freezable)
Each of these trigger when the resulting condition is met in the position.

#### `winner` (string, ["black", "white", ""], freezable)
Returns the winning color based on `checkmate` or if one side `lostOnTime`.

#### `ascii` (string)
An ascii representation of the board. Pop it in `<pre></pre>` and you're halfway to ascii chess.

#### `moves` (array)
An array of valid moves based on the current position.

#### `pgnArray` (array)
An array of each pgn move in the following format. The `active` flag will be updated based on the `history` which can be used to highlight the active ply when replaying a game.

Example:
```
// Black's turn in the second move
[{
    move: 1,
    ply1: {san: 'e4'},
    ply2 {san: 'e5'}
}, {
    move: 2,
    ply1: {san: 'f4', active: true},
    ply2: {san: ''}
}]
```

#### `endResult` (string, freezable)
Triggers when the game is over with one of the following values:

```
Lost on time
Checkmate
Draw - Stalemate
Draw - Threefold Repetition
Draw - Insufficient Material
```


## Methods

All these methods change the position in someway and will trigger changes in `fen` and `pgn`. They take an `options` object as the last parameter which will be passed along when `set` is called on `fen` and/or `pgn`.

#### `load(fen, options)`
#### `loadPgn(pgn, newlineChar, options)`
These methods will load a new `fen` or `pgn`. These exist for convenience when wanting to use the options or newlineChar parameters. Most of the time you'll want to do `chess.fen = newFen` or `chess.pgn = newPgn`.

Also note that loading a new `fen` or `pgn` will result in lost history. You should normally use the `move()` method. In the case of appending a new valid move to `pgn` this will call `move(appendedMove)` under the hood.

#### `move(move, options)`
This method will make the move requested. If the move is invalid it will return `null`.

#### `random(options)`
Make a random but valid move. Returns the move.

#### `put(piece, square, options)`
#### `remove(square, options)`
#### `reset(options)`
#### `clearEngine(options)`
These methods are used mostly in analysis style situations since they allow adding or removing pieces from the board. See the [`chess.js`](https://npmjs.org/chess.js) docs for more info about them.

#### `undo(options)`
#### `redo(options)`
#### `first(options)`
#### `last(options)`
These will change to the previous or next move in the history, or to the first or last move in the history. They will return the move to be played or `null` if no such move exists.


### Tests
Run `npm test` for the command line tests (using phantomjs) or `npm start` to open a browser with the tests.


### LICENSE
MIT