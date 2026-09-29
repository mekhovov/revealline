/** Editor surfaces call their existing domain commands. No keyboard events are
 * synthesized and registration never mutates an editor document. */
const editors = new WeakMap();

export function registerAuthoringEditor(element, adapter, { keyboard = false } = {}) {
  if (!element || typeof adapter?.handle !== 'function')
    throw new TypeError('An editor element and command adapter are required.');
  const previous = {
    tabIndex: element.tabIndex,
    marker: element.getAttribute('data-controller-editor'),
  };
  element.tabIndex = 0;
  element.setAttribute('data-controller-editor', 'true');
  editors.set(element, adapter);
  let keyboardActive = false;
  const release = () => {
    if (keyboardActive) adapter.exit({ commit: false });
    keyboardActive = false;
  };
  const keydown = (event) => {
    const direction = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[
      event.key
    ];
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      (!direction && !['Enter', ' ', 'Escape'].includes(event.key))
    )
      return;
    event.preventDefault();
    if (!keyboardActive) {
      if (adapter.enter() === false) return;
      keyboardActive = true;
    }
    const result = adapter.handle(
      direction ? { direction } : event.key === 'Escape' ? { back: true } : { confirm: true },
    );
    if (result === 'done' || result === 'cancel') release();
  };
  if (keyboard) {
    element.addEventListener('keydown', keydown);
    element.addEventListener('blur', release);
  }
  return () => {
    if (editors.get(element) !== adapter) return;
    editors.delete(element);
    release();
    element.removeEventListener('keydown', keydown);
    element.removeEventListener('blur', release);
    element.tabIndex = previous.tabIndex;
    if (previous.marker === null) element.removeAttribute('data-controller-editor');
    else element.setAttribute('data-controller-editor', previous.marker);
  };
}

export const resolveAuthoringEditor = (element) => editors.get(element) ?? null;

/** Arrow movement is bounded by the current map, including after a resize.
 * Confirm commits one operation; Back first cancels an unfinished anchor. */
export function createGridEditorAdapter({
  element,
  available = () => true,
  dimensions,
  position,
  move,
  apply,
  cancel = () => false,
  changed = () => {},
}) {
  let active = false,
    marker = null;
  const vectors = { left: [-1, 0], right: [1, 0], up: [0, -1], down: [0, 1] };
  const showCursor = () => {
    if (!active || !marker) return;
    const [x, y] = position(),
      [width, height] = dimensions(),
      box = element.getBoundingClientRect();
    marker.style.cssText = `position:fixed;pointer-events:none;z-index:100;box-sizing:border-box;border:2px solid #ffe077;box-shadow:0 0 0 1px #00121f;left:${box.left + (x * box.width) / width}px;top:${box.top + (y * box.height) / height}px;width:${box.width / width}px;height:${box.height / height}px;`;
  };
  return {
    enter() {
      if (!available()) return false;
      if (active) return true;
      active = true;
      element.focus();
      if (element.ownerDocument?.createElement && element.parentNode) {
        marker = element.ownerDocument.createElement('span');
        marker.setAttribute('aria-hidden', 'true');
        element.parentNode.append(marker);
        element.ownerDocument.addEventListener('scroll', showCursor, true);
        element.ownerDocument.defaultView?.addEventListener?.('resize', showCursor);
      }
      changed();
      showCursor();
      return true;
    },
    isCurrent: () => active && available() && element.isConnected,
    focus: () => element.focus(),
    handle(command) {
      if (command.back || command.menu) return cancel() ? undefined : 'cancel';
      if (command.confirm || command.confirmCommit) apply();
      else if (vectors[command.direction]) {
        const [dx, dy] = vectors[command.direction],
          [x, y] = position(),
          [width, height] = dimensions();
        move([Math.max(0, Math.min(width - 1, x + dx)), Math.max(0, Math.min(height - 1, y + dy))]);
      }
      changed();
      showCursor();
    },
    exit() {
      active = false;
      cancel();
      element.ownerDocument?.removeEventListener('scroll', showCursor, true);
      element.ownerDocument?.defaultView?.removeEventListener?.('resize', showCursor);
      marker?.remove();
      marker = null;
      changed();
    },
  };
}
