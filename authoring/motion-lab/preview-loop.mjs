/** One request at a time. Interruption stops intent; restoration never resumes it.
 * The caller owns simulation, input releases and rendering while paused. */
export function createPreviewLoop({
  window: host = globalThis.window,
  document: doc = globalThis.document,
  initiallyInterrupted = false,
  initiallyAway = false,
  onFrame,
  onInterrupt,
  onPageHide = () => {},
  onDispose = () => {},
}) {
  let ready = false,
    running = false,
    disposed = false,
    away = initiallyAway;
  let interrupted =
      initiallyInterrupted || initiallyAway || doc.hidden === true || doc.hasFocus?.() === false,
    request = null,
    generation = 0,
    lastTime = null;
  const visible = () => !away && !doc.hidden && doc.hasFocus?.() !== false;
  const resetClock = () => {
    lastTime = null;
  };
  const cancel = () => {
    generation++;
    if (request !== null) host.cancelAnimationFrame(request);
    request = null;
    resetClock();
  };
  const schedule = () => {
    if (disposed || !ready || !running || !visible() || request !== null) return;
    const ticket = generation;
    request = host.requestAnimationFrame((time) => {
      if (disposed || ticket !== generation) return;
      request = null;
      if (!running || !visible()) return;
      const dt = lastTime === null ? 0 : Math.max(0, Math.min((time - lastTime) / 1000, 0.25));
      lastTime = time;
      onFrame(time, dt);
      schedule();
    });
  };
  const interrupt = (reason) => {
    if (disposed) return;
    interrupted = true;
    running = false;
    cancel();
    onInterrupt(reason);
  };
  const blur = () => interrupt('blur');
  const visibility = () => {
    if (doc.hidden) interrupt('hidden');
  };
  const pagehide = (event) => {
    away = true;
    interrupt('pagehide');
    onPageHide(event);
    if (!event.persisted) dispose();
  };
  const pageshow = () => {
    if (!disposed) {
      away = false;
      resetClock();
    }
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    running = false;
    cancel();
    host.removeEventListener('blur', blur);
    host.removeEventListener('pagehide', pagehide);
    host.removeEventListener('pageshow', pageshow);
    doc.removeEventListener('visibilitychange', visibility);
    onDispose();
  };
  host.addEventListener('blur', blur);
  host.addEventListener('pagehide', pagehide);
  host.addEventListener('pageshow', pageshow);
  doc.addEventListener('visibilitychange', visibility);
  return Object.freeze({
    get interrupted() {
      return interrupted;
    },
    get disposed() {
      return disposed;
    },
    get canRun() {
      return !disposed && visible();
    },
    setReady() {
      if (!disposed) {
        ready = true;
        schedule();
      }
    },
    setRunning(value) {
      if (disposed) return;
      running = value === true && visible();
      if (!running) cancel();
      else schedule();
    },
    resetClock,
    dispose,
  });
}
