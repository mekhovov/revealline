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
