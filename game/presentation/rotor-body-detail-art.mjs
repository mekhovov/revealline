/** Original native-pixel body study. Source-only; no registered sprite, asset
 * identity or simulation rule is replaced. No reference pixels are sampled. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from './rotor-candidate-art.mjs';

export const FIELD_KIT_BODY_DETAIL_VERSION = 'reference-v3';
export const FIELD_KIT_BODY_DETAIL_ROLES = Object.freeze(['scout', 'carrier']);

function canvas(size) {
  const rgba = new Uint8ClampedArray(size * size * 4),
    scale = size / 32,
    colors = Object.fromEntries(
      Object.entries(FIELD_KIT_COLORS).map(([name, hex]) => [
        name,
        [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255),
      ]),
    );
  const put = (x, y, color) => {
    if (x >= 0 && y >= 0 && x < size && y < size) rgba.set(colors[color], (y * size + x) * 4);
  };
  const rect = (x, y, width, height, color) => {
    for (let py = Math.floor(y * scale); py < Math.floor((y + height) * scale); py++)
      for (let px = Math.floor(x * scale); px < Math.floor((x + width) * scale); px++)
        put(px, py, color);
  };
  const polygon = (points, color) => {
    const p = points.map(([x, y]) => [x * scale, y * scale]);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let inside = false;
        for (let i = 0, j = p.length - 1; i < p.length; j = i++)
          if (
            p[i][1] > y + 0.5 !== p[j][1] > y + 0.5 &&
            x + 0.5 < ((p[j][0] - p[i][0]) * (y + 0.5 - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0]
          )
            inside = !inside;
        if (inside) put(x, y, color);
      }
  };
  const line = (x1, y1, x2, y2, width, color) => {
    const ax = Math.floor(x1 * scale),
      ay = Math.floor(y1 * scale),
      bx = Math.floor(x2 * scale),
      by = Math.floor(y2 * scale),
      steps = Math.max(Math.abs(bx - ax), Math.abs(by - ay)),
      thickness = Math.max(1, Math.floor(width * scale)),
      offset = Math.floor(thickness / 2);
    for (let step = 0; step <= steps; step++) {
      const t = steps ? step / steps : 0,
        x = Math.round(ax + (bx - ax) * t),
        y = Math.round(ay + (by - ay) * t);
      for (let py = y - offset; py < y - offset + thickness; py++)
        for (let px = x - offset; px < x - offset + thickness; px++) put(px, py, color);
    }
  };
  return { rgba, size, scale, put, rect, polygon, line };
}

function frame(a, role) {
  for (const hub of FIELD_KIT_CANDIDATE_RIGS[role]) {
    const x = hub.x * 32,
      y = hub.y * 32,
      rootX = x < 16 ? 13 : 19,
      rootY = y < 16 ? 12 : y > 16 ? 20 : 16;
    a.line(rootX, rootY, x, y, 2, 'ink');
    a.line(rootX, rootY, x, y, 1, 'frame');
    // Short grain and clamps, not a bright continuous outline or a corner mark.
    if (a.size === 64) {
      a.line(rootX, rootY + 0.5, x, y + 0.5, 0.5, 'shadow');
      const t = 0.65;
      a.rect(rootX + (x - rootX) * t, rootY + (y - rootY) * t, 0.5, 0.5, 'metal');
    }
  }
}

function noseAndTail(a, role) {
  // Camera is always north; antenna remains visibly aft. No baked propellers.
  a.rect(15, 5, 2, 6, 'ink');
  a.rect(15, 6, 2, 3, 'metal');
  a.rect(15, 6, 2, 2, 'plate');
  a.rect(15, 6, 1, 1, 'cyan');
  a.rect(16, 8, 1, 2, 'shadow');
  a.rect(15, 23, 2, 1, 'shadow');
  a.rect(16, 24, 1, 4, 'metal');
  a.rect(16, 27, 1, 1, role === 'carrier' ? 'earth' : 'amber');
  if (a.size === 64) {
    a.rect(15.5, 6.5, 1, 1, 'cyan');
    a.rect(15.5, 6.5, 0.5, 0.5, 'light');
    a.rect(15.5, 8.5, 1, 0.5, 'frame');
    a.rect(16.5, 24, 0.5, 3, 'shadow');
  }
}

function scout(a) {
  a.polygon(
    [
      [15, 10],
      [17, 10],
      [19, 14],
      [19, 18],
      [17, 21],
      [17, 23],
      [15, 23],
      [15, 21],
      [13, 18],
      [13, 14],
    ],
    'ink',
  );
  a.polygon(
    [
      [15, 11],
      [17, 11],
      [18, 13],
      [18, 19],
      [17, 21],
      [15, 21],
      [14, 19],
      [14, 13],
    ],
    'shadow',
  );
  a.rect(14, 12, 1, 8, 'frame');
  a.rect(17, 12, 1, 8, 'plate');
  // Separate shaded battery faces and two buckle straps read as equipment.
  a.rect(15, 11, 2, 11, 'plate');
  a.rect(15, 12, 2, 8, 'metal');
  a.rect(16, 12, 1, 8, 'frame');
  a.rect(14, 13, 4, 1, 'amber');
  a.rect(14, 18, 4, 1, 'amber');
  a.rect(15, 13, 1, 1, 'earth');
  a.rect(15, 18, 1, 1, 'earth');
  a.rect(15, 21, 1, 1, 'amber');
  if (a.size === 64) {
    a.rect(15, 11.5, 0.5, 1, 'light');
    a.rect(15, 14.5, 0.5, 2, 'light');
    a.rect(16.5, 14, 0.5, 3.5, 'shadow');
    a.rect(15, 13, 1, 1, 'ink');
    a.rect(15.5, 13, 0.5, 0.5, 'metal');
    a.rect(15, 18, 1, 1, 'ink');
    a.rect(15.5, 18, 0.5, 0.5, 'metal');
    a.rect(14, 20, 0.5, 0.5, 'metal');
    a.rect(17.5, 20, 0.5, 0.5, 'metal');
    a.rect(16.5, 10, 0.5, 1, 'amber');
  }
}

function carrier(a) {
  a.polygon(
    [
      [14, 10],
      [18, 10],
      [21, 13],
      [21, 20],
      [18, 23],
      [14, 23],
      [11, 20],
      [11, 13],
    ],
    'ink',
  );
  a.polygon(
    [
      [14, 11],
      [18, 11],
      [20, 13],
      [20, 20],
      [18, 22],
      [14, 22],
      [12, 20],
      [12, 13],
    ],
    'shadow',
  );
  // Bevelled transport case, wider than the scout without filling rotor space.
  a.rect(13, 12, 6, 9, 'earth');
  a.rect(13, 12, 1, 8, 'green');
  a.rect(18, 12, 1, 9, 'plate');
  a.rect(14, 11, 4, 1, 'metal');
  a.rect(13, 20, 5, 1, 'frame');
  a.rect(12, 14, 8, 1, 'amber');
  a.rect(12, 19, 8, 1, 'amber');
  a.rect(15, 14, 2, 1, 'shadow');
  a.rect(15, 19, 2, 1, 'shadow');
  a.rect(15, 16, 2, 2, 'plate');
  a.rect(16, 16, 1, 1, 'metal');
  if (a.size === 64) {
    a.rect(13.5, 12, 3.5, 0.5, 'green');
    a.rect(17.5, 12.5, 0.5, 6, 'shadow');
    a.rect(15.5, 14, 0.5, 0.5, 'metal');
    a.rect(15.5, 19, 0.5, 0.5, 'metal');
    for (const x of [13, 18]) for (const y of [12, 20]) a.rect(x, y, 0.5, 0.5, 'light');
    a.rect(14, 21, 4, 0.5, 'earth');
    a.rect(14.5, 21, 1, 0.5, 'metal');
    a.rect(16.5, 21, 1, 0.5, 'metal');
  }
}

function motors(a, role) {
  const radius = a.size / 32;
  for (const hub of FIELD_KIT_CANDIDATE_RIGS[role]) {
    const x = Math.round(hub.x * a.size),
      y = Math.round(hub.y * a.size);
    for (let dy = -radius; dy <= radius; dy++)
      for (let dx = -radius; dx <= radius; dx++) {
        if (Math.abs(dx) === radius && Math.abs(dy) === radius) continue;
        a.put(x + dx, y + dy, dy < 0 ? 'metal' : 'plate');
      }
    a.put(x, y, 'amber');
    if (a.size === 64) a.put(x - 1, y - 1, 'light');
  }
}

export function detailedCandidatePixelArtForSlot(slotId, { size } = {}) {
  const match = /^player\.(scout|carrier)\.(compact|detailed)$/.exec(slotId);
  if (!match) throw new Error(`No body-detail candidate for ${slotId}.`);
  size ??= match[2] === 'detailed' ? 64 : 32;
  if (![32, 64].includes(size))
    throw new Error('Body-detail frames require a native 32 or 64 pixel grid.');
  const role = match[1],
    layers = Object.fromEntries(
      ['structure', 'equipment', 'motors'].map((id) => [id, canvas(size)]),
    );
  frame(layers.structure, role);
  noseAndTail(layers.equipment, role);
  (role === 'scout' ? scout : carrier)(layers.equipment);
  motors(layers.motors, role);
  const rgba = new Uint8ClampedArray(size * size * 4);
  for (const layer of Object.values(layers))
    for (let offset = 0; offset < rgba.length; offset += 4)
      if (layer.rgba[offset + 3]) rgba.set(layer.rgba.subarray(offset, offset + 4), offset);
  return {
    width: size,
    height: size,
    rgba,
    layers: Object.fromEntries(Object.entries(layers).map(([id, layer]) => [id, layer.rgba])),
  };
}
