import {
  keyboardFlightPreset,
  keyboardFlightKey,
  keyboardFlightValues,
  keyboardFlightHelp,
  gamepadFlightHelp,
  touchStickValues,
  createFlightGamepad,
  KEYBOARD_PRESET_KEY,
} from './input.mjs';
import { createRadioRuntime } from './radio-runtime.mjs';
import { createFlightProfileStore } from './radio-profile.mjs';
import { restoreVerifiedRadio } from './radio-session.mjs';
import { getLocale } from '../../game/i18n/index.mjs';

const axes = ['roll', 'pitch', 'yaw', 'throttle'];
const normalized = (state) =>
  Object.fromEntries(axes.map((axis) => [axis, (state?.lastInput?.[axis] ?? 0) / 1000]));
const editable = (target) =>
  target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName);

/** Uses the native mappings and the host's one device sample. Never polls devices or stores settings. */
export function attachSimDemoInput({
  root,
  canvas,
  practice,
  getPlayer,
  onTakeover,
  onActivity = () => {},
  onPause = () => {},
  onBack = () => {},
  onResume = (intent) => practice()?.start(intent),
  getContext = () => ({}),
}) {
  const doc = root.ownerDocument,
    win = doc.defaultView,
    keys = new Set(),
    pressed = new Set(),
    removers = [];
  const readOnlyStorage = {
    getItem: (key) => {
      try {
        return win.localStorage?.getItem(key) ?? null;
      } catch {
        return null;
      }
    },
  };
  const savedPreset = keyboardFlightPreset(readOnlyStorage.getItem(KEYBOARD_PRESET_KEY)).id;
  const profiles = createFlightProfileStore({ storage: readOnlyStorage });
  const preset = () => keyboardFlightPreset(getContext().simKeyboardPreset ?? savedPreset);
  const uk = () => (getContext().locale ?? getLocale()) === 'uk';
  let disposed = false,
    owner = 'keyboard',
    throttle = 0,
    currentPractice = null,
    preparing = false;
  let pads = [],
    frameNow = 0,
    controllerIntent = false,
    radioKey = null,
    lastRadioDiscovery = -Infinity,
    radioWasActive = false;
  let touch = { roll: 0, pitch: 0, yaw: 0, throttle: 0 },
    touchFire = false,
    pending = null;
  const pad = createFlightGamepad({ window: win, document: doc });
  const radio = createRadioRuntime({
    getGamepads: () => pads,
    now: () => frameNow,
    onFreeze: () => {
      if (owner === 'radio' && currentPractice) currentPractice.pause();
    },
  });
  const visible = () => !doc.hidden && doc.hasFocus?.() !== false;
  const listen = (target, event, handler, options) => {
    target?.addEventListener(event, handler, options);
    removers.push(() => target?.removeEventListener(event, handler, options));
  };
  const bindPractice = () => {
    const next = practice();
    if (!next || next === currentPractice) return;
    currentPractice = next;
    throttle = normalized(next.state).throttle;
    touch.throttle = throttle;
    pad.seedThrottle(throttle);
    next.setInputProvider((seconds) => {
      if (pending) {
        const value = pending;
        pending = null;
        return value;
      }
      if (owner === 'radio') return { ...radio.poll(), actions: keys.has(preset().fire) ? 1 : 0 };
      if (owner === 'controller')
        return { ...pad.sample(seconds), actions: pad.status().fire ? 1 : 0 };
      if (owner === 'touch') return { ...touch, actions: touchFire ? 1 : 0 };
      const value = keyboardFlightValues({ keys, preset: preset().id, throttle, seconds });
      throttle = value.throttle;
      return { ...value, actions: keys.has(preset().fire) ? 1 : 0 };
    });
  };
  const takeOver = async (device, input) => {
    if (disposed || preparing || !visible()) return;
    owner = device;
    onActivity();
    if (practice()) {
      bindPractice();
      pending = input;
      if (practice().phase !== 'playing') onResume({ device, input });
      return;
    }
    preparing = true;
    try {
      await onTakeover({ device, input });
      if (disposed || !visible()) return;
      bindPractice();
      if (device === 'keyboard') for (const code of pressed) keys.add(code);
      pending = input;
    } finally {
      preparing = false;
    }
  };
  const release = ({ handoff = preparing } = {}) => {
    keys.clear();
    pending = null;
    controllerIntent = false;
    touch = { roll: 0, pitch: 0, yaw: 0, throttle };
    if (!handoff) touchFire = false;
    // The shared host clears the old owner while reconstructing an accepted
    // fresh gesture. Preserve that controller/radio pickup for the new owner;
    // actual foreground loss always revokes it.
    if (!handoff || owner !== 'controller') pad.reset('focus');
    if (!handoff || owner !== 'radio') radio.freeze('focus-lost');
    practice()?.pause();
  };
  listen(
    win,
    'keydown',
    (event) => {
      if (
        disposed ||
        !root.open ||
        !visible() ||
        editable(event.target) ||
        event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.isComposing
      )
        return;
      if (event.code === 'Escape' || event.code === 'KeyP') {
        if (!event.repeat) {
          event.preventDefault();
          release();
          (event.code === 'Escape' ? onBack : onPause)();
        }
        return;
      }
      if (!keyboardFlightKey(event.code, preset().id) && event.code !== preset().fire) return;
      if (event.repeat && !keys.has(event.code)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      keys.add(event.code);
      pressed.add(event.code);
      if (practice() && owner === 'radio' && event.code === preset().fire) return;
      if (!event.repeat) {
        const baseline = practice()?.state ?? getPlayer()?.state;
        const input = {
          ...keyboardFlightValues({
            keys,
            preset: preset().id,
            throttle: normalized(baseline).throttle,
            seconds: 0.02,
          }),
          actions: event.code === preset().fire ? 1 : 0,
        };
        void takeOver('keyboard', input);
      }
    },
    true,
  );
  listen(
    win,
    'keyup',
    (event) => {
      keys.delete(event.code);
      pressed.delete(event.code);
    },
    true,
  );
  listen(win, 'blur', () => {
    pressed.clear();
    release({ handoff: false });
  });
  listen(doc, 'visibilitychange', () => {
    if (doc.hidden) {
      pressed.clear();
      release({ handoff: false });
    }
  });

  // The same native touch mapping: two independent sticks with retained throttle.
  const controls = doc.createElement('div');
  controls.className = 'demo-sim-touch';
  controls.style.cssText =
    'position:absolute;inset:auto 16px 16px;display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;pointer-events:none;z-index:2';
  const radioButton = doc.createElement('button');
  radioButton.type = 'button';
  radioButton.dataset.demoUi = '';
  radioButton.style.cssText = 'min-height:44px;align-self:end;pointer-events:auto';
  radioButton.textContent = uk() ? 'Практика з пультом' : 'Practice with radio';
  radioButton.hidden = true;
  listen(radioButton, 'click', () => {
    const checkpoint = normalized(practice()?.state ?? getPlayer()?.state);
    radio.reset({ notify: false, pickup: checkpoint });
    radio.poll();
    if (radio.requestArm()) void takeOver('radio', { ...radio.poll(), actions: 0 });
    else
      radioButton.textContent = uk()
        ? 'Зрівняйте тягу й увімкніть пульт'
        : 'Match throttle and arm the radio';
  });
  controls.append(radioButton);
  const fireButton = doc.createElement('button');
  fireButton.type = 'button';
  fireButton.dataset.demoUi = '';
  fireButton.textContent = uk() ? 'Вогонь' : 'Fire';
  fireButton.style.cssText =
    'min-width:44px;min-height:44px;align-self:end;touch-action:none;pointer-events:auto';
  listen(fireButton, 'pointerdown', (event) => {
    if (event.button > 0) return;
    event.preventDefault();
    fireButton.setPointerCapture?.(event.pointerId);
    touchFire = true;
    touch.throttle = normalized(practice()?.state ?? getPlayer()?.state).throttle;
    void takeOver('touch', { ...touch, actions: 1 });
  });
  for (const name of ['pointerup', 'pointercancel'])
    listen(fireButton, name, () => {
      touchFire = false;
    });
  controls.append(fireButton);
  for (const side of ['left', 'right']) {
    const stick = doc.createElement('button');
    stick.type = 'button';
    stick.dataset.demoUi = '';
    stick.setAttribute(
      'aria-label',
      side === 'left'
        ? uk()
          ? 'Стік повороту й тяги'
          : 'Yaw and throttle stick'
        : uk()
          ? 'Стік крену й тангажа'
          : 'Roll and pitch stick',
    );
    stick.textContent =
      side === 'left'
        ? uk()
          ? '↔ Поворот · ↕ Тяга'
          : '↔ Yaw · ↕ Throttle'
        : uk()
          ? '↔ Крен · ↕ Тангаж'
          : '↔ Roll · ↕ Pitch';
    stick.style.cssText =
      'width:min(28vw,120px);height:96px;touch-action:none;pointer-events:auto;opacity:.8';
    let origin = null;
    listen(stick, 'pointerdown', (event) => {
      if (event.button > 0) return;
      event.preventDefault();
      event.stopPropagation();
      origin = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        throttle: normalized(practice()?.state ?? getPlayer()?.state).throttle,
      };
      stick.setPointerCapture?.(event.pointerId);
      touch.throttle = origin.throttle;
      void takeOver('touch', { ...touch, actions: 0 });
    });
    listen(stick, 'pointermove', (event) => {
      if (origin?.id !== event.pointerId) return;
      Object.assign(
        touch,
        touchStickValues({
          side,
          dx: event.clientX - origin.x,
          dy: origin.y - event.clientY,
          travel: 48,
          throttle: origin.throttle,
        }),
      );
    });
    const end = (event) => {
      if (origin?.id !== event.pointerId) return;
      origin = null;
      if (side === 'left') touch.yaw = 0;
      else touch.roll = touch.pitch = 0;
    };
    listen(stick, 'pointerup', end);
    listen(stick, 'pointercancel', end);
    controls.append(stick);
  }
  canvas.parentElement?.append(controls);
  let hintKey = null,
    padHint = null;
  const updateControllerHint = () => {
    const status = radio.status(),
      locale = getContext().locale ?? getLocale(),
      connected = pad.status().connected,
      key = JSON.stringify([
        locale,
        connected,
        status.profile,
        status.verified,
        status.connectionLost,
      ]);
    if (key === hintKey) return;
    hintKey = key;
    if (status.verified && status.profile && !status.connectionLost) {
      const profile = JSON.parse(status.profile),
        names = uk() ? ['крен', 'тангаж', 'поворот', 'газ'] : axes,
        channel = (value) => `${uk() ? 'вісь' : 'axis'} ${value.axis}${value.invert ? ' −' : ''}`,
        arm = profile.switches.arm,
        armLabel = arm
          ? `${uk() ? 'увімкнення' : 'arm'}: ${Number.isInteger(arm.axis) ? channel(arm) : `${uk() ? 'кнопка' : 'button'} ${arm.button}`}`
          : radioButton.textContent;
      padHint = `${profile.device.id} · ${axes.map((name, index) => `${names[index]}: ${channel(profile.channels[name])}`).join(' · ')} · ${armLabel}. ${uk() ? 'Узгодьте положення стіків і газу з паузою, потім увімкніть пульт.' : 'Match the paused sticks and throttle, then arm the radio.'}`;
    } else padHint = connected ? gamepadFlightHelp(locale, { replayControls: false }) : null;
  };
  return {
    hint: () =>
      keyboardFlightHelp(preset().id, getContext().locale ?? getLocale(), {
        actions: false,
        combat: true,
      }),
    controllerHint: () => padHint,
    controller(frame = {}) {
      if (disposed || !visible()) return;
      bindPractice();
      pads = frame.gamepads ?? [];
      frameNow = frame.now ?? win.performance.now();
      const context = getContext();
      if (!context.simRadio && frameNow - lastRadioDiscovery >= 1000) {
        lastRadioDiscovery = frameNow;
        restoreVerifiedRadio(radio, profiles);
      }
      const status = context.simRadio ?? radio.status();
      radioButton.hidden = !status?.verified;
      if (status?.verified && status.profile && status.selected) {
        const key = `${status.selected.key}:${status.profile}`;
        if (key !== radioKey) {
          radioKey = key;
          if (radio.select(status.selected.index)) {
            radio.setProfile(JSON.parse(status.profile), { restoring: true });
            radio.verify();
            radio.reset({
              notify: false,
              pickup: normalized(practice()?.state ?? getPlayer()?.state),
            });
          }
        }
        const input = radio.poll(),
          active = radio.status().active;
        if (active && !radioWasActive) {
          const checkpoint = normalized(practice()?.state ?? getPlayer()?.state);
          if (axes.every((axis) => Math.abs(input[axis] - checkpoint[axis]) <= 0.07)) {
            void takeOver('radio', { ...input, actions: 0 });
          } else radio.reset({ notify: false, pickup: checkpoint });
        }
        radioWasActive = radio.status().active;
      }
      const state = pad.poll({
        gamepads: pads,
        now: frameNow,
        scope: practice()?.phase === 'playing' ? 'flight' : 'ready',
        excludeIndex: status?.verified ? status.selected?.index : null,
      });
      updateControllerHint();
      if (state.actions.some((action) => ['pause', 'back'].includes(action))) {
        release();
        onPause();
        return;
      }
      if (
        practice()?.phase !== 'playing' &&
        state.ready &&
        (state.actions.includes('arm') || (state.intent && !controllerIntent))
      ) {
        const checkpoint = normalized(practice()?.state ?? getPlayer()?.state);
        // Neutral pickup resets the native gamepad accumulator. Resume from
        // this isolated practice checkpoint, never from the older recording.
        pad.seedThrottle(checkpoint.throttle);
        void takeOver('controller', {
          ...state.controls,
          throttle: checkpoint.throttle,
          actions: state.fire ? 1 : 0,
        });
      }
      controllerIntent = state.intent;
    },
    clear: release,
    dispose() {
      if (disposed) return;
      disposed = true;
      keys.clear();
      for (const remove of removers) remove();
      pad.dispose();
      radio.freeze('disposed');
      controls.remove();
      currentPractice?.setInputProvider(null);
    },
  };
}
