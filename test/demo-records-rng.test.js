import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoGame } from '../src/demo.js';
import { formatBest } from '../src/format.js';
import { getState } from '../src/game.js';
import { recordBestTime, sanitizeBestTimes } from '../src/records.js';
import { createRng, randomInt } from '../src/rng.js';

test('demo: a deterministic intermediate board in mid-play', () => {
  const game = createDemoGame();
  const state = getState(game);
  assert.deepEqual(state, getState(createDemoGame()), 'same board every time');
  assert.equal(state.difficulty, 'intermediate');
  assert.equal(state.status, 'playing');
  assert.ok(state.elapsedMs > 0);

  const safe = game.mines.length - game.mineCount;
  assert.ok(game.revealedCount > safe * 0.3 && game.revealedCount < safe * 0.9);
  assert.ok(state.flagCount >= 5);
  state.cells.forEach((cell, i) => {
    if (cell.kind === 'flag') assert.equal(game.mines[i], true, 'demo flags are correct');
    if (cell.kind === 'open') assert.equal(game.mines[i], false);
  });
});

test('rng: same seed repeats, values stay in [0, 1)', () => {
  const a = createRng(123);
  const b = createRng(123);
  const c = createRng(124);
  const first = Array.from({ length: 1000 }, () => a());
  assert.deepEqual(first, Array.from({ length: 1000 }, () => b()));
  assert.notDeepEqual(first.slice(0, 10), Array.from({ length: 10 }, () => c()));
  assert.ok(first.every((v) => v >= 0 && v < 1));
  const rng = createRng(9);
  for (let k = 0; k < 1000; k += 1) {
    const n = randomInt(rng, 6);
    assert.ok(Number.isInteger(n) && n >= 0 && n < 6);
  }
});

test('records: a faster time becomes the best, a slower one does not', () => {
  const first = recordBestTime({}, 'beginner', 42_000);
  assert.deepEqual(first, { best: { beginner: 42_000 }, isNewBest: true });
  const slower = recordBestTime(first.best, 'beginner', 50_000);
  assert.equal(slower.isNewBest, false);
  assert.equal(slower.best, first.best);
  const faster = recordBestTime(first.best, 'beginner', 30_000);
  assert.deepEqual(faster.best, { beginner: 30_000 });
  assert.deepEqual(first.best, { beginner: 42_000 }, 'input is not mutated');
  const other = recordBestTime(faster.best, 'expert', 300_000);
  assert.deepEqual(other.best, { beginner: 30_000, expert: 300_000 });
});

test('records: times are stored as whole milliseconds, rounded down like the shown time', () => {
  const { best } = recordBestTime({}, 'beginner', 2040.1000000238419);
  assert.deepEqual(best, { beginner: 2040 });
  assert.equal(recordBestTime(best, 'beginner', 2040.9).isNewBest, false, 'the same whole ms is no new best');
  assert.deepEqual(recordBestTime(best, 'beginner', 2039.9).best, { beginner: 2039 });
  // Rounding up would store 2100 and list 0:02.1 while the win message says 0:02.0.
  const shown = formatBest(2099.6);
  assert.equal(formatBest(recordBestTime({}, 'expert', 2099.6).best.expert), shown);
});

test('records: custom boards and invalid times are never ranked', () => {
  assert.equal(recordBestTime({}, 'custom', 1000).isNewBest, false);
  assert.equal(recordBestTime({}, 'beginner', 0).isNewBest, false);
  assert.equal(recordBestTime({}, 'beginner', Number.NaN).isNewBest, false);
});

test('records: stored data is sanitized', () => {
  assert.deepEqual(sanitizeBestTimes(null), {});
  assert.deepEqual(sanitizeBestTimes('oops'), {});
  assert.deepEqual(
    sanitizeBestTimes({ beginner: 1500, intermediate: -3, expert: 'fast', custom: 10, toString: 5 }),
    { beginner: 1500 },
  );
});
