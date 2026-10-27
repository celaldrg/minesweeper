/**
 * DOM view of the minefield: builds one button per cell, keeps the buttons
 * in sync with game snapshots, sizes cells to the available space and
 * manages the roving keyboard focus. No game rules live here.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';
const GAP_PX = 2;
const MAX_CELL_PX = 44;
const MIN_CELL_FINE_PX = 18;
const MIN_CELL_TOUCH_PX = 30;
const BOTTOM_GAP_PX = 24;
const WIDE_LAYOUT_QUERY = '(min-width: 900px)';
const TOUCH_QUERY = '(pointer: coarse)';
const STAGGER_MS = 6;
const MAX_STAGGER_MS = 240;

const KIND_ICON = Object.freeze({
  flag: 'i-flag',
  mine: 'i-mine',
  exploded: 'i-mine',
  'wrong-flag': 'i-wrong-flag',
});

const KIND_LABEL = Object.freeze({
  hidden: 'cellHidden',
  flag: 'cellFlag',
  mine: 'cellMine',
  exploded: 'cellExploded',
  'wrong-flag': 'cellWrongFlag',
});

/** @typedef {(key: string, params?: Record<string, string | number>) => string} Translator */
/** @typedef {{x: number, y: number, kind: string, count: number}} CellView */

/**
 * Creates an inline SVG that references a symbol of the page's sprite.
 * @param {string} symbolId Id of a <symbol> in index.html.
 * @returns {SVGSVGElement}
 */
function createIcon(symbolId) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#${symbolId}`);
  svg.append(use);
  return svg;
}

/**
 * Wires the board view to its elements.
 * @param {{board: HTMLElement, card: HTMLElement, area: HTMLElement, footer: HTMLElement}} elements
 *   board: the grid; card: its scrollable frame; area: the layout slot; footer: page footer.
 */
export function createBoardView({ board, card, area, footer }) {
  /** @type {HTMLButtonElement[]} */
  let cells = [];
  /** @type {string[]} Last painted "kind:count" per cell, to skip unchanged cells. */
  let painted = [];
  let cols = 0;
  let rows = 0;
  let focusIndex = 0;

  board.addEventListener('focusin', (event) => {
    const index = indexOf(event.target);
    if (index >= 0) setFocus(index, false);
  });

  /**
   * Replaces all cells with a fresh, hidden grid.
   * @param {number} newCols
   * @param {number} newRows
   */
  function build(newCols, newRows) {
    cols = newCols;
    rows = newRows;
    cells = [];
    painted = [];
    const rowElements = [];
    for (let y = 0; y < rows; y += 1) {
      const row = document.createElement('div');
      row.className = 'board-row';
      row.setAttribute('role', 'row');
      for (let x = 0; x < cols; x += 1) row.append(createCell(y * cols + x));
      rowElements.push(row);
    }
    board.style.setProperty('--cols', String(cols));
    board.replaceChildren(...rowElements);
    focusIndex = Math.floor(rows / 2) * cols + Math.floor(cols / 2);
    cells[focusIndex].tabIndex = 0;
    fit();
  }

  /** @param {number} index @returns {HTMLButtonElement} */
  function createCell(index) {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cell';
    cell.tabIndex = -1;
    cell.dataset.index = String(index);
    cell.setAttribute('role', 'gridcell');
    cells.push(cell);
    painted.push('');
    return cell;
  }

  /**
   * Paints the cells that changed since the last render.
   * @param {{cells: CellView[]}} state Snapshot from getState().
   * @param {number[]} opened Indices opened by the last move, in opening order.
   * @param {Translator} t
   */
  function render(state, opened, t) {
    const order = new Map(opened.map((index, k) => [index, k]));
    state.cells.forEach((cell, i) => {
      const key = `${cell.kind}:${cell.count}`;
      if (painted[i] === key) return;
      painted[i] = key;
      paintCell(cells[i], cell, order.get(i));
      labelCell(cells[i], cell, t);
    });
  }

  /**
   * Re-labels every cell, e.g. after a language change.
   * @param {{cells: CellView[]}} state
   * @param {Translator} t
   */
  function relabel(state, t) {
    state.cells.forEach((cell, i) => labelCell(cells[i], cell, t));
  }

  /**
   * Sizes cells to the space available and marks the frame scrollable when
   * the board is wider than the screen (Expert on phones).
   */
  function fit() {
    if (cols === 0) return;
    const frame = getComputedStyle(card);
    const chromeX = sumPx(frame, ['paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth']);
    const chromeY = sumPx(frame, ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth']);
    let size = (area.clientWidth - chromeX - (cols - 1) * GAP_PX) / cols;
    if (window.matchMedia(WIDE_LAYOUT_QUERY).matches) {
      const top = card.getBoundingClientRect().top + window.scrollY;
      const free = window.innerHeight - top - footer.offsetHeight - BOTTOM_GAP_PX - chromeY;
      size = Math.min(size, (free - (rows - 1) * GAP_PX) / rows);
    }
    const min = window.matchMedia(TOUCH_QUERY).matches ? MIN_CELL_TOUCH_PX : MIN_CELL_FINE_PX;
    const cell = Math.max(min, Math.min(MAX_CELL_PX, Math.floor(size)));
    board.style.setProperty('--cell', `${cell}px`);
    card.classList.toggle('is-scrollable', card.scrollWidth > card.clientWidth + 1);
  }

  /**
   * Moves the keyboard focus by a step, staying on the board.
   * @param {number} dx
   * @param {number} dy
   */
  function moveFocus(dx, dy) {
    const x = clamp((focusIndex % cols) + dx, 0, cols - 1);
    const y = clamp(Math.floor(focusIndex / cols) + dy, 0, rows - 1);
    setFocus(y * cols + x, true);
  }

  /** @param {number} index @param {boolean} moveDomFocus */
  function setFocus(index, moveDomFocus) {
    if (index < 0 || index >= cells.length) return;
    cells[focusIndex].tabIndex = -1;
    focusIndex = index;
    cells[index].tabIndex = 0;
    if (moveDomFocus) cells[index].focus();
  }

  /**
   * Finds the cell index for an event target inside the board.
   * @param {EventTarget | null} target
   * @returns {number} Index, or -1 when the target is not a cell.
   */
  function indexOf(target) {
    const cell = target instanceof Element ? target.closest('.cell') : null;
    return cell && board.contains(cell) ? Number(cell.dataset.index) : -1;
  }

  /**
   * Reflects the game status and tap mode on the frame (for styling).
   * @param {string} status
   * @param {string} mode
   */
  function setFrameState(status, mode) {
    card.dataset.status = status;
    card.dataset.mode = mode;
  }

  return {
    build,
    render,
    relabel,
    fit,
    moveFocus,
    indexOf,
    setFrameState,
    focusedIndex: () => focusIndex,
  };
}

/**
 * @param {HTMLButtonElement} element
 * @param {CellView} cell
 * @param {number | undefined} openOrder Position in the last flood fill, for a staggered reveal.
 */
function paintCell(element, cell, openOrder) {
  element.dataset.kind = cell.kind;
  const hasNumber = cell.kind === 'open' && cell.count > 0;
  if (hasNumber) element.dataset.n = String(cell.count);
  else delete element.dataset.n;

  const icon = KIND_ICON[cell.kind];
  if (icon) element.replaceChildren(createIcon(icon));
  else element.textContent = hasNumber ? String(cell.count) : '';

  if (openOrder !== undefined) {
    element.style.setProperty('--delay', `${Math.min(openOrder * STAGGER_MS, MAX_STAGGER_MS)}ms`);
    element.classList.add('is-new');
  }
}

/** @param {HTMLButtonElement} element @param {CellView} cell @param {Translator} t */
function labelCell(element, cell, t) {
  let state;
  if (cell.kind === 'open') state = cell.count > 0 ? t('cellNumber', { n: cell.count }) : t('cellEmpty');
  else state = t(KIND_LABEL[cell.kind]);
  element.setAttribute('aria-label', t('cellLabel', { row: cell.y + 1, col: cell.x + 1, state }));
}

/** @param {CSSStyleDeclaration} style @param {string[]} props @returns {number} */
function sumPx(style, props) {
  return props.reduce((total, prop) => total + (parseFloat(style[prop]) || 0), 0);
}

/** @param {number} value @param {number} min @param {number} max @returns {number} */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
