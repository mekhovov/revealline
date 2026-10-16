import { drawHuntActor } from '../hunt/actor-art.mjs';
import { drawMachinerySpecimen } from '../presentation/industrial-machinery.mjs';
import { classicTargetIdentity } from './classic-target-identity.mjs';

const HEADINGS = new Set(['up', 'right', 'down', 'left']);
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

/** Pose comes from accepted phase only. The clock changes gait, never tells
 * the player a resting enemy is about to attack or predicts a future decision. */
export function classicTargetPose(options = {}, fallback = 0) {
  const phase = options.phase ?? options.tactical?.phase;
  const warning = ['warning', 'turning', 'windup', 'prepare', 'primed'].includes(phase);
  const mobileRecovery =
    ['jammer', 'guard'].includes(options.kind) &&
    phase === 'rest' &&
    options.tactical &&
    !options.tactical.stationary;
  const blocked = phase === 'blocked' || options.state === 'blocked';
  const recovering =
    !mobileRecovery &&
    ['rest', 'recovery', 'recovering', 'waiting', 'dormant', 'open'].includes(phase);
  const active = ['active', 'locked', 'burst', 'dash', 'jamming'].includes(phase);
  const stationaryAction = active && ['jammer', 'lane', 'guard', 'relay'].includes(options.kind);
  const idle = options.kind === 'still' || phase === 'dormant' || phase === 'waiting';
  const staticPose =
    options.frozen ||
    options.reducedEffects ||
    options.paused ||
    recovering ||
    warning ||
    blocked ||
    idle ||
    stationaryAction;
  const clip = warning
    ? 'anticipation'
    : blocked
      ? 'blocked'
      : idle || stationaryAction
        ? 'idle'
        : recovering
          ? 'recovery'
          : 'move';
  return {
    warning,
    recovering,
    active,
    blocked,
    clip,
    animationState: warning
      ? 'notice'
      : blocked
        ? 'blocked'
        : recovering
          ? 'recover'
          : idle || stationaryAction
            ? 'idle'
            : options.state,
    stride: staticPose
      ? 0
      : Number.isFinite(options.timeMs)
        ? Math.floor(options.timeMs / (active ? 70 : 115)) % 6
        : fallback,
    stance: warning
      ? 'prepare'
      : blocked
        ? 'blocked'
        : active
          ? 'action'
          : recovering || idle
            ? 'recover'
            : 'travel',
  };
}

/** Equipment is large enough to identify without the optional corner badge.
 * Native parts stay in the cell, rotate with the accepted heading and never
 * cast detached effects which could reveal a concealed enemy. */
function drawSpecialistEquipment(ctx, x, y, size, options, state) {
  const kinds = [
    'jammer',
    'lane',
    'relay',
    'perimeter',
    'contour',
    'rover',
    'ricochet',
    'eroder',
    'guard',
  ];
  if (!kinds.includes(options.kind)) return;
  const toy = options.boardStyle === 'toybox',
    night = options.boardStyle === 'night-arcade';
  const ink = state.active ? '#ee967c' : state.warning ? '#ffe39a' : '#c9dec8';
  const body = toy ? '#c79562' : night ? '#627f91' : '#97aba1';
  const r = (color, a, b, w, h) => {
    ctx.fillStyle = color;
    ctx.fillRect(a, b, w, h);
  };
  ctx.save();
  ctx.translate(x + size / 2, y + size / 2);
  ctx.scale(size / 28, size / 28);
  ctx.rotate(ANGLES[options.heading] ?? 0);
  if (options.kind === 'jammer' || options.kind === 'relay') {
    // Antenna retracts at rest; preparation deploys the full fixed silhouette.
    const mastWidth = state.recovering ? 10 : 16;
    r('#142a30', -mastWidth / 2 - 1, -11, mastWidth + 2, 5);
    r(ink, -mastWidth / 2, -10, mastWidth, 2);
    r(body, -1, -10, 2, 17);
    r(ink, state.recovering ? -4 : -6, state.recovering ? -10 : -12, 2, state.recovering ? 3 : 6);
    r(ink, state.recovering ? 2 : 4, state.recovering ? -10 : -12, 2, state.recovering ? 3 : 6);
    r('#233b42', -6, 4, 12, 7);
    r(body, -4, 5, 8, 5);
    r(state.warning || state.active ? ink : '#597f75', -2, 6, 4, 2);
    if (options.kind === 'relay') {
      r(ink, -9, -3, 2, 12);
      r(ink, 7, -3, 2, 12);
    }
  } else if (options.kind === 'lane' || options.kind === 'guard') {
    const muzzle = state.recovering ? -7 : state.active ? -10 : -12;
    r('#142a30', -4, muzzle, 8, 12);
    r(body, -3, muzzle, 6, 10);
    r(ink, -2, muzzle + 1, 4, 2);
    r('#142a30', -1, muzzle + 3, 2, 6);
    if (state.warning) {
      r(ink, -10, -7, 3, 2);
      r(ink, 7, -7, 3, 2);
    }
  } else if (options.kind === 'eroder') {
    const blade = state.recovering ? -7 : -11;
    r('#263938', -10, blade, 20, 6);
    r(body, -9, blade, 18, 3);
    for (const a of [-8, -3, 2, 7]) r(ink, a, blade - 1, 2, 5);
  } else if (options.kind === 'rover') {
    r('#253e3a', -8, 2, 16, 8);
    r(body, -7, 3, 14, 5);
    r(ink, -5, -10, 3, 2);
    r(ink, 2, -10, 3, 2);
  } else if (options.kind === 'ricochet') {
    r(ink, -7, -8, 4, 2);
    r(ink, 3, -8, 4, 2);
    r(body, -10, 3, 4, 7);
    r(body, 6, 3, 4, 7);
  } else {
    r(body, -8, 3, 16, 6);
    r('#253b3c', -6, 4, 12, 3);
    r(ink, options.kind === 'contour' ? -8 : 5, -9, 3, 5);
  }
  ctx.restore();
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
  const state = classicTargetPose(options, pose);
  pose = state.stride;
  const identity = classicTargetIdentity(options.kind, options.boardStyle);
  const machinery = identity.machine && identity.family;
  if (machinery)
    drawMachinerySpecimen(ctx, machinery, {
      x: x + size / 2,
      y: y + size / 2,
      size,
      heading: ANGLES[options.heading] ?? 0,
      frame: {
        travelPhase: pose / 8,
        phase: pose / 3,
        reduced: options.frozen || options.reducedEffects || options.paused,
      },
    });
  else
    drawHuntActor(ctx, x, y, size, pose, {
      ...options,
      detail: (options.cssUnit ?? size) < 18 ? 'compact' : options.detail,
      animationClip: options.animationClip ?? state.clip,
      state: state.animationState,
      ...(options.kind === 'guard' ? { armed: true } : {}),
      ...(families[options.kind] ? { family: families[options.kind] } : {}),
    });
  drawSpecialistEquipment(ctx, x, y, size, options, state);
  if (!families[options.kind] && options.kind !== 'guard') return;
  const ink = options.palette ?? { accent: '#ffd64a', safe: '#67aaff', danger: '#ff7169' };
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 28, size / 28);
  const warned = state.warning;
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
