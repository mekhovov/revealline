/** C1 escort proof. The leader, upgrades, collisions, rewards and clock stay in
 * the ordinary Survivor simulation. Escorts are support equipment, not airframes. */
import { damageOverflightArea } from './core.mjs';
import { visitOverflightGrid } from './grid.mjs';

export const OVERFLIGHT_RIY_RULES = Object.freeze({
  focusRange: 360,
  leash: 420,
  focusSeconds: 3,
  commandCooldown: 6,
  escortSpeed: 260,
});

export function createOverflightRiy(run) {
  return {
    targetId: null,
    focusRemaining: 0,
    cooldown: 0,
    commands: 0,
    airframesLost: run.stats.airframesLost,
    escorts: ['sweeper', 'breaker'].map((role, index) => ({
      role,
      x: run.player.x - 38,
      y: run.player.y + (index ? 52 : -52),
      heading: run.player.heading,
      cooldown: index ? 0.8 : 0.3,
      beamRemaining: 0,
      targetX: 0,
      targetY: 0,
      shots: 0,
    })),
  };
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
  let selected = null,
    score = Infinity;
  visitOverflightGrid(
    run._grid,
    run.player.x,
    run.player.y,
    OVERFLIGHT_RIY_RULES.focusRange,
    (enemy) => {
      if (
        !enemy.active ||
        enemy.warning > 0 ||
        distance(enemy, run.player) > OVERFLIGHT_RIY_RULES.focusRange ||
        Math.abs(enemy.x - run.camera.x) > run.camera.width / 2 - enemy.radius ||
        Math.abs(enemy.y - run.camera.y) > run.camera.height / 2 - enemy.radius
      )
        return;
      const next = targetScore(enemy, run.player);
      if (next < score || (next === score && enemy.id < selected.id)) {
        selected = enemy;
        score = next;
      }
    },
  );
  return selected;
}

/** Called once after an accepted 60 Hz gameplay step, never on paused frames. */
export function stepOverflightRiy(run, { focus = false } = {}) {
  const state = run.riy;
  if (!state || run.phase !== 'playing') return;
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
    }
  }
  if (focus && state.cooldown === 0) {
    const target = overflightRiyTarget(run);
    if (target) {
      state.targetId = target.id;
      state.focusRemaining = OVERFLIGHT_RIY_RULES.focusSeconds;
      state.cooldown = OVERFLIGHT_RIY_RULES.commandCooldown;
      state.commands++;
      run.events.push({ type: 'system', count: 1 });
    }
  }
  let focused =
    state.focusRemaining > 0
      ? run.enemies.find((enemy) => enemy.active && enemy.id === state.targetId)
      : null;
  if (focused && distance(focused, run.player) > OVERFLIGHT_RIY_RULES.leash) focused = null;
  if (!focused) {
    state.targetId = null;
    state.focusRemaining = 0;
  }
  for (const [index, escort] of state.escorts.entries()) {
    if (run.phase !== 'playing') break;
    escort.cooldown = Math.max(0, escort.cooldown - dt);
    escort.beamRemaining = Math.max(0, escort.beamRemaining - dt);
    const heading = focused
      ? Math.atan2(focused.y - run.player.y, focused.x - run.player.x)
      : run.player.heading;
    const side = index ? 1 : -1;
    const forward = focused ? -65 : -38;
    const anchor = focused ?? run.player;
    const goalX = Math.max(
      18,
      Math.min(
        run.compiled.arena.width - 18,
        anchor.x + Math.cos(heading) * forward - Math.sin(heading) * side * 52,
      ),
    );
    const goalY = Math.max(
      18,
      Math.min(
        run.compiled.arena.height - 18,
        anchor.y + Math.sin(heading) * forward + Math.cos(heading) * side * 52,
      ),
    );
    const dx = goalX - escort.x,
      dy = goalY - escort.y,
      length = Math.hypot(dx, dy);
    const move = Math.min(length, OVERFLIGHT_RIY_RULES.escortSpeed * dt);
    if (length > 0) {
      escort.x += (dx / length) * move;
      escort.y += (dy / length) * move;
    }
    escort.heading = heading;
    let target = focused;
    if (!target) {
      let best = Infinity;
      visitOverflightGrid(run._grid, escort.x, escort.y, 105, (enemy) => {
        if (!enemy.active || enemy.warning > 0) return;
        const next = distance(enemy, escort);
        if (next <= 105 && (next < best || (next === best && enemy.id < target.id))) {
          target = enemy;
          best = next;
        }
      });
    }
    if (!target?.active || escort.cooldown > 0 || distance(target, escort) > 120) continue;
    escort.heading = Math.atan2(target.y - escort.y, target.x - escort.x);
    escort.targetX = target.x;
    escort.targetY = target.y;
    escort.beamRemaining = 0.12;
    escort.cooldown = escort.role === 'sweeper' ? 1.1 : 1.8;
    escort.shots++;
    // Shared exact queries retain armor, deaths, remains, salvage and sound rules.
    damageOverflightArea(
      run,
      target.x,
      target.y,
      escort.role === 'sweeper' ? 40 : 10,
      escort.role === 'sweeper' ? 12 : 36,
      { origin: escort },
    );
  }
}
