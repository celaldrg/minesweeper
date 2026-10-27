/**
 * Tiny persistence helper. Every access to the backend is wrapped in
 * try/catch, so private browsing, blocked storage or quota errors only
 * mean "nothing saved" instead of a crash.
 */

/**
 * @typedef {object} Store
 * @property {(key: string, fallback: string | null) => string | null} get
 * @property {(key: string, value: string) => boolean} set
 * @property {(key: string, fallback: unknown) => unknown} getJSON
 * @property {(key: string, value: unknown) => boolean} setJSON
 */

/**
 * Creates a store over a Storage-like backend ({getItem, setItem}).
 * The backend is looked up lazily on every call, never at import time.
 * @param {() => (Pick<Storage, 'getItem' | 'setItem'> | undefined | null)} getBackend
 * @returns {Store}
 */
export function createStore(getBackend) {
  function get(key, fallback) {
    try {
      const value = getBackend()?.getItem(key);
      return typeof value === 'string' ? value : fallback;
    } catch {
      return fallback;
    }
  }

  function set(key, value) {
    try {
      const backend = getBackend();
      if (!backend) return false;
      backend.setItem(key, value);
      return true;
    } catch {
      return false;
    }
  }

  function getJSON(key, fallback) {
    const raw = get(key, null);
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  }

  function setJSON(key, value) {
    return set(key, JSON.stringify(value));
  }

  return { get, set, getJSON, setJSON };
}

/** The browser's localStorage, safely wrapped. */
export const storage = createStore(() => globalThis.localStorage);
