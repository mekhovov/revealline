import { TEAM_ANCHOR_SLOTS } from '../presentation/team-anchor-slots.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';

/** Prepare both states before adoption, even in an arena without strongholds. */
export function prepareCoopAnchors(snapshot) {
  const frames = new Map();
  for (const { id } of TEAM_ANCHOR_SLOTS) {
    const asset = snapshot?.resolved?.assets?.[id] ?? snapshot?.canvas?.assets?.[id];
    if (!asset) continue;
    if (asset.kind === 'recipe' && asset.recipe?.id === 'team.anchor.v1') continue;
    const frame = snapshot?.image?.(id),
      pivot = frame?.geometry?.pivot;
    if (
      asset.kind !== 'image' ||
      !frame?.image ||
      frame.asset?.id !== asset.id ||
      frame.asset?.revision !== asset.revision ||
      frame.geometry?.frame?.width !== 24 ||
      frame.geometry?.frame?.height !== 24 ||
      !pivot ||
      ![pivot.x, pivot.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
      throw new TypeError(`Team anchor needs its exact prepared 24×24 image: ${id}.`);
    frames.set(id, frame);
  }
  return frames;
}
/** Plan decoration without painting so neighboring imported targets stay distinct. */
export function coopAnchorBounds(frames, anchor, { cssCell = 16, width = 72, height = 36 } = {}) {
  const frame = frames?.get(`team.anchor.${anchor.captured ? 'captured' : 'available'}`);
  if (!frame) return null;
  const size = Math.max(1.4, 24 / cssCell),
    pivot = frame.geometry.pivot;
  const x = Math.max(size * pivot.x, Math.min(width - size * (1 - pivot.x), anchor.x));
  const y = Math.max(size * pivot.y, Math.min(height - size * (1 - pivot.y), anchor.y));
  return { x: x + size * (0.5 - pivot.x), y: y + size * (0.5 - pivot.y), size };
}

/** Cosmetic artwork has a 24 CSS-pixel minimum. The authored capture marker remains unchanged. */
export function drawCoopAnchor(ctx, frames, anchor, options = {}) {
  const bounds = coopAnchorBounds(frames, anchor, options);
  if (!bounds) return null;
  const frame = frames.get(`team.anchor.${anchor.captured ? 'captured' : 'available'}`);
  const { x, y, size } = bounds,
    pivot = frame.geometry.pivot;
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    drawPresentationImage(
      ctx,
      frame.image,
      x + size * (pivot.x - 0.5),
      y + size * (pivot.y - 0.5),
      size,
      size,
      frame.geometry,
    );
  } finally {
    ctx.restore();
  }
  return bounds;
}
