import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, SAFE } from '../../coop/core.mjs';
import { assessTeamPressureRoute } from '../../../scripts/lib/team-pressure-assessment.mjs';

/** Read-only measurements on a second fresh, identical public-input run.
 * Near-patrol samples and partner-ground reuse are evidence, not human enjoyment
 * scores or requirements that every mathematically possible route must satisfy. */
export function measureTeamRoamerSpatialRoute(level, log, options = {}) {
  const outcome = assessTeamPressureRoute(level, log, options);
  const owned = structuredClone(level);
  if (options.swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { seed: 1, jointCuts: options.jointCuts ?? true }));
  const events = [],
    actors = Object.fromEntries(
      run.enemies
        .filter((e) => e.type === 'claimed-rover')
        .map((e) => [
          e.id,
          {
            warningTick: null,
            activationTick: null,
            nearTicks: [0, 0],
            reclaimedNearTicks: [0, 0],
            postActivationReturns: [0, 0],
            laneExit: null,
            subsequentReturn: null,
          },
        ]),
    );
  const owner = new Int8Array(run.cells.length).fill(-1);
  const assignedTick = new Int32Array(run.cells.length).fill(-1);
  const partnerCells = [new Set(), new Set()];
  const segments = options.delayTicks
    ? [{ a: null, b: null, ticks: options.delayTicks }, ...log]
    : log;
  outer: for (const segment of segments)
    for (let tick = 0; tick < segment.ticks; tick++) {
      if (run.tick >= outcome.tick) break outer;
      const directions = options.swapped ? [segment.b, segment.a] : [segment.a, segment.b];
      const previousCells = run.players.map((p) => p.cellIndex);
      const previousPositions = run.players.map((p) => ({ x: p.x, y: p.y }));
      stepCoop(
        run,
        directions.map((direction) => ({ direction, boost: false, support: false })),
      );
      events.push(...structuredClone(run.events));
      for (const event of run.events) {
        if (event.type === 'rover.warning') actors[event.id].warningTick ??= event.tick;
        if (event.type === 'rover.activated') actors[event.id].activationTick ??= event.tick;
        if (event.type === 'cut.closed' && event.reason === 'return')
          for (const record of Object.values(actors))
            if (record.activationTick !== null && event.tick > record.activationTick) {
              record.postActivationReturns[event.player]++;
              if (
                record.laneExit &&
                event.player === record.laneExit.seat &&
                event.tick >= record.laneExit.tick
              )
                record.subsequentReturn ??= structuredClone(event);
            }
      }
      for (const enemy of run.enemies) {
        const record = actors[enemy.id];
        if (!record || enemy.rover.mode !== 'active' || record.laneExit) continue;
        const original = level.enemies.find((e) => e.id === enemy.id);
        const seat = owned.spawns.reduce(
          (best, p, index) =>
            Math.abs(p.x - original.x) < Math.abs(owned.spawns[best].x - original.x) ? index : best,
          0,
        );
        const before = previousPositions[seat],
          after = run.players[seat];
        if (Math.abs(before.y - original.y) <= 0.5 && Math.abs(after.y - original.y) > 0.5)
          record.laneExit = {
            tick: run.tick,
            seat,
            command: directions[seat],
            from: before,
            to: { x: after.x, y: after.y },
            roamer: { x: enemy.x, y: enemy.y },
            separation: Math.hypot(after.x - enemy.x, after.y - enemy.y),
            cutting: after.cutting,
          };
      }
      // Attribute only unambiguous solo returns. A joint/assisted batch is not
      // silently awarded to one craft merely to report apparent cooperation.
      for (let i = 0; i < run.events.length; i++) {
        const event = run.events[i];
        if (event.type !== 'cells.claimed') continue;
        const closers = [];
        for (let j = i + 1; j < run.events.length && run.events[j].type !== 'cells.claimed'; j++)
          if (run.events[j].type === 'cut.closed') closers.push(run.events[j]);
        const seat =
          closers.length === 1 && closers[0].reason === 'return' ? closers[0].player : -2;
        for (const cell of event.indices) {
          owner[cell] = seat;
          assignedTick[cell] = run.tick;
        }
      }
      for (const player of run.players) {
        const cell = player.cellIndex;
        if (
          cell !== previousCells[player.id] &&
          owner[cell] === 1 - player.id &&
          assignedTick[cell] < run.tick &&
          run.cells[cell] === SAFE
        )
          partnerCells[player.id].add(cell);
        for (const enemy of run.enemies) {
          const record = actors[enemy.id];
          if (!record || enemy.rover.mode !== 'active') continue;
          if (Math.hypot(player.x - enemy.x, player.y - enemy.y) <= 6) {
            record.nearTicks[player.id]++;
            if (run.cells[cell] === SAFE) record.reclaimedNearTicks[player.id]++;
          }
        }
      }
    }
  assert.equal(
    createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
    outcome.checkpoint,
  );
  return {
    ...outcome,
    encounter: Object.entries(actors).map(([id, record]) => ({
      id,
      ...record,
      activeTicksBeforeFinish:
        record.activationTick === null ? 0 : run.tick - record.activationTick - 1,
    })),
    partnerGroundCells: partnerCells.map((cells) => [...cells].sort((a, b) => a - b)),
  };
}
