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
  ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
const textEntry = (target) =>
  target?.isContentEditable ||
  target?.tagName === 'TEXTAREA' ||
  (target?.tagName === 'INPUT' &&
    !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type));

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
    if (disposed || event.defaultPrevented || event.isComposing) return;
    if (event.code === 'KeyP' || event.code === 'Escape') {
      // Pause belongs to every movement source, even while a camera/menu control
      // has focus. Text entry and native dialog dismissal keep their own keys.
      if (
        event.repeat ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        textEntry(event.target) ||
        doc.querySelector?.('dialog[open]')
      )
        return;
      event.preventDefault();
      enabled = false;
      clear();
      onPause('paused');
      return;
    }
    // Cosmetic HUD buttons can retain focus during an active flight. They are
    // not text editors; the host's enabled ownership still excludes all menus.
    if (editable(event.target)) return;
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

/** DOM-only menu adapter, following the main game's focus/edit/confirm contract.
 * The host supplies its existing frame samples and an exclusive menu context.
 * Return null during flight or the live stick/control explorer. A menu context
 * can set blockRadio for setup, or blockDevices during raw-channel capture,
 * keeping ordinary keyboard navigation available in either case. Radio
 * controls must be a verified, calibrated preview; raw USB axes are not mappings.
 * Roll/pitch navigate; hold yaw right/left for 650 ms then centre to confirm/back.
 * The first Confirm joins only. Throttle, arm, reset and fire are never read.
 * OS pickers/text entry still require native keyboard or pointer interaction. */
export function createFlightMenuNavigation({
  window: win = globalThis.window,
  document: doc = globalThis.document,
  getContext = () => null,
  onBack = () => {},
  onHint = () => {},
  locale = () => 'en',
} = {}) {
  const selector = 'button,a[href],select,input:not([type="hidden"]),textarea,summary';
  const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' };
  const listeners = [],
    sources = new Map(),
    heldKeys = new Set(),
    blockedKeys = new Set();
  let context = null,
    joined = null,
    editing = null,
    marked = null,
    disposed = false,
    lastTime = null;
  const text = (en, uk) => (locale() === 'uk' ? uk : en);
  const hint = (en, uk) => onHint(text(en, uk));
  const listen = (node, type, fn) => {
    node.addEventListener(type, fn, true);
    listeners.push(() => node.removeEventListener(type, fn, true));
  };
  const available = (element) => {
    if (
      !element?.isConnected ||
      element.disabled ||
      element.matches?.(':disabled') ||
      element.getAttribute('aria-disabled') === 'true' ||
      element.closest('[hidden],[inert],[aria-hidden="true"]') ||
      !element.getClientRects().length
    )
      return false;
    for (let node = element; node; node = node.parentElement) {
      if (node.tagName === 'DIALOG' && !node.open) return false;
      if (
        node.tagName === 'DETAILS' &&
        !node.open &&
        !node.querySelector('summary')?.contains(element)
      )
        return false;
      const style = win.getComputedStyle(node);
      if (style.visibility === 'hidden' || style.display === 'none') return false;
    }
    return true;
  };
  const controls = () => [...(context?.root?.querySelectorAll(selector) ?? [])].filter(available);
  function cancelEdit() {
    if (!editing) return;
    editing.element.value = editing.value;
    delete editing.element.dataset.fpvMenuEditing;
    editing = null;
  }
  function reset({ leaveDevice = false } = {}) {
    cancelEdit();
    sources.clear();
    if (leaveDevice) joined = null;
    if (marked) delete marked.dataset.fpvMenuFocus;
    marked = null;
    lastTime = null;
  }
  function sync() {
    const next = !disposed && !doc.hidden && doc.hasFocus?.() !== false ? getContext() : null;
    if (
      next?.root !== context?.root ||
      next?.key !== context?.key ||
      next?.blockRadio !== context?.blockRadio ||
      next?.blockDevices !== context?.blockDevices
    ) {
      reset();
      for (const key of heldKeys) blockedKeys.add(key);
      context = next?.root ? next : null;
      if (context)
        hint(
          context.blockDevices
            ? 'Keyboard: Tab/arrows, Enter to select, Esc to go back. Device menus are paused during control capture.'
            : context.blockRadio
              ? 'Keyboard: Tab/arrows, Enter, Esc. Controller: release, then press/release A to connect; D-pad/stick moves, A confirms, B goes back. Radio sticks belong to setup here.'
              : 'Tab/arrows move; Enter selects; Esc goes back. Controller: release, then press/release A to connect. Calibrated radio: hold yaw right for 0.7 s, then centre to connect; roll/pitch move, hold yaw right/left then centre to confirm/go back.',
          context.blockDevices
            ? 'Клавіатура: Tab/стрілки, Enter — вибір, Esc — назад. Меню пристроїв призупинено під час запису керування.'
            : context.blockRadio
              ? 'Клавіатура: Tab/стрілки, Enter, Esc. Геймпад: відпустіть, натисніть і відпустіть A; хрестовина/стік — вибір, A — підтвердити, B — назад. Стіки пульта тут належать налаштуванню.'
              : 'Tab/стрілки — вибір; Enter — підтвердити; Esc — назад. Геймпад: відпустіть, натисніть і відпустіть A. Пульт: утримайте рискання праворуч 0,7 с й поверніть у центр для підключення; крен/тангаж — вибір, утримання рискання праворуч/ліворуч і центр — підтвердити/назад.',
        );
      else onHint('');
    }
    if (editing && (!available(editing.element) || !context?.root.contains(editing.element)))
      cancelEdit();
    return !!context;
  }
  function focus(element) {
    if (marked && marked !== element) delete marked.dataset.fpvMenuFocus;
    marked = element;
    element.dataset.fpvMenuFocus = '';
    element.focus({ preventScroll: true });
    element.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  function command(action) {
    if (!sync()) return;
    if (action === 'back') {
      if (editing) {
        cancelEdit();
        hint('Change cancelled.', 'Зміну скасовано.');
      } else onBack(context);
      return;
    }
    const items = controls();
    if (!items.length) return;
    const current = items.includes(doc.activeElement) ? doc.activeElement : null;
    if (!current) {
      focus(items[0]);
      // A first gesture finds focus; it cannot activate an arbitrary fallback.
      return;
    }
    if (editing) {
      const element = editing.element;
      if (element !== current) {
        cancelEdit();
        return;
      }
      if (action === 'confirm') {
        const changed = element.value !== editing.value;
        delete element.dataset.fpvMenuEditing;
        editing = null;
        if (changed) {
          element.dispatchEvent(new win.Event('input', { bubbles: true }));
          element.dispatchEvent(new win.Event('change', { bubbles: true }));
        }
        hint('Change applied.', 'Зміну застосовано.');
      } else {
        const direction = ['right', 'down'].includes(action) ? 1 : -1;
        if (element.tagName === 'SELECT') {
          const options = [...element.options].filter(
            (option) =>
              !option.disabled &&
              !(option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled),
          );
          const index = options.indexOf(element.selectedOptions[0]);
          const option = options[clamp(index + direction, 0, options.length - 1)];
          if (option) element.value = option.value;
        } else {
          const minimum = element.min === '' ? 0 : Number(element.min);
          const maximum = element.max === '' ? 100 : Number(element.max);
          const step =
            !element.step || element.step === 'any'
              ? (maximum - minimum) / 100
              : Number(element.step);
          element.value = String(clamp(Number(element.value) + direction * step, minimum, maximum));
        }
      }
      return;
    }
    if (action === 'confirm') {
      if (
        current.tagName === 'SELECT' ||
        (current.tagName === 'INPUT' && current.type === 'range')
      ) {
        editing = { element: current, value: current.value };
        current.dataset.fpvMenuEditing = '';
        hint(
          'Directions change the value. Confirm applies; Back cancels.',
          'Напрямки змінюють значення. Підтвердьте для застосування; Назад — скасування.',
        );
      } else if (textEntry(current) || current.type === 'file') {
        hint(
          'Use the keyboard or touch to enter text or choose a file.',
          'Введіть текст або виберіть файл клавіатурою чи дотиком.',
        );
      } else current.click();
      return;
    }
    const rect = current.getBoundingClientRect(),
      horizontal = ['left', 'right'].includes(action);
    const sign = ['right', 'down'].includes(action) ? 1 : -1;
    const candidates = items
      .filter((item) => item !== current)
      .map((item) => {
        const bounds = item.getBoundingClientRect();
        const dx = bounds.left + bounds.width / 2 - rect.left - rect.width / 2;
        const dy = bounds.top + bounds.height / 2 - rect.top - rect.height / 2;
        const forward = (horizontal ? dx : dy) * sign;
        const cross = horizontal
          ? Math.max(0, bounds.top - rect.bottom, rect.top - bounds.bottom)
          : Math.max(0, bounds.left - rect.right, rect.left - bounds.right);
        return { item, forward, score: forward + cross * 3 };
      })
      .filter((item) => item.forward > 1)
      .sort((a, b) => a.score - b.score);
    const next = candidates[0]?.item ?? items[items.indexOf(current) + sign];
    if (next) focus(next);
  }
  function sample(source, now) {
    let state = sources.get(source.key);
    if (!state) {
      state = {
        ready: false,
        pending: null,
        since: 0,
        qualified: false,
        heldAt: 0,
        direction: null,
        repeatAt: 0,
      };
      sources.set(source.key, state);
    }
    if (!state.ready) {
      if (source.neutral) state.ready = true;
      return;
    }
    if (source.action) {
      state.direction = null;
      if (state.pending && state.pending !== source.action) {
        state.pending = null;
        state.ready = false;
        return;
      }
      if (state.pending !== source.action) {
        state.pending = source.action;
        state.since = now;
      }
      state.qualified = now - state.since >= source.hold;
      state.heldAt = now;
      return;
    }
    if (state.pending) {
      const action = state.pending;
      // A physical stick crosses intermediate positions on its way to centre.
      // Only time actually held past the action threshold qualifies the gesture.
      if (!source.neutral && source.releasing && now - state.heldAt < 900) return;
      state.pending = null;
      if (!source.neutral || !state.qualified) {
        state.ready = source.neutral;
        return;
      }
      if (joined !== source.key) {
        if (action !== 'confirm') return;
        joined = source.key;
        reset();
        const items = controls();
        if (items.length) focus(items.includes(doc.activeElement) ? doc.activeElement : items[0]);
        hint(
          source.kind === 'radio'
            ? 'Radio menus ready. Roll/pitch move; hold yaw right then centre to confirm, left then centre to go back.'
            : 'Controller menus ready. D-pad moves, A confirms, B goes back. Release between actions.',
          source.kind === 'radio'
            ? 'Меню пульта готове. Крен/тангаж — вибір; утримайте рискання праворуч і поверніть у центр для підтвердження, ліворуч — назад.'
            : 'Меню геймпада готове. Хрестовина — вибір, A — підтвердити, B — назад. Відпускайте між діями.',
        );
        return;
      }
      command(action);
      return;
    }
    if (joined !== source.key) return;
    if (!source.direction) {
      state.direction = null;
      return;
    }
    if (state.direction !== source.direction || now >= state.repeatAt) {
      const fresh = state.direction !== source.direction;
      state.direction = source.direction;
      state.repeatAt = now + (fresh ? 420 : 170);
      command(source.direction);
    }
  }
  const axisDirection = (x, y) =>
    Math.max(Math.abs(x), Math.abs(y)) < 0.65
      ? null
      : Math.abs(x) > Math.abs(y)
        ? x > 0
          ? 'right'
          : 'left'
        : y > 0
          ? 'down'
          : 'up';
  function poll({ now = win.performance.now(), gamepads = [], radio = null } = {}) {
    if (!sync()) return;
    if (lastTime !== null && (now - lastTime > 350 || now < lastTime)) reset();
    lastTime = now;
    const sampled = [];
    for (const pad of context.blockDevices ? [] : Array.from(gamepads ?? [])) {
      if (!pad || pad.connected === false || pad.mapping !== 'standard') continue;
      if (radio?.verified && pad.index === radio.index) continue;
      const pressed = (index) =>
        (typeof pad.buttons[index] === 'number'
          ? pad.buttons[index]
          : (pad.buttons[index]?.value ?? 0)) > 0.5;
      const held = [0, 1, 12, 13, 14, 15].filter(pressed);
      const x = pad.axes[0] ?? 0,
        y = pad.axes[1] ?? 0;
      if (![x, y].every((value) => Number.isFinite(value) && Math.abs(value) <= 1)) continue;
      const centered = Math.abs(x) < 0.25 && Math.abs(y) < 0.25;
      const dpad =
        held.length === 1 ? { 12: 'up', 13: 'down', 14: 'left', 15: 'right' }[held[0]] : null;
      const stick = axisDirection(x, y);
      sampled.push({
        key: `pad:${pad.index}:${pad.id}:${pad.axes.length}:${pad.buttons.length}`,
        kind: 'gamepad',
        hold: 0,
        neutral: !held.length && centered,
        action:
          centered && held.length === 1 && (pressed(0) ? 'confirm' : pressed(1) ? 'back' : null),
        direction: !held.length ? stick : dpad && (centered || stick === dpad) ? dpad : null,
      });
    }
    if (
      !context.blockDevices &&
      !context.blockRadio &&
      radio?.verified &&
      typeof radio.key === 'string' &&
      radio.controls &&
      ['roll', 'pitch', 'yaw'].every(
        (key) => Number.isFinite(radio.controls[key]) && Math.abs(radio.controls[key]) <= 1,
      )
    ) {
      const { roll, pitch, yaw } = radio.controls;
      const centered = Math.abs(roll) < 0.25 && Math.abs(pitch) < 0.25;
      sampled.push({
        key: `radio:${radio.key}`,
        kind: 'radio',
        hold: 650,
        neutral: centered && Math.abs(yaw) < 0.25,
        releasing: centered && Math.abs(yaw) <= 0.75,
        action: centered && Math.abs(yaw) > 0.75 ? (yaw > 0 ? 'confirm' : 'back') : null,
        direction: Math.abs(yaw) < 0.25 ? axisDirection(roll, -pitch) : null,
      });
    }
    const keys = new Set(sampled.map((source) => source.key));
    if (joined && !keys.has(joined)) reset({ leaveDevice: true });
    for (const key of sources.keys()) if (!keys.has(key)) sources.delete(key);
    for (const source of sampled) sample(source, now);
  }
  listen(doc, 'keydown', (event) => {
    const navigates = directions[event.key] || ['Enter', ' ', 'Escape'].includes(event.key);
    const active = sync();
    if (navigates) heldKeys.add(event.key);
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !active
    )
      return;
    if (
      blockedKeys.has(event.key) ||
      (event.repeat && ['Enter', ' '].includes(event.key) && !textEntry(event.target))
    ) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (editing && !directions[event.key] && !['Enter', ' ', 'Escape'].includes(event.key))
      cancelEdit();
    if (editing && ['Enter', ' ', 'Escape', ...Object.keys(directions)].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat)
        command(event.key === 'Escape' ? 'back' : (directions[event.key] ?? 'confirm'));
      return;
    }
    if (textEntry(event.target) || ['SELECT', 'INPUT'].includes(event.target?.tagName)) return;
    if (directions[event.key] || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) command(directions[event.key] ?? 'back');
    }
  });
  listen(doc, 'keyup', (event) => {
    if (blockedKeys.has(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    heldKeys.delete(event.key);
    blockedKeys.delete(event.key);
  });
  listen(doc, 'pointerdown', () => {
    reset();
  });
  const suspend = () => {
    context = null;
    onHint('');
    reset();
    heldKeys.clear();
    blockedKeys.clear();
  };
  listen(win, 'blur', suspend);
  listen(doc, 'visibilitychange', suspend);
  return {
    poll,
    reset,
    snapshot: () => ({
      active: !!context,
      device: joined?.split(':')[0] ?? null,
      editing: editing?.element.id ?? null,
    }),
    dispose() {
      disposed = true;
      context = null;
      onHint('');
      reset({ leaveDevice: true });
      for (const remove of listeners) remove();
    },
  };
}
