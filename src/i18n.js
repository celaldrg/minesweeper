/**
 * English and Turkish UI strings plus a tiny lookup with {placeholder}
 * substitution. Pure: the UI decides which language is active.
 */

/** @typedef {'en' | 'tr'} Lang */

/** Every UI string, keyed by language. Both tables have the same keys. */
export const STRINGS = Object.freeze({
  en: Object.freeze({
    title: 'Minesweeper',
    newGame: 'New game',
    switchLang: 'TR – switch to Turkish',
    hudLabel: 'Game status',
    mines: 'Mines',
    time: 'Time',
    statusLabel: '{status} – start a new game',
    statusReady: 'Ready',
    statusPlaying: 'Playing',
    statusWon: 'You won',
    statusLost: 'You lost',
    difficulty: 'Difficulty',
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    expert: 'Expert',
    modeReveal: 'Tap: Reveal',
    modeFlag: 'Tap: Flag',
    bestTimes: 'Best times',
    howToPlay: 'How to play',
    help1: 'Click or tap a cell to open it. Numbers count the mines around it.',
    help2: 'Right-click, long-press or switch to Flag mode to mark a mine.',
    help3: 'Press a number whose mines are all flagged to open its neighbours.',
    help4: 'Keyboard: arrows move, Enter or Space opens, F flags.',
    msgReady: 'Pick any cell – the first one is always safe.',
    msgPlaying: 'Long-press or right-click to plant a flag.',
    msgFlagMode: 'Flag mode: taps place flags.',
    msgWon: 'Field cleared in {time}!',
    msgNewBest: 'New best time!',
    msgLost: 'Boom! Start a new game to try again.',
    boardLabel: 'Minefield',
    cellLabel: 'Row {row}, column {col}: {state}',
    cellHidden: 'hidden',
    cellFlag: 'flagged',
    cellEmpty: 'empty',
    cellNumber: 'number {n}',
    cellMine: 'mine',
    cellExploded: 'exploded mine',
    cellWrongFlag: 'wrong flag',
    footerSource: 'Source on GitHub',
  }),
  tr: Object.freeze({
    title: 'Mayın Tarlası',
    newGame: 'Yeni oyun',
    switchLang: 'EN – İngilizceye geç',
    hudLabel: 'Oyun durumu',
    mines: 'Mayın',
    time: 'Süre',
    statusLabel: '{status} – yeni oyun başlat',
    statusReady: 'Hazır',
    statusPlaying: 'Oyunda',
    statusWon: 'Kazandın',
    statusLost: 'Kaybettin',
    difficulty: 'Zorluk',
    beginner: 'Başlangıç',
    intermediate: 'Orta',
    expert: 'Uzman',
    modeReveal: 'Dokunuş: Aç',
    modeFlag: 'Dokunuş: Bayrak',
    bestTimes: 'En iyi süreler',
    howToPlay: 'Nasıl oynanır',
    help1: 'Açmak için bir hücreye tıkla ya da dokun. Sayılar çevredeki mayınları gösterir.',
    help2: 'Mayını işaretlemek için sağ tıkla, basılı tut ya da Bayrak moduna geç.',
    help3: 'Mayınları bayraklanmış bir sayıya basınca komşuları açılır.',
    help4: 'Klavye: oklar gezdirir, Enter ya da Boşluk açar, F bayrak koyar.',
    msgReady: 'Bir hücre seç – ilki her zaman güvenli.',
    msgPlaying: 'Bayrak koymak için basılı tut ya da sağ tıkla.',
    msgFlagMode: 'Bayrak modu: dokunuşlar bayrak koyar.',
    msgWon: 'Tarla {time} içinde temizlendi!',
    msgNewBest: 'Yeni rekor!',
    msgLost: 'Bum! Tekrar denemek için yeni oyun başlat.',
    boardLabel: 'Mayın tarlası',
    cellLabel: 'Satır {row}, sütun {col}: {state}',
    cellHidden: 'kapalı',
    cellFlag: 'bayraklı',
    cellEmpty: 'boş',
    cellNumber: 'sayı {n}',
    cellMine: 'mayın',
    cellExploded: 'patlayan mayın',
    cellWrongFlag: 'yanlış bayrak',
    footerSource: 'GitHub’da kaynak kod',
  }),
});

/**
 * Maps any stored or user value to a supported language (English by default).
 * @param {unknown} value
 * @returns {Lang}
 */
export function normalizeLang(value) {
  return value === 'tr' ? 'tr' : 'en';
}

/**
 * The language the toggle button switches to.
 * @param {Lang} lang Current language.
 * @returns {Lang}
 */
export function otherLang(lang) {
  return normalizeLang(lang) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a string and fills {name} placeholders from params.
 * Falls back to English, then to the key itself.
 * @param {Lang} lang
 * @param {string} key
 * @param {Record<string, string | number>} [params]
 * @returns {string}
 */
export function translate(lang, key, params = {}) {
  const table = STRINGS[normalizeLang(lang)];
  const text = Object.hasOwn(table, key) ? table[key] : (STRINGS.en[key] ?? key);
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : match,
  );
}
