/**
 * Pure formatting helpers for the clock and the best-times list.
 */

/**
 * Formats elapsed time as m:ss (whole seconds, rounded down).
 * @param {number} ms Elapsed milliseconds.
 * @returns {string} For example "1:34".
 */
export function formatClock(ms) {
  const seconds = Math.floor(Math.max(0, Number(ms) || 0) / 1000);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * Formats a best time as m:ss.t (tenths, rounded down).
 * @param {number} ms Time in milliseconds.
 * @returns {string} For example "1:34.2".
 */
export function formatBest(ms) {
  const tenths = Math.floor(Math.max(0, Number(ms) || 0) / 100);
  return `${formatClock(tenths * 100)}.${tenths % 10}`;
}
