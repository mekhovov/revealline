/* global window, document */
// Observers only. The ordinary HTML module mounts the unmodified host APIs.
(() => {
  const data = (window.fpvFocusObserved = { errors: [], warnings: [], keys: [], focus: [] });
  window.addEventListener('error', (event) => data.errors.push(event.message));
  window.addEventListener('unhandledrejection', (event) => data.errors.push(String(event.reason)));
  for (const level of ['error', 'warn']) {
    const original = console[level];
    console[level] = (...args) => {
      data[level === 'error' ? 'errors' : 'warnings'].push(args.map(String).join(' '));
      original.apply(console, args);
    };
  }
  for (const type of ['keydown', 'keyup'])
    document.addEventListener(
      type,
      (event) => {
        if (data.keys.length < 100)
          data.keys.push({
            type,
            key: event.key,
            shift: event.shiftKey,
            trusted: event.isTrusted,
            target: event.target.id,
            active: document.activeElement?.id,
          });
      },
      true,
    );
  document.addEventListener('focusin', (event) => {
    if (data.focus.length < 100)
      data.focus.push({ target: event.target.id, at: performance.now() });
  });
})();
