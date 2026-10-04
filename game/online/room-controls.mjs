import { required } from '../data-json.mjs';

export const ROOM_CONTROL_PROTOCOL = 'revealline-room-controls.v2';
export const LEGACY_ROOM_PROTOCOL = 'revealline-room.v1';
export const ROOM_PROTOCOL = 'revealline-room.v2';
export const roomIdleControls = () => ({
  direction: null,
  boost: false,
  support: false,
  action: false,
  pickup: false,
  steer: false,
});

/** Physical holds and one-step gestures have separate ownership. The native
 * adapters receive only their own admitted command vocabulary. */
export function roomControls(input, protocol = ROOM_PROTOCOL) {
  required(
    input &&
      (input.direction === null || ['up', 'right', 'down', 'left'].includes(input.direction)) &&
      typeof input.boost === 'boolean' &&
      typeof input.support === 'boolean',
    'Invalid room controls.',
  );
  const result = { direction: input.direction, boost: input.boost, support: input.support };
  if (protocol === LEGACY_ROOM_PROTOCOL) return result;
  for (const key of ['action', 'pickup', 'steer']) {
    required(input[key] === undefined || typeof input[key] === 'boolean', 'Invalid room gesture.');
    result[key] = input[key] === true;
  }
  return result;
}

export function roomCaptureControls({ direction, boost, action = false, pickup = false }) {
  return { direction, boost, action, pickup };
}
export function roomTeamControls({ direction, boost, support, steer = false }) {
  return { direction, boost, support, steer };
}

/** Each physical source owns only its own Support hold. Menus/backgrounding
 * clear all sources; a repeating Space event cannot reactivate a cleared hold. */
export function attachRoomSupport({ document, button, active, isTeam, pause }) {
  const held = new Set(),
    pointers = new Set();
  const down = (event) => {
    if (
      event.code !== 'Space' ||
      event.repeat ||
      event.defaultPrevented ||
      event.target?.closest?.('input,select,textarea,button,[contenteditable]') ||
      !active()
    )
      return;
    event.preventDefault();
    if (isTeam()) held.add('keyboard');
    else pause();
  };
  const up = (event) => {
    if (event.code === 'Space') held.delete('keyboard');
  };
  const pointerDown = (event) => {
    if (!active() || !isTeam() || event.button !== 0) return;
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.add(event.pointerId);
    held.add(event.pointerId);
  };
  const pointerUp = (event) => {
    pointers.delete(event.pointerId);
    held.delete(event.pointerId);
  };
  document.addEventListener('keydown', down);
  document.addEventListener('keyup', up);
  button.addEventListener('pointerdown', pointerDown);
  const releases = ['pointerup', 'pointercancel', 'lostpointercapture'];
  for (const type of releases) button.addEventListener(type, pointerUp);
  function clear() {
    held.clear();
    const prior = [...pointers];
    pointers.clear();
    for (const id of prior) if (button.hasPointerCapture?.(id)) button.releasePointerCapture(id);
  }
  return Object.freeze({
    held: () => held.size > 0,
    clear,
    dispose() {
      clear();
      document.removeEventListener('keydown', down);
      document.removeEventListener('keyup', up);
      button.removeEventListener('pointerdown', pointerDown);
      for (const type of releases) button.removeEventListener(type, pointerUp);
    },
  });
}
