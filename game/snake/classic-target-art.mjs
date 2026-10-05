import { drawHuntActor } from '../hunt/actor-art.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';

const HEADINGS = new Set(['up', 'right', 'down', 'left']);
const MACHINE_FAMILIES = Object.freeze({
  jammer: 'radar-truck',
  lane: 'tracked-tank',
  relay: 'radar-truck',
  perimeter: 'utility-car',
  contour: 'scout-car',
  rover: 'armored-carrier',
  ricochet: 'utility-car',
  eroder: 'cargo-truck',
  guard: 'tracked-tank',
});
const ANGLES = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };

/** Historical v1 targets have positions but no saved heading. Observe only the
 * last rendered position of each of the two admitted targets, outside the run.
 * Accepted successor headings always win, including protected specialist fronts.
 * An unseen/ambiguous move retains the last heading rather than guessing inputs. */
export function createClassicTargetFacing() {
  let owner,
    identity,
    tick = -1,
    previous = new Map();
  return (run, attemptKey = run) => {
    const { width, height, wrap } = run.level;
    const nextIdentity = JSON.stringify([
      run.version,
      run.levelIdentity,
      run.seed,
      run.mode,
      width,
      height,
      wrap,
    ]);
    if (owner !== attemptKey || identity !== nextIdentity || run.tick < tick) previous.clear();
    const next = new Map(),
      result = new Map();
    for (const target of (run.targets ?? (run.target ? [run.target] : [])).slice(0, 2)) {
      const old = previous.get(target.id);
      let heading = HEADINGS.has(target.heading) ? target.heading : (old?.heading ?? 'up');
      if (!HEADINGS.has(target.heading) && old && run.tick > tick) {
        let dx = target.x - old.x,
          dy = target.y - old.y;
        if (wrap) {
          // Native v1 prey moves one grid cell at a time, including wrap seams.
          if (Math.abs(dx) === width - 1) dx = -Math.sign(dx);
          if (Math.abs(dy) === height - 1) dy = -Math.sign(dy);
        }
        if (dy === 0 && dx !== 0) heading = dx > 0 ? 'right' : 'left';
        else if (dx === 0 && dy !== 0) heading = dy > 0 ? 'down' : 'up';
      }
      next.set(target.id, { x: target.x, y: target.y, heading });
      result.set(target.id, heading);
    }
    previous = next;
    owner = attemptKey;
    identity = nextIdentity;
    tick = run.tick;
    return result;
  };
}

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
  const machinery = options.boardStyle === 'living-circuit' && MACHINE_FAMILIES[options.kind];
  if (machinery)
    drawMachinerySpecimen(ctx, machinery, {
      x: x + size / 2,
      y: y + size / 2,
      size,
      heading: ANGLES[options.heading] ?? 0,
      frame: {
        travelPhase: pose / 8,
        phase: pose / 3,
        reduced: options.frozen || options.reducedEffects,
      },
    });
  else
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
