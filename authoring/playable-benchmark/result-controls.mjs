/** A bounded UI wait. This clock never advances a run; the caller explicitly
 * starts a fresh run only after its owned cue completes. */
export function createReadyCue(onReady) {
  let owner = null;
  let elapsed = 0;
  return {
    get active() {
      return owner !== null;
    },
    begin(value) {
      owner = value;
      elapsed = 0;
    },
    cancel() {
      owner = null;
      elapsed = 0;
    },
    advance(seconds, current) {
      if (!owner) return;
      if (owner !== current) {
        owner = null;
        return;
      }
      elapsed += seconds;
      if (elapsed + 1e-10 < 0.6) return;
      const accepted = owner;
      owner = null;
      elapsed = 0;
      onReady(accepted);
    },
  };
}

/** Offer terminal Retry only while focus still belongs to the same play control.
 * Moving away cancels the offer, including when focus returns before the wait ends. */
export function createResultFocusCue({ document, isPlayFocus, onReady }) {
  let originalFocus = null;
  const cue = createReadyCue((owner) => {
    const unchanged = originalFocus && document.activeElement === originalFocus;
    originalFocus = null;
    if (unchanged) onReady(owner);
  });
  const cancel = () => {
    originalFocus = null;
    cue.cancel();
  };
  const focusChanged = (event) => {
    if (cue.active && event.target !== originalFocus) cancel();
  };
  document.addEventListener('focusin', focusChanged);
  return {
    begin(owner) {
      cancel();
      if (!isPlayFocus(document.activeElement)) return;
      originalFocus = document.activeElement;
      cue.begin(owner);
    },
    advance: (seconds, owner) => cue.advance(seconds, owner),
    cancel,
    destroy() {
      cancel();
      document.removeEventListener('focusin', focusChanged);
    },
  };
}

/** A focus transfer cannot turn a held Enter/Space or old pointer press into
 * Retry. Native keyboard activation is handled on its matching fresh release. */
export function attachDeliberateButton(button, { window, enabled, activate }) {
  const keys = new Set();
  const fresh = new WeakSet();
  const listeners = [];
  let armedKey = null;
  let armedPointer = null;
  let pointerReleased = false;
  const listen = (target, name, callback, options) => {
    target.addEventListener(name, callback, options);
    listeners.push(() => target.removeEventListener(name, callback, options));
  };
  const activation = (event) => ['Enter', ' '].includes(event.key);
  const reset = () => {
    armedKey = null;
    armedPointer = null;
    pointerReleased = false;
  };
  listen(
    window,
    'keydown',
    (event) => {
      if (!activation(event)) return;
      if (!event.repeat && !keys.has(event.key)) fresh.add(event);
      keys.add(event.key);
    },
    true,
  );
  listen(window, 'keyup', (event) => keys.delete(event.key), true);
  listen(button, 'keydown', (event) => {
    if (!activation(event)) return;
    event.preventDefault();
    if (enabled() && fresh.has(event) && !event.ctrlKey && !event.metaKey && !event.altKey)
      armedKey = event.key;
  });
  listen(button, 'keyup', (event) => {
    if (!activation(event)) return;
    event.preventDefault();
    const accepted = armedKey === event.key && enabled();
    armedKey = null;
    if (accepted) activate();
  });
  listen(button, 'pointerdown', (event) => {
    reset();
    if (enabled() && event.button === 0 && event.isPrimary !== false)
      armedPointer = event.pointerId;
  });
  listen(button, 'pointerup', (event) => {
    pointerReleased = armedPointer === event.pointerId;
    armedPointer = null;
  });
  listen(button, 'click', (event) => {
    event.preventDefault();
    const accepted =
      enabled() && keys.size === 0 && (event.detail === 0 ? armedKey === null : pointerReleased);
    reset();
    if (accepted) activate();
  });
  listen(button, 'pointercancel', reset);
  listen(button, 'blur', reset);
  listen(window, 'blur', () => {
    keys.clear();
    reset();
  });
  return {
    clear: reset,
    destroy() {
      listeners.forEach((remove) => remove());
      reset();
      keys.clear();
    },
  };
}
