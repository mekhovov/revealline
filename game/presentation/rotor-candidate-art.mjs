/** Opt-in original native-pixel construction study. This module is not a
 * registered asset, published collection or replacement for accepted sprites. */
import { FIELD_KIT_COLORS } from './pixel-art.mjs';
const classes = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'];
// Source-only alternative. Existing sprite v1, slots, metadata and registered
// rigs remain unchanged until a separately reviewed production revision adopts
// these native drawings. No reference-image pixels are sampled or incorporated.
export const FIELD_KIT_CANDIDATE_CONSTRUCTION = 'reference-v2';
export const FIELD_KIT_CANDIDATE_PIVOT = Object.freeze({ x: 0.5, y: 0.5 });
export const FIELD_KIT_CANDIDATE_RIGS = Object.freeze(
  Object.fromEntries(
    [...classes, 'enemy.border-patrol'].map((id) => {
      const heavy = id === 'carrier';
      const points = heavy
        ? [
            [9, 6, 1],
            [23, 6, -1],
            [6, 16, -1],
            [26, 16, 1],
            [9, 26, 1],
            [23, 26, -1],
          ]
        : [
            [8, 8, 1],
            [24, 8, -1],
            [8, 24, -1],
            [24, 24, 1],
          ];
      return [
        id,
        Object.freeze(
          points.map(([x, y, direction], index) =>
            Object.freeze({
              x: x / 32,
              y: y / 32,
              radius: heavy ? 0.15 : 0.205,
              blades: heavy ? 2 : 3,
              direction,
              phaseDegrees: index * 23,
            }),
          ),
        ),
      ];
    }),
  ),
);
function pixelCanvas(size, palette) {
  const rgba = new Uint8ClampedArray(size * size * 4),
    scale = size / 32;
  const colors = Object.fromEntries(
    Object.entries(palette).map(([key, hex]) => [
      key,
      [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).concat(255),
    ]),
  );
  const put = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    rgba.set(color ? colors[color] : [0, 0, 0, 0], (y * size + x) * 4);
  };
  const rect = (x, y, w, h, color) => {
    const left = Math.floor(x * scale),
      top = Math.floor(y * scale),
      right = Math.max(left + 1, Math.floor((x + w) * scale)),
      bottom = Math.max(top + 1, Math.floor((y + h) * scale));
    for (let py = top; py < bottom; py++) for (let px = left; px < right; px++) put(px, py, color);
  };
  const polygon = (points, color) => {
    const p = points.map(([x, y]) => [x * scale, y * scale]);
    const minX = Math.max(0, Math.floor(Math.min(...p.map(([x]) => x)))),
      maxX = Math.min(size, Math.ceil(Math.max(...p.map(([x]) => x))));
    const minY = Math.max(0, Math.floor(Math.min(...p.map(([, y]) => y)))),
      maxY = Math.min(size, Math.ceil(Math.max(...p.map(([, y]) => y))));
    for (let y = minY; y < maxY; y++)
      for (let x = minX; x < maxX; x++) {
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
  const chamfer = (x, y, w, h, color, cut = 1) =>
    polygon(
      [
        [x + cut, y],
        [x + w - cut, y],
        [x + w, y + cut],
        [x + w, y + h - cut],
        [x + w - cut, y + h],
        [x + cut, y + h],
        [x, y + h - cut],
        [x, y + cut],
      ],
      color,
    );
  const line = (x0, y0, x1, y1, width, color) => {
    let x = Math.floor(x0 * scale),
      y = Math.floor(y0 * scale),
      endX = Math.floor(x1 * scale),
      endY = Math.floor(y1 * scale);
    const dx = Math.abs(endX - x),
      sx = x < endX ? 1 : -1,
      dy = -Math.abs(endY - y),
      sy = y < endY ? 1 : -1;
    let error = dx + dy;
    const thickness = Math.max(1, Math.floor(width * scale)),
      offset = Math.floor(thickness / 2);
    for (;;) {
      for (let py = y - offset; py < y - offset + thickness; py++)
        for (let px = x - offset; px < x - offset + thickness; px++) put(px, py, color);
      if (x === endX && y === endY) break;
      const twice = 2 * error;
      if (twice >= dy) {
        error += dy;
        x += sx;
      }
      if (twice <= dx) {
        error += dx;
        y += sy;
      }
    }
  };
  return { rgba, size, scale, put, rect, polygon, chamfer, line };
}
function candidateMotor(a, hub) {
  const x = Math.floor(hub.x * a.size),
    y = Math.floor(hub.y * a.size),
    radius = Math.max(1, Math.floor(a.size / 32));
  for (let py = -radius; py <= radius; py++)
    for (let px = -radius; px <= radius; px++) {
      if (Math.abs(px) === radius && Math.abs(py) === radius) continue;
      a.put(x + px, y + py, py === -radius ? 'light' : 'plate');
    }
  a.put(x, y, 'amber');
  if (a.size >= 64) a.put(x + 1, y + 1, 'metal');
}

function candidateCraft(a, id, detail) {
  const hostile = id === 'enemy.border-patrol',
    hubs = FIELD_KIT_CANDIDATE_RIGS[id];
  for (const hub of hubs) {
    const x = hub.x * 32,
      y = hub.y * 32,
      rootX = x < 16 ? 14 : 18,
      rootY = y < 16 ? 13 : y > 16 ? 19 : 16;
    a.line(rootX, rootY, x, y, 2, 'ink');
    a.line(rootX, rootY, x, y, 1, 'frame');
    if (detail) a.line(rootX, rootY - 0.5, x, y - 0.5, 0.5, 'metal');
    // Restrained identification tape belongs to the arm, not the propeller.
    const tapeX = rootX + (x - rootX) * 0.55,
      tapeY = rootY + (y - rootY) * 0.55;
    a.rect(tapeX, tapeY, 1, 1, hostile ? 'danger' : x < 16 ? 'amber' : 'cyan');
  }
  // A narrow equipment spine leaves the large blade sweep visually dominant.
  if (id !== 'interceptor') {
    a.polygon(
      [
        [15, 9],
        [17, 9],
        [20, 14],
        [20, 18],
        [17, 23],
        [15, 23],
        [12, 18],
        [12, 14],
      ],
      'ink',
    );
    a.polygon(
      [
        [15, 10],
        [17, 10],
        [19, 14],
        [19, 18],
        [17, 22],
        [15, 22],
        [13, 18],
        [13, 14],
      ],
      'frame',
    );
  }
  a.rect(15, 10, 2, 12, 'plate');
  a.rect(15, 23, 1, 4, 'metal');
  a.rect(14, 26, 3, 1, 'light');
  if (id === 'scout') {
    // The approved source uses an equipment pack with separate straps, rather
    // than a solid yellow centre. Keep its corners out of the front/rear sweeps.
    a.chamfer(14, 11, 4, 10, 'plate', 1);
    a.rect(14, 12, 4, 8, 'frame');
    a.rect(14, 12, 1, 8, 'metal');
    a.rect(13, 13, 6, 1, 'amber');
    a.rect(13, 18, 6, 1, 'amber');
    a.rect(17, 15, 1, 2, 'ink');
    if (detail) a.rect(14.5, 11.5, 0.5, 1, 'light');
  } else if (id === 'bomber') {
    a.chamfer(11, 13, 10, 6, 'earth', 1);
    a.chamfer(13, 12, 6, 9, 'earth', 1);
    a.rect(14, 13, 4, 7, 'green');
    a.rect(13, 14, 6, 1, 'amber');
    a.rect(13, 18, 6, 1, 'amber');
  } else if (id === 'carrier') {
    a.chamfer(12, 10, 8, 13, 'plate', 2);
    a.rect(14, 11, 4, 11, 'earth');
    for (const y of [12, 16, 20]) a.rect(13, y, 6, 1, 'amber');
    if (detail) a.rect(14.5, 11, 0.5, 11, 'green');
  } else if (id === 'interceptor') {
    a.polygon(
      [
        [16, 8],
        [19, 15],
        [18, 20],
        [16, 23],
        [14, 20],
        [13, 15],
      ],
      'metal',
    );
    a.polygon(
      [
        [16, 10],
        [18, 15],
        [17, 20],
        [16, 21],
        [15, 20],
        [14, 15],
      ],
      'plate',
    );
    a.rect(15, 12, 2, 7, 'amber');
    a.rect(14, 19, 4, 1, 'cyan');
  } else if (id === 'fiber') {
    a.rect(14, 11, 4, 7, 'plate');
    a.rect(15, 12, 2, 5, 'amber');
    a.chamfer(11, 15, 10, 3, 'metal', 1);
    a.rect(13, 15, 6, 3, 'cyan');
    a.rect(14, 15, 1, 3, 'frame');
    a.rect(17, 15, 1, 3, 'frame');
    if (detail) a.rect(15.5, 15, 0.5, 3, 'frame');
  } else if (id === 'impact') {
    a.chamfer(11, 14, 10, 2, 'light', 1);
    a.chamfer(13, 11, 6, 6, 'light', 1);
    a.chamfer(14, 12, 4, 4, 'plate', 1);
    a.rect(15, 13, 2, 1, 'cyan');
    a.rect(14, 18, 4, 4, 'amber');
    a.rect(14, 19, 4, 1, 'frame');
  } else if (id === 'trapper') {
    a.rect(11, 14, 2, 4, 'metal');
    a.rect(19, 14, 2, 4, 'frame');
    a.rect(13, 15, 6, 2, 'ink');
    a.rect(14, 14, 4, 4, 'cyan');
    a.rect(15, 15, 2, 2, 'plate');
    a.rect(14, 11, 4, 2, 'amber');
    a.rect(14, 20, 4, 2, 'amber');
  } else if (hostile) {
    a.chamfer(13, 11, 6, 11, 'plate', 2);
    a.rect(14, 12, 4, 8, 'frame');
    a.rect(14, 13, 4, 1, 'danger');
    a.rect(14, 18, 4, 1, 'danger');
  }
  // Small camera/lens: no lettering, weapon payload or copied brand markings.
  a.rect(15, 5, 2, 5, 'ink');
  a.rect(15, 6, 2, 2, hostile ? 'danger' : 'cyan');
  if (detail) {
    a.rect(15, 5.5, 1, 0.5, 'white');
    a.rect(16.5, 8, 0.5, 2, 'metal');
    a.rect(17.5, 14, 0.5, 3, 'light');
  }
  for (const hub of hubs) candidateMotor(a, hub);
}
export function candidatePixelArtForSlot(slotId, { size } = {}) {
  const player =
      /^player\.(scout|bomber|carrier|interceptor|fiber|impact|trapper)\.(compact|detailed)$/.exec(
        slotId,
      ),
    id = player?.[1] ?? slotId;
  if (!player && slotId !== 'enemy.border-patrol')
    throw new Error(`No reference-proportion candidate for ${slotId}.`);
  size ??= player?.[2] === 'detailed' ? 64 : 32;
  if (![32, 64].includes(size))
    throw new Error('Candidate frames must use a native 32 or 64 pixel grid.');
  const canvas = pixelCanvas(size, FIELD_KIT_COLORS);
  candidateCraft(canvas, id, size === 64);
  return { width: size, height: size, rgba: canvas.rgba };
}
