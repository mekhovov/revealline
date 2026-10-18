import { boundedJSON, exactKeys } from '../data-json.mjs';
import { isBindablePhysicalKey, keyLabel } from '../key-bindings.mjs';
import { t } from '../i18n/index.mjs';

export const COUCH_KEYBOARD_VERSION = 'revealline-couch-keyboard.v1';
export const COUCH_KEYBOARD_ACTIONS = Object.freeze([
  'up',
  'down',
  'left',
  'right',
  'action',
  'pickup',
  'boost',
]);
const defaults = [
  {
    up: 'KeyW',
    down: 'KeyS',
    left: 'KeyA',
    right: 'KeyD',
    action: 'KeyQ',
    pickup: 'KeyE',
    boost: 'ShiftLeft',
  },
  {
    up: 'ArrowUp',
    down: 'ArrowDown',
    left: 'ArrowLeft',
    right: 'ArrowRight',
    action: 'Enter',
    pickup: 'Slash',
    boost: 'ShiftRight',
  },
];
export class CouchKeyboardError extends TypeError {
  constructor(reason, values = {}) {
    super(`Invalid couch keyboard bindings: ${reason}.`);
    this.reason = reason;
    this.values = values;
  }
}
function checkCode(code, seat, action) {
  const legacyEnter = seat === 1 && action === 'action' && code === 'Enter';
  if ((!isBindablePhysicalKey(code) && !legacyEnter) || ['Escape', 'KeyP'].includes(code))
    throw new CouchKeyboardError('reserved', { key: keyLabel(code) || String(code) });
}
export function resolveCouchKeyboard(source = null) {
  const value =
    source === null
      ? { version: COUCH_KEYBOARD_VERSION, seats: defaults.map((seat) => ({ ...seat })) }
      : boundedJSON(source, {
          maxBytes: 4096,
          maxNodes: 64,
          maxDepth: 4,
          maxArray: 2,
          maxString: 64,
        });
  exactKeys(value, ['version', 'seats'], 'couch keyboard');
  if (
    value.version !== COUCH_KEYBOARD_VERSION ||
    !Array.isArray(value.seats) ||
    value.seats.length !== 2
  )
    throw new CouchKeyboardError('format');
  const claimed = new Map();
  for (const [seat, bindings] of value.seats.entries()) {
    exactKeys(bindings, COUCH_KEYBOARD_ACTIONS, 'keyboard seat');
    for (const action of COUCH_KEYBOARD_ACTIONS) {
      const code = bindings[action];
      // Preserve the existing second-seat Enter action. Native focused controls
      // keep ownership of Enter, and capture cannot newly assign it elsewhere.
      checkCode(code, seat, action);
      if (claimed.has(code)) {
        const [player, usedAction] = claimed.get(code);
        throw new CouchKeyboardError('conflict', {
          key: keyLabel(code),
          player: player + 1,
          action: usedAction,
        });
      }
      claimed.set(code, [seat, action]);
    }
  }
  return value;
}
export function replaceCouchKey(source, seat, action, code) {
  if (![0, 1].includes(seat) || !COUCH_KEYBOARD_ACTIONS.includes(action))
    throw new CouchKeyboardError('format');
  const value = resolveCouchKeyboard(source);
  checkCode(code, seat, action);
  for (const [player, bindings] of value.seats.entries())
    for (const usedAction of COUCH_KEYBOARD_ACTIONS)
      if ((player !== seat || usedAction !== action) && bindings[usedAction] === code)
        throw new CouchKeyboardError('conflict', {
          key: keyLabel(code),
          player: player + 1,
          action: usedAction,
        });
  value.seats[seat][action] = code;
  return resolveCouchKeyboard(value);
}
export function couchKeyMap(source = null) {
  return Object.fromEntries(
    resolveCouchKeyboard(source).seats.flatMap((seat, player) =>
      COUCH_KEYBOARD_ACTIONS.map((action) => [seat[action], [player, action]]),
    ),
  );
}
export function couchDirectionLabel(source, player) {
  const seat = resolveCouchKeyboard(source).seats[player];
  if (['up', 'left', 'down', 'right'].every((action) => seat[action] === defaults[player][action]))
    return t(player === 0 ? 'interface:wASD' : 'interface:arrowKeys');
  return ['up', 'left', 'down', 'right'].map((action) => keyLabel(seat[action])).join(' ');
}
