/** Steam Input can expose one press as both a gamepad button and a native
 * Enter/Space or mouse click. Let the gamepad own that gesture, including its
 * release after a menu transition. Touch and standalone native input stay native.
 */
export function attachControllerConfirmGuard({
  document: doc = globalThis.document,
  confirmPressed,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  echoWindowMs = 1250,
} = {}) {
  const keys = new Set(),
    listeners = [];
  let mouse = false,
    suppressUntil = -Infinity;
  const listen = (type, callback) => {
    doc.addEventListener(type, callback, { capture: true });
    listeners.push(() => doc.removeEventListener(type, callback, { capture: true }));
  };
  const consume = (event) => {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    else event.stopPropagation?.();
  };
  const controllerOwnsGesture = () => confirmPressed() || now() <= suppressUntil;
  const isMouse = (event) =>
    event.button === 0 &&
    (!event.pointerType || event.pointerType === 'mouse') &&
    !event.sourceCapabilities?.firesTouchEvents;
  const consumeConfirmKey = (event) => {
    if (
      !['Enter', ' '].includes(event.key) ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey ||
      event.shiftKey
    )
      return;
    if (!keys.has(event.key) && !controllerOwnsGesture()) return;
    keys.add(event.key);
    consume(event);
  };
  listen('keydown', consumeConfirmKey);
  listen('keypress', consumeConfirmKey);
  listen('keyup', (event) => {
    if (keys.delete(event.key)) consume(event);
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
    if (!isMouse(event)) return;
    // HTMLElement.click() is untrusted in browsers and is the controller
    // adapter's intended activation. Steam/Chrome can separately emit a
    // trusted detail:0 click without pointer events; consume that echo too.
    const programmatic =
      event.isTrusted === false || (event.isTrusted == null && event.detail === 0);
    if (programmatic) return;
    if (!mouse && !(event.isTrusted === true && controllerOwnsGesture())) return;
    mouse = false;
    consume(event);
  });
  listen('pointercancel', (event) => {
    if (!event.pointerType || event.pointerType === 'mouse') mouse = false;
  });
  const reset = () => {
    keys.clear();
    mouse = false;
    suppressUntil = -Infinity;
  };
  doc.defaultView?.addEventListener?.('blur', reset);
  listen('visibilitychange', reset);
  return {
    observe(pressed) {
      if (pressed) suppressUntil = Math.max(suppressUntil, now() + echoWindowMs);
    },
    destroy() {
      reset();
      listeners.forEach((remove) => remove());
      doc.defaultView?.removeEventListener?.('blur', reset);
    },
  };
}
