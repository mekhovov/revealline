import { boundedJSON, exactKeys, required } from './data-json.mjs';

export const COMBAT_PREFERENCES_KEY = 'revealline.combat-preferences.v1';
export const COMBAT_PREFERENCES_VERSION = 'CombatPreferencesV1';
export const COMBAT_MODES = Object.freeze(['authored', 'on', 'off']);

export function validateCombatPreferences(source) {
  const value = boundedJSON(source, { maxBytes: 256, maxNodes: 5, maxDepth: 1 });
  exactKeys(value, ['format', 'mode', 'showScrap'], 'Combat preferences');
  required(value.format === COMBAT_PREFERENCES_VERSION, 'Unsupported combat preferences.');
  required(COMBAT_MODES.includes(value.mode), 'Unsupported optional robot choice.');
  required(typeof value.showScrap === 'boolean', 'Scrap visibility must be explicit.');
  return Object.freeze(value);
}

/** Next-attempt intent only. This module never touches a live run, recorder,
 * library or music preference. Scrap is cosmetic and has no gameplay revision. */
export function createCombatPreferences({
  getStorage = () => globalThis.localStorage,
  window: target = globalThis,
} = {}) {
  let mode = 'authored',
    showScrap = true,
    revision = 0,
    gameplayRevision = 0;
  let disposed = false,
    pending = false,
    durable = true,
    error = '';
  const listeners = new Set();
  const record = () => ({ format: COMBAT_PREFERENCES_VERSION, mode, showScrap });
  const snapshot = () =>
    Object.freeze({ mode, showScrap, revision, gameplayRevision, durable, error });
  const active = () => required(!disposed, 'Combat preferences are disposed.');
  const read = () => {
    const storage = getStorage();
    required(storage, 'Combat preference storage is unavailable.');
    const raw = storage.getItem(COMBAT_PREFERENCES_KEY);
    return { storage, raw, value: raw === null ? null : validateCombatPreferences(raw) };
  };
  const fail = (cause) => {
    durable = false;
    error = `Optional robot settings are session-only. Retry saving or export before closing. ${cause.message}`;
  };
  const adopt = (value) => {
    const nextMode = value?.mode ?? 'authored',
      nextScrap = value?.showScrap ?? true;
    if (mode !== nextMode) gameplayRevision++;
    if (mode !== nextMode || showScrap !== nextScrap) revision++;
    mode = nextMode;
    showScrap = nextScrap;
  };
  try {
    const value = read().value;
    mode = value?.mode ?? 'authored';
    showScrap = value?.showScrap ?? true;
  } catch (cause) {
    fail(cause);
  }
  const notify = () => {
    for (const listener of [...listeners]) {
      if (disposed || !listeners.has(listener)) continue;
      try {
        listener(snapshot());
      } catch {
        /* A view cannot discard player intent. */
      }
    }
    return snapshot();
  };
  const save = () => {
    try {
      // Recheck before every write: never erase corrupt/future or foreign data.
      const { storage } = read();
      storage.setItem(COMBAT_PREFERENCES_KEY, JSON.stringify(record()));
      pending = false;
      durable = true;
      error = '';
    } catch (cause) {
      fail(cause);
    }
    return notify();
  };
  const reconcile = (event) => {
    if (disposed || pending) return;
    if (event.type === 'storage' && event.key !== COMBAT_PREFERENCES_KEY) return;
    if (event.type === 'pageshow' && event.persisted !== true) return;
    try {
      const current = read();
      if (
        event.type === 'storage' &&
        (event.storageArea !== current.storage || event.newValue !== current.raw)
      )
        return;
      adopt(current.value);
      durable = true;
      error = '';
    } catch (cause) {
      fail(cause);
    }
    notify();
  };
  target?.addEventListener?.('storage', reconcile);
  target?.addEventListener?.('pageshow', reconcile);
  return Object.freeze({
    snapshot,
    choose(next) {
      active();
      const value = validateCombatPreferences({ ...record(), mode: next });
      adopt(value);
      pending = true;
      return save();
    },
    setScrap(next) {
      active();
      const value = validateCombatPreferences({ ...record(), showScrap: next });
      adopt(value);
      pending = true;
      return save();
    },
    retry() {
      active();
      if (pending) return save();
      reconcile({ type: 'pageshow', persisted: true });
      return snapshot();
    },
    export: () => JSON.stringify(record(), null, 2),
    subscribe(listener) {
      active();
      required(typeof listener === 'function', 'A preference listener is required.');
      listeners.add(listener);
      try {
        listener(snapshot());
      } catch {
        /* Keep the subscription for recovery. */
      }
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      target?.removeEventListener?.('storage', reconcile);
      target?.removeEventListener?.('pageshow', reconcile);
    },
  });
}
