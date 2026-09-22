import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, SAFE } from '../../coop/core.mjs';
import { coopBonusActive } from '../../coop/timed-bonuses.mjs';

/** Deterministic public-input evidence, not an official Team save/replay format.
 * No neutral braking, position injection, bonus grants or hidden-state repairs. */
export function assessTeamTimedRoute(
  level,
  segments,
  { seed = 1, swapped = false, delayTicks = 0, jointCuts = true, observeBonusWindows = false } = {},
) {
  const directions = [null, 'left', 'right', 'up', 'down'];
  if (
    !Array.isArray(segments) ||
    !segments.length ||
    !Number.isSafeInteger(delayTicks) ||
    delayTicks < 0 ||
    delayTicks > 1200 ||
    segments.some(
      (s) =>
        !s ||
        !directions.includes(s.a) ||
        !directions.includes(s.b) ||
        !Number.isSafeInteger(s.ticks) ||
        s.ticks < 1 ||
        s.ticks > 10000,
    ) ||
    segments.reduce((sum, s) => sum + s.ticks, delayTicks) > 36000 ||
    typeof swapped !== 'boolean' ||
    typeof jointCuts !== 'boolean' ||
    typeof observeBonusWindows !== 'boolean'
  )
    throw new TypeError('Invalid bounded Team timed route.');
  const owned = structuredClone(level);
  if (swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { seed, jointCuts }));
  const events = [],
    bonusEvents = [],
    bonusWindows = [],
    initialReserves = run.team.reserves,
    returns = [0, 0],
    collected = [],
    closures = [],
    cutStarts = [],
    activatedAt = new Map(),
    activated = new Set();
  let firstDown = null,
    failure = null,
    simultaneousTicks = 0,
    bothIdleTicks = 0,
    jointIdleStreak = 0,
    longestJointIdleTicks = 0;
  const all = delayTicks ? [{ a: null, b: null, ticks: delayTicks }, ...segments] : segments;
  outer: for (const segment of all)
    for (let n = 0; n < segment.ticks; n++) {
      if (run.status !== 'running' || firstDown) break outer;
      const directions = swapped ? [segment.b, segment.a] : [segment.a, segment.b];
      if (directions.some((d, i) => d === null && run.players[i].direction !== null)) {
        failure = 'artificial-neutral-brake';
        break outer;
      }
      const cutting = run.players.map((p) => p.cutting),
        coverageBefore = run.coverage,
        anchorsBefore = observeBonusWindows
          ? new Map(
              (run.level.timedBonuses?.schedules ?? []).flatMap((schedule) =>
                schedule.anchors.map((anchor) => [
                  `${schedule.id}/${anchor.x}/${anchor.y}`,
                  run.cells[Math.floor(anchor.y) * run.width + Math.floor(anchor.x)],
                ]),
              ),
            )
          : null,
        beforePositions = run.players.map((p) => [p.x, p.y]),
        beforeItems = new Map(
          run.bonuses.items.map((item) => [
            item.id,
            {
              x: item.x,
              y: item.y,
              reclaimed: run.cells[Math.floor(item.y) * run.width + Math.floor(item.x)] === SAFE,
            },
          ]),
        );
      const freeze = coopBonusActive(run, 'enemy-freeze'),
        slow = coopBonusActive(run, 'enemy-slow'),
        speed = run.players.map((p) => coopBonusActive(run, 'player-speed', p.id));
      stepCoop(
        run,
        directions.map((direction) => ({ direction, boost: false, support: false })),
      );
      if (run.players.every((p) => p.cutting)) simultaneousTicks++;
      if (
        run.players.every((p, i) => p.x === beforePositions[i][0] && p.y === beforePositions[i][1])
      ) {
        bothIdleTicks++;
        jointIdleStreak++;
        longestJointIdleTicks = Math.max(longestJointIdleTicks, jointIdleStreak);
      } else jointIdleStreak = 0;
      for (const event of run.events) {
        events.push(structuredClone(event));
        if (event.type.startsWith('bonus.')) bonusEvents.push(structuredClone(event));
        if (observeBonusWindows && event.type.startsWith('bonus.'))
          bonusWindows.push({
            ...structuredClone(event),
            coverageBefore,
            coverageAfter: run.coverage,
            anchorBefore: anchorsBefore.get(`${event.id}/${event.x}/${event.y}`),
            anchorAfter: run.cells[Math.floor(event.y) * run.width + Math.floor(event.x)],
          });
        if (event.type === 'player.downed') firstDown ??= structuredClone(event);
        if (event.type === 'cut.started') cutStarts.push(structuredClone(event));
        if (event.type === 'powerup.collected') {
          const item =
            beforeItems.get(event.id) ??
            run.events.find(
              (candidate) => candidate.type === 'bonus.appeared' && candidate.id === event.id,
            );
          if (!item || !Number.isFinite(item.x) || !Number.isFinite(item.y))
            throw new Error('Collection evidence requires the actual item location.');
          collected.push({
            ...event,
            x: item.x,
            y: item.y,
            reclaimedBeforeContactStep: item.reclaimed ?? null,
            partnerCutting: event.players.some((i) => cutting[1 - i]),
          });
        }
        if (event.type === 'cut.closed') {
          if (event.reason === 'return') returns[event.player]++;
          const p = run.players[event.player];
          closures.push({
            tick: run.tick,
            player: event.player,
            reason: event.reason,
            x: p.x,
            y: p.y,
            freeze,
            slow,
            speed: speed[event.player],
            coverage: run.coverage,
          });
        }
      }
      for (const enemy of run.enemies)
        if (enemy.rover?.mode === 'active') {
          activated.add(enemy.id);
          if (!activatedAt.has(enemy.id)) activatedAt.set(enemy.id, run.tick);
        }
    }
  const neutralized = run.level.terrain.every((r) => {
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if (run.cells[y * run.width + x] !== SAFE) return false;
    return true;
  });
  return {
    status:
      failure ??
      (firstDown
        ? 'first-knockdown'
        : run.status === 'won'
          ? returns.every((n) => n > 0)
            ? 'shared-no-loss-clear'
            : 'single-contributor-clear'
          : 'route-exhausted'),
    tick: run.tick,
    coverage: run.coverage,
    returns,
    firstDown,
    collected,
    bonusEvents,
    bonusWindows,
    initialReserves,
    finalReserves: run.team.reserves,
    remainingBonuses: run.bonuses.items.map((item) => ({
      ...structuredClone(item),
      reclaimed: run.cells[Math.floor(item.y) * run.width + Math.floor(item.x)] === SAFE,
    })),
    closures,
    cutStarts,
    activated: [...activated].sort(),
    activatedAt: Object.fromEntries([...activatedAt].sort(([a], [b]) => a.localeCompare(b))),
    neutralized,
    simultaneousTicks,
    bothIdleTicks,
    longestJointIdleTicks,
    schedules: structuredClone(run.bonuses.timed.schedules),
    checkpoint: createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
  };
}
