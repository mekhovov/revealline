import { boundedJSON, exactKeys, required } from '../data-json.mjs';

// A local, deliberately limited authoring proposal: three samples per board cell.
// A caller must crop/downsample a decoded reference before supplying these pixels.
// Color never determines a surface: the author explicitly selects that meaning.
export const COLOR_TRACE_SIZE = Object.freeze({ width: 216, height: 108 });
const surfaces = ['foundations', 'walls', 'slow', 'lethal'];
const nativeArray = Object.getPrototypeOf(Uint8ClampedArray.prototype);
const bufferOf = Object.getOwnPropertyDescriptor(nativeArray, 'buffer').get;
const offsetOf = Object.getOwnPropertyDescriptor(nativeArray, 'byteOffset').get;
const lengthOf = Object.getOwnPropertyDescriptor(nativeArray, 'length').get;

export function proposeColorTrace(source, options) {
  const config = boundedJSON(options, { maxBytes: 1024, maxNodes: 24, maxArray: 3, maxDepth: 2 });
  exactKeys(
    config,
    ['surface', 'color', 'backgroundColor', 'tolerance', 'minMatches'],
    'color trace options',
  );
  required(surfaces.includes(config.surface), 'Choose the proposed surface explicitly.');
  required(
    Array.isArray(config.color) &&
      config.color.length === 3 &&
      config.color.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
    'Choose an RGB sample color.',
  );
  const background = config.backgroundColor;
  if (background !== undefined) {
    required(
      Array.isArray(background) &&
        background.length === 3 &&
        background.every((n) => Number.isInteger(n) && n >= 0 && n <= 255),
      'Choose an RGB background sample color.',
    );
    required(
      Math.max(...background.map((channel, i) => Math.abs(channel - config.color[i]))) >= 8,
      'Target and background samples are too similar; use manual geometry or distinct samples.',
    );
  }
  const tolerance = config.tolerance ?? 24,
    minMatches = config.minMatches ?? 7;
  required(
    Number.isInteger(tolerance) && tolerance >= 0 && tolerance <= 64,
    'Color tolerance must be0–64.',
  );
  required(
    Number.isInteger(minMatches) && minMatches >= 5 && minMatches <= 9,
    'Require5–9 matching samples per cell.',
  );
  required(
    source && Object.getPrototypeOf(source) === Object.prototype,
    'Expected owned sample pixels.',
  );
  const fields = Object.getOwnPropertyDescriptors(source);
  required(
    Reflect.ownKeys(fields).length === 3 &&
      ['width', 'height', 'data'].every(
        (key) => fields[key]?.enumerable && Object.hasOwn(fields[key], 'value'),
      ),
    'Pixel inputs cannot use accessors or extra fields.',
  );
  const { width, height } = COLOR_TRACE_SIZE,
    input = fields.data.value;
  required(
    fields.width.value === width && fields.height.value === height,
    'Sample raster must be216×108.',
  );
  required(
    Object.getPrototypeOf(input) === Uint8ClampedArray.prototype &&
      lengthOf.call(input) === width * height * 4,
    'Expected bounded RGBA samples.',
  );
  const buffer = bufferOf.call(input);
  required(
    Object.getPrototypeOf(buffer) === ArrayBuffer.prototype,
    'Shared sample memory is not supported.',
  );
  const pixels = new Uint8ClampedArray(width * height * 4);
  pixels.set(new Uint8ClampedArray(buffer, offsetOf.call(input), pixels.length));
  const selected = new Set(),
    uncertain = [];
  for (let y = 1; y < 35; y++)
    for (let x = 1; x < 71; x++) {
      let matches = 0,
        ambiguous = 0;
      for (let sy = 0; sy < 3; sy++)
        for (let sx = 0; sx < 3; sx++) {
          const at = ((y * 3 + sy) * width + x * 3 + sx) * 4;
          if (pixels[at + 3] < 240) continue;
          const distance = Math.max(
            ...config.color.map((channel, i) => Math.abs(channel - pixels[at + i])),
          );
          if (distance > tolerance) continue;
          if (background === undefined) matches++;
          else {
            const backgroundDistance = Math.max(
              ...background.map((channel, i) => Math.abs(channel - pixels[at + i])),
            );
            // Explicit negative sample, never inferred from image borders. An
            // eight-unit distance margin abstains around the shared color boundary.
            if (backgroundDistance - distance >= 8) matches++;
            else if (backgroundDistance + 8 > distance) ambiguous++;
          }
        }
      const cell = y * 72 + x;
      if (matches >= minMatches) selected.add(cell);
      else if (matches > 0 || ambiguous > 0) uncertain.push(cell);
    }
  // Merge only exactly identical horizontal spans on adjacent rows. Never fill
  // holes, infer diagonal connections or silently truncate a fragmented proposal.
  const rectangles = [],
    active = new Map();
  for (let y = 1; y < 35; y++) {
    const used = new Set();
    for (let x = 1; x < 71; ) {
      if (!selected.has(y * 72 + x)) {
        x++;
        continue;
      }
      const start = x;
      while (x < 71 && selected.has(y * 72 + x)) x++;
      const w = x - start,
        key = `${start}/${w}`,
        previous = active.get(key);
      if (previous && previous.y + previous.h === y) previous.h++;
      else {
        const rect = { surface: config.surface, x: start, y, w, h: 1 };
        rectangles.push(rect);
        active.set(key, rect);
      }
      used.add(key);
    }
    for (const key of active.keys()) if (!used.has(key)) active.delete(key);
  }
  const fragmented = rectangles.length > 128;
  return Object.freeze({
    format: 'UnappliedColorTraceV1',
    status: fragmented ? 'too-fragmented' : selected.size ? 'inspect-required' : 'no-match',
    selectedCells: Object.freeze([...selected]),
    uncertainCells: Object.freeze(uncertain),
    proposedRectangleCount: rectangles.length,
    rectangles: Object.freeze(fragmented ? [] : rectangles.map(Object.freeze)),
    limitation:
      'Color suggestions only. Inspect geometry and runtime diagnostics; explicit Apply remains required.',
  });
}
