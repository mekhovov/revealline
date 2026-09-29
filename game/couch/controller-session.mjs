import {
  descriptorKey,
  deviceDescriptor,
  buttonValue,
  standardProfile,
  validateProfile,
  mapProfile,
} from './controller-profiles.mjs';
const blank = () => Array.from({ length: 16 }, () => ({ pressed: false, value: 0 }));
const positions = {
  up: 12,
  right: 15,
  down: 13,
  left: 14,
  action: 0,
  pickup: 2,
  boost: 5,
  pause: 9,
  confirm: 0,
  back: 1,
  menu: 9,
};
/** Physical connection ownership is separate from mappings and the single menu owner.
 * The host supplies one browser snapshot; no timers or additional hardware reads. */
export function createControllerSession({
  eventTarget = globalThis.window,
  onLoss = () => {},
} = {}) {
  const devices = new Map(),
    seats = [null, null],
    lostEvents = new Set();
  let generation = 0,
    menuSeat = null,
    scope = null,
    available = 'available',
    disposed = false,
    editable = true,
    capturing = false;
  let frame = { pads: [], menuPads: [], slots: [null, null] };
  function releaseState(d) {
    d.blocked = true;
    d.previous = new Map();
  }
  function clear() {
    for (const d of devices.values()) releaseState(d);
  }
  function lose(index) {
    const seat = seats.indexOf(index);
    devices.delete(index);
    if (seat !== -1) {
      seats[seat] = null;
      if (menuSeat === seat) menuSeat = null;
      clear();
      onLoss(seat);
    }
  }
  const disconnect = (e) => {
    const index = e.gamepad?.index;
    lostEvents.add(index);
    lose(index);
  };
  eventTarget?.addEventListener?.('gamepaddisconnected', disconnect);
  function select(index, seat) {
    if (!editable || !Number.isInteger(seat) || seat < 0 || seat > 1) return false;
    const d = devices.get(index);
    if (!d?.profile || seats.includes(index)) return false;
    if (seats[seat] !== null) releaseState(devices.get(seats[seat]));
    seats[seat] = index;
    releaseState(d);
    if (menuSeat === null) menuSeat = seat;
    return true;
  }
  function virtual(d, command, blocked = false) {
    const buttons = blank();
    if (!blocked) {
      for (const [action, value] of Object.entries(command))
        if (
          action !== 'direction' &&
          !['up', 'right', 'down', 'left'].includes(action) &&
          positions[action] !== undefined &&
          value
        )
          buttons[positions[action]] = { pressed: true, value: 1 };
      if (command.direction) buttons[positions[command.direction]] = { pressed: true, value: 1 };
    }
    return {
      index: d.index,
      id: `couch:${d.generation}:${d.revision}`,
      mapping: 'standard',
      connected: true,
      axes: [0, 0, 0, 0],
      buttons,
      timestamp: d.pad.timestamp || 0,
    };
  }
  function sample(raw, { active = false, error = null } = {}) {
    if (disposed) return frame;
    editable = !active;
    if (scope !== active) {
      clear();
      scope = active;
    }
    available = error ? 'unavailable' : 'available';
    const incoming = new Map();
    if (!error)
      for (const pad of Array.from(raw || []).slice(0, 32)) {
        if (
          !pad?.connected ||
          !Number.isInteger(pad.index) ||
          pad.index < 0 ||
          pad.index > 1023 ||
          lostEvents.has(pad.index)
        )
          continue;
        const descriptor = deviceDescriptor(pad);
        if (
          descriptor.axes > 64 ||
          descriptor.buttons > 256 ||
          !['', 'standard'].includes(descriptor.mapping)
        )
          continue;
        incoming.set(pad.index, pad);
      }
    for (const [index, d] of devices)
      if (!incoming.has(index) || descriptorKey(incoming.get(index)) !== d.key) lose(index);
    lostEvents.clear();
    for (const [index, pad] of incoming) {
      if (!devices.has(index))
        devices.set(index, {
          index,
          generation: ++generation,
          revision: 0,
          key: descriptorKey(pad),
          profile: pad.mapping === 'standard' ? standardProfile(pad) : null,
          standard: pad.mapping === 'standard',
          blocked: true,
          previous: new Map(),
          joinWas: false,
        });
      devices.get(index).pad = pad;
    }
    let confirmHeld = false;
    const pads = [],
      menuPads = [],
      paused = [];
    for (const d of [...devices.values()].sort((a, b) => a.index - b.index)) {
      if (!d.profile) continue;
      const mapped = mapProfile(d.profile, d.pad, d.previous);
      d.previous = mapped.state;
      if (!mapped.valid) {
        if (seats.includes(d.index)) {
          lose(d.index);
        }
        continue;
      }
      const join = d.standard
        ? [0, 1, 2, 3, 9].some((i) => buttonValue(d.pad.buttons?.[i]) >= 0.5)
        : mapped.menu.confirm || mapped.menu.menu;
      const neutral = mapped.neutral && !join;
      let seat = seats.indexOf(d.index);
      if (d.blocked) {
        if (neutral) d.blocked = false;
        d.joinWas = join;
      } else if (seat === -1 && !capturing && !active && join && !d.joinWas) {
        seat = seats.indexOf(null);
        if (seat !== -1) select(d.index, seat);
      } else if (seat !== -1 && active && mapped.flight.pause && !d.pauseWas) paused.push(seat);
      else if (seat !== -1 && !capturing && !active && menuSeat === null && join && !d.joinWas) {
        menuSeat = seat;
        releaseState(d);
      }
      d.joinWas = join;
      d.pauseWas = mapped.flight.pause;
      if (seat !== -1) {
        pads[d.index] = virtual(d, mapped.flight, d.blocked || capturing);
        if (menuSeat === seat && !capturing) {
          menuPads[d.index] = virtual(d, mapped.menu, d.blocked);
          confirmHeld = mapped.menu.confirm;
        }
      }
    }
    if (paused.length) menuSeat = Math.min(...paused);
    frame = { pads, menuPads, slots: [...seats], confirmHeld };
    return frame;
  }
  return {
    sample,
    clear,
    capture(value) {
      capturing = !!value;
      clear();
    },
    frame: () => frame,
    state: () => ({
      available,
      editable,
      menuSeat,
      seats: [...seats],
      devices: [...devices.values()].map((d) => ({
        index: d.index,
        generation: d.generation,
        device: deviceDescriptor(d.pad),
        profile: d.profile ? structuredClone(d.profile) : null,
        waiting: d.blocked,
        standard: d.standard,
      })),
    }),
    completeFlight: (seat) => {
      const profile = devices.get(seats[seat])?.profile;
      return !!profile && Object.values(profile.flight).every((sources) => sources.length > 0);
    },
    raw: (index) => devices.get(index)?.pad || null,
    assign: select,
    apply(index, profile) {
      if (!editable) return false;
      const d = devices.get(index);
      if (!d) return false;
      const p = validateProfile(profile);
      const descriptor = deviceDescriptor(d.pad);
      if (Object.keys(descriptor).some((key) => p.device[key] !== descriptor[key]))
        throw new Error('Profile does not match this device. Configure it again.');
      d.profile = p;
      d.standard = false;
      d.revision++;
      releaseState(d);
      return true;
    },
    release(seat) {
      if (!editable) return;
      const d = devices.get(seats[seat]);
      if (d) releaseState(d);
      seats[seat] = null;
      if (menuSeat === seat) menuSeat = null;
    },
    swap() {
      if (!editable) return;
      seats.reverse();
      if (menuSeat !== null) menuSeat = 1 - menuSeat;
      clear();
    },
    menu(seat) {
      if (!editable || (seat !== null && seats[seat] === null)) return;
      menuSeat = seat;
      clear();
    },
    dispose() {
      disposed = true;
      eventTarget?.removeEventListener?.('gamepaddisconnected', disconnect);
      devices.clear();
      seats.fill(null);
      frame = { pads: [], menuPads: [], slots: [null, null] };
    },
  };
}
