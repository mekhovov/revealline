const DIRECTIONS = ['up', 'right', 'down', 'left'];
const USED_BUTTONS = [0, 1, 2, 3, 5, 9, 12, 13, 14, 15];
const JOIN_BUTTONS = [0, 1, 2, 3, 9];
export const neutralControllerFlight = () => ({
  direction: null,
  boost: false,
  action: false,
  pickup: false,
  pause: false,
  hangar: false,
  stop: false,
});
export const neutralControllerUI = () => ({
  direction: null,
  confirm: false,
  back: false,
  menu: false,
});
const axis = (value) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0);
const pressed = (button) =>
  button?.pressed === true ||
  (Number.isFinite(button?.value) && button.value >= 0.5 && button.value <= 1);
const defaultRead = () => {
  if (typeof globalThis.navigator?.getGamepads !== 'function')
    throw new Error('Gamepad API unavailable');
  return globalThis.navigator.getGamepads();
};

/** One hardware read per sample. Does not run a timer, move DOM focus, or invoke
 * game actions. The host chooses a stable UI scope; only "flight" emits flight.
 * clear() retains the pad but requires neutral. invalidate() requires rejoining.
 */
export function createControllerRouter({
  readPads = defaultRead,
  now = () => globalThis.performance?.now?.() ?? Date.now(),
  eventTarget = globalThis.window,
  deadZone = 0.35,
  repeatDelayMs = 350,
  repeatIntervalMs = 120,
} = {}) {
  if (typeof readPads !== 'function' || typeof now !== 'function')
    throw new TypeError('Controller readers must be functions.');
  if (
    !Number.isFinite(deadZone) ||
    deadZone < 0.1 ||
    deadZone > 0.6 ||
    !Number.isFinite(repeatDelayMs) ||
    repeatDelayMs < 100 ||
    repeatDelayMs > 2000 ||
    !Number.isFinite(repeatIntervalMs) ||
    repeatIntervalMs < 50 ||
    repeatIntervalMs > 1000
  )
    throw new RangeError('Controller thresholds or repeat timing are out of bounds.');
  const seen = new Map();
  let generation = 0,
    assigned = null,
    blocked = true,
    lastScope = null,
    previousButtons = new Set(),
    repeatDirection = null,
    repeatAt = 0,
    lastTime = 0,
    pendingDisconnect = false,
    destroyed = false;

  function clear() {
    blocked = true;
    previousButtons.clear();
    repeatDirection = null;
    repeatAt = 0;
    for (const candidate of seen.values()) candidate.armed = false;
  }
  function invalidate() {
    pendingDisconnect = pendingDisconnect || assigned !== null;
    assigned = null;
    clear();
    seen.clear();
  }
  function disconnect(index) {
    if (!Number.isInteger(index) || index < 0) return;
    seen.delete(index);
    if (assigned?.index === index) {
      pendingDisconnect = true;
      assigned = null;
      clear();
    }
  }
  const disconnectedEvent = (event) => disconnect(event.gamepad?.index);
  eventTarget?.addEventListener?.('gamepaddisconnected', disconnectedEvent);

  function snapshot(pad, fallbackIndex) {
    if (!pad?.connected || pad.mapping !== 'standard') return null;
    const index = pad.index ?? fallbackIndex;
    if (!Number.isInteger(index) || index < 0 || index > 1023) return null;
    const buttons = new Set(USED_BUTTONS.filter((i) => pressed(pad.buttons?.[i])));
    const x = axis(pad.axes?.[0]),
      y = axis(pad.axes?.[1]);
    const digital = [12, 15, 13, 14].findIndex((i) => buttons.has(i));
    const direction =
      digital >= 0
        ? DIRECTIONS[digital]
        : Math.max(Math.abs(x), Math.abs(y)) > deadZone
          ? Math.abs(x) > Math.abs(y)
            ? x > 0
              ? 'right'
              : 'left'
            : y > 0
              ? 'down'
              : 'up'
          : null;
    const id = typeof pad.id === 'string' ? pad.id.slice(0, 512) : '';
    const signature = JSON.stringify([
      id,
      pad.mapping,
      pad.buttons?.length ?? 0,
      pad.axes?.length ?? 0,
    ]);
    return {
      index,
      id,
      mapping: 'standard',
      signature,
      buttons,
      direction,
      neutral: !direction && buttons.size === 0,
    };
  }
  const result = (
    code,
    message,
    flight = neutralControllerFlight(),
    ui = neutralControllerUI(),
    disconnected = false,
  ) => ({
    flight,
    ui,
    status: { code, message },
    assigned: assigned
      ? {
          index: assigned.index,
          id: assigned.id,
          mapping: assigned.mapping,
          generation: assigned.generation,
        }
      : null,
    disconnected,
  });

  function sample({ scope, timeMs } = {}) {
    if (destroyed) return result('disposed', 'Controller input is stopped.');
    if (typeof scope !== 'string' || !scope || scope.length > 160)
      throw new TypeError('Controller scope must be a stable nonempty string.');
    const clock = timeMs ?? now();
    const time = Number.isFinite(clock) ? Math.max(lastTime, clock) : lastTime;
    lastTime = time;
    if (scope !== lastScope) {
      clear();
      lastScope = scope;
    }
    let raw;
    try {
      raw = readPads();
    } catch {
      invalidate();
      const disconnected = pendingDisconnect;
      pendingDisconnect = false;
      return result(
        'unavailable',
        'Controller access is unavailable. Keyboard and touch remain available.',
        undefined,
        undefined,
        disconnected,
      );
    }
    const pads = new Map();
    let connected = false;
    // Browser slots are array-like, sometimes sparse. Bound even injected input.
    const count = Number.isInteger(raw?.length) ? Math.max(0, Math.min(32, raw.length)) : 0;
    for (let i = 0; i < count; i++) {
      connected = connected || raw[i]?.connected === true;
      const pad = snapshot(raw[i], i);
      if (pad && !pads.has(pad.index)) pads.set(pad.index, pad);
    }
    for (const [index, old] of seen) {
      if (pads.get(index)?.signature === old.signature) continue;
      seen.delete(index);
      if (assigned?.index === index) {
        assigned = null;
        pendingDisconnect = true;
        clear();
      }
    }
    for (const pad of pads.values()) {
      let candidate = seen.get(pad.index);
      if (!candidate) {
        candidate = { ...pad, generation: ++generation, armed: false, previousJoin: new Set() };
        seen.set(pad.index, candidate);
      }
      if (pad.neutral) candidate.armed = true;
    }
    if (pendingDisconnect) {
      pendingDisconnect = false;
      clear();
      return result(
        'disconnected',
        'Controller disconnected. Release controls, then press a face button to join again.',
        undefined,
        undefined,
        true,
      );
    }
    if (!assigned) {
      for (const pad of [...pads.values()].sort((a, b) => a.index - b.index)) {
        const candidate = seen.get(pad.index);
        const join =
          candidate.armed &&
          JOIN_BUTTONS.some((i) => pad.buttons.has(i) && !candidate.previousJoin.has(i));
        candidate.previousJoin = new Set(pad.buttons);
        if (join) {
          assigned = candidate;
          clear();
          return result('joined', 'Controller joined. Release controls to continue.');
        }
      }
      if (!pads.size)
        return connected
          ? result(
              'unsupported',
              'This controller has no standard mapping. Keyboard and touch remain available.',
            )
          : result(
              'waiting-controller',
              'Connect a controller and use it while this page is visible.',
            );
      return [...seen.values()].some((candidate) => candidate.armed)
        ? result('ready-to-join', 'Press a face button or Menu to join.')
        : result('waiting-neutral', 'Release the controller buttons and movement stick.');
    }
    const pad = pads.get(assigned.index);
    // An assigned pad always has a corresponding seen entry until loss handling.
    if (!pad) {
      invalidate();
      return sampleLoss();
    }
    if (blocked) {
      if (pad.neutral) blocked = false;
      previousButtons = new Set(pad.buttons);
      return result(
        blocked ? 'waiting-neutral' : 'connected',
        blocked ? 'Release the controller buttons and movement stick.' : 'Controller ready.',
      );
    }
    const edge = (i) => pad.buttons.has(i) && !previousButtons.has(i);
    const flight = neutralControllerFlight(),
      ui = neutralControllerUI();
    if (scope === 'flight') {
      if (edge(9)) flight.pause = true;
      else if (edge(3)) flight.hangar = true;
      else if (edge(1)) flight.stop = true;
      else
        Object.assign(flight, {
          direction: pad.direction,
          boost: pad.buttons.has(5),
          action: pad.buttons.has(0),
          pickup: pad.buttons.has(2),
        });
      if (flight.pause || flight.hangar || flight.stop) clear();
    } else {
      if (edge(9)) ui.menu = true;
      else if (edge(1)) ui.back = true;
      else if (edge(0)) ui.confirm = true;
      if (!ui.menu && !ui.back && !ui.confirm && pad.direction) {
        if (pad.direction !== repeatDirection || time >= repeatAt) {
          ui.direction = pad.direction;
          repeatAt = time + (pad.direction !== repeatDirection ? repeatDelayMs : repeatIntervalMs);
        }
      }
      if (!pad.direction || pad.direction !== repeatDirection || ui.menu || ui.back || ui.confirm) {
        if (ui.menu || ui.back || ui.confirm) repeatAt = time + repeatDelayMs;
        else if (!pad.direction) repeatAt = 0;
      }
      repeatDirection = pad.direction;
    }
    previousButtons = new Set(pad.buttons);
    return result('connected', 'Controller ready.', flight, ui);
  }
  function sampleLoss() {
    pendingDisconnect = false;
    return result(
      'disconnected',
      'Controller disconnected. Release controls, then press a face button to join again.',
      undefined,
      undefined,
      true,
    );
  }
  return {
    sample,
    clear,
    invalidate,
    disconnect,
    destroy() {
      invalidate();
      destroyed = true;
      eventTarget?.removeEventListener?.('gamepaddisconnected', disconnectedEvent);
    },
  };
}
