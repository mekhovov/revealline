import { actorScreenScale, PRESENTATION_INK, PRESENTATION_PLATE } from './actor-presentation.mjs';

/** Static corner marks locate the craft over revealed artwork. They are neither
 * a collision boundary nor a shield ring. Inputs and simulation stay untouched. */
export function drawPlayerLocator(ctx, { x, y, diameter, screenScale, width, height }) {
  if (![x, y, diameter, width, height].every(Number.isFinite) || width <= 0 || height <= 0) return;
  const scale = actorScreenScale(screenScale),
    radius = Math.min(18, Math.max(12, (diameter * scale) / 2 + 3)) / scale,
    edge = 5 / scale,
    inset = radius + 2.5 / scale,
    cx = width < inset * 2 ? width / 2 : Math.max(inset, Math.min(width - inset, x)),
    cy = height < inset * 2 ? height / 2 : Math.max(inset, Math.min(height - inset, y));
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';
  ctx.beginPath();
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ]) {
    const px = cx + dx * radius,
      py = cy + dy * radius;
    ctx.moveTo(px - dx * edge, py);
    ctx.lineTo(px, py);
    ctx.lineTo(px, py - dy * edge);
  }
  ctx.strokeStyle = PRESENTATION_PLATE;
  ctx.lineWidth = 5 / scale;
  ctx.stroke();
  ctx.strokeStyle = PRESENTATION_INK;
  ctx.lineWidth = 2 / scale;
  ctx.stroke();
  ctx.restore();
}
