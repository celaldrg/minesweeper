import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  countAdjacentMines,
  floodReveal,
  neighbours,
  parseLayout,
  placeMines,
} from '../src/board.js';
import { createRng } from '../src/rng.js';
import { createGame, reveal, toggleFlag } from '../src/game.js';

// Hand-made 7x5 board: an L-shaped wall of mines splits it into two regions.
const WALL = [
  '...*...',
  '...*...',
  '...*...',
  '****...',
  '.......',
];

/** Draws revealed cells as 'o', flags as 'F', everything else as '.'. */
function revealedMap(game) {
  const lines = [];
  for (let y = 0; y < game.rows; y += 1) {
    let line = '';
    for (let x = 0; x < game.cols; x += 1) {
      const i = y * game.cols + x;
      line += game.revealed[i] ? 'o' : game.flagged[i] ? 'F' : '.';
    }
    lines.push(line);
  }
  return lines;
}

test('neighbours: corners have 3, edges 5, interior 8, a 1x1 board none', () => {
  assert.deepEqual(neighbours(3, 3, 0).sort((a, b) => a - b), [1, 3, 4]);
  assert.equal(neighbours(3, 3, 1).length, 5);
  assert.deepEqual(neighbours(3, 3, 4).sort((a, b) => a - b), [0, 1, 2, 3, 5, 6, 7, 8]);
  assert.equal(neighbours(5, 4, 19).length, 3);
  assert.deepEqual(neighbours(1, 1, 0), []);
});

test('neighbour counts match a hand-computed map', () => {
  const { cols, rows, mines } = parseLayout(WALL);
  const counts = countAdjacentMines(cols, rows, mines);
  const drawn = [];
  for (let y = 0; y < rows; y += 1) {
    let line = '';
    for (let x = 0; x < cols; x += 1) {
      const i = y * cols + x;
      line += mines[i] ? '*' : String(counts[i]);
    }
    drawn.push(line);
  }
  assert.deepEqual(drawn, [
    '002*200',
    '003*300',
    '235*300',
    '****200',
    '2332100',
  ]);
});

test('flood fill opens exactly the connected zero region plus its numbered border (left)', () => {
  const game = createGame({ layout: WALL });
  const { opened } = reveal(game, 0, 0);
  assert.equal(opened.length, 9);
  assert.deepEqual(revealedMap(game), [
    'ooo....',
    'ooo....',
    'ooo....',
    '.......',
    '.......',
  ]);
  assert.equal(game.status, 'playing');
});

test('flood fill opens exactly the connected zero region plus its numbered border (right)', () => {
  const game = createGame({ layout: WALL });
  const { opened } = reveal(game, 6, 0);
  assert.equal(opened.length, 15);
  assert.deepEqual(revealedMap(game), [
    '....ooo',
    '....ooo',
    '....ooo',
    '....ooo',
    '....ooo',
  ]);
  // (3,4) is a number next to the region's border, but no zero cell touches it.
  assert.equal(game.revealed[4 * 7 + 3], false);
});

test('a numbered cell opens alone and flood fill never enters a flag', () => {
  const single = createGame({ layout: WALL });
  assert.deepEqual(reveal(single, 2, 2).opened, [2 * 7 + 2]);

  const flagged = createGame({ layout: WALL });
  toggleFlag(flagged, 1, 1);
  reveal(flagged, 0, 0);
  assert.deepEqual(revealedMap(flagged), [
    'ooo....',
    'oFo....',
    'oo.....',
    '.......',
    '.......',
  ]);
});

test('flood fill is iterative: a 300x300 board opens without a stack overflow', () => {
  const layout = Array.from({ length: 300 }, (_, y) => (y === 0 ? '*' : '.') + '.'.repeat(299));
  const game = createGame({ layout });
  const { opened, status } = reveal(game, 299, 299);
  assert.equal(opened.length, 300 * 300 - 1);
  assert.equal(status, 'won');
});

test('floodReveal skips cells that are already revealed', () => {
  const { cols, rows, mines } = parseLayout(WALL);
  const grid = {
    cols,
    rows,
    mines,
    counts: countAdjacentMines(cols, rows, mines),
    revealed: new Array(cols * rows).fill(false),
    flagged: new Array(cols * rows).fill(false),
  };
  assert.equal(floodReveal(grid, 0).length, 9);
  assert.deepEqual(floodReveal(grid, 0), []);
});

test('placeMines places the exact count and keeps the safe area clear', () => {
  const mines = placeMines(9, 9, 10, 40, createRng(7));
  assert.equal(mines.filter(Boolean).length, 10);
  for (const i of [40, ...neighbours(9, 9, 40)]) assert.equal(mines[i], false);
});

test('placeMines falls back to keeping only the clicked cell safe on dense boards', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    const mines = placeMines(3, 3, 8, 4, createRng(seed));
    assert.equal(mines[4], false);
    assert.equal(mines.filter(Boolean).length, 8);
  }
  assert.throws(() => placeMines(2, 2, 4, 0, createRng(1)), RangeError);
});

test('parseLayout reads mines and rejects malformed input', () => {
  assert.deepEqual(parseLayout(['*.', '.*']), { cols: 2, rows: 2, mines: [true, false, false, true] });
  assert.throws(() => parseLayout([]), TypeError);
  assert.throws(() => parseLayout(['..', '.']), TypeError);
  assert.throws(() => parseLayout(['.x']), TypeError);
  assert.throws(() => parseLayout(['']), TypeError);
});
