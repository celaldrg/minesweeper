import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STRINGS, normalizeLang, otherLang, translate } from '../src/i18n.js';

/** Sorted {placeholder} names used in a string. */
function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
}

test('i18n: English and Turkish have exactly the same keys', () => {
  assert.deepEqual(Object.keys(STRINGS.tr).sort(), Object.keys(STRINGS.en).sort());
});

test('i18n: every string is non-empty and uses the same placeholders in both languages', () => {
  for (const [key, english] of Object.entries(STRINGS.en)) {
    const turkish = STRINGS.tr[key];
    assert.ok(english.trim().length > 0, `en.${key} is empty`);
    assert.ok(turkish.trim().length > 0, `tr.${key} is empty`);
    assert.deepEqual(placeholders(turkish), placeholders(english), `placeholders differ for ${key}`);
  }
});

test('i18n: translate fills placeholders and falls back sensibly', () => {
  assert.equal(translate('en', 'msgWon', { time: '1:02.3' }), 'Field cleared in 1:02.3!');
  assert.equal(translate('tr', 'msgWon', { time: '1:02.3' }), 'Tarla 1:02.3 içinde temizlendi!');
  assert.equal(translate('tr', 'title'), 'Mayın Tarlası');
  assert.equal(translate('xx', 'title'), 'Minesweeper', 'unknown language uses English');
  assert.equal(translate('en', 'no-such-key'), 'no-such-key');
  assert.equal(translate('en', 'cellNumber'), 'number {n}', 'missing params stay visible');
});

test('i18n: language helpers default to English and toggle between the two', () => {
  assert.equal(normalizeLang('tr'), 'tr');
  assert.equal(normalizeLang('de'), 'en');
  assert.equal(normalizeLang(null), 'en');
  assert.equal(otherLang('en'), 'tr');
  assert.equal(otherLang('tr'), 'en');
});
