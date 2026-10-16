/** Temporary qualification-only policy. It never changes simulation state or production controls. */
import {
  createOverflightProject,
  compileOverflightProject,
} from '../../../../game/overflight/project.mjs';
import {
  createOverflightRun,
  startOverflight,
  stepOverflight,
  chooseOverflightUpgrade,
  overflightSummary,
} from '../../../../game/overflight/core.mjs';
import { createOverflightRiyMode } from '../../../../game/overflight/riy-mode.mjs';
import { selectCard, pilot as standardPilot } from '../../../../game/overflight/review-pilot.mjs';
import { overflightPayload } from '../../../../game/overflight/upgrades.mjs';
import { overflightAttackContains } from '../../../../game/overflight/tactics.mjs';

export function createLureRoute({
  passSeconds = 2.2,
  footprintWeight = 9,
  focusPolicy = 'priority',
  continuityWeight = 38,
  allowReturn = false,
} = {}) {
  let nextPass = 0,
    headingX = 1,
    headingY = 0,
    waypoint = 0,
    goalX = 2500,
    goalY = 260;
  const waypoints = [
    [2500, 260],
    [2500, 820],
    [380, 820],
    [380, 260],
  ];
  return function input(run) {
    const p = run.player,
      arena = run.compiled.arena,
      horizon = 0.6;
    const payload = overflightPayload(run.build, 3);
    const nearby = run.enemies.filter(
      (e) =>
        e.active && e.warning < horizon && Math.abs(e.x - p.x) < 300 && Math.abs(e.y - p.y) < 300,
    );
    if (run.time >= nextPass) {
      if (Math.hypot(p.x - waypoints[waypoint][0], p.y - waypoints[waypoint][1]) < 180)
        waypoint = (waypoint + 1) % waypoints.length;
      [goalX, goalY] = waypoints[waypoint];
      let bestPickup = Infinity;
      for (const item of run.pickups) {
        if (!item.active) continue;
        const dx = item.x - p.x,
          dy = item.y - p.y,
          distance = Math.hypot(dx, dy);
        const forward = (dx * headingX + dy * headingY) / (distance || 1);
        if (
          distance < 55 ||
          distance > 600 ||
          (!allowReturn && nearby.length > 12 && forward < 0.1)
        )
          continue;
        const score = distance / Math.min(4, Math.sqrt(item.value));
        if (score < bestPickup) {
          bestPickup = score;
          goalX = item.x;
          goalY = item.y;
        }
      }
      nextPass = run.time + passSeconds;
    }
    const final = run.enemies.find((e) => e.active && e.role === 'final');
    if (final) {
      const angle = Math.atan2(p.y - final.y, p.x - final.x) + 0.65;
      goalX = final.x + Math.cos(angle) * 135;
      goalY = final.y + Math.sin(angle) * 135;
    }
    const distanceBefore = Math.hypot(goalX - p.x, goalY - p.y);
    let best = -Infinity,
      selected = { x: headingX, y: headingY, boost: false };
    const options = p.boostCooldown === 0 && !run._boostHeld ? [false, true] : [false];
    for (const boost of options)
      for (const magnitude of [0.7, 1])
        for (let i = 0; i < 24; i++) {
          const angle = (i * Math.PI) / 12,
            ux = Math.cos(angle),
            uy = Math.sin(angle);
          const boostSeconds = boost ? 0.3 : Math.min(horizon, p.boostRemaining);
          const distanceAt = (t) =>
            magnitude *
            (run.flight.boostSpeed * Math.min(boostSeconds, t) +
              run.flight.speed * Math.max(0, t - boostSeconds));
          const endX = p.x + ux * distanceAt(horizon),
            endY = p.y + uy * distanceAt(horizon);
          if (endX < 36 || endY < 36 || endX > arena.width - 36 || endY > arena.height - 36)
            continue;
          const continuity = ux * headingX + uy * headingY;
          let score =
            (distanceBefore - Math.hypot(goalX - endX, goalY - endY)) * 0.65 +
            (final ? 8 : continuityWeight) * continuity -
            (boost ? 18 : 0);
          for (const enemy of nearby) {
            const burst = enemy.behaviorPhase === 'burst';
            const speed =
              enemy.speed *
              (burst
                ? Math.min(2, 144 / enemy.speed)
                : enemy.behaviorPhase === 'windup'
                  ? 0.5
                  : 1) *
              (enemy.slowUntil > run.tick ? enemy.slowMultiplier : 1);
            const vx = (burst ? enemy._burstX : enemy.steeringX) * speed,
              vy = (burst ? enemy._burstY : enemy.steeringY) * speed;
            const split = boostSeconds > 0 && boostSeconds < horizon ? boostSeconds : horizon / 2;
            let from = 0;
            for (const to of [split, horizon]) {
              const rx = p.x + ux * distanceAt(from) - enemy.x - vx * from,
                ry = p.y + uy * distanceAt(from) - enemy.y - vy * from;
              const sx = ux * (distanceAt(to) - distanceAt(from)) - vx * (to - from),
                sy = uy * (distanceAt(to) - distanceAt(from)) - vy * (to - from);
              const t = Math.max(0, Math.min(1, -(rx * sx + ry * sy) / (sx * sx + sy * sy || 1)));
              const nearest = Math.hypot(rx + sx * t, ry + sy * t),
                safe = p.radius + enemy.radius + 8;
              if (nearest < safe) score -= 340 + (safe - nearest) * 24;
              else if (nearest < safe + 32) score -= (safe + 32 - nearest) * 0.8;
              from = to;
            }
          }
          for (const attack of run.priorityAttacks) {
            if (!attack.active) continue;
            for (const t of [0.1, 0.2, 0.3, 0.4, 0.5, 0.6])
              if (
                overflightAttackContains(
                  attack,
                  p.x + ux * distanceAt(t),
                  p.y + uy * distanceAt(t),
                  p.radius + 8,
                )
              ) {
                const imminent =
                  attack.stage === 'active'
                    ? t <= attack.remaining
                    : Math.abs(t - attack.remaining) < 0.11;
                score -= imminent ? 400 : 12;
              }
          }
          // The real release offsets/radii are evaluated against crowds as well as bosses.
          // Each body contributes once, so overlapping Echo rings do not inflate aim scoring.
          if (run._cooldowns.primary < horizon) {
            const release = Math.max(0, run._cooldowns.primary),
              px = p.x + ux * distanceAt(release),
              py = p.y + uy * distanceAt(release);
            const centers = payload.rearOffsets?.slice(0, payload.echoes + 1) ?? [28];
            let hits = 0;
            for (const enemy of nearby) {
              let hit = false;
              for (const [index, rear] of centers.entries())
                for (let charge = 0; charge < payload.count; charge++) {
                  const side = (charge - (payload.count - 1) / 2) * payload.spacing;
                  const cx = px - ux * rear - uy * side,
                    cy = py - uy * rear + ux * side,
                    radius = payload.echoRadii?.[index] ?? payload.radius;
                  if (Math.hypot(cx - enemy.x, cy - enemy.y) < radius + enemy.radius * 0.6)
                    hit = true;
                }
              if (hit) hits += enemy.role === 'final' ? 5 : 1;
            }
            score += Math.min(14, hits) * footprintWeight;
          }
          if (score > best) {
            best = score;
            selected = { x: ux * magnitude, y: uy * magnitude, boost };
          }
        }
    const length = Math.hypot(selected.x, selected.y) || 1;
    headingX = selected.x / length;
    headingY = selected.y / length;
    if (run.riy) {
      const target = run.enemies.find((e) => e.active && e.id === run.riy.candidateId);
      selected.focus =
        run.riy.cooldown === 0 &&
        !!target &&
        (focusPolicy === 'automatic' || ['elite', 'final'].includes(target.role));
    }
    return selected;
  };
}

export function qualifyLureRoute({
  mode = 'riy',
  seed = 17031991,
  build = 'echo',
  warmupSeconds = 0,
  finishWithStandardAt = Infinity,
  maxSeconds = 480,
  ...policy
} = {}) {
  const base = {
    createProject: createOverflightProject,
    compileProject: compileOverflightProject,
    createRun: createOverflightRun,
    start: startOverflight,
    step: stepOverflight,
    choose: chooseOverflightUpgrade,
    summary: overflightSummary,
    selectCard,
    pilot: standardPilot,
  };
  const owner = mode === 'riy' ? createOverflightRiyMode(base) : base;
  const compiled = owner.compileProject(
    owner.createProject({
      rulesVersion: 3,
      world: 'freight-depot',
      encounterSet: 'crossing',
      seed,
      difficulty: 'standard',
    }),
  );
  const run = owner.createRun(compiled, { airframes: 3 }),
    steer = createLureRoute(policy),
    choices = [],
    trajectory = [];
  let input = {};
  owner.start(run);
  while (['playing', 'upgrade'].includes(run.phase) && run.time < maxSeconds) {
    if (run.phase === 'upgrade') {
      const card = owner.selectCard(run, build);
      if (!card || !owner.choose(run, card.id)) throw new Error('Draft blocked');
      choices.push({ time: run.time, id: card.id });
      continue;
    }
    if (run.tick % 6 === 0)
      input =
        run.time < warmupSeconds || run.time >= finishWithStandardAt
          ? owner.pilot(run, 'tight')
          : steer(run);
    owner.step(run, input);
    if (run.tick % 60 === 0)
      trajectory.push({
        time: run.time,
        x: run.player.x,
        y: run.player.y,
        headingX: run.player.headingX,
        headingY: run.player.headingY,
        hull: run.player.hull,
        airframesRemaining: run.airframesRemaining,
        input: { ...input },
        kills: run.stats.kills,
        damageTaken: run.stats.damageTaken,
        xpCollected: run.stats.xpCollected,
        alive: run.stats.enemiesAlive,
        finalHull: run.enemies.find((e) => e.active && e.role === 'final')?.hp ?? null,
      });
  }
  return {
    world: 'freight-depot',
    mode,
    seed,
    build,
    policy: {
      ...policy,
      warmupSeconds,
      finishWithStandardAt: Number.isFinite(finishWithStandardAt) ? finishWithStandardAt : null,
      maxSeconds,
    },
    projectIdentity: compiled.projectIdentity,
    outcome: run.phase,
    time: run.time,
    damageTaken: run.stats.damageTaken,
    damageCauses: run.stats.damageCauses,
    kills: run.stats.kills,
    finalHull: run.enemies.find((e) => e.active && e.role === 'final')?.hp ?? null,
    xpEarned: run.stats.xpEarned,
    xpCollected: run.stats.xpCollected,
    buildState: structuredClone(run.build),
    choices,
    trajectory,
  };
}
