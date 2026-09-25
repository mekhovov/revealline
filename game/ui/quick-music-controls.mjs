import { t, localizedText, localizedAttribute, onLocaleChange } from '../i18n/index.mjs';

export const MUSIC_SHORTCUTS_KEY = 'revealline.music-shortcuts.v1';

// Character shortcuts are optional and yield to editing and the host's game bindings.
export function musicShortcutAction(
  event,
  { enabled = true, active = true, conflicts = false } = {},
) {
  if (
    !enabled ||
    !active ||
    conflicts ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.keyCode === 229 ||
    ['Dead', 'Process'].includes(event.key) ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.target?.closest?.(
      'input,textarea,select,[contenteditable]:not([contenteditable="false"]),[data-game-reading]',
    )
  )
    return null;
  const code = event.code || { b: 'KeyB', n: 'KeyN' }[event.key?.toLowerCase()];
  return code === 'KeyB' ? 'toggle' : code === 'KeyN' ? 'next' : null;
}

/** Small views over the current host's transport. Never owns gameplay, mute or a deck. */
export function attachQuickMusicControls({
  document: doc = globalThis.document,
  window: win = doc.defaultView ?? globalThis.window,
  prefix,
  after = [],
  settingsRoot = null,
  snapshot,
  play,
  pause,
  next,
  active = () => true,
  conflicts = () => false,
  getMaster = () => null,
  getStorage = () => globalThis.localStorage,
  onError = () => {},
} = {}) {
  let disposed = false,
    enabled = true,
    warning = '',
    operation = 0;
  const foreground = () => !disposed && !doc.hidden && doc.hasFocus?.() !== false && active();
  const readPreference = () => {
    try {
      return getStorage()?.getItem(MUSIC_SHORTCUTS_KEY) !== 'false';
    } catch {
      return true;
    }
  };
  enabled = readPreference();
  const rows = after.filter(Boolean).map((anchor, index) => {
    const root = doc.createElement('div'),
      title = doc.createElement('span'),
      toggle = doc.createElement('button'),
      skip = doc.createElement('button');
    root.id = `${prefix}-quick-music-${index}`;
    root.className = 'quick-music-controls';
    root.setAttribute('role', 'group');
    localizedAttribute(root, 'aria-label', () => t('interface:quickMusic.controls'));
    title.className = 'quick-music-title';
    toggle.id = `${root.id}-toggle`;
    toggle.type = skip.type = 'button';
    toggle.className = skip.className = 'button secondary';
    skip.id = `${root.id}-next`;
    localizedText(skip, () => t('interface:quickMusic.next'));
    toggle.onclick = () => run('toggle');
    skip.onclick = () => run('next');
    root.append(title, toggle, skip);
    anchor.after(root);
    return { root, title, toggle, skip };
  });
  let details = null,
    checkbox = null,
    preferenceNotice = null;
  if (settingsRoot) {
    details = doc.createElement('details');
    details.className = 'quick-music-settings';
    const summary = doc.createElement('summary'),
      label = doc.createElement('label');
    localizedText(summary, () => t('interface:quickMusic.shortcuts'));
    checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${prefix}-music-shortcuts`;
    checkbox.checked = enabled;
    label.setAttribute('for', checkbox.id);
    const copy = doc.createElement('span');
    localizedText(copy, () => t('interface:quickMusic.shortcutHelp'));
    label.append(checkbox, copy);
    preferenceNotice = doc.createElement('p');
    preferenceNotice.className = 'micro-note';
    preferenceNotice.setAttribute('role', 'status');
    localizedText(preferenceNotice, () => t('interface:quickMusic.priority'));
    checkbox.onchange = () => {
      enabled = checkbox.checked;
      try {
        const storage = getStorage();
        if (!storage) throw new Error(t('interface:quickMusic.storageUnavailable'));
        storage.setItem(MUSIC_SHORTCUTS_KEY, String(enabled));
        localizedText(preferenceNotice, () => t('interface:quickMusic.priority'));
      } catch {
        localizedText(preferenceNotice, () => t('interface:quickMusic.sessionOnly'));
      }
      render();
    };
    details.append(summary, label, preferenceNotice);
    settingsRoot.append(details);
  }
  function render() {
    if (disposed) return;
    const state = snapshot(),
      master = getMaster();
    const pausable = !!state?.desired && !['blocked', 'error', 'ended'].includes(state.status);
    const muted = master?.muted || master?.volume === 0 || state?.volume === 0;
    const status =
      warning ||
      (state?.status === 'blocked'
        ? t('interface:quickMusic.retry')
        : state?.status === 'loading'
          ? t('interface:quickMusic.loading')
          : muted
            ? t('interface:quickMusic.muted')
            : state?.playing
              ? t('interface:quickMusic.playing')
              : t('interface:quickMusic.paused'));
    const song = state?.track
      ? `${state.track.title}${state.track.artist ? ` · ${state.track.artist}` : ''}`
      : t('interface:selectedSoundtrack');
    for (const row of rows) {
      const title = `${song} · ${status}`;
      if (row.title.textContent !== title) row.title.textContent = title;
      row.title.setAttribute('title', title);
      row.toggle.textContent = pausable
        ? t('interface:quickMusic.pause')
        : t('interface:quickMusic.play');
      row.toggle.disabled = !state;
      row.skip.disabled = !state?.queue?.length;
      row.toggle.setAttribute(
        'title',
        enabled ? t('interface:quickMusic.toggleShortcut') : t('interface:quickMusic.toggle'),
      );
      row.skip.setAttribute(
        'title',
        enabled ? t('interface:quickMusic.nextShortcut') : t('interface:quickMusic.next'),
      );
      if (enabled) {
        row.toggle.setAttribute('aria-keyshortcuts', 'B');
        row.skip.setAttribute('aria-keyshortcuts', 'N');
      } else {
        row.toggle.removeAttribute('aria-keyshortcuts');
        row.skip.removeAttribute('aria-keyshortcuts');
      }
    }
  }
  function run(action) {
    if (!foreground()) return false;
    const state = snapshot();
    if (!state || (action === 'next' && !state.queue?.length)) return false;
    const token = ++operation;
    warning = '';
    // Invoke inside the original click/key activation task, before any await.
    try {
      const pending =
        action === 'next'
          ? next()
          : state.desired && !['blocked', 'error', 'ended'].includes(state.status)
            ? pause()
            : play();
      render();
      Promise.resolve(pending)
        .catch((error) => {
          if (disposed || token !== operation) return;
          warning = error?.message || String(error);
          onError(error);
        })
        .finally(() => {
          if (!disposed && token === operation) render();
        });
    } catch (error) {
      warning = error?.message || String(error);
      onError(error);
      render();
    }
    return true;
  }
  const shortcut = (event) =>
    musicShortcutAction(event, {
      enabled,
      active: foreground(),
      conflicts: conflicts(event),
    });
  const keydown = (event) => {
    const action = shortcut(event);
    if (action && run(action)) event.preventDefault();
  };
  const storage = (event) => {
    if (event.key !== MUSIC_SHORTCUTS_KEY) return;
    try {
      const current = getStorage();
      if (event.storageArea !== current || event.newValue !== current?.getItem(MUSIC_SHORTCUTS_KEY))
        return;
      enabled = readPreference();
      if (checkbox) checkbox.checked = enabled;
      render();
    } catch {
      /* Storage can be unavailable without disabling playback. */
    }
  };
  doc.addEventListener('keydown', keydown);
  win?.addEventListener?.('storage', storage);
  const unsubscribeLocale = onLocaleChange(render);
  render();
  return Object.freeze({
    render,
    handlesKey: (event) => event.type === 'keydown' && Boolean(shortcut(event)),
    contains: (node) => rows.some((row) => row.root.contains(node)) || !!details?.contains(node),
    dispose() {
      if (disposed) return;
      disposed = true;
      operation++;
      doc.removeEventListener('keydown', keydown);
      win?.removeEventListener?.('storage', storage);
      unsubscribeLocale();
      for (const row of rows) row.root.remove();
      details?.remove();
    },
  });
}
