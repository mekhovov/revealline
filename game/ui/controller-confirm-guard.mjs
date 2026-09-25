/** Steam Input can expose one press as both a gamepad button and a native
 * Enter/Space or primary-pointer click. Let the gamepad own that gesture,
 * including its release after a menu transition. Standalone native input stays
 * native when no controller Confirm lifecycle owns it.
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
  let primaryPointer = null,
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
  const isPrimaryActivation = (event) =>
    (event.button == null || event.button === 0) && event.isPrimary !== false;
  const isDirectTouch = (event) =>
    ['touch', 'pen'].includes(event.pointerType) && !event.sourceCapabilities?.firesTouchEvents;
  const pointerId = (event) =>
    Number.isInteger(event.pointerId) && event.pointerId >= 0 ? event.pointerId : null;
  const hasActivePointer = () => {
    if (primaryPointer !== null && now() > primaryPointer.expiresAt) primaryPointer = null;
    return primaryPointer !== null;
  };
  const ownsPointer = (event) =>
    hasActivePointer() &&
    (primaryPointer.id === null ||
      pointerId(event) === null ||
      primaryPointer.id === pointerId(event));
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
    if (!isPrimaryActivation(event)) return;
    // A real touchscreen/pen gesture that starts after A is physically up owns
    // the new interaction. Steam's compatibility stream remains guarded: it
    // identifies itself through firesTouchEvents (and is normally mouse-like).
    if (isDirectTouch(event) && !neutralAfterLifecycle && !controllerHeld && !confirmPressed()) {
      primaryPointer = null;
      suppressUntil = -Infinity;
      return;
    }
    if (!controllerOwnsGesture()) {
      primaryPointer = null;
      return;
    }
    primaryPointer = { id: pointerId(event), expiresAt: Infinity };
    consume(event);
  });
  listen('pointerup', (event) => {
    if (!isPrimaryActivation(event) || (!ownsPointer(event) && !controllerOwnsGesture())) return;
    primaryPointer = { id: pointerId(event), expiresAt: now() + echoWindowMs };
    consume(event);
  });
  for (const type of ['mousedown', 'mouseup'])
    listen(type, (event) => {
      if (isPrimaryActivation(event) && (hasActivePointer() || controllerOwnsGesture()))
        consume(event);
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
    // A trusted release can be mouse, touch, pen, touch-derived compatibility
    // input, or a keyboard/accessibility PointerEvent with no pointer. Steam's
    // duplicate must not escape merely because Chrome classifies its source as
    // touch-capable.
    if (event.isTrusted === true && (hasActivePointer() || controllerOwnsGesture())) {
      primaryPointer = null;
      consume(event);
      return;
    }
    if (event.isTrusted === true) nativeActivationAt = now();
  });
  listen('pointercancel', (event) => {
    if (!ownsPointer(event)) return;
    primaryPointer = null;
    consume(event);
  });
  const reset = () => {
    keys.clear();
    primaryPointer = null;
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
        if (primaryPointer !== null) primaryPointer.expiresAt = suppressUntil;
      }
    },
    requireNeutral() {
      keys.clear();
      primaryPointer = null;
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
