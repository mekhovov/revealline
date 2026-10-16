import test from 'node:test';
import assert from 'node:assert/strict';
import { loadBenchmarkCatalog } from '../../authoring/playable-benchmark/catalog.mjs';
import { createBenchmarkSession } from '../../authoring/playable-benchmark/session.mjs';
import { CLASSES, createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { dataIdentity } from '../data-json.mjs';

const catalog = await loadBenchmarkCatalog();
const classIds = ['scout', 'bomber', 'carrier', 'interceptor', 'fiber', 'impact', 'trapper'];
const route = [
  [60, 'right'],
  [90, 'down'],
  [60, 'left'],
  [30, 'up'],
];

// The ordinary host prepares createRun(applyGameplayTuning(level, tuning), options).
// Exercise that public core path independently, not the benchmark's private run.
function ordinary(manifest, classId) {
  return createRun(applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')), {
    seed: 1,
    classId,
    turnPolicy: 'immediate',
  });
}

function comparePlay(session, expected) {
  const actualEvents = [];
  session.start();
  for (const [ticks, direction] of route) {
    const input = { direction };
    for (let remaining = ticks; remaining > 0; ) {
      const frameTicks = Math.min(17, remaining),
        events = [];
      let advanced = 0;
      for (let tick = 0; tick < frameTicks && !['won', 'lost'].includes(expected.status); tick++) {
        stepRun(expected, input, FIXED_DT);
        events.push(...structuredClone(expected.events));
        advanced++;
      }
      assert.equal(session.advance(input, frameTicks * FIXED_DT), advanced);
      assert.deepEqual(authoritativeCheckpoint(session.run), authoritativeCheckpoint(expected));
      actualEvents.push(...events);
      remaining -= frameTicks;
    }
  }
  return actualEvents;
}

test('the qualification roster is exactly the seven current public-core classes', () => {
  assert.deepEqual(
    CLASSES.map(({ id }) => id),
    classIds,
  );
  assert.equal(catalog.entries.length, 3);
});

for (const classId of classIds) {
  test(`${classId}: all three real missions match fresh Standard core state, movement and Retry`, () => {
    for (const { manifest } of catalog.entries) {
      const before = JSON.stringify(manifest),
        expected = ordinary(manifest, classId),
        observed = [],
        session = createBenchmarkSession(manifest, {
          classId,
          onStep: (events) => observed.push(...structuredClone(events)),
        });
      try {
        assert.deepEqual(session.run, expected);
        assert.equal(session.run.activeClassId, classId);
        assert.equal(session.run.classRecipe.id, classId);
        assert.deepEqual(session.run.classRecipes, CLASSES);
        assert.equal(session.setup.classId, classId);
        assert.equal(session.setup.sourceSimulationIdentity, manifest.simulationIdentity);
        assert.equal(session.setup.runtimeLevelIdentity, dataIdentity(expected.level));
        assert.equal(session.setup.difficulty, 'standard');
        assert.equal(session.setup.adminOverride, false);
        assert.ok(Object.isFrozen(session.setup));

        const initial = authoritativeCheckpoint(expected);
        assert.equal(session.advance({ direction: 'down' }, 0.25), 0);
        assert.deepEqual(authoritativeCheckpoint(session.run), initial);
        const events = comparePlay(session, expected);
        assert.deepEqual(observed, events, 'Grouped frames retain the same real core events.');
        assert.ok(session.run.tick > 0);
        session.pause();
        const paused = authoritativeCheckpoint(session.run),
          retired = session.run;
        assert.equal(session.advance({ direction: 'right' }, 0.25), 0);
        assert.deepEqual(authoritativeCheckpoint(session.run), paused);

        assert.equal(session.retry(), true);
        assert.equal(session.playing, false);
        assert.notEqual(session.run, retired);
        assert.deepEqual(session.events, []);
        assert.deepEqual(authoritativeCheckpoint(session.run), initial);
        observed.length = 0;
        assert.deepEqual(comparePlay(session, ordinary(manifest, classId)), events);
        assert.deepEqual(observed, events);
        assert.deepEqual(authoritativeCheckpoint(retired), paused, 'Retry retires the old run.');
        assert.equal(JSON.stringify(manifest), before);
      } finally {
        session.dispose();
      }
    }
  });
}

test('Retry retains the selected class and owned tuned source after caller edits', () => {
  for (const classId of classIds) {
    const manifest = structuredClone(catalog.entries[1].manifest),
      options = { classId },
      session = createBenchmarkSession(manifest, options),
      initial = authoritativeCheckpoint(session.run),
      setup = session.setup;
    try {
      options.classId = classId === 'scout' ? 'carrier' : 'scout';
      options.seed = 99;
      manifest.level.rules.moveSpeed = 1;
      manifest.level.enemies.length = 0;
      manifest.level.revision = 'caller-edited';
      manifest.simulationIdentity = 'caller-edited';
      assert.throws(() => {
        session.setup.classId = options.classId;
      }, TypeError);
      for (let retry = 0; retry < 2; retry++) {
        session.start();
        session.advance({ direction: 'right' }, 0.1);
        assert.equal(session.retry(), true);
        assert.equal(session.setup, setup);
        assert.equal(session.setup.classId, classId);
        assert.equal(session.run.activeClassId, classId);
        assert.equal(session.playing, false);
        assert.deepEqual(authoritativeCheckpoint(session.run), initial);
      }
      session.dispose();
      assert.equal(session.retry(), false);
      assert.equal(session.start(), false);
      assert.equal(session.advance({ direction: 'right' }, 0.25), 0);
      assert.deepEqual(authoritativeCheckpoint(session.run), initial);
    } finally {
      session.dispose();
    }
  }
});

test('unknown classes reject instead of falling back and unsupported mission setup stays rejected', () => {
  const manifest = catalog.entries[0].manifest,
    before = JSON.stringify(manifest);
  for (const classId of [
    null,
    '',
    'SCOUT',
    'heavy-carrier',
    'team-pilot',
    0,
    [],
    {},
    Symbol('scout'),
  ])
    assert.throws(() => createBenchmarkSession(manifest, { classId }), /supported FPV classId/);
  for (const source of [
    null,
    { ...manifest, mode: 'team' },
    { ...manifest, mode: 'versus' },
    { ...manifest, difficulty: 'expert' },
  ])
    assert.throws(() => createBenchmarkSession(source, { classId: 'carrier' }), /standard Solo/);
  assert.throws(
    () =>
      createBenchmarkSession(
        { ...manifest, level: ordinary(manifest, 'carrier').level },
        { classId: 'carrier' },
      ),
    /exactly once/,
  );
  const defaults = createBenchmarkSession(manifest),
    ignored = createBenchmarkSession(manifest, {
      classId: 'carrier',
      seed: 99,
      turnPolicy: 'grid-center',
      classRecipes: [{ id: 'carrier', moveSpeedMultiplier: 999 }],
      gameplayTuning: { difficulty: 'expert', adminOverride: true },
    });
  try {
    assert.equal(defaults.setup.classId, 'scout');
    assert.deepEqual(defaults.run, ordinary(manifest, 'scout'));
    assert.deepEqual(ignored.run, ordinary(manifest, 'carrier'));
    assert.equal(ignored.setup.seed, 1);
    assert.equal(ignored.setup.turnPolicy, 'immediate');
    assert.equal(ignored.setup.adminOverride, false);
    assert.equal(JSON.stringify(manifest), before);
  } finally {
    defaults.dispose();
    ignored.dispose();
  }
});

for (const classId of classIds) {
  test(`${classId}: E/R/Boost cannot bypass any of the three authored Arcade policies`, () => {
    for (const { manifest } of catalog.entries) {
      assert.deepEqual(manifest.level.classic.arcadeActions, { version: 'arcade-actions.v1' });
      const session = createBenchmarkSession(manifest, { classId }),
        direct = ordinary(manifest, classId),
        directionsOnly = ordinary(manifest, classId),
        initialAbility = structuredClone(direct.ability),
        initial = authoritativeCheckpoint(direct),
        observed = [];
      try {
        session.start();
        for (let tick = 0; tick < 120; tick++) {
          const direction = tick < 60 ? 'right' : 'down',
            input = {
              direction,
              action: tick % 8 < 3,
              pickup: tick % 10 < 4,
              boost: tick % 12 < 8,
            };
          stepRun(direct, input, FIXED_DT);
          stepRun(directionsOnly, { direction }, FIXED_DT);
          assert.equal(session.advance(input, FIXED_DT), 1);
          observed.push(...structuredClone(session.run.events));
          assert.deepEqual(
            session.run,
            direct,
            'Benchmark retains ordinary public-core input semantics.',
          );
          assert.deepEqual(
            direct,
            directionsOnly,
            'Manual action, pickup and Boost change no movement, events or ability state.',
          );
        }
        assert.equal(session.run.tick, 120);
        assert.equal(session.run.activeClassId, classId);
        assert.equal(session.run.classRecipe.id, classId);
        assert.deepEqual(session.run.ability, initialAbility);
        assert.equal(
          observed.some(({ type }) =>
            ['ability.used', 'ability.rejected', 'pickup.collected', 'craft.redeployed'].includes(
              type,
            ),
          ),
          false,
        );
        session.pause();
        const paused = authoritativeCheckpoint(session.run);
        assert.equal(session.advance({ action: true, pickup: true, boost: true }, 0.25), 0);
        assert.deepEqual(authoritativeCheckpoint(session.run), paused);
        assert.equal(session.retry(), true);
        assert.equal(session.setup.classId, classId);
        assert.deepEqual(authoritativeCheckpoint(session.run), initial);
        assert.equal(session.playing, false);
        session.start();
        session.advance({ action: true, pickup: true, boost: true }, FIXED_DT);
        const retried = ordinary(manifest, classId);
        stepRun(retried, {}, FIXED_DT);
        assert.deepEqual(
          session.run,
          retried,
          'Retry retains both the class and the authored command filter.',
        );
      } finally {
        session.dispose();
      }
    }
  });
}
