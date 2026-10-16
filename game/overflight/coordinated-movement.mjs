import { overflightTerrainOpenPoint, overflightTerrainWaypoint } from './terrain.mjs';
import { admitOverflightMotion } from './tactics.mjs';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ranged = new Set(['brace-trooper', 'armored-carrier', 'tracked-tank']);
const support = new Set(['shield-bearer', 'relay-warden', 'radar-truck']);

/** Cohorts own their snapshot goals, so a crowd does not continuously generate
 * thousands of independent navigation targets. No combat RNG is consumed. */
export function assignOverflightMovement(run, enemy, profile, key, member = 0, count = Infinity) {
  enemy._coordinated = null;
  enemy.movementPreset = null;
  enemy.movementPhase = null;
  enemy._motionVX = undefined;
  enemy._motionVY = undefined;
  enemy._motionTarget = null;
  enemy._motionSeconds = undefined;
  if (run.rulesVersion < 4 || run.fixture || !profile || profile.preset === 'pursuit') return;
  const specialized =
    (profile.preset === 'standoff' && ranged.has(enemy.family)) ||
    (profile.preset === 'screen-support' && support.has(enemy.family)) ||
    (profile.preset === 'convoy' && (!!enemy.objectiveId || enemy.role !== 'common'));
  const cohort = Math.floor(member / 6);
  // Bounded fraction of whole groups, not scattered individually twitchy actors.
  const fraction = profile.coordinatedFraction ?? 0.25;
  if (
    !specialized &&
    (!fraction ||
      (Number.isFinite(count)
        ? member >= Math.floor(count * fraction)
        : (cohort * 0.61803398875) % 1 >= fraction))
  )
    return;
  run._movementGroups ??= new Map();
  const id = `${key}:${cohort}`;
  let group = run._movementGroups.get(id);
  if (!group) {
    const dx = run.player.x - enemy.x,
      dy = run.player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    group = {
      x: run.player.x,
      y: run.player.y,
      xAxis: dx / length,
      yAxis: dy / length,
      vx: run.player.vx || 0,
      vy: run.player.vy || 0,
      side: cohort % 2 ? 1 : -1,
    };
    if (run._movementGroups.size >= 128)
      run._movementGroups.delete(run._movementGroups.keys().next().value);
    run._movementGroups.set(id, group);
  }
  enemy.movementPreset = profile.preset;
  enemy._coordinated = {
    profile,
    group,
    member,
    leg: 0,
    until: 0,
    target: null,
    pending: null,
    nextDecision: 0,
    phase: 'approaching',
    finished: false,
  };
}

function openTarget(run, enemy, point) {
  const arena = run.compiled.arena;
  const target = {
    x: clamp(point.x, enemy.radius + 4, arena.width - enemy.radius - 4),
    y: clamp(point.y, enemy.radius + 4, arena.height - enemy.radius - 4),
  };
  return run.terrain
    ? overflightTerrainOpenPoint(run.terrain, target.x, target.y, enemy.radius + 2, arena)
    : target;
}

function nextTarget(run, enemy, state, fallback) {
  const { group: g, profile: p, leg, member } = state;
  const width = p.formationWidth ?? 180;
  const side = p.preset === 'split-front' ? (member % 2 ? 1 : -1) : g.side;
  const lateral = width * side * 0.5;
  const offset = (center, forward, sideways) => ({
    x: center.x + g.xAxis * forward - g.yAxis * sideways,
    y: center.y + g.yAxis * forward + g.xAxis * sideways,
  });
  // Authored world anchors may be several screens away. A formation uses
  // only local approaches; it must not desert combat to chase an unrelated court.
  const anchors = (p.anchors ?? []).filter(
    (point) => Math.hypot(point.x - g.x, point.y - g.y) <= 420,
  );
  if (p.preset === 'convoy')
    return (
      fallback ??
      anchors[leg % (anchors.length || 1)] ??
      offset(g, 0, ((leg % 2 ? -1 : 1) * width) / 2)
    );
  if (p.preset === 'standoff') {
    if (!ranged.has(enemy.family)) return null;
    const toward = Math.atan2(enemy.y - run.player.y, enemy.x - run.player.x) + side * 0.65;
    const firingAnchors = anchors.filter((point) => {
      const distance = Math.hypot(point.x - run.player.x, point.y - run.player.y);
      return distance >= 180 && distance <= 260;
    });
    return firingAnchors.length
      ? firingAnchors[leg % firingAnchors.length]
      : {
          x: run.player.x + Math.cos(toward) * 220,
          y: run.player.y + Math.sin(toward) * 220,
        };
  }
  if (p.preset === 'screen-support') {
    if (anchors.length) return anchors[(member + leg) % anchors.length];
    return offset(g, support.has(enemy.family) ? -170 : -65, lateral);
  }
  if (p.preset === 'crosscut') {
    const lead = Math.min(0.6, 90 / (Math.hypot(g.vx, g.vy) || 1));
    return {
      x: g.x + g.vx * lead + g.xAxis * 90,
      y: g.y + g.vy * lead + g.yAxis * 90,
    };
  }
  if (leg === 0)
    return anchors.length
      ? anchors[(side < 0 ? 0 : 1) % anchors.length]
      : offset(g, p.preset === 'committed-flank' ? -75 : -130, lateral);
  if (leg === 1) return offset(g, 65, p.preset === 'split-front' ? lateral * 0.55 : -lateral * 0.3);
  return null;
}

/** Returns a committed world target/hold, or null to retain ordinary behavior.
 * Called at 10 Hz for ordinary actors. Waypoint changes are fresh commitments
 * and pass the same live-warning check as a new approach leg. */
export function overflightMovementTarget(run, enemy, fallback = null, speed = enemy.speed) {
  const state = enemy._coordinated;
  if (!state || state.finished) return null;
  const now = run.time;
  const p = state.profile;
  // Committed combat stops run at 60 Hz, even while ordinary route decisions
  // wait for their next 10 Hz update. The firing origin must match its warning.
  if (
    enemy.attackWarning > 0 ||
    enemy.exposureRemaining > 0 ||
    (enemy.huntRulesVersion &&
      ['windup', 'burst', 'recovery'].includes(enemy.behaviorPhase) &&
      ['vehicle', 'brace'].includes(enemy.behavior))
  ) {
    enemy.movementPhase = 'holding';
    state.output = { hold: true };
    return state.output;
  }
  // Burst, support and slow transitions can change a committed leg between
  // ordinary steering decisions. Admit the velocity the simulation will use,
  // without allowing that transition to close an existing warned escape.
  if (state.output?.target && state.admittedSpeed !== speed) {
    if (
      (state.speedRetryAt ?? 0) > now ||
      !admitOverflightMotion(run, enemy, {
        x: state.output.x * speed,
        y: state.output.y * speed,
        target: state.output.target,
        seconds: Math.max(0, state.until - now),
      })
    ) {
      if ((state.speedRetryAt ?? 0) <= now) state.speedRetryAt = now + 0.1;
      enemy.movementPhase = 'holding';
      return { hold: true };
    }
    state.admittedSpeed = speed;
    state.speedRetryAt = 0;
    enemy.movementPhase = state.phase;
  }
  if (state.nextDecision > now) return state.output;
  state.nextDecision = now + 0.1;
  if (p.preset === 'convoy' && enemy.huntRulesVersion && fallback) {
    state.target = fallback;
    state.until = now + (p.commitmentSeconds ?? 3);
  }
  if (state.phase === 'preparing') {
    enemy.movementRemaining = Math.max(0, state.until - now);
    if (now < state.until) return state.output;
    state.phase = 'committed';
    state.target = null;
  } else if (state.phase === 'recovering') {
    enemy.movementRemaining = Math.max(0, state.until - now);
    if (now < state.until) return state.output;
    if (['standoff', 'screen-support', 'convoy'].includes(p.preset)) state.phase = 'approaching';
    else {
      state.finished = true;
      enemy.movementPhase = null;
      return null;
    }
  }
  if (
    state.target &&
    !(p.preset === 'convoy' && enemy.huntRulesVersion) &&
    (Math.hypot(state.target.x - enemy.x, state.target.y - enemy.y) < 12 || now >= state.until)
  ) {
    state.target = null;
    state.leg++;
    if (['crosscut', 'standoff', 'screen-support', 'convoy'].includes(p.preset)) {
      state.phase = 'recovering';
      state.until = now + (p.preset === 'crosscut' ? 0.8 : 2);
      state.output = { hold: true };
      enemy.movementPhase = state.phase;
      return state.output;
    }
  }
  if (!state.target) {
    const raw = state.pending ?? nextTarget(run, enemy, state, fallback);
    if (!raw) {
      state.finished = true;
      enemy.movementPhase = null;
      return null;
    }
    const target = openTarget(run, enemy, raw);
    if (p.preset === 'crosscut' && state.phase === 'approaching') {
      if (!admitOverflightMotion(run, enemy, { x: 0, y: 0 })) return null;
      state.pending = target;
      state.phase = 'preparing';
      state.until = now + run.compiled.combat.attacks.warningSeconds;
      state.output = { hold: true };
      enemy.movementFacing = Math.atan2(target.y - enemy.y, target.x - enemy.x);
      enemy.movementPhase = 'preparing';
      enemy.movementRemaining = state.until - now;
      return state.output;
    }
    state.target = target;
    state.pending = null;
    state.until = now + (p.commitmentSeconds ?? 3);
  }
  let target = state.target;
  if (run.terrain)
    target = overflightTerrainWaypoint(run.terrain, enemy, target, run.compiled.arena);
  const distance = Math.hypot(target.x - enemy.x, target.y - enemy.y) || 1;
  const x = (target.x - enemy.x) / distance,
    y = (target.y - enemy.y) / distance;
  if (
    !state.output?.target ||
    Math.hypot(state.output.target.x - target.x, state.output.target.y - target.y) > 1
  ) {
    if (
      !admitOverflightMotion(run, enemy, {
        x: x * speed,
        y: y * speed,
        target,
        seconds: Math.max(0, state.until - now),
      })
    ) {
      state.target = null;
      state.pending = target;
      state.output = { hold: true };
      enemy.movementPhase = 'holding';
      return state.output;
    }
  }
  state.output = { target, x, y };
  state.admittedSpeed = speed;
  enemy.movementPhase = state.phase;
  enemy.movementFacing = Math.atan2(y, x);
  enemy.movementRemaining = Math.max(0, state.until - now);
  return state.output;
}

/** Returning from a completed authored approach is also a commitment. */
export function protectOverflightMovementExit(run, enemy, x, y, speed) {
  const state = enemy._coordinated;
  if (!state?.finished || state.exitAdmitted) return { x, y };
  if ((state.exitRetry ?? 0) > run.time) return { x: 0, y: 0 };
  state.exitRetry = run.time + 0.1;
  if (admitOverflightMotion(run, enemy, { x: x * speed, y: y * speed })) {
    state.exitAdmitted = true;
    return { x, y };
  }
  return { x: 0, y: 0 };
}
