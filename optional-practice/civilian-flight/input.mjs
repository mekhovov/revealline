import { keyCodeForEvent } from '../../game/key-bindings.mjs';
import { neutralPracticeInput, PRACTICE_CONTROLS } from './model.mjs';

const keys = {
  KeyW: ['pitch', 1],
  ArrowUp: ['pitch', 1],
  KeyS: ['pitch', -1],
  ArrowDown: ['pitch', -1],
  KeyA: ['roll', -1],
  ArrowLeft: ['roll', -1],
  KeyD: ['roll', 1],
  ArrowRight: ['roll', 1],
  KeyQ: ['yaw', -1],
  KeyE: ['yaw', 1],
  KeyR: ['throttle', 1],
  KeyF: ['throttle', -1],
};
export function attachPracticeInput({
  document: doc,
  window: win,
  arena,
  buttons = [],
  active,
  onPause,
  onStatus = () => {},
}) {
  const physical = new Set(),
    owned = new Map(),
    pointers = new Map(),
    nudges = [],
    listeners = [];
  let padIndex = null,
    padReady = false,
    disposed = false;
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  };
  const clear = () => {
    owned.clear();
    nudges.length = 0;
    for (const [pointerId, item] of pointers) {
      try {
        item.button.releasePointerCapture?.(pointerId);
      } catch {
        /* already released */
      }
    }
    pointers.clear();
    padReady = false;
    for (const button of buttons) button.setAttribute('aria-pressed', 'false');
  };
  const pause = () => {
    clear();
    onPause();
  };
  listen(win, 'keydown', (event) => {
    const code = keyCodeForEvent(event),
      fresh = !event.repeat && !physical.has(code);
    physical.add(code);
    if (
      disposed ||
      !active() ||
      doc.activeElement !== arena ||
      event.ctrlKey ||
      event.altKey ||
      event.metaKey
    )
      return;
    if (code === 'Escape' || code === 'Space') {
      event.preventDefault();
      pause();
      return;
    }
    if (keys[code]) {
      event.preventDefault();
      if (fresh) owned.set(code, keys[code]);
    }
  });
  listen(win, 'keyup', (event) => {
    const code = keyCodeForEvent(event);
    physical.delete(code);
    owned.delete(code);
  });
  for (const button of buttons) {
    const axis = button.dataset.axis,
      direction = Number(button.dataset.direction);
    if (!PRACTICE_CONTROLS.includes(axis) || ![-1, 1].includes(direction)) continue;
    listen(button, 'pointerdown', (event) => {
      if (!active() || disposed || (event.button !== undefined && event.button !== 0)) return;
      event.preventDefault();
      arena.focus({ preventScroll: true });
      pointers.set(event.pointerId, { button, axis, direction });
      button.setPointerCapture?.(event.pointerId);
      button.setAttribute('aria-pressed', 'true');
    });
    const release = (event) => {
      if (pointers.get(event.pointerId)?.button === button) pointers.delete(event.pointerId);
      button.setAttribute('aria-pressed', 'false');
    };
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'])
      listen(button, type, release);
    listen(button, 'click', (event) => {
      if (event.detail === 0 && active() && !disposed) nudges.push([axis, direction]);
    });
  }
  listen(doc, 'focusin', (event) => {
    if (!active() || event.target === arena) return;
    if (buttons.includes(event.target)) clear();
    else pause();
  });
  listen(win, 'blur', () => {
    physical.clear();
    pause();
  });
  listen(win, 'pagehide', pause);
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) pause();
  });
  listen(win, 'gamepaddisconnected', (event) => {
    if (event.gamepad?.index === padIndex) {
      padIndex = null;
      pause();
      onStatus('disconnected');
    }
  });
  return {
    clear,
    connect() {
      clear();
      let pads;
      try {
        pads = [...(win.navigator?.getGamepads?.() ?? [])];
      } catch {
        pads = [];
      }
      const pad = pads.find(
        (item) => item?.connected && item.mapping === 'standard' && item.axes?.length >= 4,
      );
      padIndex = pad?.index ?? null;
      onStatus(pad ? 'center' : 'unavailable');
      return !!pad;
    },
    sample() {
      const result = neutralPracticeInput();
      if (disposed || !active()) return result;
      for (const [axis, value] of owned.values()) result[axis] += value;
      for (const [axis, value] of nudges.splice(0)) result[axis] += value;
      for (const item of pointers.values()) result[item.axis] += item.direction;
      if (padIndex !== null) {
        let pad;
        try {
          pad = win.navigator?.getGamepads?.()?.[padIndex];
        } catch {
          /* capability fallback */
        }
        if (!pad?.connected || pad.mapping !== 'standard') {
          padIndex = null;
          pause();
          onStatus('disconnected');
          return neutralPracticeInput();
        }
        const axes = pad.axes
          .slice(0, 4)
          .map((value) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0));
        if (!padReady) {
          if (
            axes.every((value) => Math.abs(value) < 0.15) &&
            !pad.buttons?.some((button) => button.pressed)
          ) {
            padReady = true;
            onStatus('ready');
          }
          return result;
        }
        if (pad.buttons?.[9]?.pressed || pad.buttons?.[1]?.pressed) {
          pause();
          return neutralPracticeInput();
        }
        const axis = (index) => (Math.abs(axes[index]) < 0.15 ? 0 : axes[index]);
        result.yaw += axis(0);
        result.throttle -= axis(1);
        result.roll += axis(2);
        result.pitch -= axis(3);
      }
      return Object.fromEntries(
        PRACTICE_CONTROLS.map((axis) => [axis, Math.max(-1, Math.min(1, result[axis]))]),
      );
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clear();
      physical.clear();
      listeners.forEach((remove) => remove());
    },
  };
}
