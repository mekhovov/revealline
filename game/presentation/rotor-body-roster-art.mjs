/** Original native seven-class FPV roster. This source-only candidate composes
 * retained construction primitives, never sampled or resized image files. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';
import { detailedCandidatePixelArtForSlot } from './rotor-body-detail-art.mjs';
import { opticalCandidatePixelArtForSlot } from './rotor-body-optical-art.mjs';

export const FIELD_KIT_BODY_ROSTER_VERSION = 'reference-v6';
export const FIELD_KIT_BODY_ROSTER_ROLES = Object.freeze([
  'scout',
  'bomber',
  'carrier',
  'interceptor',
  'fiber',
  'impact',
  'trapper',
]);
export const FIELD_KIT_BODY_ROSTER_DESCRIPTIONS = Object.freeze({
  scout: 'Retained v5 Scout with broad amber battery and two dark tie-down straps.',
  bomber:
    'Light carrier with a broad bevelled olive cargo case, single centre strap and rear latch.',
  carrier: 'Retained v3 heavy carrier with six arms and a strapped transport case.',
  interceptor:
    'Narrow tapered interceptor spine with cyan side plates and a long exposed equipment spine.',
  fiber: 'Fiber relay with a wide wound spool, amber reel flanges and a separate forward battery.',
  impact: 'Impact craft with a broad front pulse housing, cyan inset and a narrow rear battery.',
  trapper: 'Trapper with two side canisters, an open central recess and a rear bridge.',
});

function equipmentCanvas(rgba, size) {
  const scale = size / 32,
    colors = Object.fromEntries(
      Object.entries(FIELD_KIT_COLORS).map(([name, hex]) => [
        name,
        [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16)).concat(255),
      ]),
    );
  const put = (x, y, name) => {
    if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x >= size || y >= size)
      throw new Error('Roster equipment must stay on the native grid.');
    rgba.set(colors[name], (y * size + x) * 4);
  };
  const rect = (x, y, width, height, name) => {
    for (let py = y * scale; py < (y + height) * scale; py++)
      for (let px = x * scale; px < (x + width) * scale; px++) put(px, py, name);
  };
  const polygon = (points, name) => {
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
        if (inside) put(x, y, name);
      }
  };
  return { size, rect, polygon };
}

function lightCarrier(a) {
  for (const [x, y, width, height] of [
    [15, 10, 2, 2],
    [14, 12, 4, 1],
    [13, 13, 6, 1],
    [12, 14, 8, 4],
    [13, 18, 6, 1],
    [14, 19, 4, 2],
    [15, 21, 2, 2],
  ])
    a.rect(x, y, width, height, 'ink');
  a.rect(14, 11, 4, 10, 'plate');
  a.rect(13, 13, 6, 6, 'earth');
  a.rect(13, 13, 5, 1, 'green');
  a.rect(13, 14, 1, 4, 'green');
  a.rect(18, 14, 1, 5, 'shadow');
  a.rect(12, 15, 8, 2, 'amber');
  a.rect(15, 15, 2, 2, 'frame');
  a.rect(14, 19, 4, 1, 'metal');
  a.rect(15, 20, 2, 2, 'earth');
  if (a.size === 64) {
    a.rect(13.5, 13, 4, 0.5, 'light');
    a.rect(17.5, 13.5, 0.5, 1.5, 'frame');
    a.rect(17.5, 17, 0.5, 1.5, 'frame');
    a.rect(15.5, 15.5, 1, 1, 'metal');
    a.rect(14, 19, 4, 0.5, 'shadow');
    a.rect(15.5, 20.5, 1, 0.5, 'metal');
  }
}

function interceptor(a) {
  a.polygon(
    [
      [15, 10],
      [17, 10],
      [19, 15],
      [18, 19],
      [17, 21],
      [17, 23],
      [15, 23],
      [15, 21],
      [14, 19],
      [13, 15],
    ],
    'ink',
  );
  a.polygon(
    [
      [15, 11],
      [17, 11],
      [18, 15],
      [17, 21],
      [15, 21],
      [14, 15],
    ],
    'metal',
  );
  a.rect(15, 12, 2, 10, 'plate');
  a.rect(15, 13, 1, 7, 'frame');
  a.rect(13, 15, 1, 2, 'cyan');
  a.rect(18, 15, 1, 2, 'cyan');
  a.rect(15, 20, 2, 1, 'amber');
  if (a.size === 64) {
    a.rect(14.5, 13, 0.5, 5, 'light');
    a.rect(17, 14, 0.5, 5, 'shadow');
    a.rect(15.5, 11, 1, 0.5, 'light');
    a.rect(15.5, 13, 0.5, 6, 'metal');
    a.rect(13.5, 15, 0.5, 1.5, 'plate');
    a.rect(18, 15, 0.5, 1.5, 'plate');
    a.rect(15.5, 21, 1, 0.5, 'metal');
  }
}

function fiber(a) {
  a.rect(15, 10, 2, 13, 'ink');
  a.rect(14, 11, 4, 4, 'plate');
  a.rect(15, 11, 2, 3, 'amber');
  for (const [x, y, width, height] of [
    [13, 13, 6, 1],
    [12, 14, 8, 1],
    [11, 15, 10, 2],
    [12, 17, 8, 1],
    [13, 18, 6, 1],
  ])
    a.rect(x, y, width, height, 'ink');
  a.rect(13, 14, 6, 4, 'frame');
  a.rect(12, 15, 1, 2, 'amber');
  a.rect(19, 15, 1, 2, 'amber');
  for (const x of [13, 15, 17]) a.rect(x, 14, 1, 4, 'metal');
  a.rect(14, 18, 4, 1, 'plate');
  a.rect(15, 19, 2, 3, 'frame');
  a.rect(15, 20, 2, 1, 'cyan');
  if (a.size === 64) {
    for (const x of [13, 14, 15, 16, 17, 18]) {
      a.rect(x, 14.5, 0.5, 2.5, 'light');
      a.rect(x + 0.5, 14.5, 0.5, 3, 'plate');
    }
    a.rect(12, 15, 0.5, 2, 'earth');
    a.rect(19, 15, 0.5, 2, 'light');
    a.rect(15, 11, 0.5, 2, 'light');
    a.rect(16.5, 19, 0.5, 3, 'shadow');
  }
}

function impact(a) {
  for (const [x, y, width, height] of [
    [15, 10, 2, 1],
    [14, 11, 4, 2],
    [13, 13, 6, 1],
    [12, 14, 8, 3],
    [13, 17, 6, 2],
    [14, 19, 4, 2],
    [15, 21, 2, 2],
  ])
    a.rect(x, y, width, height, 'ink');
  for (const [x, y, width, height] of [
    [15, 11, 2, 1],
    [14, 12, 4, 2],
    [13, 14, 6, 3],
    [14, 17, 4, 1],
  ])
    a.rect(x, y, width, height, 'metal');
  a.rect(14, 13, 4, 4, 'plate');
  a.rect(15, 13, 2, 2, 'cyan');
  a.rect(14, 16, 4, 1, 'frame');
  a.rect(14, 18, 4, 2, 'amber');
  a.rect(15, 20, 2, 2, 'earth');
  a.rect(15, 19, 2, 1, 'shadow');
  if (a.size === 64) {
    a.rect(14.5, 12, 3, 0.5, 'light');
    a.rect(13, 14, 0.5, 2.5, 'light');
    a.rect(18.5, 14, 0.5, 3, 'frame');
    a.rect(15.5, 13.5, 1, 1, 'plate');
    a.rect(14.5, 16, 3, 0.5, 'light');
    a.rect(14, 18, 0.5, 2, 'light');
    a.rect(15.5, 19, 1, 0.5, 'metal');
  }
}

function trapper(a) {
  a.rect(15, 10, 2, 13, 'ink');
  a.rect(14, 11, 4, 2, 'plate');
  a.rect(14, 12, 4, 1, 'amber');
  a.rect(12, 14, 8, 4, 'ink');
  for (const x of [12, 18]) {
    a.rect(x, 14, 2, 4, 'earth');
    a.rect(x, 14, 2, 1, 'green');
    a.rect(x, 17, 2, 1, 'metal');
  }
  // The dark recessed centre separates the two canisters without detached pods.
  a.rect(14, 15, 4, 2, 'plate');
  a.rect(15, 15, 2, 1, 'cyan');
  a.rect(13, 18, 6, 1, 'frame');
  a.rect(14, 19, 4, 2, 'amber');
  a.rect(15, 20, 2, 2, 'shadow');
  if (a.size === 64) {
    for (const x of [12, 18]) {
      a.rect(x, 14.5, 0.5, 2.5, 'light');
      a.rect(x + 1.5, 15, 0.5, 2, 'shadow');
      a.rect(x + 0.5, 14, 1, 0.5, 'metal');
    }
    a.rect(13.5, 18, 5, 0.5, 'metal');
    a.rect(14, 19, 4, 0.5, 'light');
    a.rect(15.5, 20.5, 1, 0.5, 'metal');
  }
}

const recipes = { bomber: lightCarrier, interceptor, fiber, impact, trapper };

export function rosterCandidatePixelArtForSlot(slotId, { size } = {}) {
  const match =
    /^player\.(scout|bomber|carrier|interceptor|fiber|impact|trapper)\.(compact|detailed)$/.exec(
      slotId,
    );
  if (!match) throw new Error(`No body-roster candidate for ${slotId}.`);
  size ??= match[2] === 'detailed' ? 64 : 32;
  if (![32, 64].includes(size))
    throw new Error('Body-roster frames require native 32 or 64 pixel grids.');
  const role = match[1];
  if (role === 'scout') return opticalCandidatePixelArtForSlot(slotId, { size });
  if (role === 'carrier') return detailedCandidatePixelArtForSlot(slotId, { size });
  // Shared quad construction owns the carbon arms, north camera, aft antenna
  // and small motor housings. Replace only its central equipment source layer.
  const image = detailedCandidatePixelArtForSlot(`player.scout.${match[2]}`, { size }),
    equipment = image.layers.equipment,
    scale = size / 32;
  for (let y = 10 * scale; y < 23 * scale; y++) equipment.fill(0, y * size * 4, (y + 1) * size * 4);
  recipes[role](equipmentCanvas(equipment, size));
  image.rgba.fill(0);
  for (const layer of Object.values(image.layers))
    for (let offset = 0; offset < image.rgba.length; offset += 4)
      if (layer[offset + 3]) image.rgba.set(layer.subarray(offset, offset + 4), offset);
  return image;
}
