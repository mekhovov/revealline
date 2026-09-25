/** Steam Input can expose one press as both a gamepad button and a native
 * Enter/Space or mouse click. Let the gamepad own that gesture, including its
 * release after a menu transition. Touch and standalone native input stay native.
 */
export function attachControllerConfirmGuard({
  document: doc = globalThis.document,
  confirmPressed,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  echoWindowMs = 1250,
  nativeLeadWindowMs = 250,
} = {}) {
  const keys = new Set(),
    listeners = [];
  let mouse = false,
    controllerHeld = false,
    suppressUntil = -Infinity,
    nativeActivationAt = -Infinity,
    neutralAfterLifecycle = false;
  const listen = (type, callback) => {
    doc.addEventListener(type, callback, { capture: true });
    listeners.push(() => doc.removeEventListener(type, callback, { capture: true }));
  };
  const consume = (event) => {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    else event.stopPropagation?.();
  };
  const controllerOwnsGesture = () => controllerHeld || confirmPressed() || now() <= suppressUntil;
  const confirmKey = (event) =>
    ['Enter', ' '].includes(event.key) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey;
  const isMouse = (event) =>
    event.button === 0 &&
    (!event.pointerType || event.pointerType === 'mouse') &&
    !event.sourceCapabilities?.firesTouchEvents;
  const touchOrPen = (event) =>
    event.sourceCapabilities?.firesTouchEvents || ['touch', 'pen'].includes(event.pointerType);
  const consumeConfirmKey = (event) => {
    if (!confirmKey(event)) return;
    if (!keys.has(event.key) && !controllerOwnsGesture()) return;
    keys.add(event.key);
    consume(event);
  };
  listen('keydown', consumeConfirmKey);
  listen('keypress', consumeConfirmKey);
  listen('keyup', (event) => {
    const owned = keys.delete(event.key);
    if (owned || (confirmKey(event) && controllerOwnsGesture())) consume(event);
  });
  listen('pointerdown', (event) => {
    if (!isMouse(event)) return;
    mouse = controllerOwnsGesture();
    if (mouse) consume(event);
  });
  for (const type of ['pointerup', 'mousedown', 'mouseup'])
    listen(type, (event) => {
      if (mouse && isMouse(event)) consume(event);
    });
  listen('click', (event) => {
    // HTMLElement.click() is untrusted in browsers and is the controller
    // adapter's intended activation. A trusted native activation can arrive
    // first, before the Gamepad API exposes the same physical press. In that
    // order, keep the native action and consume the controller click instead.
    const programmatic =
      event.isTrusted === false ||
      (event.isTrusted == null && (event.detail == null || event.detail === 0));
    if (programmatic) {
      const nativeLeadAge = now() - nativeActivationAt;
      if (controllerOwnsGesture() && nativeLeadAge >= 0 && nativeLeadAge <= nativeLeadWindowMs) {
        nativeActivationAt = -Infinity;
        consume(event);
      }
      return;
    }
    // Keyboard and accessibility activation can be a trusted PointerEvent
    // with no pointer (pointerId -1 / empty pointerType / button -1). Do not
    // require mouse button 0 for a controller-owned release echo.
    if (touchOrPen(event)) return;
    if (mouse || (event.isTrusted === true && controllerOwnsGesture())) {
      mouse = false;
      consume(event);
      return;
    }
    if (event.isTrusted === true) nativeActivationAt = now();
  });
  listen('pointercancel', (event) => {
    if (!event.pointerType || event.pointerType === 'mouse') mouse = false;
  });
  const reset = () => {
    keys.clear();
    mouse = false;
    controllerHeld = false;
    suppressUntil = -Infinity;
    nativeActivationAt = -Infinity;
    neutralAfterLifecycle = false;
  };
  doc.defaultView?.addEventListener?.('blur', reset);
  listen('visibilitychange', reset);
  return {
    observe(pressed) {
      if (neutralAfterLifecycle) {
        if (pressed) {
          controllerHeld = true;
          suppressUntil = Infinity;
        } else {
          controllerHeld = false;
          neutralAfterLifecycle = false;
          suppressUntil = -Infinity;
        }
        return;
      }
      if (pressed) {
        controllerHeld = true;
        suppressUntil = Infinity;
      } else if (controllerHeld) {
        controllerHeld = false;
        suppressUntil = now() + echoWindowMs;
      }
    },
    requireNeutral() {
      keys.clear();
      mouse = false;
      controllerHeld = false;
      suppressUntil = Infinity;
      neutralAfterLifecycle = true;
    },
    destroy() {
      reset();
      listeners.forEach((remove) => remove());
      doc.defaultView?.removeEventListener?.('blur', reset);
    },
  };
}
