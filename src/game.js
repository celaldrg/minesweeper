/**
 * Game rules on top of the board helpers. A game is a plain mutable object;
 * the functions below change it and getState() returns a render-ready
 * snapshot. No DOM, timers or storage here: the UI feeds time via update().
 */

import {
  DIFFICULTIES,
  countAdjacentMines,
  floodReveal,
  neighbours,
  parseLayout,
  placeMines,
} from './board.js';
import { createRng } from './rng.js';

/** @typedef {'ready' | 'playing' | 'won' | 'lost'} GameStatus */
/** @typedef {'hidden' | 'flag' | 'open' | 'mine' | 'exploded' | 'wrong-flag'} CellKind */

/**
 * @typedef {object} GameOptions
 * @property {string} [difficulty='beginner'] Key of DIFFICULTIES.
 * @property {number} [cols] Custom width (use together with rows and mines).
 * @property {number} [rows] Custom height.
 * @property {number} [mines] Custom mine count.
 * @property {string[]} [layout] Fixed mines ('*' mine, '.' safe); not moved on the first reveal.
 * @property {number} [seed=1] Seed for mine placement; pass a fresh one for each real game.
 * @property {() => number} [rng] Generator to use instead of a seed.
 */

/**
 * @typedef {import('./board.js').Grid & {
 *   difficulty: string, mineCount: number, minesPlaced: boolean,
 *   revealedCount: number, flagCount: number, status: GameStatus,
 *   explodedIndex: number, elapsedMs: number, rng: () => number
 * }} Game
 */

/**
 * @typedef {object} MoveResult
 * @property {number[]} opened Indices revealed by this move.
 * @property {GameStatus} status Status after the move.
 */

/**
 * Creates a new game. Mines are placed on the first reveal unless a layout is given.
 * @param {GameOptions} [options]
 * @returns {Game}
 */
export function createGame(options = {}) {
  const config = resolveConfig(options);
  const total = config.cols * config.rows;
  const mines = config.layout ?? new Array(total).fill(false);
  return {
    difficulty: config.difficulty,
    cols: config.cols,
    rows: config.rows,
    mineCount: config.mines,
    mines,
    counts: countAdjacentMines(config.cols, config.rows, mines),
    minesPlaced: config.layout !== null,
    revealed: new Array(total).fill(false),
    flagged: new Array(total).fill(false),
    revealedCount: 0,
    flagCount: 0,
    status: 'ready',
    explodedIndex: -1,
    elapsedMs: 0,
    rng: options.rng ?? createRng(options.seed ?? 1),
  };
}

/**
 * Reveals a hidden, unflagged cell (flood-filling zero regions).
 * The very first reveal places the mines around it.
 * @param {Game} game
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {MoveResult}
 */
export function reveal(game, x, y) {
  const index = indexAt(game, x, y);
  if (index < 0 || !isActive(game) || game.revealed[index] || game.flagged[index]) {
    return result(game, []);
  }
  if (!game.minesPlaced) armMines(game, index);
  game.status = 'playing';
  if (game.mines[index]) {
    lose(game, index);
    return result(game, []);
  }
  return finishMove(game, floodReveal(game, index));
}

/**
 * Chords a revealed number: when the adjacent flags equal the number, all
 * other hidden neighbours are revealed. A wrong flag makes this lose the game.
 * @param {Game} game
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {MoveResult}
 */
export function chord(game, x, y) {
  const index = indexAt(game, x, y);
  if (index < 0 || game.status !== 'playing' || !game.revealed[index] || game.counts[index] === 0) {
    return result(game, []);
  }
  const around = neighbours(game.cols, game.rows, index);
  const flags = around.filter((n) => game.flagged[n]).length;
  if (flags !== game.counts[index]) return result(game, []);

  const hidden = around.filter((n) => !game.revealed[n] && !game.flagged[n]);
  const mine = hidden.find((n) => game.mines[n]);
  if (mine !== undefined) {
    lose(game, mine);
    return result(game, []);
  }
  return finishMove(game, hidden.flatMap((n) => floodReveal(game, n)));
}

/**
 * Primary action for a tap or Enter: reveals a hidden cell or chords a revealed one.
 * @param {Game} game
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {MoveResult}
 */
export function activate(game, x, y) {
  const index = indexAt(game, x, y);
  if (index >= 0 && game.revealed[index]) return chord(game, x, y);
  return reveal(game, x, y);
}

/**
 * Toggles a flag on a hidden cell while the game is not over.
 * @param {Game} game
 * @param {number} x Column.
 * @param {number} y Row.
 * @returns {boolean} True when the flag changed.
 */
export function toggleFlag(game, x, y) {
  const index = indexAt(game, x, y);
  if (index < 0 || !isActive(game) || game.revealed[index]) return false;
  game.flagged[index] = !game.flagged[index];
  game.flagCount += game.flagged[index] ? 1 : -1;
  return true;
}

/**
 * Advances the clock; time only runs while the status is 'playing'.
 * @param {Game} game
 * @param {number} dtMs Elapsed milliseconds since the last call.
 * @returns {number} Total elapsed milliseconds.
 */
export function update(game, dtMs) {
  if (game.status === 'playing' && Number.isFinite(dtMs) && dtMs > 0) game.elapsedMs += dtMs;
  return game.elapsedMs;
}

/**
 * Builds a render-ready snapshot. Mines stay hidden until the game is lost.
 * @param {Game} game
 * @returns {{difficulty: string, cols: number, rows: number, mineCount: number,
 *   status: GameStatus, elapsedMs: number, flagCount: number, minesLeft: number,
 *   cells: {x: number, y: number, kind: CellKind, count: number}[]}}
 */
export function getState(game) {
  const cells = game.mines.map((_, i) => ({
    x: i % game.cols,
    y: Math.floor(i / game.cols),
    kind: cellKind(game, i),
    count: game.revealed[i] ? game.counts[i] : 0,
  }));
  return {
    difficulty: game.difficulty,
    cols: game.cols,
    rows: game.rows,
    mineCount: game.mineCount,
    status: game.status,
    elapsedMs: game.elapsedMs,
    flagCount: game.flagCount,
    minesLeft: game.mineCount - game.flagCount,
    cells,
  };
}

/**
 * @param {GameOptions} options
 * @returns {{difficulty: string, cols: number, rows: number, mines: number, layout: boolean[] | null}}
 */
function resolveConfig(options) {
  if (options.layout) {
    const parsed = parseLayout(options.layout);
    const mines = parsed.mines.filter(Boolean).length;
    return { difficulty: 'custom', cols: parsed.cols, rows: parsed.rows, mines, layout: parsed.mines };
  }
  if (options.cols !== undefined || options.rows !== undefined || options.mines !== undefined) {
    const { cols, rows, mines } = options;
    const sizeOk = Number.isInteger(cols) && Number.isInteger(rows) && cols >= 1 && rows >= 1;
    if (!sizeOk || !Number.isInteger(mines) || mines < 1 || mines >= cols * rows) {
      throw new RangeError('custom board needs integer cols, rows >= 1 and 1 <= mines < cols * rows');
    }
    return { difficulty: 'custom', cols, rows, mines, layout: null };
  }
  const key = options.difficulty ?? 'beginner';
  if (!Object.hasOwn(DIFFICULTIES, key)) throw new RangeError(`unknown difficulty "${key}"`);
  return { difficulty: key, ...DIFFICULTIES[key], layout: null };
}

/** @param {Game} game @param {number} x @param {number} y @returns {number} index or -1 */
function indexAt(game, x, y) {
  const valid = Number.isInteger(x) && Number.isInteger(y);
  return valid && x >= 0 && x < game.cols && y >= 0 && y < game.rows ? y * game.cols + x : -1;
}

/** @param {Game} game @returns {boolean} */
function isActive(game) {
  return game.status === 'ready' || game.status === 'playing';
}

/** @param {Game} game @param {number} safeIndex */
function armMines(game, safeIndex) {
  game.mines = placeMines(game.cols, game.rows, game.mineCount, safeIndex, game.rng);
  game.counts = countAdjacentMines(game.cols, game.rows, game.mines);
  game.minesPlaced = true;
}

/** @param {Game} game @param {number} index Mine that was hit. */
function lose(game, index) {
  game.status = 'lost';
  game.explodedIndex = index;
}

/** @param {Game} game @param {number[]} opened @returns {MoveResult} */
function finishMove(game, opened) {
  game.revealedCount += opened.length;
  if (game.revealedCount === game.mines.length - game.mineCount) win(game);
  return result(game, opened);
}

/** Marks the game won and flags every mine. @param {Game} game */
function win(game) {
  game.status = 'won';
  game.flagged = game.mines.slice();
  game.flagCount = game.mineCount;
}

/** @param {Game} game @param {number[]} opened @returns {MoveResult} */
function result(game, opened) {
  return { opened, status: game.status };
}

/** @param {Game} game @param {number} i @returns {CellKind} */
function cellKind(game, i) {
  if (game.status === 'lost') {
    if (i === game.explodedIndex) return 'exploded';
    if (game.flagged[i]) return game.mines[i] ? 'flag' : 'wrong-flag';
    if (game.mines[i]) return 'mine';
  }
  if (game.revealed[i]) return 'open';
  return game.flagged[i] ? 'flag' : 'hidden';
}
