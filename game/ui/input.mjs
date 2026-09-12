import { actionForKey, keyCodeForEvent, resolveKeyBindings } from '../key-bindings.mjs';
const neutral = () => ({ direction: null, boost: false, action: false, pickup: false });
export function gamepadCommand(pad) {
  if (!pad?.connected) return { ...neutral(), pause: false };
  const b = (i) => !!pad.buttons?.[i]?.pressed,
    x = pad.axes?.[0] || 0,
    y = pad.axes?.[1] || 0;
  let direction = b(12) ? 'up' : b(15) ? 'right' : b(13) ? 'down' : b(14) ? 'left' : null;
  if (!direction && Math.max(Math.abs(x), Math.abs(y)) > 0.35)
    direction = Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up';
  return { direction, boost: b(5), action: b(0), pickup: b(2), pause: b(9) };
}
export function attachInput({
  arena,
  onPause = () => {},
  onActivity = () => {},
  tapMode = () => false,
  active = () => true,
  onGamepad = () => {},
  getBindings = () => null,
  readControllerCommand = null,
}) {
  if (readControllerCommand !== null && typeof readControllerCommand !== 'function')
    throw new TypeError('readControllerCommand must be a function.');
  const held = new Map(),
    buttons = new Map(),
    captures = new Map(),
    listeners = [];
  const padButtons = [...document.querySelectorAll('[data-move]')],
    boostButton = document.querySelector('#boost-button');
  let order = 0,
    latched = null,
    boostLatched = false,
    boostClickGuard = false,
    boostClickTimer = null,
    padBoost = false,
    action = false,
    pickup = false,
    selectedPad = null,
    padDisconnected = false,
    lastPause = false,
    blockedPad = false,
    destroyed = false;
  const listen = (target, type, fn) => {
    if (target) {
      target.addEventListener(type, fn);
      listeners.push(() => target.removeEventListener(type, fn));
    }
  };
  const editing = (el) =>
    !!el?.closest?.(
      'input,select,textarea,[contenteditable]:not([contenteditable="false"]),[data-game-reading]',
    );
  const shortcut = (e) => e.ctrlKey || e.metaKey || e.altKey;
  const activation = (e) => e.key === ' ' || e.key === 'Enter';
  const localBoost = () =>
    boostLatched || [...held.values(), ...buttons.values()].some((value) => value.boost);
  // Native keyboard clicks run in the activation event's task. Release the
  // duplicate guard afterward so a later assistive click remains usable.
  const finishBoostKeyGesture = () => {
    if (!boostClickGuard) return;
    clearTimeout(boostClickTimer);
    boostClickTimer = setTimeout(() => {
      boostClickGuard = false;
      boostClickTimer = null;
    }, 0);
  };
  const syncPressed = () => {
    padButtons.forEach((b) =>
      b.classList.toggle(
        'pressed',
        latched === b.dataset.move ||
          [...held.values(), ...buttons.values()].some((v) => v.element === b),
      ),
    );
    if (boostButton) {
      const pressed = localBoost() || padBoost;
      boostButton.classList.toggle('pressed', pressed);
      boostButton.setAttribute('aria-pressed', String(pressed));
    }
  };
  const clear = () => {
    const captured = [...captures];
    held.clear();
    buttons.clear();
    captures.clear();
    latched = null;
    boostLatched = false;
    padBoost = false;
    action = false;
    pickup = false;
    blockedPad = true;
    finishBoostKeyGesture();
    syncPressed();
    for (const [id, element] of captured)
      try {
        if (element.hasPointerCapture?.(id)) element.releasePointerCapture(id);
      } catch {}
  };
  // Resuming may synchronously clear input. Record the fresh command only afterward.
  const startDirection = (direction, key, element = null, pointer = false) => {
    onActivity();
    if (!active()) return;
    if (element && tapMode()) latched = latched === direction ? null : direction;
    else {
      latched = null;
      (pointer ? buttons : held).set(key, { direction, order: ++order, element });
    }
    syncPressed();
  };
  const startBoost = (key, pointer = false, toggle = tapMode()) => {
    onActivity();
    if (!active()) return;
    if (toggle) boostLatched = !boostLatched;
    else (pointer ? buttons : held).set(key, { boost: true, element: boostButton });
    syncPressed();
  };
  const down = (e) => {
    if (e.defaultPrevented || shortcut(e) || editing(e.target) || !active()) return;
    const command = actionForKey(resolveKeyBindings(getBindings()), e, { allowRepeat: true }),
      code = keyCodeForEvent(e);
    if (command === 'pause') {
      e.preventDefault();
      if (!e.repeat) {
        clear();
        onPause();
      }
      return;
    }
    if (['up', 'right', 'down', 'left'].includes(command)) {
      e.preventDefault();
      if (!e.repeat) startDirection(command, code);
      return;
    }
    if (command === 'boost') {
      e.preventDefault();
      if (!e.repeat) startBoost(code, false, false);
      syncPressed();
      return;
    }
    if (command === 'stop') {
      e.preventDefault();
      if (!e.repeat) clear();
      return;
    }
    if (command === 'ability' || command === 'pickup') {
      e.preventDefault();
      if (!e.repeat) {
        if (command === 'ability') action = true;
        else pickup = true;
      }
    }
  };
  const up = (e) => {
    if (activation(e)) finishBoostKeyGesture();
    held.delete(keyCodeForEvent(e));
    syncPressed();
  };
  listen(window, 'keydown', down);
  listen(window, 'keyup', up);
  listen(window, 'blur', clear);
  if (!readControllerCommand)
    listen(window, 'gamepaddisconnected', (event) => {
      if (selectedPad && selectedPad.index === event.gamepad?.index) padDisconnected = true;
    });
  for (const b of padButtons) {
    listen(b, 'pointerdown', (e) => {
      if (!active() || (e.button !== undefined && e.button !== 0)) return;
      e.preventDefault();
      startDirection(b.dataset.move, e.pointerId, b, true);
      // Tap steering persists without a held pointer; capture still provides cancellation.
      try {
        b.setPointerCapture(e.pointerId);
        captures.set(e.pointerId, b);
      } catch {}
    });
    const release = (e) => {
      buttons.delete(e.pointerId);
      captures.delete(e.pointerId);
      syncPressed();
      try {
        if (b.hasPointerCapture?.(e.pointerId)) b.releasePointerCapture(e.pointerId);
      } catch {}
    };
    listen(b, 'pointerup', release);
    listen(b, 'pointercancel', clear);
    listen(b, 'lostpointercapture', release);
    listen(b, 'keydown', (e) => {
      if (!activation(e) || shortcut(e) || !active()) return;
      e.preventDefault();
      if (!e.repeat) startDirection(b.dataset.move, e.code, b);
    });
    listen(b, 'keyup', (e) => {
      if (activation(e)) {
        e.preventDefault();
        up(e);
      }
    });
    listen(b, 'blur', () => {
      for (const [key, value] of held) if (value.element === b) held.delete(key);
      syncPressed();
    });
  }
  if (boostButton) {
    listen(boostButton, 'pointerdown', (e) => {
      if (!active() || (e.button !== undefined && e.button !== 0)) return;
      e.preventDefault();
      startBoost(e.pointerId, true);
      try {
        boostButton.setPointerCapture(e.pointerId);
        captures.set(e.pointerId, boostButton);
      } catch {}
    });
    const releaseBoost = (e) => {
      buttons.delete(e.pointerId);
      captures.delete(e.pointerId);
      syncPressed();
      try {
        if (boostButton.hasPointerCapture?.(e.pointerId))
          boostButton.releasePointerCapture(e.pointerId);
      } catch {}
    };
    listen(boostButton, 'pointerup', releaseBoost);
    listen(boostButton, 'pointercancel', clear);
    listen(boostButton, 'lostpointercapture', (e) => {
      // Explicit pointerup removes the capture first and preserves a tap latch.
      // Unexpected capture loss cancels it, so a cancelled gesture cannot stick.
      if (captures.get(e.pointerId) === boostButton) clear();
      else releaseBoost(e);
    });
    listen(boostButton, 'keydown', (e) => {
      if (!activation(e) || shortcut(e) || !active()) return;
      e.preventDefault();
      if (!e.repeat) startBoost(e.code);
      clearTimeout(boostClickTimer);
      boostClickTimer = null;
      boostClickGuard = true;
    });
    listen(boostButton, 'keyup', (e) => {
      if (activation(e)) {
        e.preventDefault();
        up(e);
      }
    });
    listen(boostButton, 'blur', () => {
      finishBoostKeyGesture();
      for (const [key, value] of held) if (value.element === boostButton) held.delete(key);
      syncPressed();
    });
    listen(boostButton, 'click', (e) => {
      e.preventDefault();
      // Pointer clicks have a positive detail; their down/up are handled above.
      // A click-only assistive activation has no release event, so it toggles
      // even in hold steering mode. The next activation or Stop clears it.
      if (e.detail !== 0 || boostClickGuard || shortcut(e) || !active()) return;
      startBoost(null, false, true);
    });
  }
  for (const [id, kind] of [
    ['action-button', 'action'],
    ['pickup-button', 'pickup'],
    ['stop-button', 'stop'],
  ]) {
    const b = document.querySelector(`#${id}`);
    const activate = () => {
      if (kind === 'stop') clear();
      else if (active()) {
        if (kind === 'action') action = true;
        else pickup = true;
      }
      arena.focus({ preventScroll: true });
    };
    listen(b, 'click', activate);
    // Prevent native Enter repeat / Space click from turning one press into many actions.
    listen(b, 'keydown', (e) => {
      if (!activation(e) || shortcut(e)) return;
      e.preventDefault();
      if (!e.repeat) activate();
    });
    listen(b, 'keyup', (e) => {
      if (activation(e)) e.preventDefault();
    });
  }
  const poll = () => {
    if (destroyed) return neutral();
    let cmd;
    if (readControllerCommand) {
      let supplied;
      try {
        supplied = readControllerCommand();
      } catch {}
      cmd = {
        direction: ['up', 'right', 'down', 'left'].includes(supplied?.direction)
          ? supplied.direction
          : null,
        boost: supplied?.boost === true,
        action: supplied?.action === true,
        pickup: supplied?.pickup === true,
        pause: supplied?.pause === true,
        stop: supplied?.stop === true,
        hangar: supplied?.hangar === true,
      };
    } else {
      let pads = [];
      try {
        pads = [...(navigator.getGamepads?.() || [])]
          .map((pad, index) => ({
            pad,
            index: pad?.index ?? index,
            signature: JSON.stringify([
              pad?.id ?? '',
              pad?.mapping,
              pad?.buttons?.length,
              pad?.axes?.length,
            ]),
          }))
          .filter(({ pad }) => pad?.connected && pad.mapping === 'standard');
      } catch {}
      const found = selectedPad
        ? pads.find(
            (candidate) =>
              candidate.index === selectedPad.index &&
              candidate.signature === selectedPad.signature,
          )
        : pads[0];
      if (selectedPad && (!found || padDisconnected)) {
        selectedPad = null;
        padDisconnected = false;
        clear();
        onPause(true);
        onGamepad('Controller disconnected. Release controls before continuing.');
        return neutral();
      }
      if (found && !selectedPad) {
        selectedPad = { index: found.index, signature: found.signature };
        onGamepad('Standard controller connected');
      }
      cmd = gamepadCommand(found?.pad);
    }
    if (!active()) {
      clear();
      lastPause = false;
      return neutral();
    }
    if (blockedPad) {
      if (
        !cmd.direction &&
        !cmd.boost &&
        !cmd.action &&
        !cmd.pickup &&
        !cmd.pause &&
        !cmd.stop &&
        !cmd.hangar
      )
        blockedPad = false;
      cmd = gamepadCommand(null);
    }
    if (cmd.pause && !lastPause) {
      lastPause = true;
      clear();
      onPause();
      return neutral();
    }
    if (cmd.stop) {
      clear();
      return neutral();
    }
    lastPause = cmd.pause;
    padBoost = cmd.boost;
    syncPressed();
    const newest = [...held.values(), ...buttons.values()]
      .filter((x) => x.direction)
      .sort((a, b) => b.order - a.order)[0];
    const result = {
      direction: newest?.direction || latched || cmd.direction || null,
      boost: localBoost() || cmd.boost,
      action: action || cmd.action,
      pickup: pickup || cmd.pickup,
    };
    action = false;
    pickup = false;
    return result;
  };
  syncPressed();
  return {
    poll,
    clear,
    destroy() {
      clear();
      destroyed = true;
      clearTimeout(boostClickTimer);
      for (const remove of listeners) remove();
    },
  };
}
