import { TEAM_EFFECT_SLOTS } from '../presentation/team-effect-slots.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';

/** Prepare all four states before adoption, even in an arena without strongholds. */
export function prepareCoopEffects(snapshot) {
  const frames = new Map();
  for (const { id } of TEAM_EFFECT_SLOTS) {
    const asset = snapshot?.resolved?.assets?.[id] ?? snapshot?.canvas?.assets?.[id];
    if (!asset) continue;
    if (asset.kind === 'recipe' && asset.recipe?.id === 'team.effect.v1') continue;
    const frame = snapshot?.image?.(id),
      pivot = frame?.geometry?.pivot;
    if (
      asset.kind !== 'image' ||
      !frame?.image ||
      frame.asset?.id !== asset.id ||
      frame.asset?.revision !== asset.revision ||
      frame.geometry?.frame?.width !== 32 ||
      frame.geometry?.frame?.height !== 32 ||
      !pivot ||
      ![pivot.x, pivot.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1)
    )
      throw new TypeError(`Team effect needs its exact prepared 32×32 image: ${id}.`);
    frames.set(id, frame);
  }
  return frames;
}
/** Read-only state extraction; no cosmetic clock or checkpoint mutation. */
export function coopEffectMarkers(run) {
  const markers = [];
  for (const effect of run.supportEffects || [])
    if (effect.until > run.time)
      markers.push({ slot: 'team.effect.support', x: effect.x, y: effect.y });
  for (const enemy of run.enemies || [])
    if (enemy.active !== false && enemy.speedScale < 1 && enemy.slowUntil > run.time)
      markers.push({ slot: 'team.effect.slowed', x: enemy.x, y: enemy.y });
  for (const player of run.players || []) {
    if (player.status !== 'active') continue;
    const target = player.rescue?.target;
    if (
      Number.isInteger(target) &&
      run.players.some((other) => other.id === target && other.status === 'downed')
    )
      markers.push({ slot: 'team.effect.rescue', x: player.x, y: player.y });
    if (player.graceUntil > run.time)
      markers.push({ slot: 'team.effect.recovery', x: player.x, y: player.y });
  }
  return markers;
}
/** Caller supplies an unoccupied cosmetic rectangle, in board units. */
export function drawCoopEffect(ctx, frame, rect) {
  ctx.save();
  try {
    ctx.imageSmoothingEnabled = false;
    const pivot = frame.geometry.pivot;
    drawPresentationImage(
      ctx,
      frame.image,
      rect.left + rect.width * pivot.x,
      rect.top + rect.height * pivot.y,
      rect.width,
      rect.height,
      frame.geometry,
    );
  } finally {
    ctx.restore();
  }
}
