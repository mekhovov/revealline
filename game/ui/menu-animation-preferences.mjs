// Shared menu motion intent. Reading never writes browser preferences.
export const MENU_ANIMATION_KEY = 'revealline.menu-animation.v1';
export const MENU_ANIMATION_EVENT = 'revealline-menu-animation';
const memoryPreferences = new WeakMap();
export function getMenuAnimation(win = globalThis.window) {
  try {
    return win.localStorage.getItem(MENU_ANIMATION_KEY) !== 'off';
  } catch {
    return memoryPreferences.get(win) ?? true;
  }
}

export function setMenuAnimation(enabled, win = globalThis.window) {
  try {
    win.localStorage.setItem(MENU_ANIMATION_KEY, enabled ? 'on' : 'off');
  } catch {
    memoryPreferences.set(win, Boolean(enabled));
  }
  win.dispatchEvent(
    new win.CustomEvent(MENU_ANIMATION_EVENT, { detail: { enabled: Boolean(enabled) } }),
  );
}
/** Observe the same explicit preference across menu surfaces and browser tabs. */
export function subscribeMenuAnimation(listener, win = globalThis.window) {
  const refresh = (event) => {
    if (event?.type === 'storage' && event.key !== MENU_ANIMATION_KEY && event.key !== null) return;
    listener(getMenuAnimation(win));
  };
  win?.addEventListener?.(MENU_ANIMATION_EVENT, refresh);
  win?.addEventListener?.('storage', refresh);
  win?.addEventListener?.('pageshow', refresh);
  refresh();
  return () => {
    win?.removeEventListener?.(MENU_ANIMATION_EVENT, refresh);
    win?.removeEventListener?.('storage', refresh);
    win?.removeEventListener?.('pageshow', refresh);
  };
}
