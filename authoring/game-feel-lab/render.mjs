import {
  drawActiveTrail,
  drawCapturePulse,
  drawPresentedActor,
  drawTrailImpactFront,
} from '../../game/ui/actor-presentation.mjs';
import { BOARD } from './sequence.mjs';

const PALETTES = Object.freeze({
  dark: Object.freeze({
    field: '#152333',
    safe: '#38575d',
    revealed: '#66837c',
    grid: '#203647',
    accent: '#ffd64a',
    muted: '#738d91',
  }),
  light: Object.freeze({
    field: '#b5a988',
    safe: '#718b81',
    revealed: '#dcc99b',
    grid: '#a49779',
    accent: '#ffce45',
    muted: '#617b80',
  }),
});

/** Suppress optional accents only. Position, heading, contact radius, stun and
 * dormancy remain the exact production sample in both comparison panes. */
export function actorVariant(frame, accents) {
  return accents
    ? frame
    : Object.freeze({
        ...frame,
        bank: 0,
        phase: 0,
        travelPhase: 0,
        rotorPhase: 0,
        tail: Object.freeze([]),
      });
}

export function containImage(width, height, frameWidth, frameHeight) {
  if (
    ![width, height, frameWidth, frameHeight].every((value) => Number.isFinite(value) && value > 0)
  )
    throw new Error('Image and frame dimensions must be positive.');
  const scale = Math.min(frameWidth / width, frameHeight / height);
  const fittedWidth = width * scale;
  const fittedHeight = height * scale;
  return {
    x: (frameWidth - fittedWidth) / 2,
    y: (frameHeight - fittedHeight) / 2,
    width: fittedWidth,
    height: fittedHeight,
  };
}

export function drawBenchmark(
  ctx,
  scene,
  {
    capture = true,
    actors = true,
    trail = true,
    reduced = false,
    background = 'dark',
    photo = null,
  } = {},
) {
  const palette = PALETTES[background] ?? PALETTES.dark;
  const { cellSize, columns, rows } = BOARD;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 1;
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, columns * cellSize, rows * cellSize);
  if (photo) {
    // Clip the full original to secured cells. The five-argument drawImage does
    // not crop source pixels; its contain fit leaves letterboxes inside the mask.
    const fit = containImage(photo.width, photo.height, columns * cellSize, rows * cellSize);
    ctx.save();
    ctx.beginPath();
    for (let index = 0; index < scene.cells.length; index++) {
      if (scene.cells[index])
        ctx.rect(
          (index % columns) * cellSize,
          Math.floor(index / columns) * cellSize,
          cellSize,
          cellSize,
        );
    }
    ctx.clip();
    ctx.fillStyle = '#07111c';
    ctx.fillRect(0, 0, columns * cellSize, rows * cellSize);
    ctx.drawImage(photo, fit.x, fit.y, fit.width, fit.height);
    ctx.restore();
  }
  const newlySecured = new Set(scene.newlySecured);
  for (let index = 0; index < scene.cells.length; index++) {
    if (photo && scene.cells[index]) continue;
    const x = (index % columns) * cellSize;
    const y = Math.floor(index / columns) * cellSize;
    ctx.fillStyle = scene.cells[index]
      ? newlySecured.has(index)
        ? palette.revealed
        : palette.safe
      : palette.grid;
    ctx.fillRect(x + 1, y + 1, cellSize - 2, cellSize - 2);
  }
  // Match the game layer order: capture below actors, active line and warnings.
  if (capture) drawCapturePulse(ctx, scene.captureEffect, columns, scene.cells, palette, reduced);
  drawPresentedActor(ctx, actorVariant(scene.actorFrame, actors), palette);
  drawActiveTrail(ctx, scene.trailSegments, scene.trailPoints, scene.player, palette, {
    time: scene.time,
    reduced: reduced || !trail,
  });
  if (scene.front) drawTrailImpactFront(ctx, scene.front, { time: scene.time, reduced });
  // A closed cut still has a visible player coordinate in this authored scene.
  if (!scene.trailSegments.length) {
    ctx.fillStyle = '#07111c';
    ctx.fillRect(scene.player.x * cellSize - 6, scene.player.y * cellSize - 6, 12, 12);
    ctx.fillStyle = '#f1f7ed';
    ctx.fillRect(scene.player.x * cellSize - 3, scene.player.y * cellSize - 3, 6, 6);
  }
  ctx.restore();
}

export function canvasPixelBytes(canvases) {
  return canvases.reduce((sum, canvas) => sum + canvas.width * canvas.height * 4, 0);
}

/** Bounded main-thread draw measurements, excluding sequence preparation and
 * DOM layout. These are neither measured FPS nor total application memory. */
export async function measureRenderCost(
  draw,
  {
    now = () => performance.now(),
    yieldTask = () => new Promise((resolve) => setTimeout(resolve, 0)),
    warmup = 20,
    samples = 120,
    signal,
  } = {},
) {
  if (
    !Number.isSafeInteger(warmup) ||
    warmup < 0 ||
    warmup > 60 ||
    !Number.isSafeInteger(samples) ||
    samples < 1 ||
    samples > 240
  )
    throw new Error('Render measurement exceeds its sample budget.');
  const costs = [];
  for (let index = 0; index < warmup + samples; index++) {
    signal?.throwIfAborted();
    const start = now();
    draw(index);
    const elapsed = now() - start;
    if (!Number.isFinite(elapsed) || elapsed < 0) throw new Error('Invalid render measurement.');
    if (index >= warmup) costs.push(elapsed);
    if ((index + 1) % 20 === 0) await yieldTask();
  }
  signal?.throwIfAborted();
  costs.sort((a, b) => a - b);
  return Object.freeze({
    samples,
    warmup,
    medianMs: costs[Math.floor((costs.length - 1) / 2)],
    p95Ms: costs[Math.ceil(costs.length * 0.95) - 1],
    minimumMs: costs[0],
  });
}
