import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DIFFICULTIES, neighbours } from '../src/board.js';
import { createGame, reveal } from '../src/game.js';

const SEEDS = 500;

for (const [difficulty, preset] of Object.entries(DIFFICULTIES)) {
  test(`first click is never a mine: ${difficulty}, ${SEEDS} seeds`, () => {
    const total = preset.cols * preset.rows;
    const clicked = new Set();
    for (let seed = 1; seed <= SEEDS; seed += 1) {
      const game = createGame({ difficulty, seed });
      // Step the click through the cells in reading order, one cell per seed. 500 seeds
      // reach every cell of every preset (Expert has 480), so corners and edges are included.
      const index = seed % total;
      const x = index % preset.cols;
      const y = Math.floor(index / preset.cols);
      clicked.add(index);
      const { opened, status } = reveal(game, x, y);

      assert.notEqual(status, 'lost', `seed ${seed} lost on the first click`);
      assert.equal(game.mines[index], false);
      for (const n of neighbours(preset.cols, preset.rows, index)) {
        assert.equal(game.mines[n], false, `seed ${seed}: neighbour ${n} is a mine`);
      }
      assert.equal(game.counts[index], 0);
      assert.ok(opened.length > 1);
      assert.equal(game.mines.filter(Boolean).length, preset.mines);
    }
    assert.equal(clicked.size, total, 'every cell, the four corners included, was a first click');
  });
}

test('first click is safe on a board too dense to clear the neighbours', () => {
  for (let seed = 1; seed <= 50; seed += 1) {
    for (let y = 0; y < 3; y += 1) {
      for (let x = 0; x < 3; x += 1) {
        const game = createGame({ cols: 3, rows: 3, mines: 8, seed });
        assert.equal(reveal(game, x, y).status, 'won');
        assert.equal(game.mines.filter(Boolean).length, 8);
      }
    }
  }
});

test('mines are not placed before the first reveal', () => {
  const game = createGame({ difficulty: 'expert', seed: 3 });
  assert.equal(game.minesPlaced, false);
  assert.equal(game.mines.some(Boolean), false);
  assert.equal(game.status, 'ready');
});

test('the same seed gives the same board, different seeds differ', () => {
  const layoutFor = (seed) => {
    const game = createGame({ difficulty: 'intermediate', seed });
    reveal(game, 5, 5);
    return game.mines.map((m) => (m ? '*' : '.')).join('');
  };
  assert.equal(layoutFor(42), layoutFor(42));
  assert.equal(new Set([1, 2, 3, 4, 5].map(layoutFor)).size, 5);
});

test('an injected generator is used for placement', () => {
  const zeros = () => 0;
  const game = createGame({ cols: 5, rows: 1, mines: 2, rng: zeros });
  reveal(game, 0, 0);
  // Cells 0 and 1 are kept safe; a generator that always returns 0 takes the first candidates.
  assert.deepEqual(game.mines, [false, false, true, true, false]);
});

test('invalid configurations are rejected', () => {
  assert.throws(() => createGame({ difficulty: 'nightmare' }), RangeError);
  assert.throws(() => createGame({ difficulty: 'toString' }), RangeError);
  assert.throws(() => createGame({ cols: 3, rows: 3, mines: 9 }), RangeError);
  assert.throws(() => createGame({ cols: 3, rows: 3, mines: 0 }), RangeError);
  assert.throws(() => createGame({ cols: 2.5, rows: 3, mines: 1 }), RangeError);
});
