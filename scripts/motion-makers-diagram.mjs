/** Original offline artwork, not a motor model or a player animation engine.
 * The deliberately slow motion has no RPM, airflow or dimensional meaning. */
export const MOTION_MAKERS_CLIP = Object.freeze({ width: 960, height: 540, fps: 24, seconds: 12 });
const { width: W, height: H } = MOTION_MAKERS_CLIP;
const colors = {
  ink: [14, 27, 46],
  panel: [22, 43, 65],
  line: [53, 82, 103],
  pale: [225, 239, 242],
  muted: [147, 172, 186],
  amber: [255, 193, 112],
  cyan: [91, 222, 218],
};
// A small original pixel alphabet keeps the offline diagram portable without
// system fonts or a new runtime dependency. Ukrainian is drawn, not transliterated.
const glyphs = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  0: ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '/': ['00001', '00001', '00010', '00100', '01000', '10000', '10000'],
  '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
  Д: ['00110', '01010', '01010', '01010', '01010', '11111', '10001'],
  Ж: ['10101', '10101', '01110', '00100', '01110', '10101', '10101'],
  И: ['10001', '10001', '10011', '10101', '11001', '10001', '10001'],
  Л: ['00111', '01001', '01001', '01001', '01001', '01001', '10001'],
  П: ['11111', '10001', '10001', '10001', '10001', '10001', '10001'],
  У: ['10001', '10001', '10001', '01111', '00001', '00001', '11110'],
  Ф: ['00100', '01110', '10101', '10101', '10101', '01110', '00100'],
  Я: ['01111', '10001', '10001', '01111', '00101', '01001', '10001'],
};
for (const [letter, equivalent] of Object.entries({
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  Х: 'X',
  І: 'I',
}))
  glyphs[letter] = glyphs[equivalent];
glyphs.X = ['10001', '10001', '01010', '00100', '01010', '10001', '10001'];
glyphs.Х = glyphs.X;

function drawing(rgba) {
  const pixel = (x, y, color, coverage = 1) => {
    if (x < 0 || y < 0 || x >= W || y >= H || coverage <= 0) return;
    const at = (y * W + x) * 4,
      alpha = Math.min(1, coverage);
    for (let c = 0; c < 3; c++)
      rgba[at + c] = Math.round(rgba[at + c] * (1 - alpha) + color[c] * alpha);
    rgba[at + 3] = 255;
  };
  const rectangle = (x, y, w, h, color) => {
    for (let yy = Math.max(0, Math.floor(y)); yy < Math.min(H, y + h); yy++)
      for (let xx = Math.max(0, Math.floor(x)); xx < Math.min(W, x + w); xx++) pixel(xx, yy, color);
  };
  const circle = (cx, cy, radius, color, stroke = null) => {
    for (
      let y = Math.max(0, Math.floor(cy - radius - 1));
      y <= Math.min(H - 1, cy + radius + 1);
      y++
    )
      for (
        let x = Math.max(0, Math.floor(cx - radius - 1));
        x <= Math.min(W - 1, cx + radius + 1);
        x++
      ) {
        const distance = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        pixel(
          x,
          y,
          color,
          stroke === null
            ? radius + 0.5 - distance
            : Math.min(radius + 0.5 - distance, distance - (radius - stroke) + 0.5),
        );
      }
  };
  const line = (x1, y1, x2, y2, width, color) => {
    const dx = x2 - x1,
      dy = y2 - y1,
      length = Math.hypot(dx, dy),
      steps = Math.ceil(length * 1.5);
    for (let step = 0; step <= steps; step++)
      circle(x1 + (dx * step) / steps, y1 + (dy * step) / steps, width / 2, color);
  };
  const polygon = (points, color) => {
    const minY = Math.max(0, Math.floor(Math.min(...points.map((p) => p[1])))),
      maxY = Math.min(H - 1, Math.ceil(Math.max(...points.map((p) => p[1]))));
    for (let y = minY; y <= maxY; y++) {
      const intersections = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i],
          b = points[(i + 1) % points.length];
        if ((a[1] <= y + 0.5 && b[1] > y + 0.5) || (b[1] <= y + 0.5 && a[1] > y + 0.5))
          intersections.push(a[0] + ((y + 0.5 - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2)
        for (let x = Math.floor(intersections[i]); x < Math.ceil(intersections[i + 1]); x++)
          pixel(x, y, color, Math.min(x + 1, intersections[i + 1]) - Math.max(x, intersections[i]));
    }
  };
  const text = (value, cx, y, scale, color) => {
    const start = Math.round(cx - ((value.length * 6 - 1) * scale) / 2);
    [...value].forEach((letter, index) => {
      if (letter === ' ') return;
      const glyph = glyphs[letter];
      if (!glyph) throw new Error('Missing original diagram glyph: ' + letter);
      glyph.forEach((row, yy) =>
        [...row].forEach((bit, xx) => {
          if (bit === '1')
            rectangle(start + (index * 6 + xx) * scale, y + yy * scale, scale, scale, color);
        }),
      );
    });
  };
  return { rectangle, circle, line, polygon, text };
}

/** Analytic, bounded authored timeline; no physics or random state. */
export function motionMakersState(frame) {
  if (
    !Number.isInteger(frame) ||
    frame < 0 ||
    frame >= MOTION_MAKERS_CLIP.fps * MOTION_MAKERS_CLIP.seconds
  )
    throw new TypeError('Choose a frame inside the original 12-second clip.');
  const seconds = frame / MOTION_MAKERS_CLIP.fps;
  const elapsed = Math.max(0, Math.min(7.5, seconds - 2.5));
  return Object.freeze({
    seconds,
    phase: Math.min(3, Math.floor(seconds / 3)),
    statorAngle: 0,
    rotorAngle: (elapsed * Math.PI) / 5,
    propellerAngle: (elapsed * Math.PI) / 5,
    airVisible: seconds >= 6,
    airOffset: seconds >= 10 ? 0 : (Math.max(0, seconds - 6) * 14) % 44,
  });
}

let base;
function background() {
  if (base) return base;
  base = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const at = (y * W + x) * 4,
        glow = Math.max(0, 1 - Math.hypot((x - W / 2) / W, (y - 230) / H));
      base[at] = colors.ink[0] + glow * 8;
      base[at + 1] = colors.ink[1] + glow * 12;
      base[at + 2] = colors.ink[2] + glow * 14;
      base[at + 3] = 255;
    }
  const d = drawing(base);
  d.text('MOTION MAKERS', 480, 24, 4, colors.pale);
  d.text('ДЖЕРЕЛА РУХУ', 480, 61, 2, colors.muted);
  d.text('SCHEMATIC / СХЕМА', 480, 91, 2, colors.muted);
  d.line(48, 123, 912, 123, 1, colors.line);
  d.circle(260, 275, 142, colors.panel);
  d.circle(700, 275, 142, colors.panel);
  for (const cx of [260, 700]) {
    d.circle(cx, 275, 126, colors.line, 1);
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      d.line(
        cx + Math.cos(a) * 135,
        275 + Math.sin(a) * 135,
        cx + Math.cos(a) * 139,
        275 + Math.sin(a) * 139,
        1,
        colors.line,
      );
    }
  }
  d.text('MOTOR / МОТОР', 260, 422, 3, colors.pale);
  d.text('PROPELLER / ПРОПЕЛЕР', 700, 422, 3, colors.pale);
  d.text('1 STATOR / СТАТОР', 260, 461, 2, colors.amber);
  d.text('2 ROTOR / РОТОР', 260, 485, 2, colors.cyan);
  d.text('3 AIR / ПОВІТРЯ', 700, 461, 2, colors.pale);
  d.text('ROLES / РОЛІ', 700, 485, 2, colors.muted);
  return base;
}

export function renderMotionMakersFrame(frame) {
  const state = motionMakersState(frame),
    rgba = new Uint8Array(background()),
    d = drawing(rgba);
  // Stationary inner stator and moving outer rotor are deliberately schematic.
  // This avoids calling a common outrunner's moving bell a stationary housing.
  d.circle(260, 275, 84, colors.line, 13);
  d.circle(260, 275, 75, colors.ink);
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      x = 260 + Math.cos(a) * 51,
      y = 275 + Math.sin(a) * 51;
    d.circle(x, y, 13, colors.amber);
    d.circle(x, y, 7, [139, 93, 48]);
  }
  d.circle(260, 275, 32, [39, 62, 78]);
  d.circle(260, 275, 14, colors.pale);
  for (let i = 0; i < 5; i++) {
    const a = state.rotorAngle + (i * Math.PI * 2) / 5;
    d.circle(260 + Math.cos(a) * 84, 275 + Math.sin(a) * 84, i === 0 ? 10 : 5, colors.cyan);
  }
  d.circle(260, 275, 98, colors.cyan, 2);
  d.text('1', 260, 304, 2, colors.amber);
  d.text('2', 359, 265, 2, colors.cyan);
  // A separated top-view two-blade icon describes a role, not blade geometry.
  const points = [
    [9, -10],
    [31, -23],
    [72, -36],
    [108, -36],
    [115, -29],
    [111, -19],
    [85, -9],
    [43, 6],
    [9, 10],
  ];
  for (const direction of [0, Math.PI]) {
    const a = state.propellerAngle + direction - Math.PI / 5;
    d.polygon(
      points.map(([x, y]) => [
        700 + x * Math.cos(a) - y * Math.sin(a),
        275 + x * Math.sin(a) + y * Math.cos(a),
      ]),
      colors.cyan,
    );
  }
  d.circle(700, 275, 22, [45, 121, 134]);
  d.circle(700, 275, 11, colors.pale);
  if (state.airVisible)
    for (const [i, x] of [612, 653, 747, 788].entries())
      for (let j = 0; j < 3; j++) {
        const y = 320 + ((j * 34 + state.airOffset + i * 9) % 72);
        d.circle(x, y, 2 + (j % 2), colors.muted);
      }
  d.text('+', 480, 257, 4, colors.muted);
  d.text('3', 809, 344, 2, colors.pale);
  for (let i = 0; i < 4; i++)
    d.line(377 + i * 54, 519, 411 + i * 54, 519, 4, i === state.phase ? colors.cyan : colors.line);
  return { width: W, height: H, rgba };
}
