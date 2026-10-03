import {
  INDUSTRIAL_MATERIAL_REVISION,
  INDUSTRIAL_TERRAIN_MATERIALS,
  industrialMaterialPixels,
} from './industrial-materials.mjs';

/** Original overhead pixel silhouettes. These replace only verified built-in
 * presentation slots; their names are not new combat or collision policies. */
export const MILITARY_FIELD_ROLES = Object.freeze({
  'enemy.bouncer': 'utility-car',
  'enemy.claimed-rover': 'cargo-truck',
  'enemy.border-patrol': 'armored-carrier',
  'enemy.contour-patrol': 'scout-car',
  'enemy.eroder': 'tracked-tank',
  'enemy.lane-boss': 'tracked-tank',
  'enemy.relay-sentinel': 'radar-truck',
  'terrain.wall': 'concrete-checkpoint',
  'terrain.slow': 'rutted-ground',
  'terrain.lethal': 'hazard-barrier',
});

const COLORS = Object.freeze({
  ink: '#161e1a',
  tire: '#26302b',
  tread: '#596451',
  hull: '#61734a',
  light: '#a4ad78',
  camo: '#3c5038',
  sand: '#a9996d',
  glass: '#a6c5c3',
  metal: '#c8cbb1',
  lamp: '#f1d79a',
  hazard: '#ff8b73',
  white: '#e6e5d6',
  blue: '#486588',
  red: '#b96758',
});
const rgb = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));

/** Wheel/tread glints follow the shared actor sampler, including its pause and
 * reduced-effects policy. No independently advancing presentation clock. */
export function drawMilitaryVehicleMotion(ctx, frame, role, diameter) {
  if (frame.reduced || !Number.isFinite(frame.travelPhase) || frame.speed <= 0) return;
  const step = Math.floor(frame.travelPhase * 6) % 2;
  const tracked = role === 'tracked-tank';
  ctx.save();
  ctx.scale(diameter / 32, diameter / 32);
  ctx.fillStyle = '#a4ad78';
  for (const x of tracked ? [-10, 8] : [-10, 7])
    for (const y of tracked ? [-7, -1, 5] : [-7, 9]) ctx.fillRect(x, y + step, 2, 1);
  ctx.restore();
}

/** No clocks, randomness, physics or DOM access. Keep the original sprite frame
 * and pivot while using transparent air around every vehicle silhouette. */
export function militaryFieldPixels({ width, height }, slot, { revision = null } = {}) {
  const role = MILITARY_FIELD_ROLES[slot];
  if (!role) return null;
  if (revision === INDUSTRIAL_MATERIAL_REVISION && INDUSTRIAL_TERRAIN_MATERIALS[slot])
    return industrialMaterialPixels({ width, height }, INDUSTRIAL_TERRAIN_MATERIALS[slot]);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 16 ||
    height < 16 ||
    width > 128 ||
    height > 128
  )
    throw new TypeError('Military field art needs a bounded native frame.');
  const rgba = new Uint8ClampedArray(width * height * 4);
  const tile = slot.startsWith('terrain.');
  const units = tile ? 16 : 32;
  const rect = (x, y, w, h, color) => {
    const paint = rgb(COLORS[color] ?? color);
    for (
      let py = Math.floor((y * height) / units);
      py < Math.ceil(((y + h) * height) / units);
      py++
    )
      for (
        let px = Math.floor((x * width) / units);
        px < Math.ceil(((x + w) * width) / units);
        px++
      ) {
        if (px < 0 || py < 0 || px >= width || py >= height) continue;
        const at = (py * width + px) * 4;
        rgba.set([...paint, 255], at);
      }
  };
  const wheel = (x, y, length = 5) => {
    rect(x, y, 4, length, 'ink');
    rect(x + 1, y + 1, 2, length - 2, 'tread');
  };
  const hull = (x, y, w, h) => {
    rect(x, y, w, h, 'ink');
    rect(x + 1, y + 1, w - 2, h - 2, 'hull');
    rect(x + 2, y + 1, w - 4, 1, 'light');
    rect(x + 2, y + h - 3, w - 4, 1, 'camo');
  };
  const markings = (x, y) => {
    rect(x, y, 3, 1, 'white');
    rect(x, y + 1, 3, 1, 'blue');
    rect(x, y + 2, 3, 1, 'red');
  };
  if (tile) {
    rect(0, 0, 16, 16, 'ink');
    if (role === 'concrete-checkpoint') {
      rect(1, 1, 14, 14, '#6d7463');
      rect(1, 1, 14, 2, '#b9beab');
      rect(2, 4, 12, 7, '#969f8c');
      rect(1, 13, 14, 2, '#424e43');
      rect(3, 6, 2, 3, '#4b5549');
      rect(11, 6, 2, 3, '#4b5549');
      rect(7, 3, 1, 2, '#c1c4ab');
      rect(8, 11, 1, 3, '#586351');
    } else if (role === 'rutted-ground') {
      rect(0, 0, 16, 16, '#655c40');
      for (const x of [3, 10]) {
        rect(x, 0, 3, 16, '#443e30');
        for (let y = 1; y < 16; y += 4) rect(x - 1, y, 5, 1, '#a38e5e');
      }
    } else {
      rect(1, 1, 14, 14, '#574d3e');
      rect(1, 1, 14, 2, 'hazard');
      rect(1, 13, 14, 2, 'hazard');
      for (let i = 4; i < 12; i++) {
        rect(i, i, 2, 2, 'metal');
        rect(15 - i, i, 2, 2, 'metal');
      }
    }
    return { width, height, rgba };
  }
  if (role === 'tracked-tank') {
    for (const x of [5, 23]) {
      rect(x, 6, 4, 22, 'ink');
      rect(x + 1, 7, 2, 20, 'tread');
      for (let y = 8; y < 27; y += 3) rect(x, y, 4, 1, 'metal');
    }
    hull(9, 5, 14, 23);
    rect(11, 21, 10, 4, 'camo');
    for (let x = 12; x < 21; x += 2) rect(x, 22, 1, 2, 'tread');
    hull(11, 11, 10, 10);
    rect(14, 8, 4, 8, 'camo');
    rect(15, 1, 2, 13, 'ink');
    rect(15, 2, 1, 11, 'metal');
    rect(12, 13, 3, 3, 'light');
    rect(13, 14, 2, 2, 'ink');
    rect(19, 17, 2, 3, 'sand');
    markings(18, 7);
  } else if (role === 'armored-carrier') {
    for (const y of [5, 11, 17, 23]) {
      wheel(5, y, 4);
      wheel(23, y, 4);
    }
    hull(9, 4, 14, 24);
    rect(11, 4, 10, 3, 'light');
    rect(11, 7, 4, 2, 'glass');
    rect(17, 7, 4, 2, 'glass');
    rect(10, 19, 3, 6, 'camo');
    rect(18, 22, 4, 3, 'sand');
    hull(13, 12, 7, 7);
    rect(16, 8, 2, 7, 'ink');
    rect(17, 8, 1, 6, 'metal');
    markings(18, 20);
  } else if (role === 'cargo-truck' || role === 'radar-truck') {
    for (const y of [7, 19, 25]) {
      wheel(5, y, 4);
      wheel(23, y, 4);
    }
    hull(9, 3, 14, 27);
    rect(10, 4, 12, 4, 'camo');
    rect(11, 6, 4, 2, 'glass');
    rect(17, 6, 4, 2, 'glass');
    rect(10, 10, 12, 18, 'sand');
    for (const y of [12, 17, 22, 26]) rect(11, y, 10, 1, 'camo');
    rect(10, 4, 1, 1, 'lamp');
    rect(21, 4, 1, 1, 'lamp');
    markings(18, 9);
    if (role === 'radar-truck') {
      rect(11, 13, 10, 14, 'hull');
      rect(15, 9, 2, 15, 'ink');
      rect(10, 14, 12, 6, 'ink');
      rect(11, 15, 10, 4, 'metal');
      for (const x of [12, 15, 18]) rect(x, 15, 1, 4, 'camo');
      rect(15, 24, 2, 2, 'lamp');
    }
  } else {
    for (const y of [7, 22]) {
      wheel(6, y);
      wheel(22, y);
    }
    hull(10, 4, 12, 24);
    rect(11, 5, 10, 6, 'camo');
    rect(11, 12, 10, 3, 'glass');
    rect(11, 16, 10, 7, 'hull');
    rect(12, 17, 2, 5, 'light');
    rect(19, 17, 1, 4, 'camo');
    rect(11, 5, 2, 1, 'lamp');
    rect(19, 5, 2, 1, 'lamp');
    rect(13, 25, 6, 3, 'ink');
    rect(15, 25, 2, 2, 'tread');
    if (role === 'scout-car') {
      rect(18, 14, 1, 10, 'ink');
      rect(13, 17, 4, 4, 'sand');
    }
    markings(14, 18);
  }
  if (revision === 'industrial-pilot-v1' && ['utility-car', 'tracked-tank'].includes(role)) {
    // Candidate surface treatment retains the original silhouette and all rules.
    for (const y of [9, 12, 22]) {
      rect(10, y, 1, 1, 'metal');
      rect(21, y, 1, 1, 'metal');
    }
    if (role === 'tracked-tank') {
      rect(11, 22, 10, 5, 'ink');
      for (const x of [12, 14, 16, 18, 20]) rect(x, 23, 1, 3, 'tread');
      rect(11, 27, 10, 1, 'light');
      rect(17, 12, 5, 5, 'camo');
      rect(18, 12, 3, 1, 'metal');
      rect(9, 17, 1, 5, 'sand');
    } else {
      rect(11, 7, 10, 3, 'ink');
      for (const x of [12, 14, 16, 18, 20]) rect(x, 7, 1, 2, 'tread');
      rect(10, 12, 1, 6, 'metal');
      rect(21, 12, 1, 6, 'camo');
      rect(12, 16, 8, 1, 'sand');
      rect(12, 22, 8, 1, 'camo');
      rect(13, 24, 6, 1, 'metal');
    }
  }
  return { width, height, rgba };
}
