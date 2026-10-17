import { attachStorageRetention } from '../ui/storage-retention.mjs';

/** Reuse the origin retention owner without joining campaign approval or storage. */
export function mountCreatorStorageRetention({ document, window = document.defaultView }) {
  const panel = document.getElementById('creator-retention');
  const button = document.getElementById('creator-retention-button');
  const status = document.getElementById('creator-retention-status');
  let suspended = false;
  let destroyed = false;
  const isOpen = () => !destroyed && !suspended && !document.hidden && panel.open;
  const retention = attachStorageRetention({
    button,
    status,
    isOpen,
    navigator: window.navigator ?? globalThis.navigator,
  });
  const refresh = () => {
    if (isOpen()) void retention.refresh();
    else retention.close();
  };
  const hide = () => {
    suspended = true;
    retention.close();
  };
  const show = () => {
    suspended = false;
    refresh();
  };
  panel.addEventListener('toggle', refresh);
  document.addEventListener('visibilitychange', refresh);
  window.addEventListener('pagehide', hide);
  window.addEventListener('pageshow', show);
  button.disabled = false;
  refresh();
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      retention.destroy();
      panel.removeEventListener('toggle', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('pagehide', hide);
      window.removeEventListener('pageshow', show);
    },
  };
}
