/** Require a release before an activation that was already held across a UI
 * boundary can reach the newly focused action. Fresh keyboard, pointer and
 * controller activations remain independent.
 */
export function attachFreshActivationGuard({ document: doc = globalThis.document } = {}) {
  const physicalKeys = new Set(),
    blockedKeys = new Set(),
    physicalPointers = new Set(),
    blockedPointers = new Set(),
    listeners = [];
  let staleClick = false,
    programmaticDepth = 0;
  const listen = (type, callback) => {
    doc.addEventListener(type, callback, { capture: true });
    listeners.push(() => doc.removeEventListener(type, callback, { capture: true }));
  };
  const consume = (event) => {
    event.preventDefault();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    else event.stopPropagation?.();
  };
  const confirmKey = (event) =>
    ['Enter', ' '].includes(event.key) &&
    !event.ctrlKey &&
    !event.altKey &&
    !event.metaKey &&
    !event.shiftKey;
  const keyId = (event) => event.code || event.key;
  const primaryPointer = (event) =>
    (event.button == null || event.button === 0) && event.isPrimary !== false;
  const pointerId = (event) =>
    Number.isInteger(event.pointerId) && event.pointerId >= 0 ? event.pointerId : 'primary';

  listen('keydown', (event) => {
    if (!confirmKey(event)) return;
    const id = keyId(event),
      fresh = !event.repeat && !physicalKeys.has(id);
    physicalKeys.add(id);
    if (blockedKeys.has(id) || !fresh) {
      staleClick = true;
      consume(event);
      return;
    }
    staleClick = false;
  });
  listen('keyup', (event) => {
    if (!confirmKey(event)) return;
    const id = keyId(event),
      blocked = blockedKeys.delete(id);
    physicalKeys.delete(id);
    if (blocked) {
      staleClick = true;
      consume(event);
    }
  });
  listen('pointerdown', (event) => {
    if (!primaryPointer(event)) return;
    const id = pointerId(event);
    physicalPointers.add(id);
    if (blockedPointers.has(id)) consume(event);
    else staleClick = false;
  });
  listen('pointerup', (event) => {
    if (!primaryPointer(event)) return;
    const id = pointerId(event),
      blocked = blockedPointers.delete(id);
    physicalPointers.delete(id);
    if (blocked) {
      staleClick = true;
      consume(event);
    }
  });
  listen('pointercancel', (event) => {
    const id = pointerId(event),
      blocked = blockedPointers.delete(id);
    physicalPointers.delete(id);
    if (blocked) consume(event);
  });
  listen('click', (event) => {
    if (programmaticDepth || !staleClick) return;
    staleClick = false;
    consume(event);
  });

  return {
    requireFresh() {
      for (const key of physicalKeys) blockedKeys.add(key);
      for (const pointer of physicalPointers) blockedPointers.add(pointer);
    },
    programmatic(callback) {
      programmaticDepth++;
      try {
        return callback();
      } finally {
        programmaticDepth--;
      }
    },
    destroy() {
      physicalKeys.clear();
      blockedKeys.clear();
      physicalPointers.clear();
      blockedPointers.clear();
      staleClick = false;
      programmaticDepth = 0;
      listeners.forEach((remove) => remove());
    },
  };
}
