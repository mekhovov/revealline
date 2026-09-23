/** Original integer-pixel radio equipment. No sampled images, randomness, text,
 * baked effects or simulation geometry. Functional status stays in the painter. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';

export const TEAM_EQUIPMENT_IDS = Object.freeze([
  'team.anchor.available',
  'team.anchor.captured',
  'team.core.shielded',
  'team.core.exposed',
  'team.core.secured',
]);
export const TEAM_EQUIPMENT_DESCRIPTIONS = Object.freeze({
  'team.anchor.available': 'Deployable relay beacon: raised amber mast, receiver and three feet.',
  'team.anchor.captured':
    'Connected relay beacon: retracted mast, paired cyan ports and side couplers.',
  'team.core.shielded': 'Radio-yard relay cabinet: raised antenna and closed protective shutters.',
  'team.core.exposed':
    'Radio-yard relay cabinet: separated shutters reveal the amber signal stack.',
  'team.core.secured': 'Secured radio-yard relay: folded antenna and closed cyan service panel.',
});

function canvas(size) {
  const rgba = new Uint8ClampedArray(size * size * 4);
  // Team slots use the smaller registered interface palette. Keep the shared
  // construction vocabulary without importing the wider sprite-only greys.
  const palette = {
    ...FIELD_KIT_COLORS,
    plate: FIELD_KIT_COLORS.shadow,
    frame: FIELD_KIT_COLORS.light,
    metal: FIELD_KIT_COLORS.light,
    light: FIELD_KIT_COLORS.white,
  };
  const colors = Object.fromEntries(
    Object.entries(palette).map(([name, hex]) => [
      name,
      [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255),
    ]),
  );
  const rect = (x, y, width, height, color) => {
    if (
      ![x, y, width, height].every(Number.isInteger) ||
      width < 1 ||
      height < 1 ||
      x < 0 ||
      y < 0 ||
      x + width > size ||
      y + height > size ||
      !colors[color]
    )
      throw new Error('Invalid Team equipment pixel cluster.');
    for (let row = y; row < y + height; row++)
      for (let col = x; col < x + width; col++) rgba.set(colors[color], (row * size + col) * 4);
  };
  const plate = (x, y, width, height, face = 'plate') => {
    rect(x + 1, y, width - 2, height, 'ink');
    rect(x, y + 1, width, height - 2, 'ink');
    rect(x + 1, y + 1, width - 2, height - 2, face);
    rect(x + 2, y + 1, width - 4, 1, 'light');
    rect(x + 1, y + 2, 1, height - 4, 'frame');
  };
  return { rgba, rect, plate };
}

function anchor(captured) {
  const { rgba, rect, plate } = canvas(24);
  const signal = captured ? 'cyan' : 'amber';
  // The two states differ in silhouette, not just indicator colour.
  rect(10, captured ? 6 : 2, 3, captured ? 5 : 9, 'ink');
  rect(11, captured ? 7 : 3, 1, captured ? 3 : 7, 'light');
  rect(captured ? 7 : 6, captured ? 6 : 2, captured ? 10 : 12, 2, 'ink');
  rect(captured ? 8 : 7, captured ? 6 : 2, captured ? 8 : 10, 1, signal);
  rect(4, 18, 4, 4, 'ink');
  rect(16, 18, 4, 4, 'ink');
  rect(10, 19, 4, 3, 'ink');
  rect(5, 19, 2, 2, 'metal');
  rect(17, 19, 2, 2, 'metal');
  rect(11, 20, 2, 1, 'metal');
  if (captured) {
    rect(2, 13, 20, 4, 'ink');
    rect(3, 14, 18, 2, 'cyan');
  }
  plate(6, 10, 12, 10);
  rect(9, 13, 6, 4, 'ink');
  if (captured) {
    rect(9, 13, 2, 3, signal);
    rect(13, 13, 2, 3, signal);
  } else {
    rect(10, 13, 4, 3, signal);
    rect(11, 13, 2, 1, 'white');
  }
  rect(9, 18, 6, 1, 'metal');
  return { width: 24, height: 24, rgba };
}

function core(state) {
  const { rgba, rect, plate } = canvas(64);
  const exposed = state === 'exposed',
    secured = state === 'secured';
  // Ground equipment has no rotor hubs or blades and cannot read as another craft.
  for (const x of [12, 44]) {
    plate(x, 47, 8, 11, 'frame');
    rect(x + 2, 54, 4, 2, 'metal');
  }
  plate(16, 43, 32, 11);
  rect(20, 48, 24, 3, 'frame');
  rect(22, 48, 20, 1, 'light');
  plate(27, secured ? 12 : 5, 10, secured ? 13 : 20);
  if (secured) {
    plate(17, 12, 30, 6, 'frame');
    rect(20, 14, 24, 2, 'cyan');
  } else {
    plate(12, 6, 40, 6, 'frame');
    rect(15, 8, 34, 2, 'light');
    plate(17, 16, 30, 5);
    rect(20, 18, 24, 1, 'metal');
  }
  plate(20, 23, 24, 23);
  if (exposed) {
    // Side shutters slide out; the exposed receiver remains a compact central mass.
    plate(9, 26, 13, 21, 'frame');
    plate(42, 26, 13, 21, 'frame');
    rect(13, 29, 5, 13, 'metal');
    rect(46, 29, 5, 13, 'metal');
    rect(24, 27, 16, 15, 'ink');
    for (const y of [28, 33, 38]) {
      rect(26, y, 12, 3, 'amber');
      rect(28, y, 8, 1, 'white');
    }
  } else {
    plate(18, 25, 14, 23, 'frame');
    plate(32, 25, 14, 23, 'frame');
    rect(22, 29, 6, 14, 'plate');
    rect(36, 29, 6, 14, 'plate');
    if (secured) {
      rect(22, 31, 6, 7, 'cyan');
      rect(36, 31, 6, 7, 'cyan');
      rect(23, 31, 4, 2, 'white');
      rect(37, 31, 4, 2, 'white');
    } else {
      rect(22, 30, 6, 3, 'metal');
      rect(36, 30, 6, 3, 'metal');
      rect(28, 35, 8, 4, 'ink');
      rect(30, 36, 4, 2, 'amber');
    }
  }
  for (const x of [21, 40]) rect(x, 48, 3, 3, secured ? 'cyan' : 'amber');
  return { width: 64, height: 64, rgba };
}

export function teamEquipmentArt(slotId) {
  if (!TEAM_EQUIPMENT_IDS.includes(slotId))
    throw new TypeError(`No Team equipment artwork for ${slotId}.`);
  return slotId.startsWith('team.anchor.')
    ? anchor(slotId === 'team.anchor.captured')
    : core(slotId.split('.').at(-1));
}
