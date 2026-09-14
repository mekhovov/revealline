import { EPS, movingCirclesTime } from '../core/geometry.mjs';
import { cellAt, positionAt } from './geometry.mjs';

export const COOP_TIMING = Object.freeze({
  gentle: { recovery: 16, hunterWarning: 1.6, emitterWarning: 1.5 },
  standard: { recovery: 12, hunterWarning: 1.2, emitterWarning: 1 },
  expert: { recovery: 10, hunterWarning: 0.8, emitterWarning: 0.8 },
});

export function initializeThreats(run) {
  run.impacts = [];
  run.nextImpactId = 1;
  for (const enemy of run.enemies) {
    enemy.active = true;
    enemy.slowUntil = 0;
    enemy.speedScale = 1;
    enemy.patrolVelocity = { x: enemy.vx, y: enemy.vy };
    enemy.baseSpeed = Math.hypot(enemy.vx, enemy.vy) || (enemy.type === 'hunter' ? 8 : 0);
    if (enemy.type === 'hunter') {
      enemy.phase = 'patrol';
      enemy.target = null;
      enemy.targetPoint = null;
      enemy.phaseUntil = 0.5;
    }
  }
}

function targetTrail(run, origin, range) {
  const candidates = [];
  for (const player of run.players) {
    if (player.status !== 'active' || !player.cutting || player.graceUntil > run.time + EPS)
      continue;
    for (const cell of player.trail) {
      if (run.cells[cell.index] !== 0) continue;
      const point = { x: cell.x + 0.5, y: cell.y + 0.5 };
      const distance = Math.hypot(point.x - origin.x, point.y - origin.y);
      if (distance <= range)
        candidates.push({ player: player.id, point, cellIndex: cell.index, distance });
    }
  }
  candidates.sort(
    (a, b) => a.distance - b.distance || a.cellIndex - b.cellIndex || a.player - b.player,
  );
  return candidates[0] || null;
}

function hunterRecovery(run, enemy, emit) {
  enemy.phase = 'recovery';
  enemy.phaseUntil = run.time + 1.8;
  enemy.vx = enemy.vy = 0;
  emit(run, 'enemy.recovery', {
    enemy: enemy.id,
    target: enemy.target,
    phaseUntil: enemy.phaseUntil,
  });
}

/** All target changes occur at a visible warning boundary, never during a committed attack. */
export function updateThreatClocks(run, emit) {
  const timing = COOP_TIMING[run.difficulty];
  for (const enemy of run.enemies) {
    if (enemy.active === false) continue;
    // Authored reinforcements and deterministic fixtures may add an unadorned actor.
    enemy.slowUntil ??= 0;
    enemy.speedScale ??= 1;
    enemy.patrolVelocity ??= { x: enemy.vx, y: enemy.vy };
    enemy.baseSpeed ??= Math.hypot(enemy.vx, enemy.vy) || (enemy.type === 'hunter' ? 8 : 0);
    if (enemy.type === 'hunter' && enemy.phase === undefined) {
      enemy.phase = 'patrol';
      enemy.target = null;
      enemy.targetPoint = null;
      enemy.phaseUntil = run.time + 0.5;
    }
    if (enemy.speedScale !== 1 && enemy.slowUntil <= run.time + EPS) {
      enemy.vx /= enemy.speedScale;
      enemy.vy /= enemy.speedScale;
      enemy.speedScale = 1;
    }
    if (enemy.type !== 'hunter' || enemy.phaseUntil > run.time + EPS) continue;
    if (enemy.phase === 'patrol') {
      const target = targetTrail(run, enemy, 24);
      if (!target) {
        enemy.phaseUntil = run.time + 0.25;
        continue;
      }
      enemy.phase = 'warning';
      enemy.target = target.player;
      enemy.targetPoint = { ...target.point };
      enemy.phaseUntil = run.time + timing.hunterWarning;
      enemy.vx = enemy.vy = 0;
      emit(run, 'enemy.warning', {
        enemy: enemy.id,
        target: enemy.target,
        targetPoint: { ...enemy.targetPoint },
        phaseUntil: enemy.phaseUntil,
      });
    } else if (enemy.phase === 'warning') {
      const player = run.players[enemy.target];
      if (!player || player.status !== 'active' || player.graceUntil > run.time + EPS) {
        hunterRecovery(run, enemy, emit);
        continue;
      }
      const dx = enemy.targetPoint.x - enemy.x;
      const dy = enemy.targetPoint.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      if (distance < EPS || enemy.baseSpeed < EPS) {
        hunterRecovery(run, enemy, emit);
        continue;
      }
      enemy.phase = 'commit';
      enemy.phaseUntil = run.time + Math.min(1.6, Math.max(0.6, distance / enemy.baseSpeed));
      enemy.vx = (dx / distance) * enemy.baseSpeed * enemy.speedScale;
      enemy.vy = (dy / distance) * enemy.baseSpeed * enemy.speedScale;
      emit(run, 'enemy.commit', {
        enemy: enemy.id,
        target: enemy.target,
        targetPoint: { ...enemy.targetPoint },
        phaseUntil: enemy.phaseUntil,
      });
    } else if (enemy.phase === 'commit') hunterRecovery(run, enemy, emit);
    else {
      enemy.phase = 'patrol';
      enemy.phaseUntil = run.time + 0.5;
      enemy.vx = enemy.patrolVelocity.x * enemy.speedScale;
      enemy.vy = enemy.patrolVelocity.y * enemy.speedScale;
    }
  }
  for (const stronghold of run.strongholds) {
    const emitter = stronghold.emitter;
    if (stronghold.defeated || emitter.phase === 'disabled' || emitter.phaseUntil > run.time + EPS)
      continue;
    if (emitter.phase === 'warning') {
      const player = run.players[emitter.target];
      if (
        player?.status === 'active' &&
        player.cutting &&
        player.graceUntil <= run.time + EPS &&
        player.trail.some((cell) => cell.index === emitter.cellIndex) &&
        run.cells[emitter.cellIndex] === 0
      ) {
        const impact = {
          id: `impact-${run.nextImpactId++}`,
          owner: stronghold.id,
          player: player.id,
          cellIndex: emitter.cellIndex,
          x: (emitter.cellIndex % run.width) + 0.5,
          y: Math.floor(emitter.cellIndex / run.width) + 0.5,
          progress: 0,
        };
        run.impacts.push(impact);
        emit(run, 'impact.launched', {
          impact: impact.id,
          owner: impact.owner,
          player: player.id,
          cellIndex: impact.cellIndex,
        });
      }
      emitter.phase = 'cooldown';
      emitter.phaseUntil = run.time + 4;
    } else {
      const target = targetTrail(run, stronghold.core, 14);
      if (!target) {
        emitter.phase = 'idle';
        emitter.phaseUntil = run.time + 0.25;
        continue;
      }
      emitter.phase = 'warning';
      emitter.target = target.player;
      emitter.cellIndex = target.cellIndex;
      emitter.targetPoint = { ...target.point };
      emitter.phaseUntil = run.time + timing.emitterWarning;
      emit(run, 'emitter.warning', {
        owner: stronghold.id,
        target: target.player,
        targetPoint: { ...target.point },
        phaseUntil: emitter.phaseUntil,
      });
    }
  }
}

export function nextThreatDeadline(run) {
  let time = Infinity;
  for (const enemy of run.enemies) {
    if (enemy.active === false) continue;
    if (enemy.speedScale !== 1) time = Math.min(time, enemy.slowUntil);
    if (enemy.type === 'hunter') time = Math.min(time, enemy.phaseUntil);
  }
  for (const stronghold of run.strongholds)
    if (!stronghold.defeated && stronghold.emitter.phase !== 'disabled')
      time = Math.min(time, stronghold.emitter.phaseUntil);
  return time;
}

export function clearInvalidImpacts(run, emit) {
  run.impacts = run.impacts.filter((impact) => {
    const player = run.players[impact.player];
    const owner = run.strongholds.find((stronghold) => stronghold.id === impact.owner);
    const keep =
      player?.status === 'active' &&
      player.cutting &&
      !owner?.defeated &&
      run.cells[impact.cellIndex] === 0 &&
      player.trail.some((cell) => cell.index === impact.cellIndex);
    if (!keep)
      emit(run, 'impact.cleared', {
        impact: impact.id,
        owner: impact.owner,
        player: impact.player,
        reason: 'secured-or-recovered',
      });
    return keep;
  });
}

/** The current cell ID survives prefix trimming; array positions are never persistent identities. */
export function planImpacts(run, velocities, horizon) {
  return run.impacts.map((impact) => {
    const player = run.players[impact.player];
    const index = player.trail.findIndex((cell) => cell.index === impact.cellIndex);
    const next = player.trail[index + 1];
    const target = next ? { x: next.x + 0.5, y: next.y + 0.5 } : player;
    const dx = target.x - impact.x;
    const dy = target.y - impact.y;
    const distance = Math.hypot(dx, dy);
    const velocity =
      distance > EPS ? { x: (dx / distance) * 14, y: (dy / distance) * 14 } : { x: 0, y: 0 };
    const waypointAt = next ? distance / 14 : Infinity;
    const fraction = movingCirclesTime(
      impact,
      positionAt(impact, velocity, horizon),
      player,
      positionAt(player, velocities[player.id], horizon),
      0.3,
    );
    return {
      impact,
      velocity,
      waypointAt,
      nextCellIndex: next?.index ?? null,
      contactAt: fraction === null ? Infinity : fraction * horizon,
    };
  });
}

export function advanceImpacts(plans, seconds) {
  for (const plan of plans) {
    plan.impact.x += plan.velocity.x * seconds;
    plan.impact.y += plan.velocity.y * seconds;
    plan.impact.progress += 14 * seconds;
    if (plan.waypointAt <= seconds + EPS && plan.nextCellIndex !== null) {
      plan.impact.cellIndex = plan.nextCellIndex;
      plan.impact.progress = 0;
    }
  }
}

export function useSupport(run, player, emit) {
  if (player.support.readyAt > run.time + EPS) return;
  player.support.readyAt = run.time + 8;
  const slowedEnemies = [];
  for (const enemy of run.enemies)
    if (
      enemy.active !== false &&
      Math.hypot(enemy.x - player.x, enemy.y - player.y) <= 6 + EPS &&
      enemy.slowUntil <= run.time + EPS
    ) {
      const moving = Math.hypot(enemy.vx, enemy.vy) > EPS;
      enemy.slowUntil = run.time + 1.5;
      enemy.vx *= 0.5;
      enemy.vy *= 0.5;
      enemy.speedScale = 0.5;
      if (moving) slowedEnemies.push(enemy.id);
    }
  const interceptedImpacts = [];
  run.impacts = run.impacts.filter((impact) => {
    if (Math.hypot(impact.x - player.x, impact.y - player.y) > 6 + EPS) return true;
    interceptedImpacts.push(impact.id);
    emit(run, 'impact.intercepted', {
      impact: impact.id,
      owner: impact.owner,
      player: player.id,
      protectedPlayer: impact.player,
    });
    return false;
  });
  player.support.uses++;
  player.support.intercepts += interceptedImpacts.length;
  player.support.slows += slowedEnemies.length;
  run.team.interceptions += interceptedImpacts.length;
  run.supportEffects.push({ player: player.id, x: player.x, y: player.y, until: run.time + 0.3 });
  emit(run, 'support.pulse', { player: player.id, slowedEnemies, interceptedImpacts });
}

export function strongholdIndex(run, point) {
  return cellAt(run, point.x, point.y);
}
