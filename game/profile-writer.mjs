/** A conservative single writing tab. Reading, practice and exporting do not need
 * this lease. Hold the Web Lock for the page lifetime and release on pagehide.
 * Every release writer must participate; legacy clients are outside this guard.
 */
export async function claimProfileWriter(lockManager, key) {
  const unavailable =
    'This browser cannot reserve the player library for safe writing. Progress is session-only; export a backup to keep it.';
  const occupied =
    'Another game tab owns saving. This tab is session-only; close the other game tab, then reload here to save. Export still works.';
  const denied = (reason) => Object.freeze({ writable: false, reason, release() {} });
  if (!lockManager || typeof lockManager.request !== 'function') return denied(unavailable);
  if (typeof key !== 'string' || !key.trim() || key.length > 512)
    return denied('A valid profile writer key is required. Progress is session-only.');
  let settle,
    settled = false,
    writable = false,
    reason = '',
    unlock;
  const claimed = new Promise((resolve) => {
    settle = (value) => {
      if (!settled) {
        settled = true;
        resolve(value);
      }
    };
  });
  const holding = new Promise((resolve) => {
    unlock = resolve;
  });
  const lease = Object.freeze({
    get writable() {
      return writable;
    },
    get reason() {
      return reason;
    },
    release() {
      if (!writable) return;
      writable = false;
      reason =
        'The saving lease was released. Reload this tab to save again; export remains available.';
      unlock();
    },
  });
  try {
    const request = lockManager.request(
      key,
      { mode: 'exclusive', ifAvailable: true },
      async (lock) => {
        if (!lock) {
          settle(denied(occupied));
          return;
        }
        writable = true;
        settle(lease);
        await holding;
      },
    );
    Promise.resolve(request).then(
      () => {
        if (!settled) settle(denied(unavailable));
        // Unexpected request completion must not leave a stale writable flag.
        writable = false;
      },
      () => {
        writable = false;
        reason = unavailable;
        unlock();
        settle(denied(unavailable));
      },
    );
  } catch {
    writable = false;
    unlock();
    settle(denied(unavailable));
  }
  return claimed;
}
