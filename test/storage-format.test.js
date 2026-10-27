import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatBest, formatClock } from '../src/format.js';
import { createStore } from '../src/storage.js';

/** In-memory Storage stand-in. */
function memoryBackend() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

/** Backend that throws like localStorage in a locked-down private window. */
const throwingBackend = {
  getItem() {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('storage: values and JSON round-trip through the backend', () => {
  const backend = memoryBackend();
  const shared = createStore(() => backend);
  assert.equal(shared.get('missing', 'fallback'), 'fallback');
  assert.equal(shared.set('lang', 'tr'), true);
  assert.equal(shared.get('lang', 'en'), 'tr');
  assert.equal(shared.setJSON('best', { beginner: 12_345 }), true);
  assert.deepEqual(shared.getJSON('best', {}), { beginner: 12_345 });
});

test('storage: a throwing or missing backend never crashes', () => {
  for (const getBackend of [() => throwingBackend, () => undefined, () => { throw new Error('denied'); }]) {
    const store = createStore(getBackend);
    assert.equal(store.get('lang', 'en'), 'en');
    assert.equal(store.set('lang', 'tr'), false);
    assert.deepEqual(store.getJSON('best', { ok: true }), { ok: true });
    assert.equal(store.setJSON('best', {}), false);
  }
});

test('storage: corrupt JSON falls back instead of throwing', () => {
  const backend = memoryBackend();
  backend.setItem('best', '{not json');
  assert.deepEqual(createStore(() => backend).getJSON('best', {}), {});
});

test('format: clock shows m:ss, best times add tenths', () => {
  assert.equal(formatClock(0), '0:00');
  assert.equal(formatClock(9_999), '0:09');
  assert.equal(formatClock(94_000), '1:34');
  assert.equal(formatClock(3_600_000), '60:00');
  assert.equal(formatClock(-5), '0:00');
  assert.equal(formatBest(94_270), '1:34.2');
  assert.equal(formatBest(59_999), '0:59.9');
  assert.equal(formatBest(Number.NaN), '0:00.0');
});
