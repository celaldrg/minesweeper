/**
 * Pointer and keyboard input for the minefield. Raw events become four
 * intents: primary (tap, click, Enter/Space), long-press (touch or pen held
 * still), flag (right-click, Ctrl+click, F) and focus moves (arrow keys).
 */

/** How long a touch must be held still to count as a long-press. */
const LONG_PRESS_MS = 400;
const MOVE_TOLERANCE_PX = 10;
const ARROWS = Object.freeze({
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
});

/**
 * @typedef {object} BoardInputHandlers
 * @property {(target: EventTarget | null) => number} indexOf Cell index of an event target, or -1.
 * @property {() => number} focusedIndex Index of the cell holding keyboard focus.
 * @property {(index: number, source: 'pointer' | 'keyboard') => void} onPrimary
 * @property {(index: number) => void} onLongPress
 * @property {(index: number) => void} onFlag
 * @property {(dx: number, dy: number) => void} onMoveFocus
 */

/**
 * Attaches all board listeners (event delegation on the board element).
 * @param {HTMLElement} board
 * @param {BoardInputHandlers} handlers
 */
export function attachBoardInput(board, handlers) {
  /** @type {{id: number, x: number, y: number, timer: ReturnType<typeof setTimeout>} | null} */
  let press = null;
  let suppressClick = false;

  function cancelPress() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  function onPointerDown(event) {
    const index = handlers.indexOf(event.target);
    if (index < 0) return;
    suppressClick = false;
    cancelPress();
    if (event.pointerType === 'mouse') {
      const secondary = event.button === 2 || (event.button === 0 && event.ctrlKey);
      if (secondary) {
        suppressClick = true;
        handlers.onFlag(index);
      }
      return;
    }
    if (!event.isPrimary) return;
    const timer = setTimeout(() => {
      press = null;
      suppressClick = true;
      handlers.onLongPress(index);
    }, LONG_PRESS_MS);
    press = { id: event.pointerId, x: event.clientX, y: event.clientY, timer };
  }

  function onPointerMove(event) {
    if (!press || event.pointerId !== press.id) return;
    if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > MOVE_TOLERANCE_PX) {
      suppressClick = true;
      cancelPress();
    }
  }

  function onPointerEnd(event) {
    if (!press || event.pointerId !== press.id) return;
    if (event.type === 'pointercancel') suppressClick = true;
    cancelPress();
  }

  function onClick(event) {
    const index = handlers.indexOf(event.target);
    if (index < 0) return;
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    handlers.onPrimary(index, event.detail === 0 ? 'keyboard' : 'pointer');
  }

  function onKeyDown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    suppressClick = false;
    const step = ARROWS[event.key];
    if (step) {
      event.preventDefault();
      handlers.onMoveFocus(step[0], step[1]);
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      handlers.onFlag(handlers.focusedIndex());
    }
  }

  board.addEventListener('pointerdown', onPointerDown);
  board.addEventListener('pointermove', onPointerMove);
  board.addEventListener('pointerup', onPointerEnd);
  board.addEventListener('pointercancel', onPointerEnd);
  board.addEventListener('contextmenu', (event) => event.preventDefault());
  board.addEventListener('click', onClick);
  board.addEventListener('keydown', onKeyDown);
}
