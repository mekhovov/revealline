import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, FIXED_DT } from '../core/index.mjs';
import { dataIdentity } from '../data-json.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';

const catalog = await loadBenchmarkCatalog();
const manifest = (id) => catalog.entries.find((entry) => entry.id === id).manifest;
const tuning = resolveGameplayTuning('standard');
const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' };
const pressure = (run) => run.enemies.find((enemy) => enemy.id === 'carrier').classic.pressure;

// Current effective Standard inputs, not the older untuned artwork-benchmark
// traces. All transitions below come from public fixed-tick commands.
const fixtures = [
  {
    id: 'return-in-reserve',
    mode: 'trail-pursuit',
    runtimeIdentity: '7ef6a1852293e36a',
    route: [
      [100, 'right'],
      [100, 'down'],
      [67, 'left'],
    ],
    warning: 121,
    commit: 211,
    capture: 267,
    cells: 11,
    cooldown: 567,
    idleLoss: null,
    risky: [
      [100, 'right'],
      [265, 'down'],
    ],
    seeded: 310,
    resting: 315,
    failure: 365,
    prefix: [
      [100, 'right'],
      [21, 'down'],
    ],
    afterOneTick: [
      [78, 'down'],
      [67, 'left'],
    ],
    direction: 'down',
  },
  {
    id: 'crossed-bands',
    mode: 'head-intercept',
    runtimeIdentity: '87a8f61ced6a5bb5',
    route: [
      [240, null],
      [100, 'up'],
      [20, 'right'],
      [53, 'down'],
    ],
    warning: 289,
    commit: 379,
    capture: 413,
    cells: 8,
    cooldown: 713,
    idleLoss: 708,
    risky: [
      [240, null],
      [100, 'up'],
      [126, 'right'],
    ],
    seeded: 434,
    resting: 442,
    failure: 466,
    prefix: [
      [240, null],
      [49, 'up'],
    ],
    afterOneTick: [
      [50, 'up'],
      [20, 'right'],
      [53, 'down'],
    ],
    direction: 'up',
  },
];

function observed(id) {
  const events = [],
    ticks = new Map();
  let previous = null,
    turnedDuringLock = false;
  const session = createBenchmarkSession(manifest(id), {
    onStep(items, run) {
      const current = pressure(run);
      if (
        ['warning', 'committed'].includes(previous?.phase) &&
        ['warning', 'committed'].includes(current.phase)
      ) {
        assert.deepEqual(current.target, previous.target, 'Turning cannot retarget a live lock.');
        if (run.player.direction !== previous.direction) turnedDuringLock = true;
      }
      previous = {
        phase: current.phase,
        target: structuredClone(current.target),
        direction: run.player.direction,
      };
      events.push(...structuredClone(items));
      ticks.set(run.tick, {
        pressure: structuredClone(current),
        player: structuredClone(run.player),
        fronts: structuredClone(run.classic.lineImpact.fronts),
        lives: run.lives,
      });
    },
  });
  return { session, events, ticks, turned: () => turnedDuringLock };
}

function play(session, segments, frameTicks = 1) {
  session.start();
  for (const [ticks, direction] of segments) {
    let remaining = ticks;
    while (remaining) {
      const count = Math.min(frameTicks, remaining);
      assert.equal(session.advance({ direction }, count * FIXED_DT), count);
      remaining -= count;
    }
  }
}

function eventOf(trace, type) {
  const event = trace.events.find((item) => item.type === type);
  assert.ok(event, `Expected ${type}`);
  return event;
}

test('every benchmark mission uses one fresh default tuning recipe and keeps authored identity separate', () => {
  assert.equal(tuning.adminOverride, false);
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw new Error('Benchmark preparation must not read admin preferences');
    },
  });
  try {
    for (const { manifest: source } of catalog.entries) {
      const before = JSON.stringify(source);
      const expected = applyGameplayTuning(source.level, tuning);
      const session = createBenchmarkSession(source);
      try {
        assert.deepEqual(session.run, createRun(expected, options));
        assert.notEqual(dataIdentity(source.level), dataIdentity(session.run.level));
        assert.deepEqual(session.setup, {
          ...options,
          sourceSimulationIdentity: source.simulationIdentity,
          sourceRevision: source.level.revision,
          runtimeLevelIdentity: dataIdentity(expected),
          runtimeRevision: expected.revision,
          gameplayTuning: tuning.version,
          difficulty: 'standard',
          adminOverride: false,
        });
        assert.ok(Object.isFrozen(session.setup));
        assert.throws(() => createBenchmarkSession({ ...source, level: expected }), /exactly once/);
        assert.equal(JSON.stringify(source), before);
      } finally {
        session.dispose();
      }
    }
  } finally {
    if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
    else delete globalThis.localStorage;
  }
});

test('Retry owns the once-tuned setup even if the caller later edits its source manifest', () => {
  const source = structuredClone(manifest('return-in-reserve'));
  const session = createBenchmarkSession(source);
  const initial = authoritativeCheckpoint(session.run);
  const setup = session.setup;
  try {
    play(session, [
      [100, 'right'],
      [30, 'down'],
    ]);
    const retired = session.run,
      retiredCheckpoint = authoritativeCheckpoint(retired);
    source.level.rules.moveSpeed = 1;
    source.level.enemies.length = 0;
    source.level.revision = 'caller-edited';
    source.simulationIdentity = 'caller-edited';
    for (let retry = 0; retry < 2; retry++) {
      assert.equal(session.retry(), true);
      assert.equal(session.playing, false);
      assert.deepEqual(authoritativeCheckpoint(session.run), initial);
      assert.equal(session.setup, setup);
      assert.deepEqual(session.events, []);
      play(session, [[1, 'right']]);
    }
    assert.deepEqual(authoritativeCheckpoint(retired), retiredCheckpoint);
  } finally {
    session.dispose();
  }
});

for (const fixture of fixtures) {
  test(`${fixture.id}: observed aim stays locked through turns, commits on schedule and a real return cancels it`, () => {
    const trace = observed(fixture.id),
      { session } = trace;
    try {
      play(session, fixture.route);
      assert.equal(session.setup.runtimeLevelIdentity, fixture.runtimeIdentity);
      const warning = eventOf(trace, 'pressure.warning');
      const committed = eventOf(trace, 'pressure.committed');
      const cancelled = eventOf(trace, 'pressure.cancelled');
      assert.equal(warning.id, 'carrier');
      assert.equal(warning.mode, fixture.mode);
      assert.equal(warning.tick, fixture.warning);
      assert.equal(committed.tick, fixture.commit);
      assert.equal(warning.warningUntil - warning.actorTick, 90);
      assert.equal(committed.actorTick - warning.actorTick, 90);
      assert.equal(committed.commitUntil - committed.actorTick, 144);
      assert.equal(trace.ticks.get(fixture.commit - 1).pressure.phase, 'warning');
      assert.equal(trace.ticks.get(fixture.commit).pressure.phase, 'committed');
      assert.deepEqual(committed.target, warning.target);
      assert.ok(trace.turned(), 'A real post-warning turn exercises target locking.');
      const observedPlayer = trace.ticks.get(fixture.warning - 1).player;
      assert.equal(warning.target.x, observedPlayer.x);
      const expectedY =
        fixture.mode === 'head-intercept'
          ? observedPlayer.y - observedPlayer.speed * 36 * FIXED_DT
          : observedPlayer.y;
      assert.ok(
        Math.abs(warning.target.y - expectedY) < 1e-8,
        'Trail pursuit locks the observed trail; interception leads the observed heading.',
      );
      assert.equal(cancelled.tick, fixture.capture);
      assert.equal(cancelled.reason, 'trail-closed');
      assert.deepEqual(cancelled.target, warning.target, 'Cancellation records the retired lock.');
      assert.equal(cancelled.cooldownUntil, fixture.cooldown);
      assert.equal(cancelled.cooldownUntil - cancelled.actorTick, 300);
      assert.equal(eventOf(trace, 'cells.claimed').indices.length, fixture.cells);
      assert.equal(eventOf(trace, 'capture.stopped').tick, fixture.capture);
      assert.equal(session.run.lives, 3);
      assert.equal(session.run.player.cutting, false);
      assert.equal(pressure(session.run).target, null);
      assert.deepEqual(pressure(session.run).path, []);
      const stopped = { x: session.run.player.x, y: session.run.player.y };
      play(session, [[10, null]]);
      assert.deepEqual({ x: session.run.player.x, y: session.run.player.y }, stopped);
      play(session, [[289, null]]);
      assert.equal(pressure(session.run).phase, 'cooldown');
      play(session, [[1, null]]);
      assert.equal(pressure(session.run).phase, 'patrol');
      assert.equal(pressure(session.run).cooldownUntil, null);
      assert.equal(trace.events.filter((event) => event.type === 'pressure.warning').length, 1);
      const failures = trace.events.filter((event) => event.type === 'player.failed');
      if (fixture.idleLoss === null) assert.deepEqual(failures, []);
      else
        assert.deepEqual(
          failures.map(({ tick, actorId, cause }) => ({ tick, actorId, cause })),
          [{ tick: fixture.idleLoss, actorId: 'frontier', cause: 'enemy-player' }],
          'Carrier cooldown does not make reclaimed ground invulnerable to other patrols.',
        );
    } finally {
      session.dispose();
    }
  });

  test(`${fixture.id}: returning survives the same opening that an extended cut loses to the carrier`, () => {
    const safe = observed(fixture.id),
      risky = observed(fixture.id);
    try {
      play(safe.session, [...fixture.route, [fixture.failure - fixture.capture, null]]);
      play(risky.session, fixture.risky);
      assert.deepEqual(safe.session.setup, risky.session.setup);
      for (const type of ['pressure.warning', 'pressure.committed'])
        assert.deepEqual(eventOf(safe, type), eventOf(risky, type));
      assert.equal(safe.session.run.tick, risky.session.run.tick);
      assert.equal(safe.session.run.lives, 3);
      assert.equal(safe.session.run.claimedCount, fixture.cells);
      assert.equal(
        safe.events.some((event) => event.type === 'player.failed'),
        false,
      );
      assert.equal(risky.session.run.lives, 2);
      assert.equal(risky.session.run.claimedCount, 0);
      assert.equal(eventOf(risky, 'lineImpact.seeded').tick, fixture.seeded);
      assert.equal(eventOf(risky, 'pressure.cooldown').tick, fixture.resting);
      assert.ok(
        risky.ticks.get(fixture.resting).fronts.length > 0,
        'A carrier entering Rest does not erase its traveling trail impact.',
      );
      assert.equal(eventOf(risky, 'lineImpact.arrived').tick, fixture.failure);
      const failure = eventOf(risky, 'player.failed');
      assert.deepEqual(
        { tick: failure.tick, actorId: failure.actorId, cause: failure.cause },
        { tick: fixture.failure, actorId: 'carrier', cause: 'enemy-trail' },
      );
      assert.equal(eventOf(risky, 'lineImpact.cleared').reason, 'recovery');
    } finally {
      safe.session.dispose();
      risky.session.dispose();
    }
  });

  test(`${fixture.id}: frame grouping and a paused warning preserve exact deadlines and subsequent capture`, () => {
    const fixed = observed(fixture.id),
      grouped = observed(fixture.id);
    try {
      play(fixed.session, fixture.prefix);
      play(grouped.session, fixture.prefix, 17);
      const before = authoritativeCheckpoint(grouped.session.run);
      assert.deepEqual(before, authoritativeCheckpoint(fixed.session.run));
      assert.equal(pressure(grouped.session.run).phase, 'warning');
      const input = { direction: fixture.direction };
      assert.equal(grouped.session.advance(input, FIXED_DT / 2), 0);
      grouped.session.pause();
      assert.equal(grouped.session.advance(input, 0.25), 0);
      assert.deepEqual(authoritativeCheckpoint(grouped.session.run), before);
      grouped.session.start();
      assert.equal(
        grouped.session.advance(input, FIXED_DT / 2),
        0,
        'Resume discards the old partial frame rather than advancing a warning early.',
      );
      assert.equal(grouped.session.advance(input, FIXED_DT / 2), 1);
      assert.equal(fixed.session.advance(input, FIXED_DT), 1);
      play(fixed.session, fixture.afterOneTick);
      play(grouped.session, fixture.afterOneTick, 17);
      assert.deepEqual(
        authoritativeCheckpoint(grouped.session.run),
        authoritativeCheckpoint(fixed.session.run),
      );
      assert.deepEqual(grouped.events, fixed.events);
      assert.equal(eventOf(grouped, 'cells.claimed').tick, fixture.capture);
    } finally {
      fixed.session.dispose();
      grouped.session.dispose();
    }
  });
}

test('real self-contact during warning retires the lock and recovery cannot acquire a new one', () => {
  const trace = observed('return-in-reserve'),
    { session } = trace;
  try {
    play(session, [
      [30, 'down'],
      [1, 'up'],
    ]);
    assert.equal(eventOf(trace, 'pressure.warning').tick, 25);
    const failed = eventOf(trace, 'player.failed');
    assert.equal(failed.tick, 31);
    assert.equal(failed.cause, 'self-contact');
    const cancelled = eventOf(trace, 'pressure.cancelled');
    assert.equal(cancelled.tick, 31);
    assert.equal(cancelled.reason, 'recovery');
    assert.equal(cancelled.cooldownUntil, 331);
    assert.equal(pressure(session.run).target, null);
    assert.deepEqual(pressure(session.run).path, []);
    play(session, [[320, null]]);
    assert.equal(eventOf(trace, 'player.respawned').tick, 108);
    assert.equal(trace.events.filter((event) => event.type === 'pressure.warning').length, 1);
    assert.equal(
      trace.events.some((event) => event.type === 'pressure.committed'),
      false,
    );
    assert.equal(pressure(session.run).phase, 'patrol');
    assert.equal(session.run.lives, 2);
  } finally {
    session.dispose();
  }
});
