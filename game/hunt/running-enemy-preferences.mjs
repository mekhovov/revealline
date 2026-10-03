import { boundedJSON, exactKeys } from '../data-json.mjs';

export const RUNNING_ENEMY_PREFERENCES_KEY = 'revealline.running-enemies.v1';
const format = 'RunningEnemyPreferencesV1';
const pageObservers = new WeakMap();

export function validateRunningEnemyPreferences(source) {
  const value = boundedJSON(source, { maxBytes: 256, maxNodes: 4, maxDepth: 1 });
  exactKeys(value, ['format', 'enabled'], 'Running enemy preferences');
  if (value.format !== format || typeof value.enabled !== 'boolean')
    throw new TypeError('Unsupported running enemy preferences.');
  return Object.freeze(value);
}

/** Global prospective intent only. Hosts copy it when accepting a new attempt;
 * reading, changing or synchronizing it never modifies an existing run. */
export function createRunningEnemyPreferences({
  getStorage = () => globalThis.localStorage,
  window: target = globalThis.window,
} = {}) {
  let enabled = false,
    durable = true,
    pending = false,
    disposed = false;
  const listeners = new Set();
  const pageKey = target && ['object', 'function'].includes(typeof target) ? target : null;
  const peers = (pageKey && pageObservers.get(pageKey)) ?? new Set();
  if (pageKey) pageObservers.set(pageKey, peers);
  const snapshot = () => Object.freeze({ enabled, durable });
  const read = () => {
    const storage = getStorage();
    if (!storage) throw new Error('Preference storage unavailable.');
    const raw = storage.getItem(RUNNING_ENEMY_PREFERENCES_KEY);
    return {
      storage,
      raw,
      enabled: raw === null ? false : validateRunningEnemyPreferences(raw).enabled,
    };
  };
  const notify = () => {
    for (const listener of [...listeners]) {
      if (disposed || !listeners.has(listener)) continue;
      try {
        listener(snapshot());
      } catch {
        /* A settings view cannot change the accepted attempt or revoke intent. */
      }
    }
    return snapshot();
  };
  try {
    enabled = read().enabled;
  } catch {
    durable = false;
  }
  const receivePageChoice = (choice) => {
    if (disposed) return;
    enabled = choice.enabled;
    durable = choice.durable;
    pending = !durable;
    notify();
  };
  peers.add(receivePageChoice);
  const refresh = (event) => {
    if (disposed || pending) return;
    if (event.type === 'pageshow' && event.persisted !== true) return;
    if (
      event.type === 'storage' &&
      event.key !== null &&
      event.key !== RUNNING_ENEMY_PREFERENCES_KEY
    )
      return;
    try {
      const current = read();
      if (
        event.type === 'storage' &&
        (event.storageArea !== current.storage ||
          (event.key === null ? current.raw !== null : event.newValue !== current.raw))
      )
        return;
      enabled = current.enabled;
      durable = true;
    } catch {
      durable = false;
    }
    notify();
  };
  const save = () => {
    if (disposed) return snapshot();
    try {
      const { storage } = read(); // Preserve unsupported or damaged stored records.
      const raw = JSON.stringify({ format, enabled });
      storage.setItem(RUNNING_ENEMY_PREFERENCES_KEY, raw);
      if (storage.getItem(RUNNING_ENEMY_PREFERENCES_KEY) !== raw)
        throw new Error('Preference readback failed.');
      pending = false;
      durable = true;
    } catch {
      durable = false;
    }
    const choice = notify();
    for (const receive of [...peers]) if (receive !== receivePageChoice) receive(choice);
    return choice;
  };
  target?.addEventListener?.('storage', refresh);
  target?.addEventListener?.('pageshow', refresh);
  return Object.freeze({
    snapshot,
    set(value) {
      if (disposed) return snapshot();
      if (typeof value !== 'boolean')
        throw new TypeError('Choose whether running enemies are enabled.');
      enabled = value;
      pending = true;
      return save();
    },
    retry() {
      if (pending) return save();
      refresh({ type: 'pageshow', persisted: true });
      return snapshot();
    },
    subscribe(listener) {
      if (disposed || typeof listener !== 'function')
        throw new TypeError('Active preference listener required.');
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      peers.delete(receivePageChoice);
      if (pageKey && !peers.size) pageObservers.delete(pageKey);
      target?.removeEventListener?.('storage', refresh);
      target?.removeEventListener?.('pageshow', refresh);
    },
  });
}
