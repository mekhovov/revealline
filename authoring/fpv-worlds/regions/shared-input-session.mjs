/** Regional review host using the production input adapters; no scoring or player admission. */
import {
  createFlightInput,
  createFlightGamepad,
  keyboardFlightPreset,
} from "../../../optional-practice/civilian-fpv/input.mjs";

export function createRegionalInputSession({
  window: win,
  document: doc,
  createFlight,
  onFlight = () => {},
  onState = () => {},
  onCamera = () => {},
  onError = () => {},
} = {}) {
  let flight = null,
    config = null,
    closed = false,
    generation = 0,
    preparation = 0;
  let busy = false,
    blocked = false,
    accumulator = 0,
    lastTime = null,
    queue = Promise.resolve();
  let source = "keyboard",
    preset = "two-stick",
    command = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  const editing = () =>
    ["INPUT", "TEXTAREA", "SELECT"].includes(doc.activeElement?.tagName) ||
    doc.activeElement?.isContentEditable;
  const focused = () =>
    !doc.hidden &&
    doc.visibilityState !== "hidden" &&
    doc.hasFocus?.() !== false;
  const notify = () => onState(flight?.snapshot() ?? null);
  const input = createFlightInput({
    window: win,
    document: doc,
    onPause: (reason) => pause(reason),
  });
  const gamepad = createFlightGamepad({ window: win, document: doc });
  const clear = () => {
    input.enable(false);
    gamepad.reset();
    accumulator = 0;
    lastTime = null;
    command = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
  };
  function pause() {
    if (closed) return;
    clear();
    flight?.pause();
    if (busy && flight) {
      preparation++;
      flight.cancelPreparation();
    }
    notify();
  }
  async function prepare() {
    if (closed || busy || !flight) return false;
    const current = flight,
      token = generation,
      attempt = ++preparation;
    clear();
    current.pause();
    busy = true;
    notify();
    try {
      await current.prepare();
      return !closed && token === generation && attempt === preparation;
    } catch (error) {
      if (!closed && token === generation && attempt === preparation)
        onError(error);
      return false;
    } finally {
      if (!closed && token === generation) {
        busy = false;
        clear();
        notify();
      }
    }
  }
  function replace(nextConfig = config) {
    if (closed || !nextConfig) return Promise.resolve(false);
    config = { ...nextConfig };
    const token = ++generation;
    preparation++;
    clear();
    busy = true;
    const previous = flight;
    flight = null;
    previous?.pause();
    previous?.cancelPreparation();
    onFlight(null);
    notify();
    const operation = queue
      .then(async () => {
        await previous?.dispose();
        if (closed || token !== generation) return false;
        flight = createFlight(config);
        onFlight(flight);
        busy = false;
        if (!focused()) {
          notify();
          return false;
        }
        return prepare();
      })
      .catch((error) => {
        if (!closed && token === generation) {
          busy = false;
          onError(error);
        }
        return false;
      });
    queue = operation;
    return operation;
  }
  function arm() {
    if (closed || busy || blocked || editing() || !flight || !focused())
      return false;
    if (source === "controller" && !gamepad.status().canArm) return false;
    const controls =
      source === "controller" ? gamepad.status().controls : input.sample(0);
    if (!flight.arm(controls)) return false;
    input.enable(true);
    accumulator = 0;
    lastTime = null;
    notify();
    return true;
  }
  function advance(now) {
    if (closed) return;
    if (editing() && flight?.snapshot().status === "active") {
      pause();
      return;
    }
    if (
      !focused() ||
      !Number.isFinite(now) ||
      (lastTime !== null && (now < lastTime || now - lastTime > 250))
    ) {
      pause();
      return;
    }
    let pads = [];
    try {
      pads = win.navigator?.getGamepads?.() ?? [];
    } catch {
      /* Other controls remain usable. */
    }
    const beforePoll = flight;
    const state = flight?.snapshot();
    const scope =
      source !== "controller" || busy || blocked || editing() || !flight
        ? "blocked"
        : state.status === "active"
          ? "flight"
          : state.reason === "prepared"
            ? "ready"
            : "blocked";
    const sampled = gamepad.poll({ gamepads: pads, now, scope });
    for (const action of sampled.actions) {
      if (action === "arm") arm();
      else if (action === "reset") void replace();
      else if (action === "camera") onCamera();
      else if (action === "pause" || action === "back") pause();
    }
    // Losing controller ownership must freeze the body, never apply neutral thrust.
    // An explicit Arm accepted from ready above starts on the next poll instead.
    if (
      source === "controller" &&
      state?.status === "active" &&
      !sampled.active &&
      beforePoll === flight
    ) {
      pause();
      return;
    }
    if (
      beforePoll !== flight ||
      !flight ||
      busy ||
      blocked ||
      flight.snapshot().status !== "active"
    ) {
      lastTime = null;
      accumulator = 0;
      return;
    }
    const elapsed = lastTime === null ? 0 : now - lastTime;
    lastTime = now;
    accumulator += elapsed;
    while (accumulator >= 20 && flight?.snapshot().status === "active") {
      accumulator -= 20;
      command =
        source === "controller" ? gamepad.sample(0.02) : input.sample(0.02);
      const next = flight.step(command);
      if (next.status !== "active") {
        clear();
        notify();
        if (next.reason === "terrain-required") void prepare();
        break;
      }
    }
  }
  const actionKey = (event) => {
    if (
      closed ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      source !== "keyboard"
    )
      return;
    if (
      ["INPUT", "TEXTAREA", "SELECT", "BUTTON", "SUMMARY"].includes(
        event.target?.tagName,
      ) ||
      event.target?.isContentEditable
    )
      return;
    const keys = keyboardFlightPreset(preset);
    if (event.code === keys.arm) {
      event.preventDefault();
      if (flight?.snapshot().status === "active") pause();
      else arm();
    } else if (event.code === keys.reset) {
      event.preventDefault();
      void replace();
    }
  };
  win.addEventListener("keydown", actionKey);
  return Object.freeze({
    replace,
    prepare,
    arm,
    pause,
    advance,
    block(value) {
      if (value) pause();
      blocked = !!value;
    },
    get flight() {
      return flight;
    },
    status: () => ({
      busy,
      blocked,
      source,
      closed,
      controls: { ...command },
      gamepad: gamepad.status(),
    }),
    select(value) {
      if (closed) return;
      if (!["keyboard", "touch", "controller"].includes(value))
        throw new TypeError("Unsupported regional input source");
      pause();
      source = value;
      input.select(value);
      notify();
    },
    keyboardPreset(value) {
      pause();
      input.keyboardPreset(value);
      preset = value;
    },
    bindStick: (element, side) => input.bindStick(element, side),
    setMode(value) {
      pause();
      flight?.setMode(value);
      if (config) config = { ...config, mode: value };
      notify();
    },
    async dispose() {
      if (closed) return queue;
      pause();
      closed = true;
      generation++;
      preparation++;
      input.dispose();
      gamepad.dispose();
      win.removeEventListener("keydown", actionKey);
      const previous = flight;
      flight = null;
      previous?.cancelPreparation();
      onFlight(null);
      await queue;
      await previous?.dispose();
    },
  });
}
