import { neutralFlightInput } from './radio-profile.mjs';

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyS',
  'KeyA',
  'KeyD',
  'KeyQ',
  'KeyE',
  'ArrowUp',
  'ArrowDown',
  'ShiftLeft',
  'ShiftRight',
]);
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const editable = (target) =>
  ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target?.tagName) ||
  target?.isContentEditable;

/** One active owner. Throttle is a position, not an automatic altitude command.
 * Losing ownership releases all local controls; radio pickup is owned by its adapter. */
export function createFlightInput({ window: win, document: doc, onPause = () => {} }) {
  let owner = 'keyboard',
    enabled = false,
    throttle = 0,
    disposed = false;
  const keys = new Set(),
    touch = neutralFlightInput(),
    listeners = [],
    releases = [];
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const clear = () => {
    keys.clear();
    throttle = 0;
    Object.assign(touch, neutralFlightInput());
    for (const release of releases) release();
  };
  listen(win, 'keydown', (event) => {
    if (disposed || (event.repeat && event.code === 'KeyP') || editable(event.target)) return;
    if (event.code === 'KeyP' || event.code === 'Escape') {
      event.preventDefault();
      onPause('paused');
      return;
    }
    if (owner !== 'keyboard' || !enabled || !MOVE_KEYS.has(event.code)) return;
    event.preventDefault();
    keys.add(event.code);
  });
  listen(win, 'keyup', (event) => {
    keys.delete(event.code);
  });
  const lose = () => {
    clear();
    enabled = false;
    onPause('focus-lost');
  };
  listen(win, 'blur', lose);
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden || doc.visibilityState === 'hidden') lose();
  });
  return {
    clear,
    select(value) {
      if (!['keyboard', 'touch', 'radio'].includes(value))
        throw new TypeError('Unknown input source');
      clear();
      enabled = false;
      owner = value;
    },
    enable(value) {
      enabled = !!value;
      if (!enabled) clear();
    },
    owner: () => owner,
    throttle(value) {
      if (owner === 'touch' && enabled && Number.isFinite(value))
        touch.throttle = clamp(value, 0, 1);
    },
    sample(seconds) {
      if (disposed || !enabled || owner === 'radio') return neutralFlightInput();
      if (owner === 'touch') return { ...touch };
      const fine = keys.has('ShiftLeft') || keys.has('ShiftRight'),
        gain = fine ? 0.18 : 0.5;
      throttle = clamp(
        throttle +
          (Number(keys.has('ArrowUp')) - Number(keys.has('ArrowDown'))) *
            (fine ? 0.1 : 0.35) *
            clamp(seconds, 0, 0.05),
        0,
        1,
      );
      return {
        roll: (Number(keys.has('KeyD')) - Number(keys.has('KeyA'))) * gain,
        pitch: (Number(keys.has('KeyW')) - Number(keys.has('KeyS'))) * gain,
        yaw: (Number(keys.has('KeyE')) - Number(keys.has('KeyQ'))) * gain,
        throttle,
      };
    },
    bindStick(element, side) {
      let pointer = null;
      const release = () => {
        const previous = pointer;
        pointer = null;
        if (previous !== null) {
          try {
            element.releasePointerCapture(previous);
          } catch {
            /* already released */
          }
        }
        if (side === 'left') touch.yaw = 0;
        else {
          touch.roll = 0;
          touch.pitch = 0;
        }
      };
      releases.push(release);
      const move = (event) => {
        if (pointer !== event.pointerId || owner !== 'touch' || !enabled) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        const x = clamp(((event.clientX - rect.left) / rect.width) * 2 - 1, -1, 1),
          y = clamp(1 - ((event.clientY - rect.top) / rect.height) * 2, -1, 1);
        if (side === 'left') {
          touch.yaw = x;
          touch.throttle = (y + 1) / 2;
        } else {
          touch.roll = x;
          touch.pitch = y;
        }
        event.preventDefault();
      };
      listen(element, 'pointerdown', (event) => {
        if (owner !== 'touch' || !enabled || pointer !== null) return;
        pointer = event.pointerId;
        element.setPointerCapture(pointer);
        move(event);
      });
      listen(element, 'pointermove', move);
      listen(element, 'pointerup', (event) => {
        if (event.pointerId === pointer) release();
      });
      for (const type of ['pointercancel', 'lostpointercapture'])
        listen(element, type, (event) => {
          if (event.pointerId !== pointer) return;
          release();
          clear();
          enabled = false;
          onPause('input-lost');
        });
    },
    dispose() {
      disposed = true;
      clear();
      for (const remove of listeners) remove();
    },
  };
}
