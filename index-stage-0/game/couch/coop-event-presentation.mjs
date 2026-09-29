import { TEAM_EVENT_SLOTS } from '../presentation/team-event-slots.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';

/** Event icons are prepared atomically with the accepted theme, never fetched on a cut. */
export function prepareCoopEvents(snapshot) {
  const frames = new Map();
  for (const { id } of TEAM_EVENT_SLOTS) {
    const asset = snapshot?.resolved?.assets?.[id] ?? snapshot?.canvas?.assets?.[id];
    if (!asset) continue;
    if (asset.kind === 'recipe' && asset.recipe?.id === 'team.event.v1') continue;
    const frame = snapshot?.image?.(id);
    if (
      asset.kind !== 'image' ||
      !frame?.image ||
      frame.asset?.id !== asset.id ||
      frame.asset?.revision !== asset.revision ||
      frame.geometry?.frame?.width !== 32 ||
      frame.geometry?.frame?.height !== 32 ||
      frame.geometry?.pivot?.x !== 0.5 ||
      frame.geometry?.pivot?.y !== 0.5
    )
      throw new TypeError(`Team event needs its exact centered 32×32 image: ${id}.`);
    frames.set(id, frame);
  }
  return frames;
}

export function coopEventCaption(receipt) {
  if (receipt?.kind === 'joint-capture')
    return receipt.meaningful
      ? 'Joint Cut! Both lines are safe. Choose your next route together.'
      : 'Lines joined. Both lines are safe. Choose your next route together.';
  if (receipt?.kind === 'team-recovery')
    return 'Both craft are back. One team reserve used. Choose fresh directions together.';
  return '';
}

/** Draw only into a dedicated decorative HUD canvas; no arena coordinates or timers. */
export function drawCoopEventIcon(canvas, frame, receipt, { time, reduced = false } = {}) {
  if (!canvas) return false;
  if (
    !frame?.image ||
    !receipt ||
    !Number.isFinite(time) ||
    !Number.isFinite(receipt.time) ||
    !Number.isFinite(receipt.until) ||
    time < receipt.time ||
    time >= receipt.until
  ) {
    canvas.hidden = true;
    return false;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Team event artwork needs Canvas 2D.');
  if (canvas.width !== 32) canvas.width = 32;
  if (canvas.height !== 32) canvas.height = 32;
  ctx.save();
  try {
    ctx.clearRect(0, 0, 32, 32);
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 1;
    const progress = Math.min(1, (time - receipt.time) / 0.14);
    const size = reduced ? 32 : 26 + Math.round(6 * (1 - (1 - progress) ** 2));
    drawPresentationImage(ctx, frame.image, 16, 16, size, size, frame.geometry);
  } finally {
    ctx.restore();
  }
  canvas.hidden = false;
  return true;
}
