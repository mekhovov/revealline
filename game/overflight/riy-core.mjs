/** C1 escort proof. The leader, upgrades, collisions, rewards and clock stay in
 * the ordinary Survivor simulation. Escorts are support equipment, not airframes. */
import { damageOverflightArea } from './core.mjs';
import { visitOverflightGrid } from './grid.mjs';
import { OVERFLIGHT_RIY_DEFAULTS } from './riy-project.mjs';

export const OVERFLIGHT_RIY_RULES = OVERFLIGHT_RIY_DEFAULTS;

export function createOverflightRiy(run) {
  return {
    rules: run.compiled.riy ?? OVERFLIGHT_RIY_DEFAULTS,
    targetId: null,
    focusRemaining: 0,
    cooldown: 0,
    commands: 0,
    airframesLost: run.stats.airframesLost,
    escorts: (run.compiled.riy ?? OVERFLIGHT_RIY_DEFAULTS).escorts.map((config, index) => ({
      ...config,
      x: run.player.x + config.forward,
      y: run.player.y + config.lateral,
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
export function stepOverflightRiy(run, { focus = false } = {}) {
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
    const dx = goalX - escort.x,
      dy = goalY - escort.y,
      length = Math.hypot(dx, dy);
    const move = Math.min(length, rules.escortSpeed * dt);
    if (length > 0) {
      escort.x += (dx / length) * move;
      escort.y += (dy / length) * move;
    }
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
    // Shared exact queries retain armor, deaths, remains, salvage and sound rules.
    damageOverflightArea(run, target.x, target.y, escort.radius, escort.damage, { origin: escort });
  }
}
