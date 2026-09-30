/** Disabling a focused button can drop focus onto body. Restore only the
 * initiating control, without overriding any intervening keyboard navigation. */
export function retainControlFocus(control, document) {
  const beganFocused = document.activeElement === control;
  let moved = false;
  const track = (event) => {
    if (event.target !== control && event.target !== document.body) moved = true;
  };
  document.addEventListener('focusin', track);
  return (stillOwned) => {
    document.removeEventListener('focusin', track);
    if (stillOwned && beganFocused && !moved && document.activeElement === document.body)
      control.focus({ preventScroll: true });
  };
}

/** Own one preview RAF and bounded async tasks. Every departure invalidates
 * prior callbacks, including callbacks completing after a BFCache return. */
export function createPreviewLifecycle({
  requestFrame,
  cancelFrame,
  onFrame,
  onSuspend = () => {},
  onResume = () => {},
  initialActive = true,
}) {
  let active = initialActive;
  let disposed = false;
  let frame = null;
  let generation = 0;
  const tasks = new Set();
  function schedule() {
    if (!active || disposed || frame !== null) return;
    const owner = generation;
    frame = requestFrame((time) => {
      if (owner !== generation || !active || disposed) return;
      frame = null;
      onFrame(time);
      schedule();
    });
  }
  function stop() {
    active = false;
    generation++;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    for (const task of tasks) task.abort();
    tasks.clear();
    onSuspend();
  }
  schedule();
  return {
    get active() {
      return active && !disposed;
    },
    suspend() {
      if (!disposed && active) stop();
    },
    resume() {
      if (disposed || active) return;
      active = true;
      onResume();
      schedule();
    },
    beginTask() {
      if (!active || disposed) throw new Error('Preview is inactive.');
      const controller = new AbortController();
      const owner = generation;
      tasks.add(controller);
      return {
        signal: controller.signal,
        current: () => active && !disposed && owner === generation && !controller.signal.aborted,
        finish: () => tasks.delete(controller),
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stop();
    },
  };
}
