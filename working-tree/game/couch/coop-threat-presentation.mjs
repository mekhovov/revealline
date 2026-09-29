import { TEAM_THREAT_SLOTS, teamThreatSlotSpecs } from '../presentation/team-threat-slots.mjs';
import { drawPresentationImage } from '../ui/presentation-draw-image.mjs';
const specs = new Map(teamThreatSlotSpecs().map((spec) => [spec.id, spec]));
/** Borrow exact decoded frames; prepare the whole declaration before adoption. */
export function prepareCoopThreats(snapshot) {
  const frames = new Map();
  for (const { id } of TEAM_THREAT_SLOTS) {
    const asset = snapshot?.resolved?.assets?.[id] ?? snapshot?.canvas?.assets?.[id];
    if (!asset) continue;
    if (asset.kind === 'recipe' && asset.recipe?.id === 'team.threat.v1') continue;
    const frame = snapshot?.image?.(id),
      size = specs.get(id).dimensions.width;
    if (
      asset.kind !== 'image' ||
      !frame?.image ||
      frame.asset?.id !== asset.id ||
      frame.asset?.revision !== asset.revision ||
      frame.geometry?.frame?.width !== size ||
      frame.geometry?.frame?.height !== size ||
      frame.geometry?.pivot?.x !== 0.5 ||
      frame.geometry?.pivot?.y !== 0.5
    )
      throw new TypeError(`Team threat needs its exact centered ${size}×${size} image: ${id}.`);
    frames.set(id, frame);
  }
  return frames;
}
/** No timer, extrapolation, simulation writes or inferred projectile behavior. */
export function coopThreatMarkers(run) {
  if (run.status === 'won') return [];
  const markers = [];
  for (const hold of run.strongholds || []) {
    if (hold.defeated) continue;
    if (hold.shielded) markers.push({ slot: 'team.threat.shield', x: hold.core.x, y: hold.core.y });
    const emitter = hold.emitter;
    if (
      emitter?.phase === 'warning' &&
      Number.isInteger(emitter.cellIndex) &&
      emitter.cellIndex >= 0 &&
      emitter.cellIndex < run.width * run.height
    )
      markers.push({
        slot: 'team.threat.emitter-warning',
        x: (emitter.cellIndex % run.width) + 0.5,
        y: Math.floor(emitter.cellIndex / run.width) + 0.5,
      });
  }
  for (const impact of run.impacts || []) {
    const cell = impact.cellIndex;
    if (!Number.isInteger(cell) || cell < 0 || cell >= run.width * run.height) continue;
    const player = run.players?.find((row) => row.id === impact.player),
      owner = run.strongholds?.find((row) => row.id === impact.owner);
    if (
      !player ||
      player.status !== 'active' ||
      !player.cutting ||
      !owner ||
      owner.defeated ||
      run.cells[cell] !== 0 ||
      !player.trail.some((row) => row.index === cell)
    )
      continue;
    // Historical cell-only data may omit both positions. A half-valid position
    // cannot become a fabricated location by mixing live and fallback axes.
    const cellOnly = impact.x === undefined && impact.y === undefined;
    const x = cellOnly ? (cell % run.width) + 0.5 : impact.x,
      y = cellOnly ? Math.floor(cell / run.width) + 0.5 : impact.y;
    if (
      Number.isFinite(x) &&
      Number.isFinite(y) &&
      x >= 0 &&
      x <= run.width &&
      y >= 0 &&
      y <= run.height
    )
      markers.push({ slot: 'team.threat.spark', x, y });
  }
  return markers;
}
/** Fixed-position layers below functional cues. Edges clip, never shift. */
export function drawCoopThreats(ctx, frames, run, cssCell = 16, layer = 'all') {
  if (!frames?.size) return [];
  const rectangles = [];
  ctx.save();
  try {
    ctx.beginPath();
    ctx.rect(0, 0, run.width, run.height);
    ctx.clip();
    ctx.imageSmoothingEnabled = false;
    for (const marker of coopThreatMarkers(run)) {
      const isShield = marker.slot === 'team.threat.shield';
      if ((layer === 'shield' && !isShield) || (layer === 'foreground' && isShield)) continue;
      const frame = frames?.get(marker.slot);
      if (!frame) continue;
      const shield = marker.slot === 'team.threat.shield';
      const spark = marker.slot === 'team.threat.spark';
      const size = Math.max(
        shield ? 3.5 : spark ? 1.2 : 1.4,
        (shield ? 28 : spark ? 8 : 16) / cssCell,
      );
      drawPresentationImage(ctx, frame.image, marker.x, marker.y, size, size, frame.geometry);
      const left = Math.max(0, (marker.x - size / 2) * cssCell),
        right = Math.min(run.width * cssCell, (marker.x + size / 2) * cssCell),
        top = Math.max(0, (marker.y - size / 2) * cssCell),
        bottom = Math.min(run.height * cssCell, (marker.y + size / 2) * cssCell);
      if (right > left && bottom > top)
        rectangles.push({
          left,
          right,
          top,
          bottom,
          x: (left + right) / 2,
          y: (top + bottom) / 2,
          width: right - left,
          height: bottom - top,
        });
    }
  } finally {
    ctx.restore();
  }
  return rectangles;
}
