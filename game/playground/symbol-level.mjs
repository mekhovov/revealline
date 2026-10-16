import { validateLevel } from '../core/level.mjs';
import { ROUTE_COVERAGE } from '../core/coverage.mjs';

export const SYMBOL_WIDTH = 60;
export const SYMBOL_HEIGHT = 24;

/** Merge identical row spans into non-overlapping terrain rectangles. */
function rectangles(mask, width, height, offsetX, offsetY) {
  const result = [];
  let previous = new Map();
  for (let y = 0; y < height; y++) {
    const row = new Map();
    for (let x = 0; x < width; ) {
      if (!mask[y * width + x]) {
        x++;
        continue;
      }
      const start = x;
      while (x < width && mask[y * width + x]) x++;
      const key = `${start}:${x}`;
      const r = previous.get(key) ?? { x: start + offsetX, y: y + offsetY, w: x - start, h: 0 };
      if (!r.h) result.push(r);
      r.h++;
      row.set(key, r);
    }
    previous = row;
  }
  return result;
}

export function generateSymbolLevel(
  mask,
  { title = 'My symbol', material = 'lethal', layout = 'islands', seed = 'symbol' } = {},
) {
  if (
    !mask ||
    mask.length !== SYMBOL_WIDTH * SYMBOL_HEIGHT ||
    !Array.from(mask).every((v) => v === 0 || v === 1)
  )
    throw new Error('The symbol must be a 60 × 24 binary mask.');
  const count = Array.from(mask).reduce((n, v) => n + v, 0);
  if (count < 4 || count > mask.length * 0.85)
    throw new Error('The symbol is empty or too solid. Adjust contrast or invert the image.');
  if (!['slow', 'lethal'].includes(material) || !['islands', 'gates', 'open'].includes(layout))
    throw new Error('Choose a supported terrain and surrounding layout.');
  const name = String(title).trim().slice(0, 60) || 'My symbol';
  let hash = 2166136261;
  for (const c of `${seed}:${name}:${layout}:${material}:${Array.from(mask).join('')}`)
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619) >>> 0;
  const shift = hash % 3;
  const foundations =
    layout === 'islands'
      ? [
          { x: 2, y: 7 + shift * 4, w: 2, h: 3 },
          { x: 68, y: 23 - shift * 4, w: 2, h: 3 },
        ]
      : [];
  const walls =
    layout === 'gates'
      ? [
          { x: 12 + shift * 3, y: 3, w: 8, h: 1 },
          { x: 48 - shift * 3, y: 31, w: 8, h: 1 },
        ]
      : [];
  const terrain = rectangles(mask, SYMBOL_WIDTH, SYMBOL_HEIGHT, 6, 6).map((r, i) => ({
    id: `symbol-${i + 1}`,
    kind: material,
    ...r,
  }));
  if (terrain.length > 512)
    throw new Error('This image has too much fine detail. Use a simpler silhouette.');
  const level = {
    version: 'xonix-level.v5',
    id: `symbol-${hash.toString(16)}`,
    revision: '1',
    name,
    width: 72,
    height: 36,
    encounter: null,
    spawn: { x: 36.5, y: 35.5 },
    goal: { coverage: 0.75 },
    walls,
    foundations,
    objectives: [],
    supplies: [],
    signalZones: [],
    hangars: [],
    classic: {
      version: 'classic.v1',
      terrain,
      powerups: [],
      coverage: { version: ROUTE_COVERAGE },
      arcadeActions: { version: 'arcade-actions.v1' },
    },
    enemies: [
      { id: 'west-orb', type: 'bouncer', x: 4.5, y: 4.5, vx: 2.8, vy: 2, radius: 0.25 },
      { id: 'east-orb', type: 'bouncer', x: 67.5, y: 30.5, vx: -2.8, vy: -2, radius: 0.25 },
      {
        id: 'north-patrol',
        type: 'border-patrol',
        x: 12.5,
        y: 0.5,
        speed: 3,
        clockwise: true,
        radius: 0.25,
      },
    ],
    rules: { lives: 3, moveSpeed: 10, timeLimitSeconds: 0, stopOnCapture: true },
  };
  const checked = validateLevel(level);
  if (!checked.valid) throw new Error(checked.errors.join('; '));
  return level;
}
