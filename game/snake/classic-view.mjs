import { drawHuntRemains } from '../hunt/destruction.mjs';
import { runtimeActorArtRevision } from '../hunt/preferences.mjs';
import { createClassicTargetFacing, drawClassicTarget } from './classic-target-art.mjs';
import { drawClassicDrone, drawClassicCable } from './classic-flight-art.mjs';
export { drawClassicTarget } from './classic-target-art.mjs';
import { CLASSIC_SNAKE_CHAPTERS } from './classic-catalogue.mjs';

const UNIT = 28;
const targetFacings = new WeakMap();
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
export const RETRO_FIELD_PALETTE = Object.freeze({
  field: '#c5cfaa',
  alternate: '#d5dbba',
  grid: '#8a9b76',
  text: '#162b24',
  muted: '#61765d',
  accent: '#946516',
  safe: '#29643e',
  danger: '#8c2348',
});
const RETRO_INKS = [
  { body: '#276340', edge: '#153e2c', band: '#b3df76' },
  { body: '#6c457b', edge: '#3e274d', band: '#edd0f4' },
];
export function classicCatchMarks(run) {
  return run.recentCatches.map((mark) => ({
    ...mark,
    kind: mark.kind ?? 'runner',
    cause: 'ram',
    x: mark.x + 0.5,
    y: mark.y + 0.5,
  }));
}

function drawWall(ctx, wall, presentation, palette, retro = false) {
  const x = wall.x * UNIT,
    y = wall.y * UNIT,
    image = retro ? null : presentation?.image?.('terrain.wall');
  if (image) ctx.drawImage(image, x, y, UNIT, UNIT);
  else {
    ctx.fillStyle = retro ? '#3d4e41' : '#425563';
    ctx.fillRect(x, y, UNIT, UNIT);
    ctx.fillStyle = retro ? '#75856b' : '#a5b2bb';
    ctx.fillRect(x + 2, y + 2, UNIT - 4, 4);
    ctx.fillStyle = retro ? '#26392d' : '#182531';
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
    boardStyle = 'theme',
    cast = 'rivals',
    artRevision = runtimeActorArtRevision(),
    presentation,
    accent = null,
    reduced = false,
    flight = {},
    attemptKey = run,
    pixelRatio = 1,
    cssWidth,
  } = {},
) {
  const { width, height, walls, wrap } = run.level,
    retro = boardStyle === 'retro',
    palette = retro ? RETRO_FIELD_PALETTE : (presentation?.palette ?? FALLBACK_PALETTE);
  const logicalWidth = width * UNIT,
    logicalHeight = height * UNIT;
  const resolution = Math.max(
    1,
    Math.min(
      3,
      ((Number.isFinite(cssWidth) && cssWidth > 0 ? cssWidth : logicalWidth) / logicalWidth) *
        (Number.isFinite(pixelRatio) ? Math.max(1, Math.min(2, pixelRatio)) : 1),
    ),
  );
  // Half-step scales preserve the exact grid aspect ratio while avoiding
  // bitmap/CSS feedback when the responsive footprint is measured again.
  const stableResolution = Math.ceil(resolution * 2) / 2;
  const bitmapWidth = logicalWidth * stableResolution,
    bitmapHeight = logicalHeight * stableResolution;
  if (canvas.width !== bitmapWidth || canvas.height !== bitmapHeight) {
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;
    canvas.style.aspectRatio = `${width} / ${height}`;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(bitmapWidth / logicalWidth, 0, 0, bitmapHeight / logicalHeight, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);
  ctx.fillStyle = palette.alternate;
  ctx.globalAlpha = 0.42;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++)
      if ((x + y) % 2 === 0) ctx.fillRect(x * UNIT, y * UNIT, UNIT, UNIT);
  // Fine grid and sparse surface grain echo the main game's terrain without
  // competing with silhouettes or pretending to be additional obstacles.
  ctx.globalAlpha = 0.17;
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  for (let x = 1; x < width; x++) {
    ctx.moveTo(x * UNIT, 0);
    ctx.lineTo(x * UNIT, logicalHeight);
  }
  for (let y = 1; y < height; y++) {
    ctx.moveTo(0, y * UNIT);
    ctx.lineTo(logicalWidth, y * UNIT);
  }
  ctx.stroke();
  ctx.fillStyle = palette.muted;
  ctx.globalAlpha = 0.08;
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      if ((x * 7 + y * 11) % 5 === 0) ctx.fillRect(x * UNIT + 8, y * UNIT + 8, 1, 1);
    }
  ctx.globalAlpha = 1;
  if (showRemains) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    for (const mark of classicCatchMarks(run))
      drawHuntRemains(ctx, mark, { brutal, blood, artRevision });
    ctx.restore();
  }
  if (effects) {
    ctx.save();
    ctx.scale(UNIT / 16, UNIT / 16);
    effects.draw(ctx);
    ctx.restore();
  }
  for (const wall of walls) drawWall(ctx, wall, presentation, palette, retro);
  drawShutters(ctx, run, palette);
  drawPickup(ctx, run.pickup);
  ctx.lineWidth = 3;
  ctx.strokeStyle = wrap ? palette.accent : palette.muted;
  ctx.setLineDash(wrap ? [7, 7] : []);
  ctx.strokeRect(1.5, 1.5, logicalWidth - 3, logicalHeight - 3);
  ctx.setLineDash([]);
  const targets = run.targets ?? (run.target ? [run.target] : []);
  if (!targetFacings.has(canvas)) targetFacings.set(canvas, createClassicTargetFacing());
  const headings = targetFacings.get(canvas)(run, attemptKey);
  for (const target of targets)
    drawClassicTarget(
      ctx,
      target.x * UNIT,
      target.y * UNIT,
      UNIT,
      reduced || target.kind === 'still' || run.pulseTicks > 0 ? 0 : run.tick % 3,
      {
        ...target,
        heading: headings.get(target.id),
        cast,
        artRevision,
        direction:
          target.kind === 'still' || (target.kind === 'sprinter' && target.phase === 'rest')
            ? undefined
            : target.heading,
        frozen: run.pulseTicks > 0,
        palette,
        timeMs: flight.timeMs,
        reducedEffects: reduced,
      },
    );
  for (const snake of run.snakes) {
    const ink = retro ? RETRO_INKS[snake.id % 2] : pilotInk(snake.id, accent);
    drawClassicCable(ctx, snake, ink, run.level, {
      style: retro ? 'segmented' : style,
      ...flight,
      reduced,
    });
    drawClassicDrone(ctx, snake, ink, { ...flight, reduced });
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
