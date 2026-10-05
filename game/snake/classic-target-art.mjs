import { drawHuntActor } from '../hunt/actor-art.mjs';

/** Historical Classic API, now backed by the shared humanoid painter. The
 * caller still owns its cosmetic clock; this never reads or advances target AI. */
export function drawClassicTarget(ctx, x, y, size, pose = 0, options = {}) {
  const families = {
    jammer: 'relay-warden',
    lane: 'guard',
    relay: 'relay-warden',
    perimeter: 'patroller',
    contour: 'patroller',
    rover: 'patroller',
    ricochet: 'runner',
    eroder: 'guard',
  };
  drawHuntActor(ctx, x, y, size, pose, {
    ...options,
    ...(options.kind === 'guard' ? { armed: true } : {}),
    ...(families[options.kind] ? { family: families[options.kind] } : {}),
  });
  if (!families[options.kind] && options.kind !== 'guard') return;
  const ink = options.palette ?? { accent: '#ffd64a', safe: '#67aaff', danger: '#ff7169' };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 28, size / 28);
  const warned = options.phase === 'warning';
  const danger = ['locked', 'active'].includes(options.phase);
  ctx.strokeStyle = danger ? ink.danger : warned ? ink.accent : ink.safe;
  ctx.fillStyle = '#071527';
  ctx.lineWidth = 1.5;
  ctx.fillRect(17, 0, 11, 11);
  ctx.strokeRect(17.5, 0.5, 10, 10);
  ctx.beginPath();
  if (options.kind === 'jammer') {
    ctx.moveTo(22, 9);
    ctx.lineTo(22, 2);
    ctx.moveTo(19, 3);
    ctx.lineTo(25, 3);
  } else if (options.kind === 'lane') {
    ctx.moveTo(19, 4);
    ctx.lineTo(26, 4);
    ctx.moveTo(19, 7);
    ctx.lineTo(26, 7);
  } else if (options.kind === 'relay') {
    ctx.moveTo(22, 2);
    ctx.lineTo(26, 5);
    ctx.lineTo(22, 9);
    ctx.lineTo(19, 5);
    ctx.closePath();
    if (options.phase === 'open') {
      ctx.moveTo(19, 5);
      ctx.lineTo(22, 7);
      ctx.lineTo(26, 2);
    }
  } else if (options.kind === 'perimeter') ctx.rect(20, 3, 5, 5);
  else if (options.kind === 'contour') {
    ctx.moveTo(19, 3);
    ctx.lineTo(19, 8);
    ctx.lineTo(25, 8);
  } else if (options.kind === 'rover') ctx.arc(22.5, 5.5, 3, 0, Math.PI * 2);
  else if (options.kind === 'ricochet') {
    ctx.moveTo(20, 3);
    ctx.lineTo(25, 5);
    ctx.lineTo(20, 8);
    ctx.moveTo(19, 5);
    ctx.lineTo(25, 5);
  } else if (options.kind === 'eroder') {
    ctx.moveTo(19, 8);
    ctx.lineTo(21, 3);
    ctx.lineTo(23, 8);
    ctx.lineTo(25, 3);
  } else {
    ctx.arc(22.5, 5.5, 2.5, 0, Math.PI * 2);
    ctx.moveTo(22.5, 1);
    ctx.lineTo(22.5, 10);
    ctx.moveTo(18, 5.5);
    ctx.lineTo(27, 5.5);
  }
  ctx.stroke();
  if (warned || danger) {
    ctx.setLineDash(warned ? [3, 3] : []);
    ctx.strokeRect(1, 1, 26, 26);
  }
  ctx.restore();
}
