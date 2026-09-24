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
    root.setAttribute('aria-label', 'Music controls');
    title.className = 'quick-music-title';
    toggle.id = `${root.id}-toggle`;
    toggle.type = skip.type = 'button';
    toggle.className = skip.className = 'button secondary';
    skip.id = `${root.id}-next`;
    skip.textContent = 'Next song';
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
    summary.textContent = 'Music shortcuts';
    checkbox = doc.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = `${prefix}-music-shortcuts`;
    checkbox.checked = enabled;
    label.setAttribute('for', checkbox.id);
    const copy = doc.createElement('span');
    copy.textContent = ' B: play / pause music · N: next song';
    label.append(checkbox, copy);
    preferenceNotice = doc.createElement('p');
    preferenceNotice.className = 'micro-note';
    preferenceNotice.setAttribute('role', 'status');
    preferenceNotice.textContent = 'Game bindings and typing take priority.';
    checkbox.onchange = () => {
      enabled = checkbox.checked;
      try {
        const storage = getStorage();
        if (!storage) throw new Error('Storage unavailable.');
        storage.setItem(MUSIC_SHORTCUTS_KEY, String(enabled));
        preferenceNotice.textContent = 'Game bindings and typing take priority.';
      } catch {
        preferenceNotice.textContent =
          'Shortcut preference changed for this visit; saving is unavailable.';
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
        ? 'Choose Play music to retry'
        : state?.status === 'loading'
          ? 'Loading music…'
          : muted
            ? 'Sound muted'
            : state?.playing
              ? 'Playing'
              : 'Paused');
    const song = state?.track
      ? `${state.track.title}${state.track.artist ? ` · ${state.track.artist}` : ''}`
      : 'Selected soundtrack';
    for (const row of rows) {
      const title = `${song} · ${status}`;
      if (row.title.textContent !== title) row.title.textContent = title;
      row.title.setAttribute('title', title);
      row.toggle.textContent = pausable ? 'Pause music' : 'Play music';
      row.toggle.disabled = !state;
      row.skip.disabled = !state?.queue?.length;
      row.toggle.setAttribute('title', enabled ? 'Play / pause music (B)' : 'Play / pause music');
      row.skip.setAttribute('title', enabled ? 'Next song (N)' : 'Next song');
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
  const keydown = (event) => {
    const action = musicShortcutAction(event, {
      enabled,
      active: foreground(),
      conflicts: conflicts(event),
    });
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
  render();
  return Object.freeze({
    render,
    contains: (node) => rows.some((row) => row.root.contains(node)) || !!details?.contains(node),
    dispose() {
      if (disposed) return;
      disposed = true;
      operation++;
      doc.removeEventListener('keydown', keydown);
      win?.removeEventListener?.('storage', storage);
      for (const row of rows) row.root.remove();
      details?.remove();
    },
  });
}
