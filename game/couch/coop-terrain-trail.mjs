import { drawActiveTrail } from '../ui/actor-presentation.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';

const CELL = 16;

/** Borrow one already prepared frame. A missing legacy binding remains optional;
 * an advertised but malformed frame must not replace the accepted presentation. */
export function prepareCoopWall(snapshot) {
  if (typeof snapshot?.image !== 'function') return null;
  const tile = snapshot.image('terrain.wall');
  if (tile == null) return null;
  const width = tile.image?.naturalWidth ?? tile.image?.width;
  const height = tile.image?.naturalHeight ?? tile.image?.height;
  const pivot = tile.geometry?.pivot;
  if (
    !Number.isFinite(width) ||
    width <= 0 ||
    !Number.isFinite(height) ||
    height <= 0 ||
    !pivot ||
    ![pivot.x, pivot.y].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)
  )
    throw new TypeError('Team terrain needs its prepared image and normalized pivot.');
  return tile;
}

export function drawCoopWall(ctx, tile, x, y) {
  if (!tile) return;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    drawPresentationImage(ctx, tile.image, x + 0.5, y + 0.5, 1, 1, tile.geometry);
  } finally {
    ctx.restore();
  }
}

/** Team paints in cells; the shared primitive paints in 16-unit cells. Keep
 * authoritative anchors and heads independent of cosmetic body displacement. */
export function drawCoopActiveTrail(ctx, player, accent, { time, reduced, cssCell }) {
  if (!player.trail.length) return;
  const segments = [];
  let previous = player.safeAnchor;
  for (const cell of player.trail) {
    const point = { x: cell.x + 0.5, y: cell.y + 0.5 };
    segments.push({ x1: previous.x, y1: previous.y, x2: point.x, y2: point.y });
    previous = point;
  }
  segments.push({ x1: previous.x, y1: previous.y, x2: player.x, y2: player.y });
  ctx.save();
  try {
    ctx.scale(1 / CELL, 1 / CELL);
    drawActiveTrail(
      ctx,
      segments,
      player.trail,
      player,
      { accent },
      {
        time,
        reduced,
        screenScale: cssCell / CELL,
      },
    );
  } finally {
    ctx.restore();
  }
}
