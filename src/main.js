/**
 * Entry point: owns the app state, connects input to the game rules and
 * re-renders the board and panel after every move.
 */

import { DIFFICULTIES } from './board.js';
import { createBoardView } from './board-view.js';
import { createDemoGame } from './demo.js';
import { formatBest } from './format.js';
import { activate, createGame, getState, toggleFlag, update } from './game.js';
import { normalizeLang, otherLang, translate } from './i18n.js';
import { attachBoardInput } from './input.js';
import { createPanel } from './panel.js';
import { recordBestTime, sanitizeBestTimes } from './records.js';
import { storage } from './storage.js';

const KEYS = Object.freeze({
  lang: 'minesweeper:lang',
  difficulty: 'minesweeper:difficulty',
  best: 'minesweeper:best',
});
const DEFAULT_DIFFICULTY = 'beginner';
const DEMO_DIFFICULTY = 'intermediate';

const app = {
  lang: normalizeLang(storage.get(KEYS.lang, 'en')),
  difficulty: savedDifficulty(),
  /** @type {'reveal' | 'flag'} */
  mode: 'reveal',
  best: sanitizeBestTimes(storage.getJSON(KEYS.best, {})),
  /** @type {import('./game.js').Game | null} */
  game: null,
  isNewBest: false,
  clock: { frame: 0, last: 0 },
};

const t = (key, params) => translate(app.lang, key, params);
const boardElement = document.getElementById('board');
const panel = createPanel(document);
const view = createBoardView({
  board: boardElement,
  card: document.getElementById('board-card'),
  area: document.getElementById('board-area'),
  footer: document.querySelector('.app-footer'),
});

init();

function init() {
  wireControls();
  attachBoardInput(boardElement, {
    indexOf: view.indexOf,
    focusedIndex: view.focusedIndex,
    onPrimary,
    onLongPress,
    onFlag: flagCell,
    onMoveFocus: view.moveFocus,
  });
  if (new URLSearchParams(window.location.search).has('demo')) {
    app.difficulty = DEMO_DIFFICULTY;
    showGame(createDemoGame());
  } else {
    startNewGame();
  }
  applyLanguage();
  window.addEventListener('resize', view.fit);
}

function wireControls() {
  document.getElementById('new-game').addEventListener('click', startNewGame);
  document.getElementById('status').addEventListener('click', startNewGame);
  document.getElementById('lang-toggle').addEventListener('click', () => {
    app.lang = otherLang(app.lang);
    storage.set(KEYS.lang, app.lang);
    applyLanguage();
  });
  document.getElementById('mode-toggle').addEventListener('click', () => {
    app.mode = app.mode === 'reveal' ? 'flag' : 'reveal';
    panel.renderMode(app.mode, t);
    renderStatus(getState(app.game));
  });
  for (const button of document.querySelectorAll('[data-difficulty]')) {
    button.addEventListener('click', () => {
      app.difficulty = button.dataset.difficulty;
      storage.set(KEYS.difficulty, app.difficulty);
      startNewGame();
    });
  }
}

/** @returns {string} The stored difficulty, or the default one. */
function savedDifficulty() {
  const value = storage.get(KEYS.difficulty, DEFAULT_DIFFICULTY);
  return Object.hasOwn(DIFFICULTIES, value) ? value : DEFAULT_DIFFICULTY;
}

/** @returns {number} A fresh 32-bit seed for the next board. */
function freshSeed() {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

function startNewGame() {
  showGame(createGame({ difficulty: app.difficulty, seed: freshSeed() }));
}

/** @param {import('./game.js').Game} game */
function showGame(game) {
  stopClock();
  app.game = game;
  app.isNewBest = false;
  view.build(game.cols, game.rows);
  panel.renderDifficulty(app.difficulty);
  panel.renderBest(app.best, app.difficulty);
  render([]);
}

/** @param {number} index @param {'pointer' | 'keyboard'} source */
function onPrimary(index, source) {
  if (source === 'pointer' && app.mode === 'flag' && !app.game.revealed[index]) flagCell(index);
  else play(index);
}

/** Long-press does the opposite of a tap in the current mode. @param {number} index */
function onLongPress(index) {
  if (app.mode === 'flag') play(index);
  else flagCell(index);
}

/** Reveals a hidden cell or chords a revealed number. @param {number} index */
function play(index) {
  const { x, y } = coordinates(index);
  syncClock();
  const { opened, status } = activate(app.game, x, y);
  if (status === 'won' && opened.length > 0) saveWin();
  if (status === 'playing') startClock();
  else stopClock();
  render(opened);
}

/** @param {number} index */
function flagCell(index) {
  const { x, y } = coordinates(index);
  if (toggleFlag(app.game, x, y)) render([]);
}

/** @param {number} index @returns {{x: number, y: number}} */
function coordinates(index) {
  return { x: index % app.game.cols, y: Math.floor(index / app.game.cols) };
}

function saveWin() {
  const result = recordBestTime(app.best, app.game.difficulty, app.game.elapsedMs);
  app.isNewBest = result.isNewBest;
  if (!result.isNewBest) return;
  app.best = result.best;
  storage.setJSON(KEYS.best, app.best);
  panel.renderBest(app.best, app.difficulty);
}

/** @param {number[]} opened Indices opened by the last move. */
function render(opened) {
  const state = getState(app.game);
  view.render(state, opened, t);
  renderStatus(state);
}

/** @param {ReturnType<typeof getState>} state */
function renderStatus(state) {
  view.setFrameState(state.status, app.mode);
  panel.renderHud(state, t);
  panel.renderMessage(messageFor(state), state.status);
}

/** @param {ReturnType<typeof getState>} state @returns {string} */
function messageFor(state) {
  if (state.status === 'won') {
    const text = t('msgWon', { time: formatBest(state.elapsedMs) });
    return app.isNewBest ? `${text} ${t('msgNewBest')}` : text;
  }
  if (state.status === 'lost') return t('msgLost');
  if (state.status === 'ready') return t('msgReady');
  return app.mode === 'flag' ? t('msgFlagMode') : t('msgPlaying');
}

function applyLanguage() {
  panel.applyText(t, app.lang);
  panel.renderMode(app.mode, t);
  const state = getState(app.game);
  view.relabel(state, t);
  renderStatus(state);
}

/** Adds the time since the last tick, so a move is timed to the moment it happens. */
function syncClock() {
  if (app.clock.frame === 0) return;
  const now = performance.now();
  update(app.game, now - app.clock.last);
  app.clock.last = now;
}

function startClock() {
  if (app.clock.frame !== 0) return;
  app.clock.last = performance.now();
  app.clock.frame = requestAnimationFrame(tick);
}

function tick() {
  syncClock();
  panel.renderClock(app.game.elapsedMs);
  app.clock.frame = requestAnimationFrame(tick);
}

function stopClock() {
  cancelAnimationFrame(app.clock.frame);
  app.clock.frame = 0;
}
