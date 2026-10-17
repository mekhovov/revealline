/** Explicit review-demo pilot only. Never enabled by an ordinary game start. */
import { rerollOverflightUpgrades } from './core.mjs';
import { overflightAttackContains } from './tactics.mjs';
import { overflightPayload } from './upgrades.mjs';
import { overflightEnemyVelocity } from './motion.mjs';
import {
  overflightTerrainClear,
  overflightTerrainOpenPoint,
  overflightTerrainWaypoint,
} from './terrain.mjs';

export const QUALIFICATION_BUILDS = Object.freeze({
  fan: ['primary:wide', 'proximity-pulse', 'side-burst', 'scanner'],
  echo: ['primary:double', 'slow-field', 'proximity-pulse', 'shield'],
  systems: ['proximity-pulse', 'side-burst', 'scanner', 'primary:double'],
});
/** Explicit headless policies: never silently fill a no-pulse slot with pulse. */
export const NO_PULSE_QUALIFICATION_BUILDS = Object.freeze({
  'fan-scanner': ['primary:wide', 'slow-field', 'side-burst', 'scanner'],
  'fan-shield': ['primary:wide', 'slow-field', 'side-burst', 'shield'],
  'echo-scanner': ['primary:double', 'slow-field', 'side-burst', 'scanner'],
  'echo-shield': ['primary:double', 'slow-field', 'side-burst', 'shield'],
});
export function selectCard(run, direction = 'fan') {
  const preferences = QUALIFICATION_BUILDS[direction] ?? NO_PULSE_QUALIFICATION_BUILDS[direction];
  if (!preferences) throw new RangeError('Unknown Overflight review build.');
  const strict = Object.hasOwn(NO_PULSE_QUALIFICATION_BUILDS, direction);
  const score = (card) => {
    const index = preferences.findIndex((prefix) => card.id.startsWith(prefix));
    return index < 0
      ? card.system === 'repair'
        ? 30
        : 50
      : index * 5 + (card.kind === 'evolution' ? -1 : 0);
  };
  const sortedOffers = () =>
    run.offers
      .filter(
        (card) =>
          !strict ||
          card.kind === 'utility' ||
          preferences.some((prefix) => card.id.startsWith(prefix)),
      )
      .sort((a, b) => score(a) - score(b));
  let sorted = sortedOffers();
  if (strict) {
    while ((!sorted.length || score(sorted[0]) >= 30) && run.progression.rerolls > 0) {
      rerollOverflightUpgrades(run);
      sorted = sortedOffers();
    }
    return sorted[0] ?? null;
  }
  if (score(sorted[0]) >= 30 && run.progression.rerolls > 0) {
    rerollOverflightUpgrades(run);
    sorted = sortedOffers();
  }
  return sorted[0];
}

export const OVERFLIGHT_AUDIT_ROUTES = Object.freeze([
  'park-after-pulse2',
  'tiny-circle-after-pulse2',
  'wall-after-pulse2',
  'edge-loop-after-pulse2',
]);

/** Deliberately simple exploit probes, never selected by normal/native play. */
export function createOverflightAuditPilot(route) {
  if (!OVERFLIGHT_AUDIT_ROUTES.includes(route)) throw new RangeError('Unknown audit route.');
  const state = {
    startedAt: null,
    hullAtStart: null,
    damageAtStart: null,
    airframesAtStart: null,
    origin: null,
    edgeDirection: 1,
  };
  return {
    state,
    input(run) {
      if (state.startedAt === null) {
        if (!run.build.combat.some((module) => module.id === 'proximity-pulse' && module.rank >= 2))
          return pilot(run);
        state.startedAt = run.time;
        state.hullAtStart = run.player.hull;
        state.damageAtStart = run.stats.damageTaken;
        state.airframesAtStart = run.airframesRemaining;
        state.origin = { x: run.player.x, y: run.player.y };
      }
      if (route === 'park-after-pulse2') return { x: 0, y: 0, boost: false };
      if (route === 'wall-after-pulse2') return { x: -1, y: 0, boost: false };
      if (route === 'tiny-circle-after-pulse2') {
        const angle = (run.time - state.startedAt) * 9;
        return { x: Math.cos(angle), y: Math.sin(angle), boost: false };
      }
      if (run.player.y >= run.compiled.arena.height - 80) state.edgeDirection = -1;
      if (run.player.y <= 80) state.edgeDirection = 1;
      return {
        x: Math.max(-1, Math.min(1, (80 - run.player.x) / 40)),
        y: state.edgeDirection,
        boost: false,
      };
    },
  };
}

/** A deterministic, imperfect pilot, recomputed at 10Hz; it sees ordinary game state.
 * It pursues salvage, skirts the boss, and compares short movement candidates to
 * avoid nearby bodies/visible committed attack geometry. It cannot alter the simulation. */
export function pilot(run, route = 'tight') {
  if (run.rulesVersion >= 3) return directionalPilot(run, route);
  const player = run.player;
  const arena = run.compiled.arena;
  const phase = run.time * (route === 'tight' ? 0.55 : 0.32);
  let goalX = arena.width / 2 + Math.cos(phase) * (route === 'tight' ? 120 : 280);
  let goalY = arena.height / 2 + Math.sin(phase * (route === 'figure-eight' ? 2 : 1)) * 140;
  let bestPickup = Infinity;
  for (const pickup of run.pickups) {
    if (!pickup.active) continue;
    const distance = Math.hypot(pickup.x - player.x, pickup.y - player.y);
    const score = distance / Math.min(3, Math.sqrt(pickup.value));
    if (distance > 55 && score < bestPickup && distance < 500) {
      bestPickup = score;
      goalX = pickup.x;
      goalY = pickup.y;
    }
  }
  const final = run.enemies.find((enemy) => enemy.active && enemy.role === 'final');
  if (final) {
    const angle = Math.atan2(player.y - final.y, player.x - final.x) + 0.6;
    goalX = final.x + Math.cos(angle) * 80;
    goalY = final.y + Math.sin(angle) * 80;
  }
  const enemies = run.enemies.filter(
    (enemy) =>
      enemy.active &&
      enemy.warning <= 0 &&
      Math.abs(enemy.x - player.x) < 190 &&
      Math.abs(enemy.y - player.y) < 190,
  );
  let best = -Infinity,
    input = { x: 0, y: 0, boost: false };
  const before = Math.hypot(goalX - player.x, goalY - player.y);
  for (const magnitude of [0.35, 0.6, 1]) {
    for (let index = 0; index < 20; index++) {
      const angle = (index * Math.PI) / 10;
      const vx = Math.cos(angle) * magnitude * 180,
        vy = Math.sin(angle) * magnitude * 180;
      const x = player.x + vx * 0.42,
        y = player.y + vy * 0.42;
      if (x < 40 || y < 40 || x > arena.width - 40 || y > arena.height - 40) continue;
      let score = (before - Math.hypot(goalX - x, goalY - y)) * 0.8;
      for (const enemy of enemies) {
        const dx = player.x - enemy.x,
          dy = player.y - enemy.y;
        const length = Math.hypot(dx, dy) || 1;
        const predictedX = enemy.x + (dx / length) * enemy.speed * 0.3;
        const predictedY = enemy.y + (dy / length) * enemy.speed * 0.3;
        const distance = Math.min(
          Math.hypot(predictedX - x, predictedY - y),
          Math.hypot(enemy.x - (player.x + x) / 2, enemy.y - (player.y + y) / 2),
        );
        const safety = enemy.radius + player.radius + 18;
        if (distance < safety) score -= 100 + (safety - distance) * 15;
        else if (distance < safety + 35) score -= (safety + 35 - distance) * 0.15;
      }
      for (const attack of run.priorityAttacks) {
        if (attack.active && overflightAttackContains(attack, x, y, player.radius + 9))
          score -= 500;
      }
      // Small direction continuity penalty prevents purely numerical jitter.
      score -= Math.abs(vx - player.vx) * 0.005 + Math.abs(vy - player.vy) * 0.005;
      if (score > best) {
        best = score;
        input = { x: vx / 180, y: vy / 180, boost: false };
      }
    }
  }
  if (best < -100 && player.boostCooldown === 0) input.boost = true;
  return input;
}

/** V3 review route: ordinary steering, deliberate boosts and visible warnings.
 * Relative sweeps account for committed flank/burst paths instead of assuming
 * every body pursues the pilot. This is still a local, imperfect flight policy.
 */
function directionalPilot(run, route) {
  const p = run.player,
    arena = run.compiled.arena;
  const horizon = 0.5;
  const phase = run.time * (route === 'tight' ? 0.4 : 0.25);
  let goalX = arena.width / 2 + Math.cos(phase) * 240;
  let goalY = arena.height / 2 + Math.sin(phase * (route === 'figure-eight' ? 2 : 1)) * 210;
  let bestPickup = Infinity;
  for (const pickup of run.pickups) {
    if (!pickup.active) continue;
    const distance = Math.hypot(pickup.x - p.x, pickup.y - p.y);
    const value = distance / Math.min(3, Math.sqrt(pickup.value));
    if (distance > 45 && distance < 550 && value < bestPickup) {
      bestPickup = value;
      goalX = pickup.x;
      goalY = pickup.y;
    }
  }
  const final = run.enemies.find((enemy) => enemy.active && enemy.role === 'final');
  const payload = overflightPayload(run.build, 3);
  if (final) {
    const angle = Math.atan2(p.y - final.y, p.x - final.x) + 0.7;
    const radius = run.build.primary.branch === 'double' ? 120 : 85;
    goalX = final.x + Math.cos(angle) * radius;
    goalY = final.y + Math.sin(angle) * radius;
  }
  if (route === 'lure-and-return') {
    const goal = lureGoal(run, final);
    goalX = goal.x;
    goalY = goal.y;
  }
  if (run.terrain) {
    const goal = overflightTerrainOpenPoint(run.terrain, goalX, goalY, p.radius, arena);
    const waypoint = overflightTerrainWaypoint(run.terrain, p, goal, arena);
    goalX = waypoint.x;
    goalY = waypoint.y;
  }
  const enemies = run.enemies
    .filter(
      (enemy) =>
        enemy.active &&
        enemy.warning < horizon &&
        Math.abs(enemy.x - p.x) < 260 &&
        Math.abs(enemy.y - p.y) < 260,
    )
    .map((enemy) => {
      if (run.rulesVersion >= 4) {
        const velocity = overflightEnemyVelocity(enemy);
        return { enemy, vx: velocity.x, vy: velocity.y };
      }
      const burst = enemy.behaviorPhase === 'burst';
      const speed =
        enemy.speed *
        (burst ? Math.min(2, 144 / enemy.speed) : enemy.behaviorPhase === 'windup' ? 0.5 : 1) *
        (enemy.slowUntil > run.tick ? enemy.slowMultiplier : 1);
      return {
        enemy,
        vx: (burst ? enemy._burstX : enemy.steeringX) * speed,
        vy: (burst ? enemy._burstY : enemy.steeringY) * speed,
      };
    });
  let best = -Infinity,
    chosen = { x: 0, y: 0, boost: false };
  const before = Math.hypot(goalX - p.x, goalY - p.y);
  const boostOptions = p.boostCooldown === 0 && !run._boostHeld ? [false, true] : [false];
  for (const boost of boostOptions)
    for (const magnitude of [0.65, 1])
      for (let index = 0; index < 24; index++) {
        const angle = (index * Math.PI) / 12,
          ux = Math.cos(angle),
          uy = Math.sin(angle);
        const boostSeconds = boost ? 0.3 : Math.min(horizon, p.boostRemaining);
        const distanceAt = (seconds) =>
          magnitude *
          (run.flight.boostSpeed * Math.min(boostSeconds, seconds) +
            run.flight.speed * Math.max(0, seconds - boostSeconds));
        const distance = distanceAt(horizon),
          x = p.x + ux * distance,
          y = p.y + uy * distance;
        if (x < 28 || y < 28 || x > arena.width - 28 || y > arena.height - 28) continue;
        if (!overflightTerrainClear(run.terrain, p.x, p.y, x, y, p.radius)) continue;
        let score = (before - Math.hypot(goalX - x, goalY - y)) * 0.8 - (boost ? 24 : 0);
        for (const { enemy, vx, vy } of enemies) {
          // Two segments represent the boost ending before the prediction horizon.
          const split = boostSeconds > 0 && boostSeconds < horizon ? boostSeconds : horizon / 2;
          let from = 0;
          for (const to of [split, horizon]) {
            const rx = p.x + ux * distanceAt(from) - enemy.x - vx * from;
            const ry = p.y + uy * distanceAt(from) - enemy.y - vy * from;
            const sx = ux * (distanceAt(to) - distanceAt(from)) - vx * (to - from);
            const sy = uy * (distanceAt(to) - distanceAt(from)) - vy * (to - from);
            const t = Math.max(0, Math.min(1, -(rx * sx + ry * sy) / (sx * sx + sy * sy || 1)));
            const nearest = Math.hypot(rx + sx * t, ry + sy * t);
            const safety = p.radius + enemy.radius + 6;
            if (nearest < safety) score -= 280 + (safety - nearest) * 20;
            else if (nearest < safety + 25) score -= (safety + 25 - nearest) * 0.65;
            from = to;
          }
        }
        for (const attack of run.priorityAttacks) {
          if (!attack.active) continue;
          for (const seconds of [0.1, 0.2, 0.3, 0.4, 0.5]) {
            const imminent =
              attack.stage === 'active'
                ? seconds <= attack.remaining
                : Math.abs(seconds - attack.remaining) < 0.11;
            if (
              overflightAttackContains(
                attack,
                p.x + ux * distanceAt(seconds),
                p.y + uy * distanceAt(seconds),
                p.radius + 8,
              )
            )
              score -= imminent ? 350 : 8;
          }
        }
        // A rear weapon needs an exit pass. Reward an actual release footprint on
        // the boss, never proximity to a fictional concentric damage aura.
        if (final && run._cooldowns.primary < horizon) {
          const release = Math.max(0, run._cooldowns.primary);
          const px = p.x + ux * distanceAt(release),
            py = p.y + uy * distanceAt(release);
          const centers = payload.rearOffsets?.slice(0, payload.echoes + 1) ?? [28];
          for (const [impact, rear] of centers.entries())
            for (let charge = 0; charge < payload.count; charge++) {
              const side = (charge - (payload.count - 1) / 2) * payload.spacing;
              const cx = px - ux * rear - uy * side,
                cy = py - uy * rear + ux * side;
              const radius = payload.echoRadii?.[impact] ?? payload.radius;
              if (Math.hypot(cx - final.x, cy - final.y) < radius + final.radius * 0.6) score += 22;
            }
        }
        score -=
          (Math.abs(ux * run.flight.speed * magnitude - p.vx) +
            Math.abs(uy * run.flight.speed * magnitude - p.vy)) *
          0.012;
        if (score > best) {
          best = score;
          chosen = { x: ux * magnitude, y: uy * magnitude, boost };
        }
      }
  return chosen;
}

// Explicit review policy only. Its private state cannot grant power, move an
// actor, alter a clock or affect a normal playthrough. All avoidance/terrain
// decisions still pass through directionalPilot's ordinary input candidates.
const lureRoutes = new WeakMap();
function lureGoal(run, final) {
  const p = run.player,
    arena = run.compiled.arena;
  let state = lureRoutes.get(run);
  if (!state || state.lost !== run.stats.airframesLost || state.final !== final?.id) {
    state = {
      until: 0,
      goal: null,
      lost: run.stats.airframesLost,
      final: final?.id,
      phase: 'approach',
    };
    lureRoutes.set(run, state);
  }
  if (final) {
    const dx = p.x - final.x,
      dy = p.y - final.y,
      length = Math.hypot(dx, dy) || 1;
    if (state.phase === 'approach' && length < 175) {
      state.phase = 'exit';
      state.until = run.time + 1.5;
      state.goal = { x: p.x + (dx / length) * 300, y: p.y + (dy / length) * 300 };
    }
    if (state.phase === 'exit' && run.time >= state.until) state.phase = 'approach';
    if (state.phase === 'approach') {
      const angle = Math.atan2(dy, dx) + 0.35;
      state.goal = { x: final.x + Math.cos(angle) * 130, y: final.y + Math.sin(angle) * 130 };
    }
  } else if (
    run.time >= state.until ||
    !state.goal ||
    Math.hypot(p.x - state.goal.x, p.y - state.goal.y) < 50
  ) {
    // Score whole salvage patches, then commit long enough to collect them.
    // A local grid retains exact values without an all-pairs pickup scan.
    const candidates = [],
      cells = new Map(),
      cellSize = 110;
    for (const pickup of run.pickups) {
      if (!pickup.active) continue;
      const separation = Math.hypot(pickup.x - p.x, pickup.y - p.y);
      if (separation <= 65 || separation >= 700) continue;
      candidates.push(pickup);
      const key = `${Math.floor(pickup.x / cellSize)}:${Math.floor(pickup.y / cellSize)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(pickup);
    }
    let best = null,
      bestScore = 0;
    for (const candidate of candidates) {
      let value = 0;
      const cx = Math.floor(candidate.x / cellSize),
        cy = Math.floor(candidate.y / cellSize);
      for (let y = cy - 1; y <= cy + 1; y++)
        for (let x = cx - 1; x <= cx + 1; x++) {
          for (const other of cells.get(`${x}:${y}`) ?? []) {
            if (Math.hypot(candidate.x - other.x, candidate.y - other.y) < cellSize)
              value += other.value;
          }
        }
      const score = value / (Math.hypot(candidate.x - p.x, candidate.y - p.y) + 80);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    if (best) state.goal = { x: best.x, y: best.y };
    else {
      const angle = run.time * 0.2;
      state.goal = {
        x: arena.width / 2 + Math.cos(angle) * 320,
        y: arena.height / 2 + Math.sin(angle) * 250,
      };
    }
    state.until = run.time + 2.4;
  }
  return {
    x: Math.max(70, Math.min(arena.width - 70, state.goal.x)),
    y: Math.max(70, Math.min(arena.height - 70, state.goal.y)),
  };
}
