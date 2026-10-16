import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataIdentity } from '../../data-json.mjs';
import { compileContentProject, resolveMission } from '../../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop, SAFE } from '../../coop/core.mjs';
import { perimeterConnectedFoundations } from './team-foundation-goal.mjs';
import { replayTeamCommands } from './coop-win.mjs';
import { assessTeamTimedRoute } from './team-timed-route.mjs';

const fixture = JSON.parse(
  await readFile(new URL('../fixtures/current-team-specialized-host-routes.json', import.meta.url)),
);
assert.equal(fixture.format, 'CurrentTeamSpecializedHostRoutesV1');
assert.equal(fixture.ruleset, 'gameplay-pressure.v4');
assert.equal(fixture.seed, 17);

function fixedTickEvent(event) {
  const result = { ...event };
  delete result.time;
  return result;
}

function inside(level, cell, foundation) {
  const rect = level.safeRects[foundation],
    x = cell % level.width,
    y = Math.floor(cell / level.width);
  return x >= rect.x && x < rect.x + rect.w && y >= rect.y && y < rect.y + rect.h;
}

// Current host routes are independently rehearsed against the approved tuning.
// The earlier authored-rule histories and their checkpoints remain unchanged.
export function specializedTeamRoute(source, missionId, difficulty, kind) {
  const authored = resolveMission(compileContentProject(source), missionId, {
    mode: 'team',
    difficulty,
  }).level;
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const row = fixture.rows.find(
    (item) =>
      item.kind === kind &&
      item.sourceId === source.id &&
      item.sourceRevision === source.revision &&
      item.missionId === missionId &&
      item.difficulty === difficulty &&
      item.authoredIdentity === dataIdentity(authored) &&
      item.tunedIdentity === dataIdentity(level),
  );
  assert(row, `Exact specialized route required: ${kind}/${source.id}/${missionId}/${difficulty}`);
  const run = startCoop(createCoop(level, { difficulty, seed: fixture.seed }));
  const initialReserves = run.team.reserves;
  const commands = [],
    events = [],
    banks = [],
    departures = [],
    states = [];
  const owner = new Int8Array(run.cells.length).fill(-1);
  const acquired = new Int32Array(run.cells.length).fill(-1);
  const partnerReturns = [];
  let released = [];
  for (const segment of row.segments)
    for (let index = 0; index < segment.ticks; index++) {
      const input = [segment.a, segment.b].map((direction) => ({
        direction,
        boost: false,
        support: false,
      }));
      for (const [seat, command] of input.entries())
        assert(
          command.direction !== null || run.players[seat].direction === null,
          'No artificial neutral brake.',
        );
      for (const seat of released)
        assert.equal(input[seat].direction, null, 'Real banks require the public release tick.');
      stepCoop(run, input);
      commands.push(input);
      events.push(...structuredClone(run.events));
      released = run.events
        .filter((event) => event.type === 'cut.closed')
        .map((event) => event.player);
      for (const event of run.events) {
        if (event.type === 'cut.closed')
          banks.push({
            ...fixedTickEvent(event),
            cell: run.players[event.player].cellIndex,
            innerConnected: perimeterConnectedFoundations(run).has(3),
            coverage: run.coverage,
          });
        if (event.type === 'cut.started')
          departures.push({
            ...fixedTickEvent(event),
            cell: run.players[event.player].departureIndex,
            innerConnected: perimeterConnectedFoundations(run).has(3),
          });
      }
      for (const event of run.events) {
        if (event.type !== 'cut.closed' || event.reason !== 'return') continue;
        const cell = run.players[event.player].cellIndex;
        if (
          run.cells[cell] === SAFE &&
          owner[cell] === 1 - event.player &&
          acquired[cell] < run.tick
        )
          partnerReturns.push({ player: event.player, tick: run.tick, cell });
      }
      for (let index = 0; index < run.events.length; index++) {
        const event = run.events[index];
        if (event.type !== 'cells.claimed') continue;
        const closers = [];
        for (
          let next = index + 1;
          next < run.events.length && run.events[next].type !== 'cells.claimed';
          next++
        )
          if (run.events[next].type === 'cut.closed') closers.push(run.events[next]);
        const seat =
          closers.length === 1 && closers[0].reason === 'return' ? closers[0].player : -2;
        for (const cell of event.indices) {
          owner[cell] = seat;
          acquired[cell] = run.tick;
        }
      }
      if (run.events.some((event) => event.type === 'cut.closed' || event.type === 'cut.started'))
        states.push({ tick: run.tick, coverage: run.coverage, reserves: run.team.reserves });
    }
  assert(!events.some((event) => event.type === 'player.downed'));
  assert.equal(run.status, row.status);
  assert.equal(run.tick, row.tick);
  assert.equal(run.coverage, row.coverage);
  assert.deepEqual(
    [0, 1].map((seat) => banks.filter((event) => event.player === seat).length),
    row.closed,
  );
  assert.deepEqual(banks.slice(0, 2), row.banks);
  assert.deepEqual(departures.slice(0, 2), row.departures);
  assert.deepEqual(states, row.states);
  assert.deepEqual(
    commands[0].map((command) => command.direction),
    [null, null],
  );
  if (kind.startsWith('inner-')) {
    assert.equal(banks[0].player, 1);
    assert.equal(banks[0].reason, 'return');
    assert(inside(level, banks[0].cell, 3), 'First bank reaches the isolated inner foundation.');
    assert.equal(departures[1].player, 1);
    assert(inside(level, departures[1].cell, 3), 'Pilot redeparts from that inner foundation.');
    assert(banks[0].tick < departures[1].tick && departures[1].tick < banks[1].tick);
    assert.equal(banks[1].player, 1);
    assert.equal(banks[1].reason, 'return');
    assert(inside(level, banks[1].cell, 1), 'A second useful bank returns to home foundation.');
    assert(banks[1].coverage > banks[0].coverage);
    assert(
      [banks[0], departures[1], banks[1]].every((event) => event.innerConnected === false),
      'Inner use must precede perimeter connection.',
    );
  }
  if (kind === 'partner-full') {
    assert.deepEqual(
      [...new Set(partnerReturns.map((event) => event.player))].sort(),
      [0, 1],
      'Both pilots bank on cells earned earlier by the partner.',
    );
    for (const event of partnerReturns)
      assert(
        !level.safeRects.some((rect, index) => inside(level, event.cell, index)),
        'A permanent foundation cannot count as a partner return.',
      );
    assert.equal(run.status, 'won');
  }
  if (kind.endsWith('pickup-free')) {
    assert(!events.some((event) => event.type === 'powerup.collected'));
    assert(row.closed.every((count) => count >= 3));
    if (kind === 'depot-pickup-free')
      assert(
        run.enemies.filter((enemy) => enemy.rover).every((enemy) => enemy.rover.mode === 'active'),
        'Pickup-free Depot route activates both patrols.',
      );
  }
  return {
    run,
    commands,
    events,
    states,
    banks,
    departures,
    partnerReturns,
    initialReserves,
    row,
    level,
  };
}

export function playSpecializedTeamRoute(
  f,
  source,
  missionId,
  difficulty,
  kind,
  afterTick = () => {},
) {
  const reference = specializedTeamRoute(source, missionId, difficulty, kind);
  const states = new Map(reference.states.map((state) => [state.tick, state]));
  let tick = 1;
  const frames = replayTeamCommands(f, reference.commands.slice(1), () => {
    tick++;
    assert.doesNotMatch(f.$('coop-message').textContent, /needs a rescue|reserve used/);
    const reserves =
      reference.initialReserves +
      reference.events
        .filter(
          (event) =>
            event.type === 'powerup.collected' &&
            event.kind === 'extra-life' &&
            (event.activationTick ?? event.tick + 1) <= tick,
        )
        .reduce((sum, event) => sum + event.gain, 0);
    assert.equal(
      f.$('coop-reserves').textContent,
      `${reserves} reserve${reserves === 1 ? '' : 's'}`,
    );
    if (states.has(tick))
      assert.equal(
        f.$('coop-coverage').textContent,
        `${(states.get(tick).coverage * 100).toFixed(1)}%`,
      );
    afterTick(tick, reference);
  });
  assert.equal(frames + 1, reference.run.tick);
  assert.equal(f.$('coop-coverage').textContent, `${(reference.run.coverage * 100).toFixed(1)}%`);
  assert.equal(f.$('coop-overlay').hidden, reference.run.status === 'running');
  if (reference.run.status === 'won')
    assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
  assert.deepEqual(f.visits, []);
  return reference;
}

export function playSpecializedTeamBonusRoute(f, source, missionId, difficulty, kind) {
  const reference = specializedTeamRoute(source, missionId, difficulty, kind);
  const bonus = assessTeamTimedRoute(reference.level, reference.row.segments, {
    seed: 17,
    jointCuts: true,
    observeBonusWindows: true,
  });
  assert.equal(bonus.status, 'shared-no-loss-clear');
  assert.equal(bonus.tick, reference.run.tick);
  assert.equal(bonus.firstDown, null);
  assert(bonus.returns.every((count) => count >= 3));
  assert.equal(bonus.collected.length, 1);
  const item = bonus.collected[0];
  assert.equal(item.activationTick, item.tick + 1);
  assert.equal(bonus.finalReserves, bonus.initialReserves);
  const expectedKind = kind.startsWith('window-')
    ? 'enemy-slow'
    : kind.startsWith('coolant-')
      ? 'enemy-freeze'
      : 'player-speed';
  assert.equal(item.kind, expectedKind);
  const effect =
    expectedKind === 'enemy-slow' ? 'slow' : expectedKind === 'enemy-freeze' ? 'freeze' : 'speed';
  assert(
    bonus.closures.some(
      (event) => event.reason === 'return' && event.tick > item.tick && event[effect],
    ),
    'A real return uses the collected effect.',
  );
  if (kind === 'window-cooperation') {
    assert.equal(item.partnerCutting, true);
    assert.equal(item.reclaimedBeforeContactStep, false);
    assert(
      bonus.closures.some(
        (event) =>
          event.reason === 'return' &&
          event.player !== item.players[0] &&
          event.tick > item.tick &&
          event.slow,
      ),
      'Partner banks during the shared slow.',
    );
  } else {
    const windows = bonus.bonusWindows.filter((event) => event.id === item.id);
    const first = windows.find((event) => event.type === 'bonus.appeared');
    const expired = windows.find((event) => event.type === 'bonus.expired');
    const second = windows.find(
      (event) => event.type === 'bonus.appeared' && event.tick > expired?.tick,
    );
    assert(first && expired && second);
    assert(first.tick < expired.tick && expired.tick < second.tick && second.tick < item.tick);
    assert.notDeepEqual(
      [first.x, first.y],
      [second.x, second.y],
      'Recovery collects the relocated anchor.',
    );
    assert.deepEqual([item.x, item.y], [second.x, second.y]);
    assert(item.tick < second.tick + 1200, 'Use the second appearance, not a later substitute.');
    if (kind === 'depot-relocation') {
      assert.deepEqual(item.players, [1]);
      assert.deepEqual([item.x, item.y], [19.5, 6.5]);
      const speedBanks = bonus.closures.filter(
        (event) =>
          event.player === 1 && event.reason === 'return' && event.tick > item.tick && event.speed,
      );
      assert(speedBanks.length >= 2);
      const exact = reference.banks.filter((event) =>
        speedBanks.slice(0, 2).some((bank) => bank.tick === event.tick + 1),
      );
      assert(inside(reference.level, exact[0].cell, 2));
      assert(inside(reference.level, exact[1].cell, 3));
      assert(
        reference.departures.some(
          (event) => event.player === 1 && event.tick > exact[0].tick && event.tick < exact[1].tick,
        ),
      );
    }
  }
  const effectPattern =
    expectedKind === 'enemy-slow'
      ? /^Enemies slow \d+s$/
      : expectedKind === 'enemy-freeze'
        ? /^Enemies frozen \d+s$/
        : /^Pilot 2 speed \d+s$/;
  const transitions = [];
  let firstEffect = null;
  const result = playSpecializedTeamRoute(f, source, missionId, difficulty, kind, (tick) => {
    const live = f.$('coop-bonus-live').textContent;
    const phase = live.split(' · ').some((part) => effectPattern.test(part)) ? 'effect' : live;
    if (transitions.at(-1)?.phase !== phase) transitions.push({ tick, phase });
    if (firstEffect === null && phase === 'effect') {
      firstEffect = tick;
      assert.match(
        f.$('coop-message').textContent,
        new RegExp(`^${['Sunflower', 'Skyline'][item.players[0]]} collected`),
      );
    }
  });
  assert.equal(firstEffect, item.activationTick);
  if (kind === 'window-relocation' || kind === 'coolant-relocation') {
    const expected = [
      { tick: 2, phase: '' },
      ...bonus.bonusWindows.slice(0, 5).map((event) => ({
        tick: event.tick + 1,
        phase:
          event.type === 'bonus.announced'
            ? 'Pickup incoming'
            : event.type === 'bonus.appeared'
              ? '1 timed pickup available'
              : '',
      })),
    ];
    assert.deepEqual(
      transitions.slice(0, 6),
      expected,
      'The live status covers announcement, availability, expiry and relocated availability.',
    );
  }
  return { ...result, bonus, transitions };
}

export function playSpecializedTeamReserveRoute(f, source, missionId, difficulty) {
  const kind = 'depot-reserve';
  const reference = specializedTeamRoute(source, missionId, difficulty, kind);
  const bonus = assessTeamTimedRoute(reference.level, reference.row.segments, {
    seed: 17,
    jointCuts: true,
    observeBonusWindows: true,
  });
  assert.equal(bonus.status, 'shared-no-loss-clear');
  assert.equal(bonus.tick, reference.run.tick);
  assert.equal(bonus.firstDown, null);
  assert(bonus.returns.every((count) => count >= 5));
  assert.equal(bonus.collected.length, 1);
  const item = bonus.collected[0];
  assert.deepEqual(
    [
      item.id,
      item.kind,
      item.players,
      item.x,
      item.y,
      item.gain,
      item.partnerCutting,
      item.reclaimedBeforeContactStep,
    ],
    ['depot-reserve', 'extra-life', [0], 52.5, 7.5, 1, true, false],
  );
  assert.equal(bonus.finalReserves, bonus.initialReserves + 1);
  const windows = bonus.bonusWindows.filter((event) => event.id === item.id);
  const first = windows.find((event) => event.type === 'bonus.appeared');
  const expiry = windows.find((event) => event.type === 'bonus.expired');
  const second = windows.find(
    (event) => event.type === 'bonus.appeared' && event.tick > expiry?.tick,
  );
  assert(first && expiry && second);
  assert(first.tick < expiry.tick && expiry.tick < second.tick && second.tick < item.tick);
  assert.notDeepEqual([first.x, first.y], [second.x, second.y]);
  assert.deepEqual([second.x, second.y], [item.x, item.y]);
  assert(item.tick < second.tick + 1200);
  const returns = [0, 1].map((seat) =>
    bonus.closures.find(
      (event) => event.player === seat && event.reason === 'return' && event.tick > item.tick,
    ),
  );
  assert(
    returns.every((event) => event && event.coverage < 0.6),
    'Both pilots bank with meaningful territory remaining.',
  );
  assert(
    bonus.closures.some((event) => event.tick > Math.max(...returns.map((event) => event.tick))),
  );
  let observed = false;
  const result = playSpecializedTeamRoute(f, source, missionId, difficulty, kind, (tick) => {
    if (tick !== item.tick + 1) return;
    observed = true;
    assert.equal(f.$('coop-message').textContent, 'Sunflower: one shared reserve gained.');
    assert.equal(f.$('coop-state-1').textContent, 'Line exposed');
  });
  assert(observed, 'The actual host reaches the reserve contact frame.');
  return { ...result, bonus };
}
