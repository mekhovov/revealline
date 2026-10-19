import { resolveTouchControls } from './touch-controls.mjs';

export const TOUCH_PREFERENCES_KEY = 'revealline.touch.v1';
const fields = ['mode', 'side', 'size', 'opacity'];
const same = (a, b) => fields.every((key) => a[key] === b[key]);
const failure = (error) =>
  error?.name === 'QuotaExceededError'
    ? 'full'
    : error?.name === 'SecurityError'
      ? 'blocked'
      : 'unavailable';

/** Shared presentation preference only. Never writes a campaign/profile or changes rules.
 * Writes remain synchronous. Fresh reads preserve observed unrelated edits; this
 * is verified readback, not an atomic transaction across concurrent browser tabs. */
export function createTouchPreferences({
  storage,
  legacy = null,
  eventTarget = globalThis.window,
  onChange = () => {},
} = {}) {
  const suppliedStorage = storage !== undefined;
  const listeners = new Set();
  let value = resolveTouchControls(legacy),
    disposed = false,
    stored = false,
    explicit = false,
    sessionOnly = false,
    pending = {},
    reason = '',
    revision = 0,
    writing = false;
  const read = () => {
    try {
      const target = suppliedStorage ? storage : globalThis.localStorage;
      if (!target) return { reason: 'unavailable' };
      const raw = target.getItem(TOUCH_PREFERENCES_KEY);
      if (raw === null || raw === undefined) return { target, raw: null, value: null };
      try {
        if (typeof raw !== 'string' || raw.length > 512) throw Error('Unreadable settings.');
        const decoded = JSON.parse(raw);
        if (decoded === null) throw Error('Unreadable settings.');
        return { target, raw, value: resolveTouchControls(decoded) };
      } catch {
        return { target, raw, reason: 'preserved' };
      }
    } catch (error) {
      return { reason: failure(error) };
    }
  };
  const initial = read();
  if (initial.value) {
    value = initial.value;
    stored = true;
  }
  const persistence = () => ({
    status: !explicit
      ? 'unchanged'
      : sessionOnly
        ? 'session'
        : Object.keys(pending).length || reason
          ? 'unsaved'
          : 'saved',
    reason,
    canRetry: !disposed && !sessionOnly && (Object.keys(pending).length > 0 || !!reason),
  });
  const notify = (changed = false) => {
    if (disposed) return;
    if (changed) onChange({ ...value });
    for (const listener of [...listeners]) {
      if (!disposed && listeners.has(listener)) listener(persistence());
    }
  };
  const persist = () => {
    if (disposed || !explicit || sessionOnly || writing) return;
    const expected = revision;
    writing = true;
    try {
      // Detect reentrant reads and preserve any newer explicit local choice.
      // The second read catches an already observed peer write before overwrite.
      for (let attempt = 0; attempt < 3; attempt++) {
        const current = read();
        if (disposed || revision !== expected) {
          reason = 'changed';
          return;
        }
        if (current.reason) {
          reason = current.reason;
          return;
        }
        const next = resolveTouchControls({ ...(current.value ?? value), ...pending });
        const confirmation = read();
        if (disposed || revision !== expected) {
          reason = 'changed';
          return;
        }
        if (confirmation.reason) {
          reason = confirmation.reason;
          return;
        }
        if (confirmation.target !== current.target || confirmation.raw !== current.raw) continue;
        value = next;
        const encoded = JSON.stringify(next);
        current.target.setItem(TOUCH_PREFERENCES_KEY, encoded);
        if (disposed || revision !== expected) {
          reason = 'changed';
          return;
        }
        const verified = read();
        if (disposed || revision !== expected) {
          reason = 'changed';
          return;
        }
        if (verified.reason) {
          reason = verified.reason;
          return;
        }
        if (verified.target !== current.target || verified.raw !== encoded) {
          reason = 'unconfirmed';
          return;
        }
        pending = {};
        stored = true;
        reason = '';
        return;
      }
      reason = 'changed';
    } catch (error) {
      reason = failure(error);
    } finally {
      writing = false;
    }
  };
  const changed = (event) => {
    if (disposed || sessionOnly || (event.key !== TOUCH_PREFERENCES_KEY && event.key !== null))
      return;
    const current = read();
    if (
      (event.storageArea && event.storageArea !== current.target) ||
      (event.newValue !== undefined && event.newValue !== current.raw)
    )
      return;
    if (!current.value) {
      if (explicit) {
        reason = current.reason || 'unconfirmed';
        notify();
      }
      return;
    }
    stored = true;
    const next = resolveTouchControls({ ...current.value, ...pending });
    if (!Object.keys(pending).length) reason = '';
    if (same(next, value)) {
      notify();
      return;
    }
    value = next;
    revision++;
    notify(true);
  };
  const restored = (event) => {
    if (event.persisted === true) changed({ key: TOUCH_PREFERENCES_KEY });
  };
  eventTarget?.addEventListener?.('storage', changed);
  eventTarget?.addEventListener?.('pageshow', restored);
  return {
    snapshot: () => ({ ...value }),
    persistence,
    subscribe(listener) {
      if (disposed) return () => {};
      listeners.add(listener);
      listener(persistence());
      return () => listeners.delete(listener);
    },
    set(next, { persist: save = true } = {}) {
      if (disposed) return { ...value };
      const accepted = resolveTouchControls(next);
      const edits = Object.fromEntries(
        fields.filter((key) => accepted[key] !== value[key]).map((key) => [key, accepted[key]]),
      );
      pending = { ...pending, ...edits };
      if (!Object.keys(pending).length && !stored) pending = { ...accepted };
      value = accepted;
      explicit = true;
      sessionOnly = !save;
      reason = sessionOnly ? 'session' : '';
      revision++;
      persist();
      notify(true);
      return { ...value };
    },
    retry() {
      const before = { ...value };
      if (persistence().canRetry) persist();
      notify(!same(before, value));
      return persistence();
    },
    adoptLegacy(next) {
      if (disposed || stored || explicit) return false;
      const current = read();
      if (current.value) {
        value = current.value;
        stored = true;
        return false;
      }
      value = resolveTouchControls(next);
      return true;
    },
    warning: () =>
      persistence().status === 'unsaved'
        ? 'Touch controls changed for this visit; saving could not be confirmed.'
        : '',
    destroy() {
      if (disposed) return;
      disposed = true;
      revision++;
      listeners.clear();
      eventTarget?.removeEventListener?.('storage', changed);
      eventTarget?.removeEventListener?.('pageshow', restored);
    },
  };
}
