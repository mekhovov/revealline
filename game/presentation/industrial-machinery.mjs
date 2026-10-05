/** Original overhead machinery. Presentation-only integer clusters share one
 * material vocabulary and never declare weapons, damage or collision geometry. */
export const INDUSTRIAL_MACHINERY_REVISION = 'industrial-roster-v3';
export const INDUSTRIAL_MACHINERY_FAMILIES = Object.freeze([
  'utility-car',
  'cargo-truck',
  'armored-carrier',
  'scout-car',
  'tracked-tank',
  'radar-truck',
]);
export const INDUSTRIAL_MACHINERY_PALETTE = Object.freeze({
  ink: '#14201d',
  rubber: '#26302b',
  tread: '#586255',
  steel: '#a4ad98',
  hull: '#66754c',
  shade: '#3c4e38',
  light: '#a9af76',
  canvas: '#9a8963',
  glass: '#91b6b1',
  brass: '#c3a966',
  rust: '#8d6450',
  lamp: '#eed497',
  white: '#e6e5d6',
  blue: '#486588',
  red: '#b96758',
  cyan: '#78dce8',
});
export const INDUSTRIAL_MACHINERY_DESCRIPTIONS = Object.freeze({
  'utility-car': 'Short wheelbase, ribbed bonnet, spare wheel and canvas recovery strap.',
  'cargo-truck': 'Long six-wheel chassis, separate cab, covered load bed and cargo straps.',
  'armored-carrier': 'Eight wheels, sloped shoulders, roof hatches and narrow observation ports.',
  'scout-car': 'Low four-wheel chassis, asymmetric radio rack, whip antenna and folded map case.',
  'tracked-tank':
    'Wide articulated tracks, offset cupola, engine grilles and a fixed decorative barrel.',
  'radar-truck': 'Six-wheel field communications truck with a folding scanner and cable reel.',
});
export const INDUSTRIAL_TEAM_HARDWARE_SLOTS = Object.freeze([
  'team.anchor.available',
  'team.anchor.captured',
  'team.core.shielded',
  'team.core.exposed',
  'team.core.secured',
]);
const p = INDUSTRIAL_MACHINERY_PALETTE;
const rect = (commands, color, x, y, w, h) => commands.push([p[color] ?? color, x, y, w, h]);

function vehicleCommands(family, { travel = 0, signal = 0, compact = false } = {}) {
  if (!INDUSTRIAL_MACHINERY_FAMILIES.includes(family))
    throw new TypeError('Unknown industrial machinery family.');
  const rows = [],
    r = (color, x, y, w, h) => rect(rows, color, x, y, w, h);
  const panel = (x, y, w, h, face = 'hull') => {
    r('ink', x, y, w, h);
    r(face, x + 2, y + 2, w - 4, h - 4);
    r('light', x + 3, y + 2, w - 6, 2);
    r('shade', x + w - 4, y + 4, 2, h - 6);
  };
  const wheel = (x, y, length = 9) => {
    r('ink', x, y, 7, length);
    r('rubber', x + 1, y + 1, 5, length - 2);
    r('steel', x + 2, y + 3 + (travel % 2), 3, 2);
  };
  const flag = (x, y) => {
    r('white', x, y, 6, 2);
    r('blue', x, y + 2, 6, 2);
    r('red', x, y + 4, 6, 2);
  };
  const grille = (x, y, w, h) => {
    r('ink', x, y, w, h);
    for (let at = x + 2; at < x + w - 1; at += 3) r('steel', at, y + 1, 1, h - 2);
  };
  const lamps = (y, width = 18) => {
    for (const x of [32 - width / 2 - 2, 32 + width / 2 - 2]) {
      r('ink', x - 1, y - 1, 6, 4);
      r('lamp', x, y, 4, 2);
    }
  };
  const bolt = (x, y) => {
    if (!compact) {
      r('ink', x, y, 2, 2);
      r('steel', x, y, 1, 1);
    }
  };
  if (family === 'tracked-tank') {
    for (const x of [9, 47]) {
      r('ink', x, 11, 8, 44);
      r('rubber', x + 1, 12, 6, 42);
      for (let y = 13 + (travel % 3); y < 53; y += 4) r('tread', x, y, 8, 2);
      r('steel', x + 2, 13, 2, 39);
    }
    panel(17, 10, 30, 46);
    r('shade', 19, 38, 26, 15);
    grille(22, 40, 20, 10);
    r('rust', 20, 52, 23, 2);
    for (const x of [18, 42]) {
      r('canvas', x, 29, 4, 12);
      r('ink', x + 1, 33, 2, 2);
    }
    panel(22, 19, 22, 23);
    r('shade', 21, 23, 3, 14);
    r('light', 23, 21, 17, 2);
    r('ink', 30, 2, 5, 25);
    r('steel', 31, 3, 2, 24);
    r('shade', 29, 23, 7, 8);
    panel(25, 25, 9, 10, 'tread');
    r('ink', 27, 27, 5, 6);
    r('steel', 27, 27, 3, 2);
    r('brass', 36, 29, 5, 3);
    flag(36, 12);
    lamps(13, 21);
    for (const y of [15, 35, 51]) {
      bolt(18, y);
      bolt(43, y);
    }
  } else if (family === 'cargo-truck' || family === 'radar-truck') {
    for (const x of [10, 47]) for (const y of [9, 38, 49]) wheel(x, y, 8);
    r('ink', 20, 5, 24, 54);
    panel(17, 4, 30, 22);
    r('shade', 19, 8, 26, 6);
    r('glass', 20, 17, 10, 5);
    r('glass', 33, 17, 10, 5);
    grille(24, 7, 16, 5);
    lamps(7, 24);
    r('steel', 16, 23, 32, 2);
    panel(17, 27, 30, 32, family === 'cargo-truck' ? 'canvas' : 'hull');
    if (family === 'cargo-truck') {
      for (const y of [33, 43, 53]) {
        r('shade', 19, y, 26, 2);
        r('light', 19, y + 2, 26, 1);
      }
      for (const x of [23, 38]) {
        r('ink', x, 29, 3, 27);
        r('brass', x, 41, 3, 4);
      }
      r('canvas', 19, 29, 24, 3);
      r('steel', 21, 57, 22, 2);
    } else {
      panel(20, 43, 11, 12, 'tread');
      grille(22, 45, 7, 7);
      r('ink', 38, 44, 6, 11);
      r('steel', 39, 46, 4, 7);
      r('ink', 30, 25, 4, 23);
      r('steel', 31, 26, 2, 17);
      const narrow = signal % 4 === 1 || signal % 4 === 3;
      panel(narrow ? 28 : 19, 30, narrow ? 9 : 27, 9, 'steel');
      for (let x = narrow ? 30 : 22; x < (narrow ? 35 : 44); x += 4) r('shade', x, 32, 2, 5);
      r(signal % 2 ? 'brass' : 'lamp', 33, 49, 3, 3);
    }
    flag(38, 8);
    for (const y of [29, 55]) {
      bolt(18, y);
      bolt(44, y);
    }
  } else if (family === 'armored-carrier') {
    for (const x of [8, 49]) for (const y of [9, 21, 33, 45]) wheel(x, y, 8);
    panel(15, 8, 34, 48);
    r('shade', 15, 9, 4, 10);
    r('shade', 45, 9, 4, 10);
    r('light', 20, 7, 24, 3);
    r('glass', 22, 12, 8, 3);
    r('glass', 34, 12, 8, 3);
    panel(23, 22, 19, 17);
    r('ink', 31, 15, 3, 14);
    r('steel', 31, 15, 1, 12);
    panel(20, 41, 10, 10);
    panel(34, 41, 10, 10);
    r('ink', 23, 44, 4, 4);
    r('ink', 37, 44, 4, 4);
    for (const y of [23, 32, 41]) {
      r('ink', 17, y, 3, 3);
      r('ink', 44, y, 3, 3);
    }
    lamps(9, 22);
    flag(36, 17);
    for (const y of [18, 52]) {
      bolt(18, y);
      bolt(44, y);
    }
  } else {
    const scout = family === 'scout-car';
    for (const x of [12, 45]) for (const y of [12, 43]) wheel(x, y, 9);
    panel(19, scout ? 10 : 7, 26, scout ? 44 : 49);
    r('shade', 21, 10, 22, 13);
    grille(24, 13, 16, 7);
    lamps(10, 18);
    r('glass', 21, 25, 22, 6);
    r('steel', 21, 24, 22, 1);
    r('ink', 31, 25, 2, 6);
    panel(21, 33, 22, 17, scout ? 'shade' : 'hull');
    if (scout) {
      panel(22, 35, 11, 11, 'tread');
      r('cyan', 24, 38, 3, 2);
      r('ink', 39, 22, 2, 23);
      r('steel', 39, 22, 1, 16);
      r('ink', 37, 22 + (signal % 2), 6, 2);
      r('canvas', 35, 39, 6, 8);
      r('brass', 36, 40, 3, 2);
      r('steel', 23, 49, 18, 2);
      flag(27, 8);
    } else {
      r('canvas', 24, 34, 16, 3);
      r('ink', 25, 37, 3, 10);
      r('brass', 25, 42, 3, 3);
      r('ink', 26, 51, 12, 8);
      r('rubber', 28, 52, 8, 6);
      r('steel', 30, 54, 4, 2);
      flag(34, 38);
    }
    for (const y of [21, 48]) {
      bolt(20, y);
      bolt(42, y);
    }
  }
  return rows;
}

function poseOf(frame = {}) {
  return {
    // Native sampling already stops these clocks. Keep the last tread pose when
    // stopped/paused instead of snapping back to frame zero.
    travel: frame.reduced ? 0 : Math.floor((frame.travelPhase ?? 0) * 8) % 3,
    signal: frame.reduced ? 0 : Math.floor((frame.phase ?? 0) * 3) % 4,
  };
}
function paint(ctx, commands) {
  for (const [color, x, y, w, h] of commands) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }
}

function hardwareCommands(slot) {
  if (!INDUSTRIAL_TEAM_HARDWARE_SLOTS.includes(slot))
    throw new TypeError('Unknown Team hardware slot.');
  const rows = [],
    r = (color, x, y, w, h) => rect(rows, color, x, y, w, h),
    anchor = slot.startsWith('team.anchor.'),
    connected = slot.endsWith('captured') || slot.endsWith('secured'),
    exposed = slot.endsWith('exposed'),
    accent = connected ? 'cyan' : 'brass';
  if (anchor) {
    // Direct overhead tripod. Three feet and a single aerial are unlike a quadcopter.
    for (const [x, y, w, h] of [
      [27, 6, 10, 17],
      [8, 41, 19, 9],
      [37, 41, 19, 9],
    ]) {
      r('ink', x, y, w, h);
      r('steel', x + 2, y + 2, w - 4, h - 4);
    }
    r('ink', 18, 20, 28, 28);
    r('hull', 21, 23, 22, 22);
    r('light', 21, 23, 22, 3);
    r('ink', 26, 28, 12, 14);
    r(accent, 28, 30, 8, 10);
    r('steel', 28, 30, 8, 2);
    r('ink', 31, connected ? 16 : 8, 3, 18);
    r('steel', 31, connected ? 17 : 9, 1, 16);
    r(accent, connected ? 23 : 17, connected ? 17 : 9, connected ? 19 : 31, 3);
    if (connected) {
      r('cyan', 17, 34, 6, 4);
      r('cyan', 41, 34, 6, 4);
    } else {
      r('ink', 23, 43, 18, 4);
      r('canvas', 25, 43, 14, 2);
    }
  } else {
    // Ground cabinet viewed vertically: roof, vents and either closed shutters
    // or exposed receiver bays. Existing host rings still communicate danger.
    r('ink', 9, 9, 46, 47);
    r('shade', 12, 12, 40, 42);
    r('steel', 12, 12, 40, 2);
    for (const x of [6, 52]) {
      r('ink', x, 16, 6, 13);
      r('steel', x + 2, 18, 2, 9);
      r('ink', x, 42, 6, 13);
    }
    r('ink', 18, 4, 28, 8);
    r('steel', 20, 6, 24, 4);
    r('ink', 30, 7, 4, 14);
    for (const x of [16, 43]) for (let y = 17; y < 28; y += 3) r('steel', x, y, 5, 1);
    r('ink', 22, 16, 20, 11);
    r('canvas', 24, 18, 16, 7);
    r('ink', 30, 18, 3, 7);
    if (exposed) {
      for (const x of [12, 44]) {
        r('light', x, 30, 8, 22);
        r('shade', x + 2, 33, 4, 17);
      }
      r('ink', 20, 29, 24, 24);
      for (const y of [32, 39, 46]) {
        r('brass', 23, y, 18, 4);
        r('lamp', 25, y, 14, 1);
      }
    } else {
      for (const x of [16, 33]) {
        r('hull', x, 29, 15, 24);
        r('light', x, 29, 15, 2);
        r('ink', x + 5, 36, 5, 9);
      }
      r(accent, 26, 38, 12, 4);
      if (connected) {
        r('cyan', 19, 45, 8, 4);
        r('cyan', 37, 45, 8, 4);
        r('shade', 22, 5, 20, 4);
      }
    }
    for (const x of [15, 47]) for (const y of [14, 52]) r('steel', x, y, 2, 2);
  }
  return rows;
}

function pixelsFromCommands({ width, height }, commands) {
  if (![width, height].every((v) => Number.isInteger(v) && v >= 16 && v <= 128))
    throw new TypeError('Machinery needs a bounded native frame.');
  const rgba = new Uint8ClampedArray(width * height * 4);
  for (const [color, x, y, w, h] of commands) {
    const bytes = [1, 3, 5].map((at) => parseInt(color.slice(at, at + 2), 16)).concat(255);
    for (let yy = Math.floor((y * height) / 64); yy < Math.ceil(((y + h) * height) / 64); yy++)
      for (let xx = Math.floor((x * width) / 64); xx < Math.ceil(((x + w) * width) / 64); xx++)
        if (xx >= 0 && yy >= 0 && xx < width && yy < height) rgba.set(bytes, (yy * width + xx) * 4);
  }
  return { width, height, rgba };
}

export function machineryHardwarePixels(size, slot) {
  return pixelsFromCommands(size, hardwareCommands(slot));
}

export function drawMachineryHardwareSpecimen(ctx, slot, { x = 0, y = 0, size = 64 } = {}) {
  if (!(Number.isFinite(size) && size > 0 && size <= 512))
    throw new TypeError('Invalid hardware specimen size.');
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 64, size / 64);
  ctx.translate(-32, -32);
  paint(ctx, hardwareCommands(slot));
  ctx.restore();
}

/** Direct Canvas specimen and runtime overlay; no canvas/bitmap allocation. */
export function drawMachinerySpecimen(
  ctx,
  family,
  { x = 0, y = 0, size = 64, heading = 0, frame = {}, compact = size <= 24 } = {},
) {
  if (!(Number.isFinite(size) && size > 0 && size <= 512 && Number.isFinite(heading)))
    throw new TypeError('Invalid machinery specimen bounds.');
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(heading);
  ctx.scale(size / 64, size / 64);
  ctx.translate(-32, -32);
  paint(ctx, vehicleCommands(family, { ...poseOf(frame), compact }));
  ctx.restore();
}

/** Admitted native frame pixels; every surrounding pixel is transparent. */
export function machineryPixels({ width, height }, family, frame = {}) {
  return pixelsFromCommands(
    { width, height },
    vehicleCommands(family, { ...poseOf(frame), compact: width <= 24 }),
  );
}

/** Material-accurate equipment, never flesh. Call only for accepted destruction;
 * this pure recipe cannot create or award a vehicle elimination. */
export function drawMachineryDebris(
  ctx,
  family,
  { x = 0, y = 0, size = 32, brutal = false, progress = 1, reduced = false } = {},
) {
  if (!INDUSTRIAL_MACHINERY_FAMILIES.includes(family))
    throw new TypeError('Unknown machinery debris family.');
  const t = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 1));
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  const count = brutal ? 6 : 3;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4,
      radius = reduced ? 5 : 3 + t * (brutal ? 9 : 4);
    ctx.save();
    ctx.translate(Math.cos(angle) * radius, Math.sin(angle) * radius * 0.7);
    ctx.rotate(reduced ? angle : angle + t * 1.5);
    const wheel = i % 3 === 0,
      canvas = family === 'cargo-truck' && i % 3 === 1;
    ctx.fillStyle = p.ink;
    ctx.fillRect(-3, -2, 6, 4);
    ctx.fillStyle = wheel ? p.rubber : canvas ? p.canvas : p.hull;
    ctx.fillRect(-2, -1, 4, 2);
    ctx.fillStyle = wheel ? p.tread : p.steel;
    ctx.fillRect(-2, -1, 3, 1);
    if (family === 'radar-truck' && i === 1) {
      ctx.fillStyle = p.steel;
      ctx.fillRect(-4, -2, 8, 1);
    }
    if (family === 'tracked-tank' && i === 0) {
      ctx.fillStyle = p.steel;
      ctx.fillRect(-3, 0, 6, 1);
    }
    ctx.restore();
  }
  ctx.restore();
}
