/**
 * Everything around the board: translated static text, the HUD (mines
 * left, clock, status button), the message line, the difficulty and mode
 * buttons and the best-times list. Rendering only; main.js owns the state.
 */

import { formatBest, formatClock } from './format.js';
import { otherLang } from './i18n.js';

const STATUS_TEXT = Object.freeze({
  ready: 'statusReady',
  playing: 'statusPlaying',
  won: 'statusWon',
  lost: 'statusLost',
});
const STATUS_ICON = Object.freeze({
  ready: '#i-probe',
  playing: '#i-probe',
  won: '#i-won',
  lost: '#i-lost',
});
const NO_TIME = '—';

/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translator */

/**
 * Looks up the panel elements once and returns render functions for them.
 * @param {Document} doc
 */
export function createPanel(doc) {
  const byId = (id) => doc.getElementById(id);
  const el = {
    minesLeft: byId('mines-left'),
    timer: byId('timer'),
    status: byId('status'),
    statusIcon: byId('status').querySelector('use'),
    message: byId('message'),
    mode: byId('mode-toggle'),
    modeIcon: byId('mode-toggle').querySelector('use'),
    modeText: byId('mode-text'),
    lang: byId('lang-toggle'),
    difficulties: [...doc.querySelectorAll('[data-difficulty]')],
    bestRows: [...doc.querySelectorAll('[data-best]')],
  };
  let clockText = '';

  /**
   * Translates every static string ([data-i18n] text, [data-i18n-label]
   * aria-labels), the document title, <html lang> and the language button.
   * @param {Translator} t
   * @param {'en' | 'tr'} lang
   */
  function applyText(t, lang) {
    doc.documentElement.lang = lang;
    doc.title = t('title');
    for (const node of doc.querySelectorAll('[data-i18n]')) node.textContent = t(node.dataset.i18n);
    for (const node of doc.querySelectorAll('[data-i18n-label]')) {
      node.setAttribute('aria-label', t(node.dataset.i18nLabel));
    }
    el.lang.textContent = otherLang(lang).toUpperCase();
    el.lang.setAttribute('aria-label', t('switchLang'));
    el.lang.title = t('switchLang');
  }

  /**
   * Shows mines left, the clock and the status icon.
   * @param {{status: string, minesLeft: number, elapsedMs: number}} state
   * @param {Translator} t
   */
  function renderHud(state, t) {
    el.minesLeft.textContent = String(state.minesLeft);
    renderClock(state.elapsedMs);
    el.status.dataset.status = state.status;
    el.statusIcon.setAttribute('href', STATUS_ICON[state.status]);
    const label = t('statusLabel', { status: t(STATUS_TEXT[state.status]) });
    el.status.setAttribute('aria-label', label);
    el.status.title = label;
  }

  /**
   * Updates the clock text only when the shown second changes.
   * @param {number} ms
   */
  function renderClock(ms) {
    const text = formatClock(ms);
    if (text === clockText) return;
    clockText = text;
    el.timer.textContent = text;
  }

  /**
   * Sets the live message line (announced politely by screen readers).
   * @param {string} text
   * @param {string} tone Status name used for colouring.
   */
  function renderMessage(text, tone) {
    el.message.dataset.tone = tone;
    if (el.message.textContent !== text) el.message.textContent = text;
  }

  /**
   * Shows the tap mode on its toggle button.
   * @param {'reveal' | 'flag'} mode
   * @param {Translator} t
   */
  function renderMode(mode, t) {
    const flag = mode === 'flag';
    el.mode.setAttribute('aria-pressed', String(flag));
    el.modeIcon.setAttribute('href', flag ? '#i-flag' : '#i-tap');
    el.modeText.textContent = t(flag ? 'modeFlag' : 'modeReveal');
  }

  /**
   * Marks the selected difficulty button.
   * @param {string} current
   */
  function renderDifficulty(current) {
    for (const button of el.difficulties) {
      button.setAttribute('aria-pressed', String(button.dataset.difficulty === current));
    }
  }

  /**
   * Fills the best-times list and highlights the current difficulty.
   * @param {Record<string, number>} best
   * @param {string} current
   */
  function renderBest(best, current) {
    for (const row of el.bestRows) {
      const key = row.dataset.best;
      row.classList.toggle('is-current', key === current);
      row.querySelector('.best-time').textContent = Object.hasOwn(best, key) ? formatBest(best[key]) : NO_TIME;
    }
  }

  return { applyText, renderHud, renderClock, renderMessage, renderMode, renderDifficulty, renderBest };
}
