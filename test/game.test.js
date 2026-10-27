import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  activate,
  chord,
  createGame,
  getState,
  reveal,
  toggleFlag,
  update,
} from '../src/game.js';

// 3x3 with one mine in the top-left corner; the centre shows 1.
const CORNER = ['*..', '...', '...'];

/** Kind of the cell at (x, y) in a fresh snapshot. */
function kindAt(game, x, y) {
  return getState(game).cells[y * game.cols + x].kind;
}

test('flags: toggling updates the flag count and mines left', () => {
  const game = createGame({ difficulty: 'beginner', seed: 1 });
  assert.equal(toggleFlag(game, 0, 0), true);
  assert.equal(toggleFlag(game, 1, 0), true);
  assert.equal(getState(game).flagCount, 2);
  assert.equal(getState(game).minesLeft, 8);
  assert.equal(game.status, 'ready', 'flagging does not start the game');
  assert.equal(toggleFlag(game, 0, 0), true);
  assert.equal(getState(game).flagCount, 1);
  assert.equal(kindAt(game, 1, 0), 'flag');
  assert.equal(kindAt(game, 0, 0), 'hidden');
});

test('flags: revealed cells cannot be flagged, flagged cells cannot be revealed', () => {
  const game = createGame({ layout: CORNER });
  toggleFlag(game, 2, 2);
  assert.deepEqual(reveal(game, 2, 2).opened, []);
  assert.equal(game.status, 'ready');
  reveal(game, 1, 1);
  assert.equal(toggleFlag(game, 1, 1), false);
  assert.equal(getState(game).flagCount, 1);
});

test('flags: mines left can go below zero when over-flagging', () => {
  const game = createGame({ layout: CORNER });
  toggleFlag(game, 0, 0);
  toggleFlag(game, 2, 2);
  assert.equal(getState(game).minesLeft, -1);
});

test('chord reveals the other neighbours once flags match the number', () => {
  const game = createGame({ layout: CORNER });
  assert.deepEqual(reveal(game, 1, 1).opened, [4]);
  toggleFlag(game, 0, 0);
  const { opened, status } = chord(game, 1, 1);
  assert.equal(opened.length, 7);
  assert.equal(status, 'won');
});

test('chord does nothing without enough flags, on hidden cells or on zeros', () => {
  // (3,3) is boxed in by mines, so no flood fill can finish this board.
  const game = createGame({ layout: ['*...', '....', '..**', '..*.'] });
  reveal(game, 1, 1);
  assert.deepEqual(chord(game, 1, 1).opened, [], 'no flags yet');
  assert.deepEqual(chord(game, 3, 3).opened, [], 'hidden cell');
  reveal(game, 3, 0);
  const before = game.revealedCount;
  assert.deepEqual(chord(game, 3, 0).opened, [], 'zero cell');
  assert.equal(game.revealedCount, before);
  assert.equal(game.status, 'playing');
});

test('chord with a wrong flag hits the mine and loses', () => {
  const game = createGame({ layout: CORNER });
  reveal(game, 1, 1);
  toggleFlag(game, 2, 2);
  assert.equal(chord(game, 1, 1).status, 'lost');
  assert.equal(kindAt(game, 0, 0), 'exploded');
  assert.equal(kindAt(game, 2, 2), 'wrong-flag');
});

test('activate reveals hidden cells and chords revealed ones', () => {
  const game = createGame({ layout: CORNER });
  activate(game, 1, 1);
  assert.equal(kindAt(game, 1, 1), 'open');
  toggleFlag(game, 0, 0);
  assert.equal(activate(game, 1, 1).status, 'won');
});

test('win: only after every safe cell is open; then all mines get flagged', () => {
  const game = createGame({ layout: ['*.*.'] });
  assert.equal(reveal(game, 1, 0).status, 'playing');
  assert.equal(reveal(game, 3, 0).status, 'won');
  const state = getState(game);
  assert.equal(state.minesLeft, 0);
  assert.deepEqual(state.cells.map((c) => c.kind), ['flag', 'open', 'flag', 'open']);
  assert.deepEqual(state.cells.map((c) => c.count), [0, 2, 0, 1]);
});

test('win: a single reveal that opens the whole board wins at once', () => {
  const game = createGame({ layout: CORNER });
  const { opened, status } = reveal(game, 2, 2);
  assert.equal(opened.length, 8);
  assert.equal(status, 'won');
});

test('loss: all mines are shown, the hit mine explodes, wrong flags are marked', () => {
  const game = createGame({ layout: ['*..*', '....', '....', '*...'] });
  reveal(game, 1, 1);
  toggleFlag(game, 3, 0);
  toggleFlag(game, 2, 2);
  assert.equal(getState(game).cells.some((c) => c.kind === 'mine'), false, 'mines hidden while playing');
  assert.equal(reveal(game, 0, 3).status, 'lost');
  assert.equal(kindAt(game, 0, 3), 'exploded');
  assert.equal(kindAt(game, 0, 0), 'mine');
  assert.equal(kindAt(game, 3, 0), 'flag');
  assert.equal(kindAt(game, 2, 2), 'wrong-flag');
  assert.equal(kindAt(game, 1, 1), 'open');
  assert.equal(kindAt(game, 3, 3), 'hidden');
});

test('no moves are accepted once the game is over', () => {
  const lost = createGame({ layout: CORNER });
  reveal(lost, 0, 0);
  assert.equal(lost.status, 'lost');
  assert.deepEqual(reveal(lost, 2, 2).opened, []);
  assert.equal(toggleFlag(lost, 2, 2), false);

  const won = createGame({ layout: CORNER });
  reveal(won, 2, 2);
  assert.equal(toggleFlag(won, 0, 0), false);
  assert.equal(chord(won, 1, 1).status, 'won');
});

test('timer runs only while playing and ignores bad deltas', () => {
  const game = createGame({ layout: ['*.*.'] });
  assert.equal(update(game, 500), 0, 'clock waits for the first reveal');
  reveal(game, 1, 0);
  update(game, 1200);
  update(game, -50);
  update(game, Number.NaN);
  assert.equal(getState(game).elapsedMs, 1200);
  reveal(game, 3, 0);
  assert.equal(update(game, 1000), 1200, 'clock stops on win');
});

test('getState exposes size, status and counts only for open cells', () => {
  const game = createGame({ layout: CORNER });
  reveal(game, 1, 1);
  const state = getState(game);
  assert.equal(state.cols, 3);
  assert.equal(state.rows, 3);
  assert.equal(state.mineCount, 1);
  assert.equal(state.difficulty, 'custom');
  assert.equal(state.status, 'playing');
  assert.deepEqual(state.cells[4], { x: 1, y: 1, kind: 'open', count: 1 });
  assert.deepEqual(state.cells[1], { x: 1, y: 0, kind: 'hidden', count: 0 });
});

test('moves outside the board are ignored', () => {
  const game = createGame({ layout: CORNER });
  assert.deepEqual(reveal(game, -1, 0).opened, []);
  assert.deepEqual(reveal(game, 3, 0).opened, []);
  assert.deepEqual(chord(game, 0, 9).opened, []);
  assert.equal(toggleFlag(game, 1.5, 0), false);
  assert.equal(game.status, 'ready');
});
