/**
 * Deterministic mid-game board for the README screenshot (?demo).
 */

import { neighbours } from './board.js';
import { createGame, reveal, toggleFlag, update } from './game.js';

const DEMO_SEED = 63;
const DEMO_REVEALS = [
  [7, 8],
  [13, 2],
];
const DEMO_FLAGS = 9;
const DEMO_ELAPSED_MS = 94_000;

/**
 * Builds an intermediate board in mid-play: two opened areas, a few correct
 * flags on mines that touch the opened cells, and a running clock.
 * @returns {import('./game.js').Game}
 */
export function createDemoGame() {
  const game = createGame({ difficulty: 'intermediate', seed: DEMO_SEED });
  for (const [x, y] of DEMO_REVEALS) reveal(game, x, y);
  for (const index of pickBorderMines(game, DEMO_FLAGS)) {
    toggleFlag(game, index % game.cols, Math.floor(index / game.cols));
  }
  update(game, DEMO_ELAPSED_MS);
  return game;
}

/**
 * Picks up to `count` mines touching revealed cells, spread evenly in reading order.
 * @param {import('./game.js').Game} game
 * @param {number} count
 * @returns {number[]}
 */
function pickBorderMines(game, count) {
  const border = game.mines
    .map((isMine, i) => (isMine && touchesRevealed(game, i) ? i : -1))
    .filter((i) => i >= 0);
  const step = Math.max(1, Math.floor(border.length / count));
  return border.filter((_, k) => k % step === 0).slice(0, count);
}

/** @param {import('./game.js').Game} game @param {number} index @returns {boolean} */
function touchesRevealed(game, index) {
  return neighbours(game.cols, game.rows, index).some((n) => game.revealed[n]);
}
