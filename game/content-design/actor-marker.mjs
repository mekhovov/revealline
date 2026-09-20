/** Shared color-independent silhouettes for Studio and mission diagrams.
 * Adds a path only; the caller owns ink, fill and frozen capture overlays.
 */
export function traceContentActor(ctx, type, x, y, radius) {
  if (['bouncer', 'drifter'].includes(type)) ctx.arc(x, y, radius, 0, Math.PI * 2);
  else if (type === 'border-patrol') {
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y);
    ctx.lineTo(x, y + radius);
    ctx.lineTo(x - radius, y);
    ctx.closePath();
  } else if (type === 'claimed-rover') {
    ctx.rect(x - radius * 0.7, y - radius * 0.65, radius * 1.4, radius * 1.3);
    ctx.rect(x - radius, y - radius, radius * 0.3, radius * 2);
    ctx.rect(x + radius * 0.7, y - radius, radius * 0.3, radius * 2);
  } else if (type === 'eroder') {
    // A toothed blade, not a patrol triangle or the roamer's tracked square.
    ctx.rect(x - radius * 0.45, y - radius * 0.2, radius * 0.9, radius * 1.2);
    ctx.rect(x - radius, y - radius * 0.6, radius * 2, radius * 0.5);
    for (const tooth of [-1, -0.2, 0.6])
      ctx.rect(x + radius * tooth, y - radius, radius * 0.4, radius * 0.4);
  } else {
    ctx.moveTo(x, y - radius);
    ctx.lineTo(x + radius, y + radius);
    ctx.lineTo(x - radius, y + radius);
    ctx.closePath();
  }
}
