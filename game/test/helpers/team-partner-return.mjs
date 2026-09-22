import { createHash } from 'node:crypto';
import { createCoop, startCoop, stepCoop, SAFE } from '../../coop/core.mjs';

/** Evidence only: credit a partner return only on an earlier, unambiguously
 * attributed solo capture. Shared fill batches and foundations have no owner. */
export function measureTeamPartnerReturns(level, log, { swapped = false, jointCuts = false } = {}) {
  const owned = structuredClone(level);
  if (swapped) owned.spawns.reverse();
  const run = startCoop(createCoop(owned, { seed: 17, jointCuts }));
  const owner = new Int8Array(run.cells.length).fill(-1);
  const acquired = new Int32Array(run.cells.length).fill(-1);
  const events = [],
    returns = [],
    departures = [];
  let simultaneousTicks = 0;
  for (const segment of log) {
    if (!Number.isSafeInteger(segment.ticks) || segment.ticks < 1 || segment.ticks > 10000)
      throw new Error('Expected bounded whole fixed ticks.');
    for (let n = 0; n < segment.ticks && run.status === 'running'; n++) {
      const directions = swapped ? [segment.b, segment.a] : [segment.a, segment.b];
      for (const [seat, direction] of directions.entries())
        if (direction === null && run.players[seat].direction !== null)
          throw new Error('No artificial braking between closures.');
      stepCoop(
        run,
        directions.map((direction) => ({ direction, boost: false, support: false })),
      );
      events.push(...structuredClone(run.events));
      if (run.players.every((p) => p.cutting) && directions.every(Boolean)) simultaneousTicks++;
      for (const event of run.events) {
        if (event.type === 'cut.started')
          departures.push({
            tick: run.tick,
            player: event.player,
            cell: run.players[event.player].departureIndex,
          });
        if (event.type !== 'cut.closed' || event.reason !== 'return') continue;
        const cell = run.players[event.player].cellIndex;
        returns.push({
          tick: run.tick,
          player: event.player,
          cell,
          cells: event.cells,
          previousOwner: owner[cell],
          acquiredTick: acquired[cell],
          partnerReturn:
            run.cells[cell] === SAFE &&
            owner[cell] === 1 - event.player &&
            acquired[cell] < run.tick,
        });
      }
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
          acquired[cell] = run.tick;
        }
      }
      if (run.events.some((e) => e.type === 'player.downed')) return finish();
    }
  }
  return finish();
  function finish() {
    return {
      status: run.status,
      tick: run.tick,
      coverage: run.coverage,
      reserves: run.team.reserves,
      simultaneousTicks,
      returns,
      departures,
      firstDown: events.find((e) => e.type === 'player.downed') ?? null,
      players: run.players.map((p) => ({
        cell: p.cellIndex,
        cutting: p.cutting,
        direction: p.direction,
      })),
      rovers: run.enemies.filter((e) => e.rover).map((e) => ({ id: e.id, mode: e.rover.mode })),
      checkpoint: createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
    };
  }
}
