import { drawFpvBodyRecipe } from '../ui/fpv-body-recipes.mjs';
import { aliasSafePhase } from '../../authoring/motion-lab/animation.mjs';
/** Original FPV pixel artwork. All coordinates are decorative, never collision geometry. */
const UNIT = 28;
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
const rect = (ctx, color, x, y, w, h) => {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
};

/** Caller owns one clock per board. Pause, Reduced effects and a terminal board
 * freeze it; it is deliberately absent from gameplay saves and replay identity. */
export function advanceClassicFlight(previous, elapsedMs, active, reduced) {
  const current = previous ?? { timeMs: 0, rotorPhase: 0 };
  if (!active || reduced) return current;
  const elapsed = Number.isFinite(elapsedMs) ? Math.max(0, Math.min(100, elapsedMs)) : 0;
  return {
    timeMs: (current.timeMs + elapsed) % 60000,
    rotorPhase: aliasSafePhase(current.rotorPhase, 1.8, elapsed / 1000, 3).phase,
  };
}

export function drawClassicDrone(ctx, snake, ink, { rotorPhase = 0, reduced = false } = {}) {
  const head = snake.body[0];
  ctx.save();
  ctx.translate((head.x + 0.5) * UNIT, (head.y + 0.5) * UNIT);
  ctx.rotate(ANGLES[snake.direction] ?? 0);
  // Retain the full cell contact cue without putting the aircraft in a box.
  ctx.globalAlpha = 0.4;
  rect(ctx, ink.body, -13.5, -13.5, 27, 27);
  ctx.globalAlpha = 0.85;
  for (const x of [-13, 10])
    for (const y of [-13, 10]) {
      rect(ctx, ink.edge, x, y, 3, 0.7);
      rect(ctx, ink.edge, x, y, 0.7, 3);
    }
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = '#020c13';
  ctx.beginPath();
  ctx.ellipse(0, 2, 11, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
  rect(ctx, '#071522', -4, 8, 8, 6);
  rect(ctx, ink.edge, -2.5, 8, 5, 6);
  rect(ctx, ink.band, -1, 8, 2, 6);
  // Share the main game's carbon frame, camera, antenna and tri-blade motors.
  drawFpvBodyRecipe(
    ctx,
    { bodyRecipe: 'fpv-open-x', rotorPhase, reduced },
    {
      dark: '#07141c',
      light: '#d1e3df',
      body: ink.edge,
      trim: ink.band,
    },
  );
  // Service details fit the original silhouette: battery rails, ties, lens,
  // blue/yellow flight marking and a rear tether socket.
  rect(ctx, '#091923', -4, -6, 8, 12);
  rect(ctx, '#abc3c5', -3.5, -5.5, 7, 11);
  rect(ctx, '#799ca5', -3, -5, 1, 10);
  rect(ctx, '#799ca5', 2, -5, 1, 10);
  rect(ctx, '#284656', -2, -5, 4, 10);
  rect(ctx, '#a7bbc0', -2, -5, 1, 9);
  rect(ctx, '#0057b7', -2, -1.5, 4, 2);
  rect(ctx, '#ffd700', -2, 0.5, 4, 2);
  rect(ctx, '#0b1c28', -3, -4, 6, 1);
  rect(ctx, '#0b1c28', -3, 3.5, 6, 1);
  rect(ctx, '#73e4f5', -0.5, -7.5, 1, 1);
  rect(ctx, '#0b1c28', -2.5, 7, 5, 3);
  rect(ctx, '#c7d5cd', -1.5, 7.5, 3, 2);
  rect(ctx, ink.band, -1, 8, 2, 1);
  if (snake.id) {
    rect(ctx, ink.edge, -3, 10, 1, 2);
    rect(ctx, ink.edge, 2, 10, 1, 2);
  }
  ctx.restore();
}

function direction(from, to, level) {
  if (!to) return null;
  let dx = to.x - from.x,
    dy = to.y - from.y;
  if (level.wrap) {
    if (Math.abs(dx) === level.width - 1) dx = -Math.sign(dx);
    if (Math.abs(dy) === level.height - 1) dy = -Math.sign(dy);
  }
  return Math.abs(dx) + Math.abs(dy) === 1 ? { x: dx, y: dy } : null;
}

export function drawClassicCable(
  ctx,
  snake,
  ink,
  level,
  { style = 'cable', timeMs = 0, reduced = false } = {},
) {
  const signal = style === 'signal';
  ctx.save();
  if (style === 'segmented') {
    // The original chunky Snake body is still the exact occupied-cell footprint.
    // Small connectors follow real neighbours, including a wrapped board edge.
    for (let i = snake.body.length - 1; i > 0; i--) {
      const cell = snake.body[i],
        x = cell.x * UNIT,
        y = cell.y * UNIT;
      for (const neighbour of [snake.body[i - 1], snake.body[i + 1]]) {
        const toward = direction(cell, neighbour, level);
        if (toward) rect(ctx, ink.body, x + 8 + toward.x * 8, y + 8 + toward.y * 8, 12, 12);
      }
      rect(ctx, ink.edge, x + 1, y + 1, 26, 26);
      rect(ctx, ink.body, x + 3, y + 3, 22, 22);
      rect(ctx, ink.band, x + 5, y + 5, 4, 4);
      rect(ctx, '#71966b', x + 3, y + 24, 22, 1);
      if (i === snake.body.length - 1) {
        rect(ctx, ink.edge, x + 11, y + 11, 6, 6);
        rect(ctx, ink.band, x + 13, y + 13, 2, 2);
      }
    }
    ctx.restore();
    return;
  }
  // Full occupied cells stay visible; continuous tubing carries the visual focus.
  for (let i = snake.body.length - 1; i > 0; i--) {
    const cell = snake.body[i],
      x = cell.x * UNIT,
      y = cell.y * UNIT;
    ctx.globalAlpha = 0.58;
    rect(ctx, ink.body, x + 0.5, y + 0.5, UNIT - 1, UNIT - 1);
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = ink.edge;
    ctx.lineWidth = 0.7;
    ctx.strokeRect(x + 1, y + 1, UNIT - 2, UNIT - 2);
  }
  ctx.globalAlpha = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = snake.body.length - 1; i > 0; i--) {
    const cell = snake.body[i],
      x = (cell.x + 0.5) * UNIT,
      y = (cell.y + 0.5) * UNIT;
    const front = direction(cell, snake.body[i - 1], level),
      back = direction(cell, snake.body[i + 1], level);
    ctx.moveTo(x + ((back?.x ?? 0) * UNIT) / 2, y + ((back?.y ?? 0) * UNIT) / 2);
    ctx.lineTo(x, y);
    ctx.lineTo(x + ((front?.x ?? 0) * UNIT) / 2, y + ((front?.y ?? 0) * UNIT) / 2);
  }
  // Stroke all joined pieces together so individual end caps cannot sever the
  // inner cable at cell boundaries. Wrap pieces terminate at their own edge.
  ctx.strokeStyle = '#071522';
  ctx.lineWidth = signal ? 7 : 10;
  ctx.stroke();
  ctx.strokeStyle = ink.edge;
  ctx.lineWidth = signal ? 4 : 7;
  ctx.stroke();
  ctx.strokeStyle = signal ? '#f0fff9' : ink.band;
  ctx.lineWidth = signal ? 1.5 : 3;
  ctx.setLineDash(signal ? [2, 4] : [5, 2]);
  ctx.lineDashOffset = reduced ? 0 : -(timeMs / 100) % 7;
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.lineDashOffset = 0;
  for (let i = snake.body.length - 1; i > 0; i--) {
    const cell = snake.body[i],
      x = (cell.x + 0.5) * UNIT,
      y = (cell.y + 0.5) * UNIT;
    const front = direction(cell, snake.body[i - 1], level),
      back = direction(cell, snake.body[i + 1], level);
    if (!back && front) {
      // The terminating reel connector follows the last cable segment.
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(front.y, front.x));
      rect(ctx, '#071522', -6, -5, 11, 10);
      rect(ctx, '#9caeae', -5, -4, 8, 8);
      rect(ctx, ink.body, -4, -3, 6, 6);
      rect(ctx, ink.band, -2, -3, 2, 6);
      rect(ctx, '#dae3d6', 3, -2, 3, 4);
      ctx.restore();
    } else if (i % 3 === 0 && front && back && front.x === -back.x && front.y === -back.y) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.atan2(front.y, front.x));
      rect(ctx, '#0b1b26', -2, -5, 4, 10);
      rect(ctx, '#bac9c7', -1, -4, 2, 8);
      ctx.restore();
    }
  }
  ctx.restore();
}
