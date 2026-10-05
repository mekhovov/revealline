import test from 'node:test';
import assert from 'node:assert/strict';
import { createOverflightBenchmark } from '../overflight/benchmark.mjs';
import { summarizeOverflightTrials } from '../overflight/trial-report.mjs';
function trial(id) {
  const meter = createOverflightBenchmark({
    warmupSeconds: 30,
    measurementSeconds: 120,
    repetitions: 1,
    stopAtEnd: true,
  });
  for (let i = 0; i <= 9001; i++) meter.frame((i * 1000) / 60);
  return {
    format: 'OverflightMeasurementsV1',
    benchmarkTrial: String(id),
    capturedAt: `trial-${id}`,
    browser: 'test browser',
    projectIdentity: 'test project',
    appearance: { identity: 'test' },
    fixture: 'reference',
    seed: 42,
    viewport: { width: 1920, height: 1080 },
    trialValid: true,
    invalidReasons: [],
    renderer: meter.snapshot({ raw: true }),
    resourceSamples: Array.from({ length: 10 }, () => ({
      alive: 1500,
      visible: 700,
      canvasCount: 1,
    })),
  };
}
test('three separately warmed trials are accepted from raw intervals', () => {
  const report = summarizeOverflightTrials([trial(1), trial(2), trial(3)]);
  assert.equal(report.valid, true);
  assert.equal(report.passes, true);
});
test('duplicates, changed seeds, interruptions and missing actors cannot qualify', () => {
  for (const mutate of [
    (records) => {
      records[2] = records[1];
    },
    (records) => {
      records[1].seed = 43;
    },
    (records) => {
      records[1].trialValid = false;
    },
    (records) => {
      records[1].resourceSamples[0].visible = 64;
    },
    (records) => {
      records[1].renderer.protocol.repetitions = 3;
    },
    (records) => {
      records[1].renderer.rawIntervals = [];
    },
  ]) {
    const records = [trial(1), trial(2), trial(3)];
    mutate(records);
    assert.equal(summarizeOverflightTrials(records).valid, false);
    assert.equal(summarizeOverflightTrials(records).passes, false);
  }
});

function raidTrial(id, fixture) {
  const record = trial(id);
  record.format = 'OverflightHuntMeasurementsV1';
  record.fixture = 'raid-reference';
  record.seed = fixture.seed;
  record.projectIdentity = fixture.compiled.projectIdentity;
  record.summary = overflightHuntSummary(fixture);
  record.resourceSamples = Array.from({ length: 10 }, () => ({
    alive: OVERFLIGHT_HUNT_BENCHMARK_TARGET.alive,
    visible: OVERFLIGHT_HUNT_BENCHMARK_TARGET.visible,
    canvasCount: 1,
  }));
  return record;
}

import {
  OVERFLIGHT_HUNT_BENCHMARK_TARGET,
  overflightBenchmarkTarget,
} from '../overflight/benchmark.mjs';
import {
  createOverflightHuntProject,
  compileOverflightHuntProject,
} from '../overflight/raid-project.mjs';
import { createOverflightHuntRun, overflightHuntSummary } from '../overflight/raid-core.mjs';

const raidFixture = () =>
  createOverflightHuntRun(compileOverflightHuntProject(createOverflightHuntProject()), {
    fixture: 'raid-reference',
  });

test('Raid qualification binds exact default-content population and technical-workload metadata', () => {
  const run = raidFixture();
  assert.deepEqual(OVERFLIGHT_HUNT_BENCHMARK_TARGET, { alive: 537, visible: 200 });
  assert.equal(
    run.enemies.filter((enemy) => enemy.active).length,
    OVERFLIGHT_HUNT_BENCHMARK_TARGET.alive,
  );
  assert.equal(run.stats.enemiesVisible, OVERFLIGHT_HUNT_BENCHMARK_TARGET.visible);
  const report = summarizeOverflightTrials([1, 2, 3].map((id) => raidTrial(id, run)));
  assert.equal(report.valid, true);
  assert.equal(report.passes, true);
  assert.deepEqual(report.workload, OVERFLIGHT_HUNT_BENCHMARK_TARGET);
  assert.match(report.scope, /Normal sorties do not recycle actors/);
  assert.match(report.scope, /does not establish normal-run pacing/);
});

test('Raid rejects mixed formats, altered populations and claims of ordinary gameplay qualification', () => {
  const fixture = raidFixture();
  for (const mutate of [
    (record) => {
      record.format = 'OverflightMeasurementsV1';
    },
    (record) => {
      record.summary.outcome = 'won';
    },
    (record) => {
      record.summary.fixtureWorkload.gameplayResult = true;
    },
    (record) => {
      record.summary.fixtureWorkload.alive--;
    },
    (record) => {
      record.summary.fixtureWorkload.visible--;
    },
    (record) => {
      record.summary.fixtureWorkload.progressionPolicy = 'ordinary';
    },
    (record) => {
      record.summary.fixtureWorkload.partitionWrapping = false;
    },
    (record) => {
      record.summary.fixtureWorkload.movingContactCollisions = false;
    },
    (record) => {
      record.summary.fixtureWorkload.independentProjectiles = false;
    },
    (record) => {
      record.resourceSamples[4].alive--;
    },
    (record) => {
      record.resourceSamples[5].visible--;
    },
    (record) => {
      record.resourceSamples[2].canvasCount = 2;
    },
    (record) => {
      record.trialValid = false;
    },
    (record) => {
      record.summary = null;
    },
  ]) {
    const records = [1, 2, 3].map((id) => raidTrial(id, fixture));
    mutate(records[1]);
    const report = summarizeOverflightTrials(records);
    assert.equal(report.valid, false);
    assert.equal(report.passes, false);
  }
});

test('unknown fixture names cannot resolve through tuning constants or object prototypes', () => {
  for (const fixture of ['raid', 'cadenceP95Ms', '__proto__', 'constructor', undefined]) {
    assert.equal(overflightBenchmarkTarget(fixture), null);
    const records = [trial(1), trial(2), trial(3)];
    records[0].fixture = fixture;
    const report = summarizeOverflightTrials(records);
    assert.equal(report.valid, false);
    assert.ok(report.trials[0].reasons.includes('Unknown fixture.'));
  }
});

test('short ordinary Raid runs cannot masquerade as completed fixture trials', () => {
  const records = [1, 2, 3].map((id) => raidTrial(id, raidFixture()));
  const short = createOverflightBenchmark({
    warmupSeconds: 30,
    measurementSeconds: 120,
    repetitions: 1,
  });
  for (let frame = 0; frame < 3600; frame++) short.frame((frame * 1000) / 60);
  records[0].renderer = short.snapshot({ raw: true });
  const report = summarizeOverflightTrials(records);
  assert.equal(report.valid, false);
  assert.equal(report.passes, false);
  assert.ok(report.trials[0].reasons.includes('Incomplete measurement.'));
});
