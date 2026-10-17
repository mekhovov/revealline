import {
  overflightTerrainClear,
  overflightTerrainOpenPoint,
  overflightTerrainWaypoint,
  moveOverflightThroughTerrain,
} from './terrain.mjs';
/** C1 escort proof. The leader, upgrades, collisions, rewards and clock stay in
 * the ordinary Survivor simulation. Escorts are support equipment, not airframes. */
import { damageOverflightArea, damageOverflightEnemy } from './core.mjs';
import { visitOverflightGrid } from './grid.mjs';
import { OVERFLIGHT_RIY_DEFAULTS } from './riy-project.mjs';
import {
  createOverflightRiyBuild,
  overflightRiyEscortParameters,
  draftOverflightRiyUpgrades,
  applyOverflightRiyUpgrade,
} from './riy-upgrades.mjs';

function moveEscort(run, escort, goalX, goalY, speed, dt) {
  let target = { x: goalX, y: goalY };
  if (run.terrain) {
    escort.radius = 9;
    if (!overflightTerrainClear(run.terrain, escort.x, escort.y, escort.x, escort.y, escort.radius))
      Object.assign(
        escort,
        overflightTerrainOpenPoint(
          run.terrain,
          escort.x,
          escort.y,
          escort.radius,
          run.compiled.arena,
        ),
      );
    target = overflightTerrainOpenPoint(run.terrain, target.x, target.y, 9, run.compiled.arena);
    target = overflightTerrainWaypoint(run.terrain, escort, target, run.compiled.arena);
  }
  const dx = target.x - escort.x,
    dy = target.y - escort.y,
    length = Math.hypot(dx, dy);
  const movement = Math.min(length, speed * dt);
  if (length > 0)
    moveOverflightThroughTerrain(
      run.terrain,
      escort,
      escort.x + (dx / length) * movement,
      escort.y + (dy / length) * movement,
    );
  return Math.hypot(goalX - escort.x, goalY - escort.y);
}

export const OVERFLIGHT_RIY_RULES = OVERFLIGHT_RIY_DEFAULTS;

export function createOverflightRiy(run) {
  const version = run.compiled.riyVersion ?? 1;
  if (version === 2) {
    run.build.escorts = createOverflightRiyBuild();
    run.build.combat = [];
    run.upgradePolicy = {
      draft: draftOverflightRiyUpgrades,
      apply: applyOverflightRiyUpgrade,
    };
  }
  const state = {
    version,
    rules: run.compiled.riy ?? OVERFLIGHT_RIY_DEFAULTS,
    targetId: null,
    focusRemaining: 0,
    cooldown: 0,
    commands: 0,
    engagements: 0,
    candidateId: null,
    phase: 'follow',
    approachRemaining: 0,
    trails: Array.from({ length: 8 }, () => ({
      active: false,
      x: 0,
      y: 0,
      radius: 0,
      remaining: 0,
      clock: 0,
      slowMultiplier: 1,
    })),
    airframesLost: run.stats.airframesLost,
    escorts: (run.compiled.riy ?? OVERFLIGHT_RIY_DEFAULTS).escorts.map((config, index) => ({
      ...config,
      x:
        run.player.x +
        (version === 2
          ? Math.cos(run.player.heading) * config.forward -
            Math.sin(run.player.heading) * config.lateral
          : config.forward),
      y:
        run.player.y +
        (version === 2
          ? Math.sin(run.player.heading) * config.forward +
            Math.cos(run.player.heading) * config.lateral
          : config.lateral),
      heading: run.player.heading,
      formationHeading: run.player.heading,
      cooldown: index ? 0.8 : 0.3,
      beamRemaining: 0,
      shotSegmentCount: 0,
      shotSegments: Array.from({ length: 3 }, () => ({ x: 0, y: 0, targetX: 0, targetY: 0 })),
      targetX: 0,
      targetY: 0,
      shots: 0,
      pending: null,
    })),
  };
  if (run.terrain)
    for (const escort of state.escorts)
      Object.assign(
        escort,
        overflightTerrainOpenPoint(run.terrain, escort.x, escort.y, 9, run.compiled.arena),
      );
  return state;
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function targetScore(enemy, origin) {
  const priority =
    enemy.role === 'final'
      ? 0
      : enemy.role === 'elite'
        ? 1
        : enemy.maxArmor > 0
          ? 2
          : enemy.guardIntegrity > 0
            ? 3
            : 4;
  return priority * 1000 + distance(enemy, origin);
}
export function overflightRiyTarget(run) {
  const rules = run.riy?.rules ?? OVERFLIGHT_RIY_DEFAULTS;
  let selected = null,
    score = Infinity;
  visitOverflightGrid(run._grid, run.player.x, run.player.y, rules.focusRange, (enemy) => {
    if (
      !enemy.active ||
      enemy.warning > 0 ||
      distance(enemy, run.player) > rules.focusRange ||
      Math.abs(enemy.x - run.camera.x) > run.camera.width / 2 - enemy.radius ||
      Math.abs(enemy.y - run.camera.y) > run.camera.height / 2 - enemy.radius
    )
      return;
    const next = targetScore(enemy, run.player);
    if (next < score || (next === score && enemy.id < selected.id)) {
      selected = enemy;
      score = next;
    }
  });
  return selected;
}

/** Called once after an accepted 60 Hz gameplay step, never on paused frames. */
function stepLegacyOverflightRiy(run, { focus = false } = {}) {
  const state = run.riy;
  if (!state || run.phase !== 'playing') return;
  const rules = state.rules;
  const dt = 1 / 60;
  state.cooldown = Math.max(0, state.cooldown - dt);
  state.focusRemaining = Math.max(0, state.focusRemaining - dt);
  if (state.airframesLost !== run.stats.airframesLost) {
    state.targetId = null;
    state.focusRemaining = 0;
    state.airframesLost = run.stats.airframesLost;
    for (const escort of state.escorts) {
      escort.x = run.player.x;
      escort.y = run.player.y;
      escort.beamRemaining = 0;
      escort.shotSegmentCount = 0;
    }
  }
  if (focus && state.cooldown === 0) {
    const target = overflightRiyTarget(run);
    if (target) {
      state.targetId = target.id;
      state.focusRemaining = rules.focusSeconds;
      state.cooldown = rules.commandCooldown;
      state.commands++;
      run.events.push({ type: 'system', count: 1 });
    }
  }
  let focused =
    state.focusRemaining > 0
      ? run.enemies.find((enemy) => enemy.active && enemy.id === state.targetId)
      : null;
  if (focused && distance(focused, run.player) > rules.leash) focused = null;
  if (!focused) {
    state.targetId = null;
    state.focusRemaining = 0;
  }
  for (const escort of state.escorts) {
    if (run.phase !== 'playing') break;
    escort.cooldown = Math.max(0, escort.cooldown - dt);
    escort.beamRemaining = Math.max(0, escort.beamRemaining - dt);
    const heading = focused
      ? Math.atan2(focused.y - run.player.y, focused.x - run.player.x)
      : run.player.heading;
    const forward = focused ? rules.focusForward : escort.forward;
    const anchor = focused ?? run.player;
    const goalX = Math.max(
      18,
      Math.min(
        run.compiled.arena.width - 18,
        anchor.x + Math.cos(heading) * forward - Math.sin(heading) * escort.lateral,
      ),
    );
    const goalY = Math.max(
      18,
      Math.min(
        run.compiled.arena.height - 18,
        anchor.y + Math.sin(heading) * forward + Math.cos(heading) * escort.lateral,
      ),
    );
    moveEscort(run, escort, goalX, goalY, rules.escortSpeed, dt);
    escort.heading = heading;
    let target = focused;
    if (!target) {
      let best = Infinity;
      visitOverflightGrid(run._grid, escort.x, escort.y, rules.defendRange, (enemy) => {
        if (!enemy.active || enemy.warning > 0) return;
        const next = distance(enemy, escort);
        if (next <= rules.defendRange && (next < best || (next === best && enemy.id < target.id))) {
          target = enemy;
          best = next;
        }
      });
    }
    if (!target?.active || escort.cooldown > 0 || distance(target, escort) > rules.attackRange)
      continue;
    escort.heading = Math.atan2(target.y - escort.y, target.x - escort.x);
    escort.targetX = target.x;
    escort.targetY = target.y;
    escort.beamRemaining = 0.12;
    escort.cooldown = escort.interval;
    escort.shots++;
    escort.shotSegmentCount = 0;
    recordShotSegment(escort, escort, target);
    // Shared exact queries retain armor, deaths, remains, salvage and sound rules.
    damageOverflightArea(run, target.x, target.y, escort.radius, escort.damage, { origin: escort });
  }
}

const activeEnemy = (run, id) =>
  run.enemies.find((enemy) => enemy.active && enemy.id === id) ?? null;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function overflightRiyInFollowArc(escort, enemy) {
  const axis = escort.formationHeading + (escort.role === 'sweeper' ? Math.PI : 0);
  const dx = enemy.x - escort.x,
    dy = enemy.y - escort.y;
  const length = Math.hypot(dx, dy);
  return (
    length <= escort.attackRange &&
    (length === 0 ||
      (dx * Math.cos(axis) + dy * Math.sin(axis)) / length >=
        Math.cos((escort.followArc * Math.PI) / 360) - 1e-12)
  );
}

function releaseFocus(state) {
  state.targetId = null;
  state.focusRemaining = 0;
  state.approachRemaining = 0;
  state.phase = 'returning';
}

function clearShot(run, origin, target) {
  return (
    target?.active &&
    target.warning <= 0 &&
    overflightTerrainClear(run.terrain, origin.x, origin.y, target.x, target.y)
  );
}

// Capture admitted links at impact time. Rendering must not reconnect moving
// actors afterward or imply that a blocked victim received a damage share.
function recordShotSegment(escort, origin, target) {
  const segment = escort.shotSegments[escort.shotSegmentCount++];
  Object.assign(segment, { x: origin.x, y: origin.y, targetX: target.x, targetY: target.y });
}

function applyShot(run, escort, target, settings, burst = false) {
  if (run.phase !== 'playing' || !clearShot(run, escort, target)) return false;
  escort.heading = Math.atan2(target.y - escort.y, target.x - escort.x);
  escort.targetX = target.x;
  escort.targetY = target.y;
  escort.beamRemaining = 0.12;
  escort.shotSegmentCount = 0;
  escort.shots++;
  if (escort.role === 'sweeper') {
    recordShotSegment(escort, escort, target);
    damageOverflightArea(run, target.x, target.y, settings.radius, settings.damage, {
      origin: escort,
    });
    if (settings.trailRadius > 0) {
      const trail = run.riy.trails.find((entry) => !entry.active);
      if (!trail) throw new Error('Riy trail pool is too small for the authored fire rate.');
      Object.assign(trail, {
        active: true,
        x: escort.x - Math.cos(escort.formationHeading) * 20,
        y: escort.y - Math.sin(escort.formationHeading) * 20,
        radius: settings.trailRadius,
        remaining: settings.trailDuration,
        clock: 0,
        slowMultiplier: settings.trailSlow,
      });
    }
  } else if (settings.chainTargets > 1) {
    const targets = [target];
    while (targets.length < settings.chainTargets) {
      const origin = targets.at(-1);
      let next = null,
        best = Infinity;
      visitOverflightGrid(run._grid, origin.x, origin.y, settings.chainRange, (enemy) => {
        const separation = distance(origin, enemy);
        if (
          !enemy.active ||
          enemy.warning > 0 ||
          targets.includes(enemy) ||
          separation > settings.chainRange ||
          !overflightTerrainClear(run.terrain, origin.x, origin.y, enemy.x, enemy.y)
        )
          return;
        if (separation < best || (separation === best && enemy.id < next.id)) {
          next = enemy;
          best = separation;
        }
      });
      if (!next) break;
      targets.push(next);
    }
    const damage = settings.damage / targets.length;
    let origin = escort;
    for (const victim of targets) {
      // A rejected link cannot carry the remaining chain through cover or beyond
      // the final enemy's death. Divide only among admitted, clear links above.
      if (!damageOverflightEnemy(run, victim, damage, origin)) break;
      recordShotSegment(escort, origin, victim);
      origin = { x: victim.x, y: victim.y };
    }
  } else {
    damageOverflightEnemy(run, target, settings.damage, escort);
    recordShotSegment(escort, escort, target);
    if (!burst && settings.burstCount > 1)
      escort.pending = {
        targetId: target.id,
        remaining: settings.burstDelay,
        damage: settings.damage,
      };
  }
  return true;
}

function stepSquad(run, focus) {
  const state = run.riy,
    rules = state.rules,
    dt = 1 / 60;
  const attackDt = dt * (run.attackRate ?? 1);
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (state.phase === 'approach')
    state.approachRemaining = Math.max(0, state.approachRemaining - dt);
  if (state.phase === 'engaged') state.focusRemaining = Math.max(0, state.focusRemaining - dt);
  if (state.airframesLost !== run.stats.airframesLost) {
    releaseFocus(state);
    state.airframesLost = run.stats.airframesLost;
    for (const escort of state.escorts) {
      escort.x = run.player.x;
      escort.y = run.player.y;
      escort.beamRemaining = 0;
      escort.shotSegmentCount = 0;
      escort.pending = null;
    }
  }
  const candidate = overflightRiyTarget(run);
  state.candidateId = state.cooldown === 0 ? (candidate?.id ?? null) : null;
  if (focus && state.cooldown === 0 && candidate) {
    state.targetId = candidate.id;
    state.approachRemaining = rules.approachSeconds;
    state.focusRemaining = 0;
    state.phase = 'approach';
    state.cooldown = rules.commandCooldown;
    state.commands++;
    state.candidateId = null;
    run.events.push({ type: 'system', count: 1 });
  }
  let target = activeEnemy(run, state.targetId);
  if (
    target &&
    (distance(target, run.player) > rules.leash ||
      (state.phase === 'approach' && state.approachRemaining === 0) ||
      (state.phase === 'engaged' && state.focusRemaining === 0))
  )
    target = null;
  if (!target && state.targetId !== null) releaseFocus(state);
  let returned = true;
  for (const escort of state.escorts) {
    if (run.phase !== 'playing') break;
    const upgrade = run.build.escorts.find((entry) => entry.role === escort.role);
    const config = rules.escorts.find((entry) => entry.role === escort.role);
    const settings = overflightRiyEscortParameters(config, upgrade);
    Object.assign(escort, settings);
    escort.cooldown = Math.max(0, escort.cooldown - attackDt);
    escort.beamRemaining = Math.max(0, escort.beamRemaining - dt);
    const heading = target
      ? Math.atan2(target.y - run.player.y, target.x - run.player.x)
      : run.player.heading;
    escort.formationHeading = heading;
    escort.heading = heading;
    const forward = target ? rules.focusForward : escort.forward;
    const anchor = target ?? run.player;
    const goalX = clamp(
      anchor.x + Math.cos(heading) * forward - Math.sin(heading) * escort.lateral,
      18,
      run.compiled.arena.width - 18,
    );
    const goalY = clamp(
      anchor.y + Math.sin(heading) * forward + Math.cos(heading) * escort.lateral,
      18,
      run.compiled.arena.height - 18,
    );
    if (moveEscort(run, escort, goalX, goalY, rules.escortSpeed, dt) > 4) returned = false;
    if (
      target &&
      state.phase === 'approach' &&
      distance(escort, target) <= settings.attackRange &&
      overflightTerrainClear(run.terrain, escort.x, escort.y, target.x, target.y)
    ) {
      state.phase = 'engaged';
      state.engagements++;
      state.approachRemaining = 0;
      state.focusRemaining = rules.focusSeconds;
    }
    if (escort.pending) {
      escort.pending.remaining -= attackDt;
      if (escort.pending.remaining <= 0) {
        const pendingTarget = activeEnemy(run, escort.pending.targetId);
        if (
          pendingTarget &&
          distance(escort, pendingTarget) <= settings.attackRange &&
          (target?.id === pendingTarget.id || overflightRiyInFollowArc(escort, pendingTarget))
        )
          applyShot(
            run,
            escort,
            pendingTarget,
            { ...settings, damage: escort.pending.damage },
            true,
          );
        escort.pending = null;
      }
    }
    if (escort.cooldown > 0) continue;
    let shotTarget = target;
    if (!shotTarget) {
      let best = Infinity;
      visitOverflightGrid(run._grid, escort.x, escort.y, settings.attackRange, (enemy) => {
        if (!overflightRiyInFollowArc(escort, enemy) || !clearShot(run, escort, enemy)) return;
        const score =
          escort.role === 'breaker' ? targetScore(enemy, escort) : distance(enemy, escort);
        if (score < best || (score === best && enemy.id < shotTarget.id)) {
          shotTarget = enemy;
          best = score;
        }
      });
    }
    if (!shotTarget?.active || distance(escort, shotTarget) > settings.attackRange) continue;
    if (applyShot(run, escort, shotTarget, settings)) escort.cooldown = settings.interval;
  }
  if (!target && returned && state.phase === 'returning') state.phase = 'follow';
  for (const trail of state.trails) {
    if (!trail.active) continue;
    trail.remaining -= dt;
    trail.clock -= dt;
    if (trail.clock <= 0) {
      damageOverflightArea(run, trail.x, trail.y, trail.radius, 0, {
        slow: 0.2,
        slowMultiplier: trail.slowMultiplier,
      });
      trail.clock = 0.1;
    }
    if (trail.remaining <= 0) trail.active = false;
  }
}

/** Both revisions run on the accepted gameplay clock; legacy behavior is untouched. */
export function stepOverflightRiy(run, { focus = false } = {}) {
  if (!run.riy || run.phase !== 'playing') return;
  if (run.riy.version !== 2) return stepLegacyOverflightRiy(run, { focus });
  stepSquad(run, focus);
}

export function overflightRiyPresentation(run) {
  const state = run.riy;
  if (!state) return null;
  const candidate = state.cooldown === 0 ? overflightRiyTarget(run) : null;
  return {
    phase: state.phase,
    candidate: candidate
      ? {
          id: candidate.id,
          family: candidate.family,
          x: candidate.x,
          y: candidate.y,
          radius: candidate.radius,
        }
      : null,
    focusRemaining: state.focusRemaining,
    cooldown: state.cooldown,
    escorts: state.escorts.map((escort) => ({
      ...escort,
      shotSegments: escort.shotSegments.map((segment) => ({ ...segment })),
      arcRadians: ((escort.followArc ?? 360) * Math.PI) / 180,
      range: escort.attackRange ?? state.rules.attackRange,
    })),
  };
}
