import { neutralFlightInput, STICK_LAYOUTS } from './radio-profile.mjs';
import { menuGroupNeighbor } from '../../game/ui/menu-navigation-groups.mjs';

export const KEYBOARD_PRESET_KEY = 'revealline.fpv.keyboard-preset.v1';
const keyboardPresets = Object.freeze({
  'two-stick': Object.freeze({
    id: 'two-stick',
    axes: Object.freeze({
      throttle: Object.freeze(['KeyS', 'KeyW']),
      yaw: Object.freeze(['KeyA', 'KeyD']),
      pitch: Object.freeze(['ArrowDown', 'ArrowUp']),
      roll: Object.freeze(['ArrowLeft', 'ArrowRight']),
    }),
    labels: Object.freeze({ throttle: 'W / S', yaw: 'A / D', pitch: '↑ / ↓', roll: '← / →' }),
    arm: 'Space',
    reset: 'KeyR',
    fire: 'KeyF',
  }),
  classic: Object.freeze({
    id: 'classic',
    axes: Object.freeze({
      throttle: Object.freeze(['ArrowDown', 'ArrowUp']),
      yaw: Object.freeze(['KeyQ', 'KeyE']),
      pitch: Object.freeze(['KeyS', 'KeyW']),
      roll: Object.freeze(['KeyA', 'KeyD']),
    }),
    labels: Object.freeze({ throttle: '↑ / ↓', yaw: 'Q / E', pitch: 'W / S', roll: 'A / D' }),
    arm: null,
    reset: null,
    fire: 'Space',
  }),
});
export const keyboardFlightPreset = (value = 'two-stick') =>
  Object.hasOwn(keyboardPresets, value) ? keyboardPresets[value] : keyboardPresets['two-stick'];
export const keyboardFlightKey = (code, preset) =>
  code === 'ShiftLeft' ||
  code === 'ShiftRight' ||
  Object.values(keyboardFlightPreset(preset).axes).some((pair) => pair.includes(code));

/** Key mapping only. Both flight and the unscored lab use the original gains,
 * retained throttle and fixed-step integration; changing a layout changes no physics. */
export function keyboardFlightValues({ keys, preset, throttle = 0, seconds = 0 }) {
  const axes = keyboardFlightPreset(preset).axes,
    fine = keys.has('ShiftLeft') || keys.has('ShiftRight'),
    gain = fine ? 0.18 : 0.5,
    axis = (name) => Number(keys.has(axes[name][1])) - Number(keys.has(axes[name][0]));
  return {
    roll: axis('roll') * gain,
    pitch: axis('pitch') * gain,
    yaw: axis('yaw') * gain,
    throttle: clamp(
      throttle +
        axis('throttle') *
          (fine ? 0.1 : 0.35) *
          clamp(Number.isFinite(seconds) ? seconds : 0, 0, 0.05),
      0,
      1,
    ),
  };
}
export function keyboardFlightHelp(preset, locale = 'en', { actions = true, combat = false } = {}) {
  const p = keyboardFlightPreset(preset),
    uk = locale === 'uk',
    text = `${p.labels.throttle} ${uk ? 'газ' : 'throttle'} · ${p.labels.yaw} ${uk ? 'поворот' : 'yaw'} · ${p.labels.pitch} ${uk ? 'нахил уперед/назад' : 'pitch forward/back'} · ${p.labels.roll} ${uk ? 'крен' : 'roll'} · Shift ${uk ? 'точніше' : 'fine control'}`;
  return `${text}${actions ? (p.arm ? (uk ? ' · Пробіл — увімкнути / пауза · R — почати заново · Esc / P — меню' : ' · Space arm / pause · R reset · Esc / P menu') : uk ? ' · Esc / P — пауза' : ' · Esc / P pause') : ''}${combat ? ` · ${p.fire === 'Space' ? (uk ? 'Пробіл' : 'Space') : 'F'} ${uk ? 'вогонь · C зброя · L перезарядка · G заряд · H підрив' : 'fire · C weapon · L reload · G payload · H detonate'}` : ''}`;
}
const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
const editable = (target) =>
  ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName) || target?.isContentEditable;
const textEntry = (target) =>
  target?.isContentEditable ||
  target?.tagName === 'TEXTAREA' ||
  (target?.tagName === 'INPUT' &&
    !['range', 'checkbox', 'radio', 'button', 'submit', 'reset'].includes(target.type));

/** Retain the controls belonging to a committed flight step, not menu input or
 * a rejected worker proposal. Opening an editor must not mix two input owners. */
export function createFlightInputDiagnostics({
  now = () => globalThis.performance?.now?.() ?? 0,
} = {}) {
  const samples = new WeakMap();
  return {
    record(flight, source, controls, diagnostic, state = flight.snapshot()) {
      samples.set(flight, {
        source,
        at: diagnostic?.sampledAtMs ?? now(),
        diagnostic: structuredClone(diagnostic ?? {}),
        calibrated: { ...controls },
        tick: state.ticks,
        achieved: state.angular
          ? Object.fromEntries(
              Object.entries(state.angular).map(([axis, value]) => [axis, value / 100]),
            )
          : null,
      });
    },
    read(flight, source, preview = null) {
      const last = flight ? samples.get(flight) : null;
      const sample = last?.source === source ? last : null;
      const diagnostic = preview ?? sample?.diagnostic;
      return structuredClone({
        source,
        context: preview?.calibrated
          ? 'live-preview'
          : !preview && sample
            ? 'last-flight-sample'
            : 'unavailable',
        raw: diagnostic?.raw ?? null,
        ...(preview?.mapping
          ? {
              mapping: preview.mapping,
              throttleRate: preview.throttleRate,
              throttleRateLabel: preview.throttleRateLabel,
              throttleRateUnits: preview.throttleRateUnits,
            }
          : {}),
        calibrated: preview ? preview.calibrated : (sample?.calibrated ?? null),
        sampleAgeMs:
          diagnostic?.sampleAgeMs == null
            ? null
            : diagnostic.sampleAgeMs + (preview ? 0 : Math.max(0, now() - sample.at)),
        cadenceHz: diagnostic?.cadenceHz ?? null,
        achieved: sample?.achieved ?? null,
        flightTick: sample?.tick ?? null,
      });
    },
  };
}

/** Spatial response only: no smoothing queue or additional input latency.
 * A new thumb contact starts at neutral rotation and the retained throttle.
 * The actual applied command (not finger position) belongs in the stick HUD. */
export function touchStickValues({ side, dx, dy, travel, throttle = 0, response = 'precise' }) {
  if (!['left', 'right'].includes(side) || !Number.isFinite(travel) || travel <= 0)
    throw new TypeError('Invalid touch stick geometry');
  const axis = (distance) => {
    const value = clamp(Number.isFinite(distance) ? distance / travel : 0, -1, 1);
    if (response === 'direct') return value;
    const magnitude = Math.max(0, (Math.abs(value) - 0.03) / 0.97);
    return Math.sign(value) * (0.35 * magnitude + 0.65 * magnitude ** 3);
  };
  return side === 'left'
    ? { yaw: axis(dx), throttle: clamp(throttle + dy / (travel * 2), 0, 1) }
    : { roll: axis(dx), pitch: axis(dy) };
}

/** One active owner. Throttle is a position, not an automatic altitude command.
 * Losing ownership releases all local controls; radio pickup is owned by its adapter. */
export function createFlightInput({ window: win, document: doc, onPause = () => {} }) {
  let owner = 'keyboard',
    enabled = false,
    throttle = 0,
    keyboardPreset = 'two-stick',
    touchResponse = 'precise',
    ratesApplied = false,
    keyboardResumeSession = null,
    disposed = false;
  const keys = new Set(),
    touch = neutralFlightInput(),
    rawTouch = neutralFlightInput(),
    listeners = [],
    releases = [];
  let diagnostic = null;
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler);
    listeners.push(() => target.removeEventListener(type, handler));
  };
  const clear = () => {
    keys.clear();
    throttle = 0;
    keyboardResumeSession = null;
    Object.assign(touch, neutralFlightInput());
    Object.assign(rawTouch, neutralFlightInput());
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
      // Reopening an already paused menu releases keys without losing eligibility.
      const resumeSession = keyboardResumeSession;
      clear();
      keyboardResumeSession = resumeSession;
      onPause('paused');
      return;
    }
    // Cosmetic HUD buttons can retain focus during an active flight. They are
    // not text editors; the host's enabled ownership still excludes all menus.
    if (editable(event.target)) return;
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      owner !== 'keyboard' ||
      !enabled ||
      !keyboardFlightKey(event.code, keyboardPreset)
    )
      return;
    if (event.repeat && !keys.has(event.code)) return;
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
  listen(win, 'resize', () => {
    // Reacquire a fresh thumb origin after rotation/fullscreen changes.
    if (owner === 'touch' && enabled) lose();
  });
  return {
    clear,
    select(value) {
      if (!['keyboard', 'touch', 'radio', 'controller'].includes(value))
        throw new TypeError('Unknown input source');
      clear();
      enabled = false;
      owner = value;
      diagnostic = null;
    },
    enable(value) {
      enabled = !!value;
      if (!enabled) clear();
    },
    // A deliberate pause may retain eligibility, never held keys or live input.
    // The host supplies a flight identity so another attempt cannot inherit it.
    pause({ session = null, retainKeyboardThrottle = false } = {}) {
      const retained = keyboardResumeSession;
      enabled = false;
      clear();
      if (owner === 'keyboard' && session && (retainKeyboardThrottle || retained === session))
        keyboardResumeSession = session;
    },
    resume(session, consumedThrottle) {
      enabled = true;
      if (
        owner === 'keyboard' &&
        session &&
        keyboardResumeSession === session &&
        Number.isFinite(consumedThrottle)
      )
        throttle = clamp(consumedThrottle, 0, 1);
      keyboardResumeSession = null;
    },
    owner: () => owner,
    keyboardPreset(value) {
      if (!Object.hasOwn(keyboardPresets, value)) throw new TypeError('Unknown keyboard preset');
      if (value !== keyboardPreset) clear();
      keyboardPreset = value;
    },
    touchResponse(value) {
      if (!['precise', 'direct'].includes(value)) throw new TypeError('Unknown touch response');
      if (value !== touchResponse) clear();
      touchResponse = value;
    },
    // Portable curves already shape rotation. Legacy touch precision is an
    // explicit device aid; it must not be applied again to an imported curve.
    ratesApplied(value) {
      ratesApplied = Boolean(value);
      diagnostic = null;
      clear();
    },
    throttle(value) {
      if (owner === 'touch' && enabled && Number.isFinite(value))
        rawTouch.throttle = touch.throttle = clamp(value, 0, 1);
    },
    // Hosts may restore throttle only after a deliberate resume of an unscored
    // checkpoint. This neither enables input nor restores held keys/actions.
    seedThrottle(value) {
      if (!enabled || !Number.isFinite(value)) return;
      throttle = clamp(value, 0, 1);
      touch.throttle = throttle;
      rawTouch.throttle = throttle;
    },
    sample(seconds) {
      if (disposed || !enabled || ['radio', 'controller'].includes(owner))
        return neutralFlightInput();
      const command =
        owner === 'touch'
          ? { ...touch }
          : keyboardFlightValues({ keys, preset: keyboardPreset, throttle, seconds });
      throttle = command.throttle;
      diagnostic = {
        raw: owner === 'touch' ? { ...rawTouch } : { keys: [...keys].sort() },
        calibrated: { ...command },
        sampleAgeMs: null,
        cadenceHz: null,
      };
      return command;
    },
    diagnostics: () => (diagnostic ? structuredClone(diagnostic) : null),
    bindStick(element, side) {
      let pointer = null,
        pickup = null;
      const release = () => {
        const previous = pointer;
        pointer = null;
        pickup = null;
        element.dataset.touchActive = 'false';
        if (previous !== null) {
          try {
            element.releasePointerCapture(previous);
          } catch {
            /* already released */
          }
        }
        if (side === 'left') rawTouch.yaw = touch.yaw = 0;
        else {
          rawTouch.roll = touch.roll = 0;
          rawTouch.pitch = touch.pitch = 0;
        }
      };
      releases.push(release);
      const move = (event) => {
        if (pointer !== event.pointerId || owner !== 'touch' || !enabled) return;
        if (!pickup) return;
        Object.assign(
          touch,
          touchStickValues({
            side,
            dx: event.clientX - pickup.x,
            dy: pickup.y - event.clientY,
            travel: pickup.travel,
            throttle: pickup.throttle,
            response: ratesApplied ? 'direct' : touchResponse,
          }),
        );
        Object.assign(
          rawTouch,
          touchStickValues({
            side,
            dx: event.clientX - pickup.x,
            dy: pickup.y - event.clientY,
            travel: pickup.travel,
            throttle: pickup.throttle,
            response: 'direct',
          }),
        );
        event.preventDefault();
      };
      listen(element, 'pointerdown', (event) => {
        if (owner !== 'touch' || !enabled || pointer !== null) return;
        if (event.button !== undefined && event.button !== 0) return;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        pickup = {
          x: event.clientX,
          y: event.clientY,
          travel: rect.width * 0.34,
          throttle: touch.throttle,
        };
        pointer = event.pointerId;
        try {
          element.setPointerCapture(pointer);
        } catch {
          release();
          return;
        }
        element.dataset.touchActive = 'true';
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

/** Standard browser Gamepad flight ownership, separate from calibrated USB radios.
 * Poll once per host frame; integrate throttle only by calling sample at fixed
 * simulation ticks. A centred left stick holds the current throttle position.
 * The host owns arming and gives this adapter an exclusive ready/flight scope;
 * its menu adapter must be blocked for that same device while scope is owned.
 * W3C standard mapping: LX yaw, -LY throttle rate, RX roll, -RY pitch. */
export function createFlightGamepad({
  window: win = globalThis.window,
  document: doc = globalThis.document,
  combatLayout = () => false,
} = {}) {
  const mappedButtons = [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15];
  const actionButtons = new Map([
    [0, 'arm'],
    [1, 'back'],
    [3, 'reset'],
    [9, 'pause'],
    [11, 'camera'],
  ]);
  let scope = 'blocked',
    ready = false,
    connected = false,
    selected = null,
    reason = 'blocked',
    throttle = 0,
    throttleRate = 0,
    rotation = { roll: 0, pitch: 0, yaw: 0 },
    fire = false,
    intent = false,
    neutral = false,
    pending = null,
    lastTime = null,
    interrupted = false,
    disposed = false;
  const listeners = [];
  let diagnostic = null,
    previousTimestamp = null,
    timestampIntervals = [];
  const axis = (value) =>
    Math.abs(value) <= 0.12 ? 0 : (Math.sign(value) * (Math.abs(value) - 0.12)) / 0.88;
  const button = (pad, index) => {
    const raw = pad.buttons?.[index];
    return typeof raw === 'number' ? raw : (raw?.value ?? (raw?.pressed ? 1 : 0));
  };
  // The preview and flight use the same mapping once. Reading a preview must
  // never acquire flight ownership, advance retained throttle or consume an
  // action-button edge while the workbench owns the device.
  const mappedControls = (pad, values = Array.from(pad.axes).slice(0, 4).map(axis)) => {
    const pressed = (index) => button(pad, index) > 0.5,
      trigger = (index) => Math.max(0, (button(pad, index) - 0.12) / 0.88);
    return {
      rotation: {
        roll: values[2] || (combatLayout() ? 0 : (Number(pressed(15)) - Number(pressed(14))) * 0.5),
        pitch:
          -values[3] || (combatLayout() ? 0 : (Number(pressed(12)) - Number(pressed(13))) * 0.5),
        yaw: values[0] || (Number(pressed(5)) - Number(pressed(4))) * 0.5,
      },
      throttleRate: -values[1] || trigger(7) - trigger(6),
      fire: pressed(2),
      intent:
        values.some((value) => Math.abs(value) > 0.18) ||
        [4, 5, 12, 13, 14, 15].some(pressed) ||
        Math.abs(trigger(7) - trigger(6)) > 0.18,
    };
  };
  const valid = (pad) =>
    pad &&
    pad.connected !== false &&
    pad.mapping === 'standard' &&
    Number.isInteger(pad.index) &&
    pad.index >= 0 &&
    typeof pad.id === 'string' &&
    pad.axes?.length >= 4 &&
    pad.buttons?.length >= 16 &&
    Array.from(pad.axes)
      .slice(0, 4)
      .every((n) => Number.isFinite(n) && Math.abs(n) <= 1) &&
    mappedButtons.every(
      (i) => Number.isFinite(button(pad, i)) && button(pad, i) >= 0 && button(pad, i) <= 1,
    );
  const key = (pad) => `${pad.index}:${pad.id}:${pad.axes.length}:${pad.buttons.length}`;
  const clear = (nextReason = 'reset') => {
    ready = false;
    throttle = throttleRate = 0;
    rotation = { roll: 0, pitch: 0, yaw: 0 };
    fire = false;
    intent = false;
    neutral = false;
    pending = null;
    reason = nextReason;
  };
  const active = () => !disposed && connected && ready && scope === 'flight';
  const controls = () =>
    !disposed && connected && ready && scope !== 'blocked'
      ? { ...rotation, throttle }
      : neutralFlightInput();
  const status = () => ({
    connected: !disposed && connected,
    ready: !disposed && connected && ready && scope !== 'blocked',
    neutral: !disposed && connected && neutral,
    canArm: !disposed && connected && ready && neutral && scope === 'ready',
    active: active(),
    id: selected?.id ?? null,
    index: selected?.index ?? null,
    reason,
    stickMode: 2,
    controls: controls(),
    throttleRate: ready && scope !== 'blocked' ? throttleRate : 0,
    fire: active() && fire,
    intent: !disposed && connected && ready && scope !== 'blocked' && intent,
  });
  const suspend = () => {
    interrupted ||= active();
    clear('focus');
    lastTime = null;
  };
  for (const [target, name] of [
    [win, 'blur'],
    [doc, 'visibilitychange'],
  ]) {
    if (!target?.addEventListener) continue;
    target.addEventListener(name, suspend);
    listeners.push(() => target.removeEventListener(name, suspend));
  }
  return {
    poll({
      gamepads = win?.navigator?.getGamepads?.() ?? [],
      now = win?.performance?.now?.() ?? 0,
      scope: nextScope = 'blocked',
      excludeIndex = null,
    } = {}) {
      const actions = [];
      if (disposed) return { ...status(), actions };
      const wasActive = active();
      if (interrupted) actions.push('pause');
      interrupted = false;
      if (!['ready', 'flight'].includes(nextScope)) nextScope = 'blocked';
      const focused = !doc?.hidden && doc?.hasFocus?.() !== false;
      if (!focused) nextScope = 'blocked';
      if (nextScope !== scope) {
        // The host has already accepted an explicit Arm from a neutral ready
        // state. Keep that pickup when its next frame becomes flight: a pilot
        // may raise throttle immediately after releasing Arm. Other scope
        // transitions still demand a fresh neutral pickup.
        const armedPickup = scope === 'ready' && nextScope === 'flight' && ready && connected,
          armedThrottle = throttle;
        clear(focused ? (nextScope === 'blocked' ? 'blocked' : 'neutral') : 'focus');
        scope = nextScope;
        if (armedPickup) {
          throttle = armedThrottle;
          ready = true;
          reason = 'active';
        }
      }
      // Long foreground frames do not disconnect a controller. The host bounds
      // simulation time; only an invalid/backwards clock invalidates this poll.
      const stalled = !Number.isFinite(now) || (lastTime !== null && now < lastTime);
      lastTime = Number.isFinite(now) ? now : null;
      if (stalled || !focused) {
        if (wasActive && !actions.includes('pause')) actions.push('pause');
        clear(stalled ? 'stall' : 'focus');
      }
      const all = Array.from(gamepads ?? []).filter((pad) => pad && pad.index !== excludeIndex);
      const candidates = all.filter(valid).sort((a, b) => a.index - b.index);
      const pad = candidates.find((candidate) => selected?.key === key(candidate)) ?? candidates[0];
      const changed = selected?.key !== (pad ? key(pad) : undefined);
      const lost = connected && changed;
      if (changed) {
        if (wasActive && !actions.includes('pause')) actions.push('pause');
        clear(lost ? 'disconnected' : 'neutral');
        selected = pad ? { key: key(pad), id: pad.id, index: pad.index } : null;
        diagnostic = null;
        previousTimestamp = null;
        timestampIntervals = [];
      }
      connected = Boolean(pad);
      if (!pad) {
        diagnostic = null;
        clear(
          lost
            ? 'disconnected'
            : all.some((p) => p.connected !== false)
              ? 'unsupported'
              : 'missing',
        );
        return { ...status(), actions };
      }
      const timestamp = Number.isFinite(pad.timestamp) && pad.timestamp > 0 ? pad.timestamp : null;
      if (timestamp !== null && previousTimestamp !== null && timestamp > previousTimestamp)
        timestampIntervals = [...timestampIntervals, timestamp - previousTimestamp].slice(-20);
      if (timestamp === null || (previousTimestamp !== null && timestamp < previousTimestamp))
        timestampIntervals = [];
      previousTimestamp = timestamp;
      diagnostic = {
        raw: {
          axes: Array.from(pad.axes).slice(0, 4),
          buttons: Object.fromEntries(mappedButtons.map((index) => [index, button(pad, index)])),
        },
        sampleAgeMs: timestamp === null ? null : Math.max(0, now - timestamp),
        sampledAtMs: now,
        cadenceHz: timestampIntervals.length
          ? Math.round(
              (1000 * timestampIntervals.length) /
                timestampIntervals.reduce((sum, interval) => sum + interval, 0),
            )
          : null,
      };
      const values = Array.from(pad.axes).slice(0, 4).map(axis);
      const centred = values.every((value) => value === 0);
      const released = mappedButtons.every((i) => button(pad, i) <= 0.12);
      neutral = centred && released;
      if (scope === 'blocked' || stalled || !focused || lost) return { ...status(), actions };
      if (!ready) {
        if (centred && released) {
          ready = true;
          reason = scope === 'flight' ? 'active' : 'ready';
        } else reason = 'neutral';
        return { ...status(), actions };
      }
      const pressed = (i) => button(pad, i) > 0.5;
      const currentActions = combatLayout()
        ? new Map([
            ...actionButtons,
            [12, 'reload'],
            [13, 'payload'],
            [14, 'weaponA'],
            [15, 'weaponB'],
            [10, 'detonate'],
          ])
        : actionButtons;
      const heldActions = [...currentActions.keys()].filter(pressed);
      if (heldActions.length > 1) {
        clear('neutral');
        // The host must stop before it can sample the cleared throttle. A
        // conflicting chord is neither an action nor permission to keep flying.
        if (wasActive) actions.push('pause');
      } else if (pending !== null) {
        if (!pressed(pending)) {
          const action = currentActions.get(pending);
          pending = null;
          if (heldActions.length) {
            clear('neutral');
            if (wasActive) actions.push('pause');
          } else if (action !== 'arm' || (scope === 'ready' && centred && released)) {
            if (action !== 'arm' || scope === 'ready') actions.push(action);
            if (
              !['arm', 'camera', 'weaponA', 'weaponB', 'reload', 'payload', 'detonate'].includes(
                action,
              )
            )
              clear(action === 'reset' ? 'reset' : 'neutral');
          }
        }
      } else if (heldActions.length) pending = heldActions[0];
      if (ready) {
        ({ rotation, throttleRate, fire, intent } = mappedControls(pad, values));
        reason = scope === 'flight' ? 'active' : 'ready';
      }
      return { ...status(), actions };
    },
    sample(seconds) {
      if (!active()) return neutralFlightInput();
      const dt = Number.isFinite(seconds) ? clamp(seconds, 0, 0.05) : 0;
      throttle = clamp(throttle + throttleRate * 0.5 * dt, 0, 1);
      return controls();
    },
    preview: status,
    status,
    diagnostics: () => (diagnostic ? structuredClone(diagnostic) : null),
    previewDiagnostics() {
      if (disposed || !connected || !diagnostic) return null;
      const mapped = mappedControls(diagnostic.raw);
      return structuredClone({
        ...diagnostic,
        calibrated: { ...mapped.rotation, throttle: null },
        mapping: 'standard-mode-2',
        throttleRate: mapped.throttleRate,
        throttleRateLabel: 'Throttle change input',
        throttleRateUnits: 'normalized',
      });
    },
    // A separate unscored preview may inherit its current thrust on takeover.
    // Real flight ownership/reset still clears this value and all action edges.
    seedThrottle(value) {
      if (disposed || !Number.isFinite(value) || value < 0 || value > 1) return false;
      throttle = value;
      return true;
    },
    reset(nextReason = 'reset') {
      clear(nextReason);
      diagnostic = null;
      previousTimestamp = null;
      timestampIntervals = [];
      interrupted = false;
      lastTime = null;
    },
    dispose() {
      if (disposed) return;
      clear('disposed');
      disposed = true;
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
 * Legacy radio menus use roll/pitch and held yaw gestures. Six-switch layouts
 * use the centering gimbal and fresh switch cycles, never flight commands.
 * The first Confirm joins only. Native file pickers still need a host gesture. */
export function createFlightMenuNavigation({
  window: win = globalThis.window,
  document: doc = globalThis.document,
  getContext = () => null,
  onBack = () => {},
  onAction = () => {},
  onHint = () => {},
  onRadioShortcut = () => {},
  onCommand = () => false,
  onDeviceJoin = () => false,
  keyboard = true,
  locale = () => 'en',
  ownsKeyboardEvent = () => false,
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
    lastTime = null,
    captureEscape = null,
    radioCaptureEscape = null,
    editorSerial = 0;
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
  const controls = () =>
    [...((editing?.panel ?? context?.root)?.querySelectorAll(selector) ?? [])].filter(available);
  function cancelEdit({ restoreFocus = false } = {}) {
    if (!editing) return;
    const previous = editing;
    if (!previous.panel) previous.element.value = previous.value;
    delete previous.element.dataset.fpvMenuEditing;
    previous.panel?.remove();
    editing = null;
    if (restoreFocus && available(previous.element)) focus(previous.element);
  }
  function reset({ leaveDevice = false } = {}) {
    cancelEdit();
    sources.clear();
    if (leaveDevice) joined = null;
    if (marked) delete marked.dataset.fpvMenuFocus;
    marked = null;
    lastTime = null;
    captureEscape = null;
    radioCaptureEscape = null;
  }
  function sync() {
    const candidate = !disposed && !doc.hidden ? getContext() : null;
    const next = doc.hasFocus?.() !== false || candidate?.frameFocused ? candidate : null;
    if (
      next?.root !== context?.root ||
      next?.key !== context?.key ||
      Boolean(next?.frameFocused) !== Boolean(context?.frameFocused) ||
      next?.blockRadio !== context?.blockRadio ||
      next?.blockDevices !== context?.blockDevices ||
      next?.captureControllerIndex !== context?.captureControllerIndex ||
      next?.captureRadioBack !== context?.captureRadioBack ||
      Boolean(next?.onCaptureBack) !== Boolean(context?.onCaptureBack)
    ) {
      reset();
      for (const key of heldKeys) blockedKeys.add(key);
      context = next?.root ? next : null;
      if (context)
        hint(
          context.blockDevices
            ? typeof context.onCaptureBack === 'function' &&
              Number.isInteger(context.captureControllerIndex)
              ? 'Sticks control the preview. Release all buttons, then press and release B to return to menu controls. Keyboard: Esc to go back.'
              : 'Keyboard: Tab/arrows, Enter to select, Esc to go back. Device menus are paused during control capture.'
            : context.blockRadio
              ? 'Keyboard: Tab/arrows, Enter, Esc. Controller: release, then press/release A to connect; D-pad/stick moves, A confirms, B goes back. Radio sticks belong to setup here.'
              : 'Tab/arrows move; Enter selects; Esc goes back. Controller: release, then press/release A to connect. Calibrated radio: hold yaw right for 0.7 s, then centre to connect; roll/pitch move, hold yaw right/left then centre to confirm/go back.',
          context.blockDevices
            ? typeof context.onCaptureBack === 'function' &&
              Number.isInteger(context.captureControllerIndex)
              ? 'Стіки керують переглядом. Відпустіть усі кнопки, потім натисніть і відпустіть B, щоб повернути керування меню. Клавіатура: Esc — назад.'
              : 'Клавіатура: Tab/стрілки, Enter — вибір, Esc — назад. Меню пристроїв призупинено під час запису керування.'
            : context.blockRadio
              ? 'Клавіатура: Tab/стрілки, Enter, Esc. Геймпад: відпустіть, натисніть і відпустіть A; хрестовина/стік — вибір, A — підтвердити, B — назад. Стіки пульта тут належать налаштуванню.'
              : 'Tab/стрілки — вибір; Enter — підтвердити; Esc — назад. Геймпад: відпустіть, натисніть і відпустіть A. Пульт: утримайте рискання праворуч 0,7 с й поверніть у центр для підключення; крен/тангаж — вибір, утримання рискання праворуч/ліворуч і центр — підтвердити/назад.',
        );
      else onHint('');
    }
    if (context && next) {
      context.frameFocused = next.frameFocused;
      context.handleFrameCommand = next.handleFrameCommand;
      context.onCaptureBack = next.onCaptureBack;
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
  function openEditor(element) {
    if (element.readOnly) {
      hint('This value is read-only.', 'Це значення доступне лише для читання.');
      return;
    }
    const numeric = element.type === 'number',
      original = element.value ?? '',
      requestedLimit = Number(element.maxLength),
      limit = numeric
        ? 64
        : Number.isInteger(requestedLimit) && requestedLimit >= 0
          ? Math.min(4096, requestedLimit)
          : 4096,
      panel = doc.createElement('section'),
      title = doc.createElement('h3'),
      preview = doc.createElement('output'),
      keys = doc.createElement('div'),
      actions = doc.createElement('div'),
      status = doc.createElement('p');
    panel.className = 'fpv-menu-editor';
    panel.dataset.fpvMenuEditor = numeric ? 'number' : 'text';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    title.className = 'fpv-menu-editor__title';
    title.id = `fpv-menu-editor-title-${++editorSerial}`;
    title.textContent =
      element.getAttribute('aria-label') ||
      element.labels?.[0]?.textContent ||
      element.placeholder ||
      text(numeric ? 'Edit number' : 'Edit text', numeric ? 'Змінити число' : 'Змінити текст');
    panel.setAttribute('aria-labelledby', title.id);
    preview.className = 'fpv-menu-editor__preview';
    keys.className = 'fpv-menu-editor__keys';
    keys.dataset.menuLayout = 'grid';
    keys.dataset.menuEdgeExit = 'true';
    actions.className = 'fpv-menu-editor__actions';
    actions.dataset.menuLayout = 'horizontal';
    actions.dataset.menuEdgeExit = 'true';
    status.className = 'fpv-menu-editor__status';
    status.setAttribute('role', 'status');
    panel.append(title, preview, keys, actions, status);
    const state = {
      element,
      value: original,
      draft: original,
      panel,
      numeric,
      limit,
      alphabet: locale() === 'uk' ? 'uk' : 'en',
      uppercase: false,
    };
    editing = state;
    element.dataset.fpvMenuEditing = '';
    const show = () => {
      preview.textContent =
        element.type === 'password' ? '•'.repeat(Math.min(256, state.draft.length)) : state.draft;
      status.textContent = `${state.draft.length} / ${limit} · ${text(
        'Select applies a key. Apply saves; Back cancels.',
        'Вибір додає символ. «Застосувати» зберігає; «Назад» скасовує.',
      )}`;
    };
    const append = (value) => {
      if (editing !== state) return;
      if (state.draft.length + value.length > limit) {
        status.textContent = text('Character limit reached.', 'Досягнуто межі символів.');
        return;
      }
      state.draft += value;
      show();
    };
    const erase = () => {
      if (editing !== state) return;
      state.draft = [...state.draft].slice(0, -1).join('');
      show();
    };
    const keyButton = (owner, caption, action, name) => {
      const button = doc.createElement('button');
      button.type = 'button';
      button.textContent = caption;
      if (name) button.dataset.fpvEditorAction = name;
      button.addEventListener('click', () => {
        if (editing === state) action();
      });
      owner.append(button);
      return button;
    };
    const numberBound = (key, fallback) =>
      element[key] !== '' && element[key] != null && Number.isFinite(Number(element[key]))
        ? Number(element[key])
        : fallback;
    const apply = () => {
      let value = state.draft;
      if (value.length > limit) {
        status.textContent = text(
          'Shorten the value before saving.',
          'Скоротіть значення перед збереженням.',
        );
        return;
      }
      if (numeric && value !== '') {
        const number = Number(value),
          minimum = numberBound('min', -Infinity),
          maximum = numberBound('max', Infinity);
        if (
          !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value) ||
          !Number.isFinite(number) ||
          number < minimum ||
          number > maximum
        ) {
          status.textContent = text(
            'Enter a number within the allowed range.',
            'Введіть число в дозволених межах.',
          );
          return;
        }
        value = String(number);
      }
      element.value = value;
      if (element.checkValidity?.() === false) {
        element.value = original;
        status.textContent = text(
          'Check the value and its allowed format.',
          'Перевірте значення та дозволений формат.',
        );
        return;
      }
      delete element.dataset.fpvMenuEditing;
      editing = null;
      panel.remove();
      if (available(element)) focus(element);
      if (value !== original) {
        element.dispatchEvent(new win.Event('input', { bubbles: true }));
        element.dispatchEvent(new win.Event('change', { bubbles: true }));
      }
      hint('Change applied.', 'Зміну застосовано.');
      sources.clear();
    };
    const paintKeys = () => {
      keys.replaceChildren();
      const alphabet =
        state.alphabet === 'uk'
          ? 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя'
          : 'abcdefghijklmnopqrstuvwxyz';
      const values = numeric
        ? '789456123-0.e+'
        : `${state.uppercase ? alphabet.toUpperCase() : alphabet}0123456789.,!?-_/@:;#()'"+=`;
      for (const value of values) {
        const button = keyButton(keys, value, () => append(value));
        button.dataset.fpvEditorKey = value;
      }
    };
    paintKeys();
    keyButton(actions, text('Apply', 'Застосувати'), apply, 'apply');
    keyButton(
      actions,
      text('Cancel', 'Скасувати'),
      () => cancelEdit({ restoreFocus: true }),
      'cancel',
    );
    keyButton(actions, text('Delete last', 'Стерти останнє'), erase, 'erase');
    keyButton(
      actions,
      text('Clear', 'Очистити'),
      () => {
        state.draft = '';
        show();
      },
      'clear',
    );
    if (numeric) {
      for (const multiple of [-10, -1, 1, 10])
        keyButton(
          actions,
          `${multiple > 0 ? '+' : '−'}${Math.abs(multiple)}×`,
          () => {
            const step = element.step === 'any' ? 0.1 : numberBound('step', 1),
              current = Number(state.draft);
            state.draft = String(
              Number(
                clamp(
                  (Number.isFinite(current) ? current : 0) + multiple * (step > 0 ? step : 1),
                  numberBound('min', -Infinity),
                  numberBound('max', Infinity),
                ).toPrecision(12),
              ),
            );
            show();
          },
          `step-${multiple}`,
        );
    } else {
      keyButton(actions, text('Space', 'Пробіл'), () => append(' '), 'space');
      if (element.tagName === 'TEXTAREA')
        keyButton(actions, text('New line', 'Новий рядок'), () => append('\n'), 'newline');
      keyButton(
        actions,
        'ABC / abc',
        () => {
          state.uppercase = !state.uppercase;
          paintKeys();
        },
        'case',
      );
      keyButton(
        actions,
        'EN / УК',
        () => {
          state.alphabet = state.alphabet === 'en' ? 'uk' : 'en';
          paintKeys();
        },
        'alphabet',
      );
    }
    state.append = append;
    state.erase = erase;
    context.root.append(panel);
    show();
    focus(keys.querySelector('button'));
    sources.clear();
  }
  function command(action) {
    if (!sync()) return;
    onAction(action);
    if (context.frameFocused) {
      context.handleFrameCommand?.({ back: action === 'back' });
      return;
    }
    if (onCommand(action, context) === true) return;
    if (action === 'back') {
      if (editing) {
        cancelEdit({ restoreFocus: true });
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
    if (editing && !editing.panel) {
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
      if (editing?.panel) {
        current.click();
        return;
      }
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
      } else if (current.type === 'file') {
        hint(
          'Choosing an external file needs a click or touch. Saved in-app files remain available.',
          'Для вибору зовнішнього файла потрібен клік або дотик. Збережені в застосунку файли доступні.',
        );
      } else if (textEntry(current)) {
        openEditor(current);
      } else current.click();
      return;
    }
    const grouped = menuGroupNeighbor(items, current, action);
    if (grouped) {
      focus(grouped);
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
      if (source.sixSwitch && !context.frameFocused)
        hint(
          joined === source.key
            ? source.provisional
              ? 'Setup buttons ready. Fire selects; Weapon goes back. Measure the sticks before stick navigation.'
              : 'Radio menus ready. Centering stick moves. Fire selects; Weapon goes back.'
            : source.provisional
              ? 'Release the setup switches. Turn Fire on then off to join; Weapon on then off goes back. Stick navigation starts after calibration.'
              : 'Centre the spring-loaded stick and release the switches. Turn Fire on then off to join; Weapon goes back.',
          joined === source.key
            ? source.provisional
              ? 'Кнопки налаштування готові. Вогонь — підтвердити; Зброя — назад. Спочатку виміряйте стіки для навігації.'
              : 'Меню пульта готове. Пружинний стік — вибір. Вогонь — підтвердити; Зброя — назад.'
            : source.provisional
              ? 'Відпустіть перемикачі налаштування. Увімкніть і вимкніть Вогонь для підключення; Зброя — назад. Навігація стіком почнеться після калібрування.'
              : 'Відцентруйте пружинний стік і відпустіть перемикачі. Увімкніть і вимкніть Вогонь для підключення; Зброя — назад.',
        );
      state = {
        ready: false,
        pending: null,
        since: 0,
        qualified: false,
        target: null,
        heldAt: 0,
        direction: null,
        repeatAt: 0,
        arm: source.arm,
      };
      sources.set(source.key, state);
    }
    if (source.blocked || (source.arm !== undefined && state.arm !== source.arm)) {
      state.ready = false;
      state.pending = state.direction = null;
      state.arm = source.arm;
      return;
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
        onAction(source.action);
        state.pending = source.action;
        state.target = doc.activeElement;
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
      if (action === 'confirm' && state.target !== doc.activeElement) return;
      if (context.frameFocused) {
        command(action);
        return;
      }
      if (source.sixSwitch && ['camera', 'retry', 'settings'].includes(action)) {
        const owner = context;
        reset();
        onRadioShortcut(action, owner);
        return;
      }
      if (source.sixSwitch && action === 'back' && joined !== source.key) {
        command(action);
        return;
      }
      if (joined !== source.key) {
        if (action !== 'confirm') return;
        joined = source.key;
        reset();
        const items = controls();
        if (onDeviceJoin(source, context) !== true && items.length)
          focus(items.includes(doc.activeElement) ? doc.activeElement : items[0]);
        hint(
          source.provisional
            ? 'Setup buttons ready. Fire selects; Weapon goes back. Measure the sticks before stick navigation.'
            : source.sixSwitch
              ? 'Radio menus ready. Centering stick moves. Fire selects; Weapon goes back.'
              : source.kind === 'radio'
                ? 'Radio menus ready. Roll/pitch move; hold yaw right then centre to confirm, left then centre to go back.'
                : 'Controller menus ready. D-pad moves, A confirms, B goes back. Release between actions.',
          source.provisional
            ? 'Кнопки налаштування готові. Вогонь — підтвердити; Зброя — назад. Спочатку виміряйте стіки для навігації.'
            : source.sixSwitch
              ? 'Меню пульта готове. Пружинний стік — вибір. Вогонь — підтвердити; Зброя — назад.'
              : source.kind === 'radio'
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
  // The host explicitly grants this one escape action to the captured pad.
  // Preview stick deflection is allowed, but button pickup/press/release must
  // be fresh. This path never joins, navigates, confirms, arms or emits Back.
  function pollCaptureEscape(gamepads) {
    const index = context.captureControllerIndex;
    if (typeof context.onCaptureBack !== 'function' || !Number.isInteger(index) || index < 0) {
      captureEscape = null;
      return;
    }
    const pad = Array.from(gamepads ?? []).find((candidate) => candidate?.index === index);
    const value = (button) =>
      typeof button === 'number' ? button : (button?.value ?? (button?.pressed ? 1 : 0));
    if (
      !pad ||
      pad.connected === false ||
      pad.mapping !== 'standard' ||
      typeof pad.id !== 'string' ||
      !pad.axes ||
      pad.axes.length < 4 ||
      !pad.buttons ||
      pad.buttons.length < 16 ||
      !Array.from(pad.axes)
        .slice(0, 4)
        .every((axis) => Number.isFinite(axis) && Math.abs(axis) <= 1)
    ) {
      captureEscape = null;
      return;
    }
    const buttons = Array.from(pad.buttons).slice(0, 16).map(value);
    if (!buttons.every((button) => Number.isFinite(button) && button >= 0 && button <= 1)) {
      captureEscape = null;
      return;
    }
    const key = `pad:${pad.index}:${pad.id}:${pad.axes.length}:${pad.buttons.length}`;
    if (captureEscape?.key !== key) captureEscape = { key, ready: false, pending: false };
    const released = buttons.every((button) => button <= 0.12),
      otherPressed = buttons.some((button, index) => index !== 1 && button > 0.12);
    if (!captureEscape.ready) {
      if (released) captureEscape.ready = true;
      return;
    }
    if (otherPressed) {
      captureEscape.ready = captureEscape.pending = false;
      return;
    }
    if (buttons[1] > 0.5) captureEscape.pending = true;
    else if (released && captureEscape.pending) {
      captureEscape.ready = captureEscape.pending = false;
      context.onCaptureBack();
      reset();
    }
  }
  const sixSwitchState = (radio) =>
    radio?.layout === 'six-switch' &&
    (radio.verified === true || (radio.verified === false && radio.provisional === true)) &&
    typeof radio.key === 'string' &&
    Number.isInteger(radio.index) &&
    radio.index >= 0 &&
    ['arm', 'fire', 'weapon', 'reload', 'payload', 'detonate'].every(
      (key) => typeof radio.switches?.[key] === 'boolean',
    );
  function pollRadioCaptureEscape(radio) {
    if (
      context.captureRadioBack === false ||
      typeof context.onCaptureBack !== 'function' ||
      !sixSwitchState(radio)
    ) {
      radioCaptureEscape = null;
      return;
    }
    const key = `${radio.key}:${radio.index}`;
    if (radioCaptureEscape?.key !== key) radioCaptureEscape = { key, ready: false, pending: false };
    const escape = radioCaptureEscape;
    if (!escape.ready) {
      if (!radio.switches.weapon) escape.ready = true;
      return;
    }
    if (radio.switches.weapon) escape.pending = true;
    else if (escape.pending) {
      const leave = context.onCaptureBack;
      reset({ leaveDevice: true });
      leave();
    }
  }
  function poll({ now = win.performance.now(), gamepads = [], radio = null } = {}) {
    if (!sync()) return;
    if (!Number.isFinite(now)) {
      reset();
      return;
    }
    if (lastTime !== null && (now - lastTime > 350 || now < lastTime)) reset();
    lastTime = now;
    if (context.blockDevices && typeof context.onCaptureBack === 'function') {
      pollCaptureEscape(gamepads);
      if (sync() && context.blockDevices) pollRadioCaptureEscape(radio);
      return;
    }
    const sampled = [];
    const radioInFrame =
      context.frameFocused &&
      context.handleFrameCommand?.({ source: 'radio', radio, now }) === true;
    for (const pad of context.blockDevices ? [] : Array.from(gamepads ?? [])) {
      if (!pad || pad.connected === false || pad.mapping !== 'standard') continue;
      if ((radio?.verified || radio?.provisional) && pad.index === radio.index) continue;
      const pressed = (index) =>
        (typeof pad.buttons[index] === 'number'
          ? pad.buttons[index]
          : (pad.buttons[index]?.value ?? 0)) > 0.5;
      const held = [0, 1, ...(context.frameFocused ? [9] : []), 12, 13, 14, 15].filter(pressed);
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
          centered &&
          held.length === 1 &&
          (pressed(0)
            ? 'confirm'
            : pressed(1) || (context.frameFocused && pressed(9))
              ? 'back'
              : null),
        direction: !held.length ? stick : dpad && (centered || stick === dpad) ? dpad : null,
      });
    }
    if (
      !radioInFrame &&
      !context.blockDevices &&
      !context.blockRadio &&
      radio &&
      typeof radio.key === 'string'
    ) {
      if (radio.layout === 'six-switch') {
        const calibrated =
          radio.verified === true &&
          STICK_LAYOUTS[radio.stickMode] &&
          ['roll', 'pitch', 'yaw'].every(
            (key) => Number.isFinite(radio.controls?.[key]) && Math.abs(radio.controls[key]) <= 1,
          );
        if (
          sixSwitchState(radio) &&
          (calibrated || (radio.verified === false && radio.provisional === true))
        ) {
          const layout = STICK_LAYOUTS[radio.stickMode] ?? STICK_LAYOUTS[2],
            offset = layout.indexOf('throttle') < 2 ? 2 : 0,
            x = calibrated ? radio.controls[layout[offset]] : 0,
            y = calibrated ? -radio.controls[layout[offset + 1]] : 0,
            centered = Math.abs(x) < 0.25 && Math.abs(y) < 0.25,
            held = ['fire', 'weapon', 'reload', 'payload', 'detonate'].filter(
              (key) => radio.switches[key],
            );
          sampled.push({
            key: `radio:${radio.key}:${radio.index}:six-switch:${calibrated ? radio.stickMode : 'provisional'}`,
            kind: 'radio',
            sixSwitch: true,
            provisional: !calibrated,
            arm: radio.switches.arm,
            hold: 0,
            neutral: centered && held.length === 0,
            blocked:
              held.length > 1 ||
              (held.length > 0 && !centered) ||
              (!calibrated && held.some((key) => !['fire', 'weapon'].includes(key))),
            action:
              centered && held.length === 1
                ? {
                    fire: 'confirm',
                    weapon: 'back',
                    reload: 'camera',
                    payload: 'retry',
                    detonate: 'settings',
                  }[held[0]]
                : null,
            direction: held.length === 0 ? axisDirection(x, y) : null,
          });
        }
      } else if (
        radio.verified &&
        ['roll', 'pitch', 'yaw'].every(
          (key) => Number.isFinite(radio.controls?.[key]) && Math.abs(radio.controls[key]) <= 1,
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
    }
    const keys = new Set(sampled.map((source) => source.key));
    if (joined && !keys.has(joined)) {
      onAction('disconnect');
      reset({ leaveDevice: true });
    }
    for (const key of sources.keys()) if (!keys.has(key)) sources.delete(key);
    for (const source of sampled) sample(source, now);
  }
  listen(doc, 'keydown', (event) => {
    if (!keyboard) return;
    const navigates = directions[event.key] || ['Enter', ' ', 'Escape'].includes(event.key);
    const active = sync();
    if (navigates) heldKeys.add(event.key);
    if (
      event.defaultPrevented ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      !active ||
      ownsKeyboardEvent(event)
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
    if (editing?.panel && event.key === 'Tab') {
      const items = controls(),
        index = items.indexOf(doc.activeElement);
      event.preventDefault();
      event.stopPropagation();
      if (items.length)
        focus(items[(index + (event.shiftKey ? -1 : 1) + items.length) % items.length]);
      return;
    }
    if (
      editing?.panel &&
      (event.key === 'Backspace' || event.key.length === 1) &&
      ![' ', 'Enter'].includes(event.key)
    ) {
      event.preventDefault();
      event.stopPropagation();
      if (event.key === 'Backspace') editing.erase();
      else editing.append(event.key);
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
    const settingField = event.target?.closest?.('select,input');
    const directionalSetting =
      settingField?.closest?.('.native-settings') &&
      (settingField.tagName === 'SELECT' ||
        ['range', 'checkbox', 'radio'].includes(settingField.type));
    if (directionalSetting && (directions[event.key] || ['Enter', ' '].includes(event.key))) {
      event.preventDefault();
      event.stopPropagation();
      if (!event.repeat) command(directions[event.key] ?? 'confirm');
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
    if (!keyboard) return;
    if (blockedKeys.has(event.key)) {
      event.preventDefault();
      event.stopPropagation();
    }
    heldKeys.delete(event.key);
    blockedKeys.delete(event.key);
  });
  listen(doc, 'pointerdown', (event) => {
    if (editing?.panel?.contains(event.target)) {
      sources.clear();
      captureEscape = radioCaptureEscape = null;
    } else reset();
  });
  const suspend = () => {
    context = null;
    onHint('');
    reset();
    heldKeys.clear();
    blockedKeys.clear();
  };
  listen(win, 'blur', () => {
    if (!getContext()?.frameFocused) suspend();
  });
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
