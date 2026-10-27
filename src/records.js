/**
 * Best times per difficulty, as plain data. Persistence is the UI's job
 * (through storage.js); these helpers only validate and update the values.
 */

import { DIFFICULTIES } from './board.js';

/** @typedef {Record<string, number>} BestTimes Difficulty id -> best time in ms. */

/**
 * Keeps only known difficulties with positive finite times, so stored data
 * that is corrupt or from an older version cannot break the game.
 * @param {unknown} value Parsed stored value of any shape.
 * @returns {BestTimes}
 */
export function sanitizeBestTimes(value) {
  const best = {};
  if (value === null || typeof value !== 'object') return best;
  for (const key of Object.keys(DIFFICULTIES)) {
    const ms = Object.hasOwn(value, key) ? value[key] : undefined;
    if (typeof ms === 'number' && Number.isFinite(ms) && ms > 0) best[key] = ms;
  }
  return best;
}

/**
 * Records a winning time and reports whether it beat the previous best.
 * Times are kept as whole milliseconds, rounded down like the time shown
 * after a win, so the stored record and the win message always agree.
 * Custom boards are never ranked.
 * @param {BestTimes} best Current best times (not mutated).
 * @param {string} difficulty Difficulty id of the won game.
 * @param {number} ms Winning time in milliseconds (may be fractional).
 * @returns {{best: BestTimes, isNewBest: boolean}}
 */
export function recordBestTime(best, difficulty, ms) {
  const time = Math.floor(ms);
  const ranked = Object.hasOwn(DIFFICULTIES, difficulty) && Number.isFinite(time) && time > 0;
  const previous = Object.hasOwn(best, difficulty) ? best[difficulty] : undefined;
  if (!ranked || (previous !== undefined && previous <= time)) return { best, isNewBest: false };
  return { best: { ...best, [difficulty]: time }, isNewBest: true };
}
