// Classic entry: module failures must leave native recovery outside the tool.
(() => {
  const host = globalThis,
    doc = host.document,
    script = doc.currentScript;
  if (host.RevealLineToolLaunch || !script) return;
  const moduleURL = new URL(script.dataset.module, doc.baseURI).href;
  const statusId = script.dataset.status;
  let attached = false,
    live = true,
    timer = null,
    reload = null,
    started = false;
  function message(text, state) {
    const target = doc.getElementById(statusId);
    if (!live || !target) return;
    const label = target.querySelector('.operation-status-label') || target;
    label.textContent = text;
    label.setAttribute('role', 'status');
    label.setAttribute('aria-live', 'polite');
    target.hidden = false;
    (label.closest('.operation-status') || target).dataset.state = state;
    if (state === 'error') {
      doc.documentElement.dataset.toolState = 'error';
      for (const control of doc.querySelectorAll('[data-tool-control]')) control.disabled = true;
    }
    if (!reload) {
      reload = doc.createElement('a');
      reload.className = 'button secondary';
      reload.style.minHeight = '44px';
      reload.style.display = 'inline-flex';
      reload.style.alignItems = 'center';
      reload.href = doc.baseURI;
      reload.textContent = 'Reload this tool';
      target.after(reload);
    }
    reload.hidden = false;
  }
  host.RevealLineToolLaunch = Object.freeze({
    attached() {
      if (!live) return;
      attached = true;
      host.clearTimeout(timer);
      if (reload) reload.hidden = true;
    },
  });
  function start() {
    if (started || !live) return;
    started = true;
    timer = host.setTimeout(() => {
      if (!attached && live)
        message(
          'Still loading tool modules. You can wait, reload, or use the page’s Back link.',
          'busy',
        );
    }, 15000);
    import(moduleURL)
      .then(() => {
        host.clearTimeout(timer);
      })
      .catch((error) => {
        host.clearTimeout(timer);
        message(
          `This tool could not start: ${String(error.message || error).slice(0, 240)}. Reload to try again, or use the page’s Back link.`,
          'error',
        );
      });
  }
  host.addEventListener('pagehide', (event) => {
    if (event.persisted) return;
    live = false;
    host.clearTimeout(timer);
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
