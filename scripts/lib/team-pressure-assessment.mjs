import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, SAFE } from '../../game/coop/core.mjs';
import {
  createTeamFoundationEvidence,
  observeTeamFoundationGoal,
  inspectTeamFoundationGoal,
} from '../../game/test/helpers/team-foundation-goal.mjs';
import { inspectTeamMaterialGoal } from '../../game/test/helpers/team-material-goal.mjs';
import { inspectTeamRoamerGoal } from '../../game/test/helpers/team-roamer-goal.mjs';

const directions = new Set([null, 'up', 'down', 'left', 'right']);
const presets = new Set(['gentle', 'standard', 'expert']);

export function teamPressureGoal(run, evidence) {
  const common = run.status === 'won' && evidence.downs === 0 && evidence.closed.size === 2;
  if (run.level.id === 'twin-landings') return { achieved: common };
  if (run.level.id === 'shared-detour') {
    const neutralized = run.level.terrain.every((area) => {
      for (let y = area.y; y < area.y + area.h; y++)
        for (let x = area.x; x < area.x + area.w; x++)
          if (run.cells[y * run.width + x] !== SAFE) return false;
      return true;
    });
    return { achieved: common && neutralized, neutralized };
  }
  if (run.enemies.some((actor) => actor.type === 'claimed-rover'))
    return inspectTeamRoamerGoal(run, evidence);
  if (run.level.terrain?.length) return inspectTeamMaterialGoal(run, evidence);
  return inspectTeamFoundationGoal(run, evidence);
}

/** Public two-seat commands, no injected state and no artificial neutral brake.
 * This is deterministic local simulation evidence, not an official Team replay.
 * Stop at the FIRST knockdown, before shared reserves could hide the failure. */
export function assessTeamPressureRoute(
  level,
  segments,
  { jointCuts = true, swapped = false, delayTicks = 0 } = {},
) {
  if (typeof jointCuts !== 'boolean' || typeof swapped !== 'boolean')
    throw new TypeError('Team route switches must be boolean.');
  if (!Number.isSafeInteger(delayTicks) || delayTicks < 0 || delayTicks > 1200)
    throw new TypeError('Initial delay must be bounded whole ticks.');
  if (
    !Array.isArray(segments) ||
    !segments.length ||
    segments.some(
      (s) =>
        !s ||
        !directions.has(s.a) ||
        !directions.has(s.b) ||
        !Number.isSafeInteger(s.ticks) ||
        s.ticks < 1 ||
        s.ticks > 10000,
    ) ||
    segments.reduce((total, s) => total + s.ticks, delayTicks) > 36000
  )
    throw new TypeError('Team route requires valid bounded public-command segments.');
  const owned = structuredClone(level);
  if (swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { jointCuts, seed: 1 }));
  const evidence = createTeamFoundationEvidence(),
    events = [],
    closures = [0, 0];
  const closureReasons = [{}, {}];
  const exposureTicks = [0, 0],
    stationaryTicks = [0, 0];
  let simultaneousTicks = 0,
    stopped = null,
    firstClosures = [null, null],
    firstDown = null;
  observeTeamFoundationGoal(run, evidence);
  const tick = (a, b) => {
    const commands = swapped ? [b, a] : [a, b];
    if (
      commands.some((direction, seat) => direction === null && run.players[seat].direction !== null)
    ) {
      stopped = 'continuous-input-mismatch';
      return;
    }
    const before = run.players.map(({ x, y, cutting }) => ({ x, y, cutting }));
    stepCoop(
      run,
      commands.map((direction) => ({ direction, boost: false, support: false })),
    );
    events.push(...structuredClone(run.events));
    observeTeamFoundationGoal(run, evidence);
    for (const [seat, player] of run.players.entries()) {
      if (before[seat].cutting || player.cutting) exposureTicks[seat]++;
      if (before[seat].x === player.x && before[seat].y === player.y) stationaryTicks[seat]++;
    }
    if (run.players.every((p, seat) => p.cutting && commands[seat] !== null)) simultaneousTicks++;
    for (const event of run.events) {
      if (event.type === 'cut.closed') {
        closures[event.player]++;
        const counts = closureReasons[event.player];
        counts[event.reason] = (counts[event.reason] ?? 0) + 1;
        firstClosures[event.player] ??= run.tick;
      }
      if (event.type === 'player.downed') firstDown ??= structuredClone(event);
    }
    if (firstDown) stopped = 'first-knockdown';
  };
  const all = delayTicks ? [{ a: null, b: null, ticks: delayTicks }, ...segments] : segments;
  outer: for (const segment of all)
    for (let i = 0; i < segment.ticks; i++) {
      if (run.status !== 'running' || stopped) break outer;
      tick(segment.a, segment.b);
    }
  const status =
    stopped ??
    (run.status === 'won' && evidence.closed.size === 2
      ? 'shared-no-loss-clear'
      : run.status === 'won'
        ? 'single-contributor-clear'
        : 'route-exhausted');
  return {
    status,
    tick: run.tick,
    coverage: run.coverage,
    closures,
    closureReasons,
    firstClosures,
    simultaneousTicks,
    exposureTicks,
    stationaryTicks,
    firstDown,
    reserves: run.team.reserves,
    supportUses: run.players.map((p) => p.support.uses),
    jointEvents: events.filter((e) => e.type === 'cut.joint').length,
    meaningfulJointCuts: run.team.jointCuts,
    mastery: teamPressureGoal(run, evidence),
    checkpoint: createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
  };
}

export function teamRouteTemplates(fixtures, missionId, difficulty) {
  if (!presets.has(difficulty)) throw new Error('Unknown Team preset.');
  return fixtures
    .filter((row) => row.missionId === missionId)
    .sort((a, b) => Number(b.difficulty === difficulty) - Number(a.difficulty === difficulty));
}
