/** Browser-origin retention only. This does not install or verify downloads. */
export function attachStorageRetention({
  button,
  status,
  isOpen,
  navigator: browser = globalThis.navigator,
}) {
  let active = false,
    destroyed = false,
    generation = 0,
    pending = null;
  const current = (version) => !destroyed && active && isOpen() && generation === version;
  const show = (version, message, busy = false) => {
    if (!current(version)) return;
    status.textContent = message;
    // Keep the focused action and ordinary Back available while the browser decides.
    button.setAttribute('aria-busy', String(busy));
  };
  const granted = 'Retention granted. Keep backups; you can still clear site data.';
  const unsupported = 'This browser cannot request download retention. Keep backups.';
  const requesting = 'Asking the browser… You can close Settings while it decides.';
  async function refresh() {
    if (destroyed || !isOpen()) return;
    active = true;
    const version = ++generation;
    if (pending) {
      show(version, requesting, true);
      await pending.done;
      if (!current(version)) return;
    }
    show(version, 'Checking download retention…');
    try {
      const storage = browser?.storage;
      if (typeof storage?.persisted !== 'function') {
        show(
          version,
          typeof storage?.persist === 'function'
            ? 'Retention status is unavailable. You can still ask this browser.'
            : unsupported,
        );
        return;
      }
      const retained = await storage.persisted();
      if (typeof retained !== 'boolean') throw new Error('Invalid retention result.');
      show(
        version,
        retained
          ? granted
          : typeof storage.persist === 'function'
            ? 'Retention is not enabled. Downloads may be removed by the browser.'
            : unsupported,
      );
    } catch {
      show(version, 'Could not check retention. Keep backups.');
    }
  }
  function request() {
    if (destroyed || !active || !isOpen() || pending) return;
    const version = ++generation;
    const token = {};
    pending = token;
    token.done = (async () => {
      try {
        const storage = browser?.storage;
        if (typeof storage?.persist !== 'function') {
          show(version, unsupported);
          return;
        }
        show(version, requesting, true);
        // Invoke before the first await, directly in the explicit button action.
        const retained = await storage.persist();
        if (typeof retained !== 'boolean') throw new Error('Invalid retention result.');
        show(
          version,
          retained
            ? granted
            : 'Not granted by this browser. Downloads may be removed; keep backups.',
        );
      } catch {
        show(version, 'Could not request retention. You can try again; keep backups.');
      } finally {
        if (pending === token) pending = null;
      }
    })();
    return token.done;
  }
  button.addEventListener('click', request);
  return {
    refresh,
    close() {
      active = false;
      generation++;
    },
    destroy() {
      destroyed = true;
      active = false;
      generation++;
      button.removeEventListener('click', request);
    },
  };
}
