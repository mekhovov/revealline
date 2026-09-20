import { CELL } from '../core/registry.mjs';
import { captureOverlay } from './capture-overlay.mjs';
import { paintMaterialMarker } from './material-markers.mjs';

/** Map-first Studio renderer. Only the engine inspection supplies capture facts.
 * Shapes/patterns duplicate colors so the view does not require color distinction. */
export function paintContentMap(
  ctx,
  preview,
  { width = 1008, showCapture = true, underlay = null } = {},
) {
  const { geometry, manifest } = preview;
  const overlay = captureOverlay(preview);
  const size = width / geometry.width;
  ctx.save();
  ctx.clearRect(0, 0, width, geometry.height * size);
  if (underlay) underlay(ctx, width, geometry.height * size);
  ctx.lineWidth = Math.max(1, size / 10);
  for (let i = 0; i < geometry.cells.length; i++) {
    const x = (i % geometry.width) * size,
      y = Math.floor(i / geometry.width) * size;
    ctx.fillStyle =
      geometry.cells[i] === CELL.SAFE
        ? '#81b5a0'
        : geometry.cells[i] === CELL.WALL
          ? '#74786b'
          : geometry.terrain[i] === 2
            ? '#8c4036'
            : geometry.terrain[i] === 1
              ? '#665333'
              : '#102720';
    ctx.globalAlpha = underlay && geometry.cells[i] === CELL.FIELD ? 0.58 : 1;
    ctx.fillRect(x, y, size - 1, size - 1);
    ctx.globalAlpha = 1;
    if (geometry.cells[i] === CELL.FIELD) paintMaterialMarker(ctx, geometry.terrain[i], x, y, size);
    else if (geometry.cells[i] === CELL.WALL) {
      ctx.strokeStyle = '#ced3bc';
      ctx.strokeRect(x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5);
    }
    if (!showCapture) continue;
    const state = overlay.cells[i];
    if (state === 'retained') {
      ctx.fillStyle = '#9aaea5';
      ctx.fillRect(x + size / 2 - 1, y + size / 2 - 1, 2, 2);
    } else if (state === 'would-fill') {
      ctx.strokeStyle = '#d8ef92';
      ctx.beginPath();
      ctx.moveTo(x + 2, y + size - 3);
      ctx.lineTo(x + size - 3, y + 2);
      ctx.stroke();
    } else if (state === 'trail') {
      ctx.strokeStyle = '#fff0ad';
      ctx.strokeRect(x + 2, y + 2, size - 5, size - 5);
    }
  }
  // Framed glyphs distinguish pickup effects without relying on color. These
  // are placement markers, never a claim that enclosing them collects them.
  const bonusGlyphs = {
    'extra-life': '+',
    'player-speed': '>',
    'enemy-slow': 'v',
    'enemy-freeze': '*',
  };
  for (const bonus of manifest.level.classic?.powerups ?? []) {
    const x = bonus.x * size,
      y = bonus.y * size;
    ctx.fillStyle = '#102720';
    ctx.fillRect(x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2);
    ctx.strokeStyle = '#d8ef92';
    ctx.strokeRect(x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2);
    ctx.fillStyle = '#f5ffba';
    ctx.font = `bold ${Math.max(10, size)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bonusGlyphs[bonus.kind], x, y);
  }
  for (const actor of overlay.actors) {
    const x = actor.x * size,
      y = actor.y * size,
      radius = size * 0.45;
    ctx.fillStyle = '#ffae8e';
    ctx.beginPath();
    if (['bouncer', 'drifter'].includes(actor.type)) ctx.arc(x, y, radius, 0, Math.PI * 2);
    else if (actor.type === 'border-patrol') {
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y);
      ctx.lineTo(x, y + radius);
      ctx.lineTo(x - radius, y);
      ctx.closePath();
    } else {
      ctx.moveTo(x, y - radius);
      ctx.lineTo(x + radius, y + radius);
      ctx.lineTo(x - radius, y + radius);
      ctx.closePath();
    }
    ctx.fill();
    if (showCapture && actor.anchor) {
      ctx.strokeStyle = '#fff0ad';
      ctx.beginPath();
      ctx.arc(x, y, size * 0.7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const objective of overlay.objectives) {
    const x = objective.x * size,
      y = objective.y * size;
    ctx.strokeStyle = '#fff0ad';
    ctx.strokeRect(x - size * 0.4, y - size * 0.4, size * 0.8, size * 0.8);
    if (showCapture && objective.affected) {
      ctx.fillStyle = '#d8ef92';
      ctx.fillRect(x - size * 0.2, y - size * 0.2, size * 0.4, size * 0.4);
    }
  }
  // Author view exposes even hidden markers; it never claims gameplay visibility.
  for (const objective of manifest.level.objectives ?? []) {
    const x = objective.x * size,
      y = objective.y * size;
    ctx.fillStyle = '#102720';
    ctx.fillRect(x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2);
    ctx.strokeStyle = '#fff0ad';
    ctx.strokeRect(x - size * 0.6, y - size * 0.6, size * 1.2, size * 1.2);
    ctx.fillStyle = '#fff0ad';
    ctx.font = `bold ${Math.max(10, size)}px monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(objective.hidden ? '?' : objective.required ? '!' : 'o', x, y);
  }
  ctx.fillStyle = '#f5ffba';
  for (const [seat, { x, y }] of (preview.markers.spawns ?? [manifest.level.spawn]).entries()) {
    ctx.fillRect(x * size - 8, y * size - 2, 16, 4);
    ctx.fillRect(x * size - 2, y * size - 8, 4, 16);
    // The second seat adds a square so the distinction is not color-dependent.
    if (seat > 0) {
      ctx.strokeStyle = '#f5ffba';
      ctx.strokeRect(x * size - 10, y * size - 10, 20, 20);
    }
  }
  ctx.restore();
  return overlay.summary;
}
