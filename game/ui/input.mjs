const keys = {
  ArrowUp: 'up',
  ArrowRight: 'right',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  w: 'up',
  d: 'right',
  s: 'down',
  a: 'left',
};
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
}) {
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
    padWas = false,
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
    !!el?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
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
    const key = e.key.toLowerCase(),
      dir = keys[e.key] || keys[key];
    if (e.key === 'Escape' || key === 'p') {
      e.preventDefault();
      if (!e.repeat) {
        clear();
        onPause();
      }
      return;
    }
    if (dir) {
      e.preventDefault();
      if (!e.repeat) startDirection(dir, e.code);
      return;
    }
    if (e.key === 'Shift') {
      e.preventDefault();
      if (!e.repeat) held.set(e.code, { boost: true, order: ++order });
      syncPressed();
      return;
    }
    if (key === 'e' || key === 'r') {
      e.preventDefault();
      if (!e.repeat) {
        if (key === 'e') action = true;
        else pickup = true;
      }
    }
  };
  const up = (e) => {
    if (activation(e)) finishBoostKeyGesture();
    held.delete(e.code);
    syncPressed();
  };
  listen(window, 'keydown', down);
  listen(window, 'keyup', up);
  listen(window, 'blur', clear);
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
    let pad;
    try {
      pad = [...(navigator.getGamepads?.() || [])].find(
        (p) => p?.connected && p.mapping === 'standard',
      );
    } catch {}
    if (!!pad !== padWas) {
      if (padWas) {
        clear();
        onPause(true);
      }
      padWas = !!pad;
      onGamepad(pad ? 'Standard controller connected' : 'Keyboard / touch');
    }
    if (!active()) {
      clear();
      lastPause = false;
      return neutral();
    }
    let cmd = gamepadCommand(pad);
    if (blockedPad) {
      if (!cmd.direction && !cmd.boost && !cmd.action && !cmd.pickup && !cmd.pause)
        blockedPad = false;
      cmd = gamepadCommand(null);
    }
    if (cmd.pause && !lastPause) {
      lastPause = true;
      clear();
      onPause();
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
