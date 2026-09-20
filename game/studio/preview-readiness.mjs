/** A slow boot is a warning, not a terminal failure. Keep observing only the
 * owned preview until it settles or its caller closes/replaces/disposes it. */
export function observePreviewReadiness({
  readDocument,
  expectedURL,
  isCurrent,
  notify,
  now = Date.now,
  schedule = setInterval,
  cancel = clearInterval,
}) {
  const deadline = now() + 20000;
  let stopped = false,
    warned = false,
    timer;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    cancel(timer);
  };
  timer = schedule(() => {
    if (stopped) return;
    if (!isCurrent()) return stop();
    let document;
    try {
      document = readDocument();
    } catch {
      // A navigating/inaccessible frame cannot establish readiness.
    }
    const state =
      document?.URL === expectedURL ? document.documentElement?.dataset.bootState : null;
    if (state === 'ready' || state === 'failed') {
      stop();
      notify(state);
    } else if (!warned && now() >= deadline) {
      warned = true;
      notify('slow');
    }
  }, 250);
  return stop;
}
