/**
 * Pure board helpers: presets, neighbours, mine placement, adjacency counts
 * and the iterative flood fill. Cells are addressed by index = y * cols + x.
 */

import { randomInt } from './rng.js';

/**
 * Standard presets keyed by difficulty id.
 * @type {Readonly<Record<string, Readonly<{cols: number, rows: number, mines: number}>>>}
 */
export const DIFFICULTIES = Object.freeze({
  beginner: Object.freeze({ cols: 9, rows: 9, mines: 10 }),
  intermediate: Object.freeze({ cols: 16, rows: 16, mines: 40 }),
  expert: Object.freeze({ cols: 30, rows: 16, mines: 99 }),
});

/**
 * Mutable cell data shared by the board helpers and the game.
 * @typedef {object} Grid
 * @property {number} cols
 * @property {number} rows
 * @property {boolean[]} mines
 * @property {number[]} counts Adjacent mine count per cell.
 * @property {boolean[]} revealed
 * @property {boolean[]} flagged
 */

/**
 * Lists the indices of the up to eight cells touching a cell.
 * @param {number} cols Board width.
 * @param {number} rows Board height.
 * @param {number} index Cell index.
 * @returns {number[]}
 */
export function neighbours(cols, rows, index) {
  const x = index % cols;
  const y = (index - x) / cols;
  const result = [];
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      const nx = x + dx;
      const ny = y + dy;
      const inside = nx >= 0 && nx < cols && ny >= 0 && ny < rows;
      if (inside && (dx !== 0 || dy !== 0)) result.push(ny * cols + nx);
    }
  }
  return result;
}

/**
 * Places mines at random while keeping the first revealed cell safe.
 * The cell and its neighbours stay mine-free; on boards too dense for that
 * only the cell itself is kept safe.
 * @param {number} cols Board width.
 * @param {number} rows Board height.
 * @param {number} mineCount Number of mines to place.
 * @param {number} safeIndex Index of the first revealed cell.
 * @param {() => number} rng Seeded generator.
 * @returns {boolean[]} Mine flag per cell.
 */
export function placeMines(cols, rows, mineCount, safeIndex, rng) {
  const total = cols * rows;
  const excluded = new Set([safeIndex]);
  const around = neighbours(cols, rows, safeIndex);
  if (total - 1 - around.length >= mineCount) around.forEach((i) => excluded.add(i));

  const candidates = [];
  for (let i = 0; i < total; i += 1) {
    if (!excluded.has(i)) candidates.push(i);
  }
  if (candidates.length < mineCount) {
    throw new RangeError(`cannot place ${mineCount} mines on a ${cols}x${rows} board`);
  }

  const mines = new Array(total).fill(false);
  for (let k = 0; k < mineCount; k += 1) {
    const j = k + randomInt(rng, candidates.length - k);
    [candidates[k], candidates[j]] = [candidates[j], candidates[k]];
    mines[candidates[k]] = true;
  }
  return mines;
}

/**
 * Counts the mines touching every cell.
 * @param {number} cols Board width.
 * @param {number} rows Board height.
 * @param {boolean[]} mines Mine flag per cell.
 * @returns {number[]}
 */
export function countAdjacentMines(cols, rows, mines) {
  return mines.map((_, i) => neighbours(cols, rows, i).filter((n) => mines[n]).length);
}

/**
 * Reveals a cell; when it has no adjacent mines, keeps opening the connected
 * zero region and its numbered border. Iterative (explicit stack), so huge
 * boards cannot overflow the call stack. Flagged cells and mines are skipped.
 * @param {Grid} grid Grid to mutate.
 * @param {number} start Index of the cell to open.
 * @returns {number[]} Indices that were newly revealed, in opening order.
 */
export function floodReveal(grid, start) {
  const opened = [];
  const stack = [start];
  while (stack.length > 0) {
    const i = stack.pop();
    if (grid.revealed[i] || grid.flagged[i] || grid.mines[i]) continue;
    grid.revealed[i] = true;
    opened.push(i);
    if (grid.counts[i] !== 0) continue;
    for (const n of neighbours(grid.cols, grid.rows, i)) {
      if (!grid.revealed[n] && !grid.flagged[n]) stack.push(n);
    }
  }
  return opened;
}

/**
 * Parses a hand-drawn layout, one string per row: '*' is a mine, '.' is safe.
 * @param {string[]} lines Rows of equal length.
 * @returns {{cols: number, rows: number, mines: boolean[]}}
 */
export function parseLayout(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new TypeError('layout must be a non-empty array of strings');
  }
  const cols = typeof lines[0] === 'string' ? lines[0].length : 0;
  const mines = [];
  for (const line of lines) {
    if (typeof line !== 'string' || line.length !== cols || cols === 0) {
      throw new TypeError('layout rows must be non-empty strings of equal length');
    }
    for (const ch of line) {
      if (ch !== '*' && ch !== '.') throw new TypeError(`unexpected layout character "${ch}"`);
      mines.push(ch === '*');
    }
  }
  return { cols, rows: lines.length, mines };
}
