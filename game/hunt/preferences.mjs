import { boundedJSON, exactKeys } from '../data-json.mjs';

export const ENCOUNTER_VARIANTS = Object.freeze([
  'authored',
  'off',
  'patrol',
  'bonus',
  'capture-quota',
  'hunt',
]);
export const ENCOUNTER_VARIANT_KEY = 'revealline.encounter-variant.v1';
export const DESTRUCTION_PREFERENCES_KEY = 'revealline.destruction.v1';

function storedChoice({
  key,
  format,
  defaults,
  valid,
  window: target = globalThis,
  getStorage = () => globalThis.localStorage,
  writable = () => true,
}) {
  let disposed = false,
    pending = false,
    saving = false,
    generation = 0;
  const listeners = new Set();
  const parse = (raw) => {
    if (raw === null) return { ...defaults };
    const value = boundedJSON(raw, { maxBytes: 512, maxNodes: 12, maxDepth: 2 });
    exactKeys(value, ['format', ...Object.keys(defaults)], format);
    if (value.format !== format || !valid(value))
      throw new TypeError('Unsupported preference record.');
    return Object.fromEntries(Object.keys(defaults).map((name) => [name, value[name]]));
  };
  const read = () => {
    const storage = getStorage();
    if (!storage) throw new Error('Preference storage unavailable.');
    const raw = storage.getItem(key);
    return { storage, raw, value: parse(raw) };
  };
  let state = Object.freeze({ ...defaults, durable: true, revision: 0 });
  try {
    state = Object.freeze({ ...state, ...read().value });
  } catch {
    state = Object.freeze({ ...state, durable: false });
  }
  const update = (value) => {
    if (Object.entries(value).every(([name, next]) => state[name] === next)) return false;
    state = Object.freeze({ ...state, ...value, revision: state.revision + 1 });
    return true;
  };
  const notify = () => {
    for (const listener of [...listeners]) {
      if (disposed || !listeners.has(listener)) continue;
      try {
        listener(state);
      } catch {
        /* A view cannot revoke a preference. */
      }
    }
    return state;
  };
  const refresh = (event) => {
    if (disposed || pending) return;
    if (event.type === 'pageshow' && !event.persisted) return;
    if (
      event.type === 'storage' &&
      event.key !== key &&
      !(event.key === null && event.newValue === null)
    )
      return;
    try {
      const current = read();
      if (
        event.type === 'storage' &&
        (event.storageArea !== current.storage || event.newValue !== current.raw)
      )
        return;
      if (update({ ...current.value, durable: true })) notify();
    } catch {
      if (event.type !== 'storage' && update({ durable: false })) notify();
    }
  };
  const save = () => {
    if (disposed || saving) return state;
    saving = true;
    const ticket = generation;
    try {
      if (writable() !== true) throw new Error('Preference is session-only.');
      const current = read(); // Unsupported stored versions are never overwritten.
      if (disposed || ticket !== generation) return state;
      const record = {
        format,
        ...Object.fromEntries(Object.keys(defaults).map((name) => [name, state[name]])),
      };
      const raw = JSON.stringify(record);
      current.storage.setItem(key, raw);
      if (disposed || ticket !== generation) return state;
      if (current.storage.getItem(key) !== raw) throw new Error('Preference readback failed.');
      pending = false;
      update({ durable: true });
    } catch {
      if (!disposed && ticket === generation) update({ durable: false });
    } finally {
      saving = false;
      notify();
    }
    return state;
  };
  target?.addEventListener?.('storage', refresh);
  target?.addEventListener?.('pageshow', refresh);
  return Object.freeze({
    snapshot: () => state,
    set(patch) {
      if (disposed) throw new Error('Preference owner is disposed.');
      exactKeys(patch, Object.keys(defaults), format);
      const next = { ...state, ...patch };
      if (!valid(next)) throw new TypeError('Unsupported preference choice.');
      generation++;
      pending = true;
      update({ ...patch, durable: false });
      return save();
    },
    retry() {
      if (pending) return save();
      refresh({ type: 'pageshow', persisted: true });
      return state;
    },
    subscribe(listener) {
      if (disposed || typeof listener !== 'function')
        throw new TypeError('Active preference listener required.');
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      listeners.clear();
      target?.removeEventListener?.('storage', refresh);
      target?.removeEventListener?.('pageshow', refresh);
    },
  });
}

export const createEncounterVariantPreferences = (options = {}) =>
  storedChoice({
    ...options,
    key: ENCOUNTER_VARIANT_KEY,
    format: 'EncounterVariantPreferencesV1',
    defaults: { variant: 'authored' },
    valid: (value) => ENCOUNTER_VARIANTS.includes(value.variant),
  });
export const createDestructionPreferences = (options = {}) =>
  storedChoice({
    ...options,
    key: DESTRUCTION_PREFERENCES_KEY,
    format: 'DestructionPreferencesV1',
    defaults: { brutal: false, blood: true },
    valid: (value) => typeof value.brutal === 'boolean' && typeof value.blood === 'boolean',
  });
