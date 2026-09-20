import { PRESENTATION_INK, PRESENTATION_PLATE } from './actor-presentation.mjs';

/** Functional lane cue only. No input, clocks or authoritative state are changed. */
export function drawLaneAttack(
  ctx,
  enemy,
  palette,
  { frozen = false, screenScale = 1, boardWidth = 1152, boardHeight = 576 } = {},
) {
  if (enemy.type !== 'lane-boss' || !['warning', 'active'].includes(enemy.bossPhase)) return false;
  const scale = Math.max(0.2, Math.min(1, screenScale));
  const horizontal = enemy.axis === 'horizontal';
  const center = (enemy.lane ?? (horizontal ? enemy.y : enemy.x)) * 16;
  const breadth = (enemy.laneWidth ?? 1.2) * 16;
  const box = horizontal
    ? [16, center - breadth / 2, boardWidth - 32, breadth]
    : [center - breadth / 2, 16, breadth, boardHeight - 32];
  ctx.save();
  ctx.fillStyle = frozen ? palette.muted : palette.danger;
  ctx.globalAlpha = frozen ? 0.12 : enemy.bossPhase === 'active' ? 0.35 : 0.1;
  ctx.fillRect(...box);
  // Static dashed warning / solid active edges survive muted audio, reduced
  // effects and monochrome. Two inks keep either theme background legible.
  ctx.globalAlpha = 1;
  ctx.setLineDash(enemy.bossPhase === 'warning' ? [6 / scale, 4 / scale] : []);
  for (const [ink, width] of [
    [PRESENTATION_PLATE, 3 / scale],
    [PRESENTATION_INK, 1 / scale],
  ]) {
    ctx.strokeStyle = ink;
    ctx.lineWidth = width;
    ctx.strokeRect(...box);
  }
  ctx.restore();
  return true;
}
