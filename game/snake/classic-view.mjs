import { drawHumanoidPixelBody, drawHuntRemains } from '../hunt/destruction.mjs';
import { CLASSIC_SNAKE_CHAPTERS } from './classic-catalogue.mjs';

const UNIT = 28;
const INKS = [
  { body: '#153d61', edge: '#65b6ff', band: '#ffe16b' },
  { body: '#4b285e', edge: '#e3b5ff', band: '#ffffff' },
];
const ACCENT_COLORS = Object.freeze(
  [
    ['#153d61', '#65b6ff', '#ffe16b'],
    ['#4b285e', '#e3b5ff', '#ffffff'],
    ['#174c43', '#8fe2bc', '#e8ffe9'],
    ['#55431d', '#ffcd76', '#fff0c7'],
    ['#562e28', '#ffaa91', '#ffedcf'],
    ['#38315c', '#bfb0ff', '#eff0ff'],
    ['#34424c', '#c4dbea', '#ffffff'],
    ['#354923', '#c7e887', '#efffcc'],
    ['#1a4657', '#86d9f5', '#e9faff'],
    ['#512d40', '#f8b1d4', '#ffe8f3'],
    ['#174c4a', '#71ded2', '#d8fff5'],
    ['#483153', '#d9b6f2', '#f5eaff'],
    ['#51401f', '#eace86', '#fff0c9'],
    ['#243e52', '#b0e0ff', '#f0fbff'],
  ].map(([body, edge, band]) => Object.freeze({ body, edge, band })),
);
const accents = new Map(
  CLASSIC_SNAKE_CHAPTERS.map((chapter, i) => [chapter.id, ACCENT_COLORS[i % ACCENT_COLORS.length]]),
);
const pilotInk = (id, accent) => (id ? INKS[id % INKS.length] : (accents.get(accent) ?? INKS[0]));
const FALLBACK_PALETTE = Object.freeze({
  field: '#071527',
  alternate: '#10243e',
  grid: '#26394e',
  text: '#f6f3e8',
  muted: '#a8b8cc',
  accent: '#ffd64a',
  safe: '#67aaff',
  danger: '#ff7169',
});
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const TARGETS = Object.freeze({
  patroller: { color: '#b8ddf2', accent: '#6ab4db', kind: 'guard' },
  runner: { color: '#ffe09a', accent: '#e3a247', kind: 'runner' },
  sprinter: { color: '#ffbfa7', accent: '#f07858', kind: 'runner' },
  courier: { color: '#e6b8ff', accent: '#ad76df', kind: 'runner' },
});

export function classicCatchMarks(run) {
  return run.recentCatches.map((mark) => ({
    ...mark,
    kind: mark.kind === 'patroller' ? 'guard' : 'runner',
    cause: 'ram',
    x: mark.x + 0.5,
    y: mark.y + 0.5,
  }));
}

/** Stable shape badges distinguish roles without depending on color or motion. */
export function drawClassicTarget(ctx, x, y, size, pose = 0, options = {}) {
  const profile = options.kind ?? options.profile ?? 'runner',
    design = TARGETS[profile] ?? TARGETS.runner;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / UNIT, size / UNIT);
  ctx.fillStyle = '#162238';
  ctx.fillRect(1, 1, 26, 26);
  ctx.strokeStyle = design.color;
  ctx.lineWidth = 2;
  ctx.strokeRect(1.5, 1.5, 25, 25);
  ctx.save();
  ctx.translate(5, 2);
  ctx.scale(1.2, 1.2);
  drawHumanoidPixelBody(ctx, { kind: design.kind, pose }, { accent: design.accent });
  ctx.restore();
  ctx.fillStyle = design.color;
  if (profile === 'courier') {
    ctx.fillRect(17, 14, 8, 7);
    ctx.fillStyle = '#162238';
    ctx.fillRect(20, 14, 2, 7);
  } else if (profile === 'patroller') {
    ctx.fillRect(3, 4, 4, 10);
    ctx.fillRect(2, 6, 6, 3);
  } else {
    ctx.fillRect(2, 7, 2, 3);
    ctx.fillRect(4, 9, 2, 3);
    if (profile === 'sprinter') {
      ctx.fillRect(2, 13, 2, 3);
      ctx.fillRect(4, 15, 2, 3);
    }
  }
  if (options.frozen) {
    ctx.strokeStyle = '#d4f5ff';
    ctx.lineWidth = 2;
    ctx.strokeRect(4, 4, 20, 20);
    ctx.fillStyle = '#d4f5ff';
    ctx.fillRect(10, 22, 3, 4);
    ctx.fillRect(16, 22, 3, 4);
  }
  if (options.phase === 'warning') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(22, 12, 3, 6);
    ctx.fillRect(22, 20, 3, 3);
  }
  if (options.direction in ANGLES) {
    ctx.translate(22, 6);
    ctx.rotate(ANGLES[options.direction]);
    ctx.fillStyle = design.color;
    ctx.beginPath();
    ctx.moveTo(0, -3);
    ctx.lineTo(3, 2);
    ctx.lineTo(-3, 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawDrone(ctx, snake, presentation, accent) {
  const head = snake.body[0],
    ink = pilotInk(snake.id, accent);
  ctx.save();
  ctx.translate((head.x + 0.5) * UNIT, (head.y + 0.5) * UNIT);
  ctx.rotate(ANGLES[snake.direction]);
  ctx.fillStyle = '#071527';
  ctx.fillRect(-13, -13, 26, 26);
  ctx.strokeStyle = ink.edge;
  ctx.lineWidth = 1;
  ctx.strokeRect(-13, -13, 26, 26);
  const image = presentation?.image?.('player.scout.compact');
  if (image) ctx.drawImage(image, -14, -14, 28, 28);
  else {
    ctx.strokeStyle = '#a8b8cc';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-8, -8);
    ctx.lineTo(8, 8);
    ctx.moveTo(8, -8);
    ctx.lineTo(-8, 8);
    ctx.stroke();
    ctx.fillStyle = '#d5deec';
    ctx.fillRect(-4, -8, 8, 16);
  }
  // Four separated rotor hubs and a forward camera keep the FPV silhouette
  // readable at small sizes; no spinning blur or new collision shape.
  for (const x of [-7, 7])
    for (const y of [-7, 7]) {
      ctx.fillStyle = '#071527';
      ctx.fillRect(x - 3, y - 2, 6, 4);
      ctx.fillStyle = ink.edge;
      ctx.fillRect(x - 2, y - 1, 4, 2);
    }
  ctx.fillStyle = '#0057b7';
  ctx.fillRect(-3, -2, 6, 3);
  ctx.fillStyle = '#ffd700';
  ctx.fillRect(-3, 1, 6, 3);
  ctx.fillStyle = ink.band;
  ctx.fillRect(-2, -11, 4, 3);
  if (snake.id) {
    ctx.fillRect(-6, 8, 2, 3);
    ctx.fillRect(4, 8, 2, 3);
  } else ctx.fillRect(-1, 8, 2, 3);
  ctx.restore();
}

function drawCable(ctx, snake, style, accent) {
  const ink = pilotInk(snake.id, accent);
  for (let i = snake.body.length - 1; i > 0; i--) {
    const cell = snake.body[i],
      x = cell.x * UNIT,
      y = cell.y * UNIT;
    // The whole occupied cell remains marked in BOTH cosmetic styles.
    ctx.fillStyle = ink.body;
    ctx.fillRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
    ctx.strokeStyle = ink.edge;
    ctx.lineWidth = 1;
    ctx.setLineDash(style === 'signal' ? [3, 2] : []);
    ctx.strokeRect(x + 1.5, y + 1.5, UNIT - 3, UNIT - 3);
    ctx.setLineDash([]);
    const previous = snake.body[i - 1];
    ctx.strokeStyle = ink.band;
    ctx.lineWidth = style === 'signal' ? 2 : 5;
    ctx.beginPath();
    ctx.moveTo(x + UNIT / 2, y + UNIT / 2);
    if (previous && Math.abs(cell.x - previous.x) + Math.abs(cell.y - previous.y) === 1)
      ctx.lineTo((previous.x + 0.5) * UNIT, (previous.y + 0.5) * UNIT);
    else ctx.lineTo(x + UNIT / 2 + 1, y + UNIT / 2);
    ctx.stroke();
    ctx.fillStyle = ink.edge;
    ctx.fillRect(x + 5, y + 5, 3, 3);
    if (snake.id) ctx.fillRect(x + 20, y + 20, 3, 3);
  }
}

function drawWall(ctx, wall, presentation, palette) {
  const x = wall.x * UNIT,
    y = wall.y * UNIT,
    image = presentation?.image?.('terrain.wall');
  if (image) ctx.drawImage(image, x, y, UNIT, UNIT);
  else {
    ctx.fillStyle = '#425563';
    ctx.fillRect(x, y, UNIT, UNIT);
    ctx.fillStyle = '#a5b2bb';
    ctx.fillRect(x + 2, y + 2, UNIT - 4, 4);
    ctx.fillStyle = '#182531';
    ctx.fillRect(x, y + 14, UNIT, 2);
  }
  ctx.strokeStyle = palette.muted;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, UNIT - 1, UNIT - 1);
}

function drawShutters(ctx, run, palette) {
  for (const shutter of run.shutters ?? [])
    for (const cell of shutter.cells) {
      const x = cell.x * UNIT,
        y = cell.y * UNIT;
      ctx.save();
      ctx.strokeStyle = shutter.closed
        ? palette.danger
        : shutter.warning
          ? palette.accent
          : palette.safe;
      ctx.lineWidth = shutter.closed ? 3 : 2;
      ctx.setLineDash(shutter.closed ? [] : [4, 3]);
      if (shutter.closed) {
        ctx.fillStyle = '#26313e';
        ctx.fillRect(x, y, UNIT, UNIT);
        ctx.strokeRect(x + 1.5, y + 1.5, UNIT - 3, UNIT - 3);
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 6);
        ctx.lineTo(x + 22, y + 22);
        ctx.moveTo(x + 22, y + 6);
        ctx.lineTo(x + 6, y + 22);
        ctx.stroke();
      } else {
        ctx.strokeRect(x + 2, y + 2, UNIT - 4, UNIT - 4);
        if (shutter.warning || shutter.yielding) {
          ctx.setLineDash([]);
          ctx.fillStyle = palette.accent;
          ctx.fillRect(x + 3, y + 3, 5, 3);
          ctx.fillRect(x + 20, y + 22, 5, 3);
        }
      }
      ctx.restore();
    }
}

function drawPickup(ctx, pickup) {
  if (!pickup) return;
  const x = pickup.x * UNIT,
    y = pickup.y * UNIT;
  ctx.save();
  ctx.translate(x + UNIT / 2, y + UNIT / 2);
  ctx.fillStyle = '#071527';
  ctx.strokeStyle = '#d4f5ff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(12, 0);
  ctx.lineTo(0, 12);
  ctx.lineTo(-12, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  if (pickup.kind === 'pulse') {
    ctx.fillStyle = '#d4f5ff';
    ctx.fillRect(-5, -5, 3, 10);
    ctx.fillRect(2, -5, 3, 10);
  } else {
    ctx.strokeStyle = '#ffe16b';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffe16b';
    ctx.fillRect(-2, -2, 4, 4);
  }
  ctx.restore();
}

export function drawClassicBoard(
  canvas,
  run,
  {
    effects,
    brutal = false,
    blood = true,
    showRemains = true,
    style = 'cable',
    presentation,
    accent = null,
    reduced = false,
  } = {},
) {
  const { width, height, walls, wrap } = run.level,
    palette = presentation?.palette ?? FALLBACK_PALETTE;
  if (canvas.width !== width * UNIT || canvas.height !== height * UNIT) {
    canvas.width = width * UNIT;
    canvas.height = height * UNIT;
    canvas.style.aspectRatio = `${width} / ${height}`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      ctx.fillStyle = (x + y) % 2 ? palette.field : palette.alternate;
      ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
    }
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x * UNIT, 0);
    ctx.lineTo(x * UNIT, canvas.height);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y * UNIT);
    ctx.lineTo(canvas.width, y * UNIT);
  }
  ctx.stroke();
  if (showRemains) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    for (const mark of classicCatchMarks(run)) drawHuntRemains(ctx, mark, { brutal, blood });
    ctx.restore();
  }
  if (effects) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    effects.draw(ctx);
    ctx.restore();
  }
  for (const wall of walls) drawWall(ctx, wall, presentation, palette);
  drawShutters(ctx, run, palette);
  drawPickup(ctx, run.pickup);
  ctx.lineWidth = 3;
  ctx.strokeStyle = wrap ? palette.accent : palette.muted;
  ctx.setLineDash(wrap ? [7, 7] : []);
  ctx.strokeRect(1.5, 1.5, canvas.width - 3, canvas.height - 3);
  ctx.setLineDash([]);
  const targets = run.targets ?? (run.target ? [run.target] : []);
  for (const target of targets)
    drawClassicTarget(
      ctx,
      target.x * UNIT,
      target.y * UNIT,
      UNIT,
      reduced || target.kind === 'still' || run.pulseTicks > 0 ? 0 : run.tick % 3,
      {
        ...target,
        direction:
          target.kind === 'still' || (target.kind === 'sprinter' && target.phase === 'rest')
            ? undefined
            : target.heading,
        frozen: run.pulseTicks > 0,
      },
    );
  for (const snake of run.snakes) {
    drawCable(ctx, snake, style, accent);
    drawDrone(ctx, snake, presentation, accent);
    if (!snake.alive) {
      const head = snake.body[0];
      ctx.strokeStyle = palette.danger;
      ctx.lineWidth = 4;
      ctx.strokeRect(head.x * UNIT + 1, head.y * UNIT + 1, UNIT - 2, UNIT - 2);
    }
  }
  // A failed step keeps the previous legal body. Mark the attempted impact
  // cell as well, so the frozen failure image identifies the actual obstacle.
  for (const failure of run.failure?.players ?? []) {
    if (!failure.at) continue;
    const x = Math.max(0, Math.min(width - 1, failure.at.x)) * UNIT,
      y = Math.max(0, Math.min(height - 1, failure.at.y)) * UNIT;
    ctx.strokeStyle = '#071527';
    ctx.lineWidth = 7;
    ctx.strokeRect(x + 3, y + 3, UNIT - 6, UNIT - 6);
    ctx.strokeStyle = palette.danger;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 3, y + 3, UNIT - 6, UNIT - 6);
    ctx.beginPath();
    ctx.moveTo(x + 8, y + 8);
    ctx.lineTo(x + 20, y + 20);
    ctx.moveTo(x + 20, y + 8);
    ctx.lineTo(x + 8, y + 20);
    ctx.stroke();
  }
}
