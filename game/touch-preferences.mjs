import { resolveTouchControls } from './touch-controls.mjs';

export const TOUCH_PREFERENCES_KEY = 'revealline.touch.v1';

/** Shared presentation preference only. Never writes a campaign/profile or changes rules. */
export function createTouchPreferences({
  storage,
  legacy = null,
  eventTarget = globalThis.window,
  onChange = () => {},
} = {}) {
  if (storage === undefined) {
    try {
      storage = globalThis.localStorage;
    } catch {
      storage = null;
    }
  }
  let value = resolveTouchControls(legacy),
    disposed = false,
    warning = '';
  const read = () => {
    try {
      const raw = storage?.getItem(TOUCH_PREFERENCES_KEY);
      if (raw && raw.length <= 512) value = resolveTouchControls(JSON.parse(raw));
    } catch {
      /* Invalid/denied storage leaves this visit's valid choice intact. */
    }
  };
  read();
  const changed = (event) => {
    if (disposed || event.key !== TOUCH_PREFERENCES_KEY) return;
    read();
    onChange({ ...value });
  };
  eventTarget?.addEventListener?.('storage', changed);
  return {
    snapshot: () => ({ ...value }),
    set(next) {
      if (disposed) return { ...value };
      value = resolveTouchControls(next);
      warning = '';
      try {
        if (!storage) throw new Error('Storage unavailable');
        storage.setItem(TOUCH_PREFERENCES_KEY, JSON.stringify(value));
      } catch {
        warning = 'Touch controls changed for this visit; saving is unavailable.';
      }
      onChange({ ...value });
      return { ...value };
    },
    warning: () => warning,
    destroy() {
      disposed = true;
      eventTarget?.removeEventListener?.('storage', changed);
    },
  };
}
