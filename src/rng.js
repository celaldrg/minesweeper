/**
 * Seeded pseudo-random numbers. All randomness in the game flows through
 * here so that tests and the demo board are fully deterministic.
 */

/**
 * Creates a small, fast seeded generator (mulberry32).
 * @param {number} seed Any number; the same seed always yields the same sequence.
 * @returns {() => number} A function returning floats in [0, 1).
 */
export function createRng(seed) {
  let state = Math.trunc(Number(seed) || 0) >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws an integer in [0, max) from a generator.
 * @param {() => number} rng Generator returning floats in [0, 1).
 * @param {number} max Exclusive upper bound (positive integer).
 * @returns {number}
 */
export function randomInt(rng, max) {
  return Math.floor(rng() * max);
}
