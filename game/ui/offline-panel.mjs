import { offlineAvailability, prepareOffline, checkOffline } from '../offline.mjs';
import { createOperationStatus } from './operation-status.mjs';

/** Observes the release worker; leaving this screen never owns its installation. */
export function attachOfflinePanel({
  document: doc = globalThis.document,
  window: win = globalThis.window,
  availability = offlineAvailability,
  prepare = prepareOffline,
  check = checkOffline,
} = {}) {
  const $ = (id) => doc.getElementById(id);
  const button = $('offline-button');
  const stop = $('offline-stop');
  const dialog = $('settings-dialog');
  let observation = null;
  let disposed = false;
  let action = 'prepare';
  const feedback = createOperationStatus($('offline-status'), { isCurrent: () => !disposed });
  const available = availability();
  button.hidden = !available.available;
  feedback.begin({ message: '' }).finish({
    message: available.available
      ? 'Download this release for offline play on this device.'
      : available.reason,
  });
  function controls() {
    button.disabled = !!observation;
    stop.hidden = !observation;
    button.textContent =
      action === 'verify'
        ? 'Verify offline files'
        : action === 'check'
          ? 'Check progress'
          : 'Prepare offline play';
  }
  function detach({ focus = false } = {}) {
    if (!observation) return;
    const restoreFocus = focus && doc.activeElement === stop;
    const owned = observation;
    observation = null;
    owned.controller.abort();
    owned.status.finish({
      state: 'detached',
      message:
        'Stopped waiting. Offline preparation may still be running. Check progress to confirm its result.',
    });
    action = 'check';
    controls();
    if (restoreFocus && dialog.open && !doc.hidden && doc.hasFocus?.() !== false)
      button.focus({ preventScroll: true });
  }
  async function run() {
    if (disposed || observation || !available.available) return;
    const owned = {
      controller: new AbortController(),
      status: feedback.begin({
        message: action === 'prepare' ? 'Preparing offline play…' : 'Checking offline files…',
        stage: action === 'prepare' ? 'connecting' : 'verifying',
      }),
    };
    observation = owned;
    const current = () => !disposed && observation === owned;
    controls();
    try {
      const result = await (action === 'prepare' ? prepare : check)({
        signal: owned.controller.signal,
        onStatus(status) {
          if (!current() || !['preparing', 'checking'].includes(status.status)) return;
          owned.status.update({
            message: status.message,
            stage: status.stage,
            progress: status.progress ?? null,
          });
        },
      });
      if (!current()) return;
      const ready = ['ready', 'waiting'].includes(result.status);
      const pending = ['still-running', 'unconfirmed'].includes(result.status);
      action = ready ? 'verify' : pending ? 'check' : 'prepare';
      owned.status.finish({
        state: ready ? 'ready' : pending ? 'detached' : 'error',
        message: `${result.message || result.status}${result.verified ? ` · ${result.verified} files verified` : ''}`,
      });
      $('offline-details').textContent = JSON.stringify(result, null, 2);
    } catch (error) {
      if (!current()) return;
      action = 'prepare';
      owned.status.finish({ state: 'error', message: error.message });
    } finally {
      if (current()) {
        const restoreFocus = doc.activeElement === stop;
        observation = null;
        controls();
        if (restoreFocus && dialog.open && !doc.hidden && doc.hasFocus?.() !== false)
          button.focus({ preventScroll: true });
      }
    }
  }
  button.onclick = run;
  stop.onclick = () => detach({ focus: true });
  const closed = () => {
    if (!dialog.open) detach();
  };
  const hidden = () => detach();
  dialog.addEventListener('close', closed);
  win.addEventListener('pagehide', hidden);
  controls();
  return {
    destroy() {
      detach();
      disposed = true;
      feedback.dispose();
      button.onclick = stop.onclick = null;
      dialog.removeEventListener('close', closed);
      win.removeEventListener('pagehide', hidden);
    },
  };
}
