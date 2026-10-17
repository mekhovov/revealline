import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  DEFAULT_ADVANCED_TUNE,
  createAdvancedController,
  validateAdvancedTune,
} from '../../optional-practice/civilian-fpv/advanced-controller.mjs';
import { ADVANCED_QUALIFICATION } from '../../optional-practice/civilian-fpv/advanced-simulation.mjs';
import {
  compareAdvancedRuntimes,
  runAdvancedDeterminismQualification,
  runAdvancedTimingQualification,
} from './helpers/fpv-advanced-qualification.mjs';
import { advancedQualificationSources } from '../../scripts/qualify-fpv-advanced.mjs';

test('cross-runtime fixture covers collisions and restores complete simulation history exactly', async () => {
  const first = await runAdvancedDeterminismQualification();
  const second = await runAdvancedDeterminismQualification();
  assert.deepEqual(compareAdvancedRuntimes(first, second), { matched: true, differences: [] });
  const golden = JSON.parse(
    await readFile(new URL('./fixtures/fpv-advanced-runtime-v2.json', import.meta.url)),
  );
  for (const field of ['backend', 'identity', 'initialHash', 'hashes', 'finalHash'])
    assert.deepEqual(first[field], golden[field], `Published v2 ${field} fixture`);
  assert.equal(first.hashes.length, 20);
  assert.equal(first.consumedInputs.length, 200);
  assert.equal(first.contact.blocked, true);
  assert.ok(Object.values(first.checks).every(Boolean));
  for (const field of [
    'backend',
    'frequency',
    'identity',
    'initialHash',
    'hashes',
    'finalHash',
    'consumedInputs',
    'finalTelemetry',
    'contact',
    'checks',
  ]) {
    const changed = { ...second, [field]: null };
    assert.deepEqual(compareAdvancedRuntimes(first, changed), {
      matched: false,
      differences: [field],
    });
  }
});

test('all three default-template axes pass fixed-frequency numerical gates against coupled 2 kHz', async () => {
  const report = await runAdvancedTimingQualification({ repetitions: 2 });
  assert.equal(report.reference.frequency, 2000);
  assert.equal(report.frozenExperimentalDefaultHz, 250);
  for (const candidate of report.candidates) {
    assert.equal(
      candidate.accuracyPass,
      true,
      `${candidate.frequency} Hz three-axis numerical gate`,
    );
    assert.equal(candidate.contactsPass, true);
    assert.equal(candidate.repetitionPass, true);
    assert.deepEqual(Object.keys(candidate.axes), ['roll', 'pitch', 'yaw']);
    for (const axis of Object.values(candidate.axes)) {
      assert.equal(axis.elapsedMs.length, 2);
      for (const error of Object.values(axis.relativeErrors)) assert.ok(error <= 0.02);
    }
  }
  // Wall-clock performance is evidence, not a flaky unit assertion on busy CI.
  assert.equal(ADVANCED_QUALIFICATION.scored, false);
  assert.equal(ADVANCED_QUALIFICATION.defaultEligible, false);
});

test('finite feedforward bandwidth prevents physics-frequency-dependent yaw impulse saturation', () => {
  for (const dt of [1 / 250, 1 / 500, 1 / 1000, 1 / 2000]) {
    const controller = createAdvancedController();
    const input = {
      controls: { roll: 0, pitch: 0, yaw: 0.25, throttle: 0.5 },
      target: { roll: 0, pitch: 0, yaw: 100, throttle: 0.5 },
      sensors: { roll: 0, pitch: 0, yaw: 0 },
      dt,
    };
    const first = controller.step(input);
    assert.equal(first.saturated, false);
    const saved = controller.snapshot();
    assert.ok(saved.state.feedforward.yaw > 0);
    const continued = controller.step(input);
    controller.restore(saved);
    assert.deepEqual(controller.step(input), continued);
  }
});

test('old tune migration preserves explicit unfiltered feedforward and rejects ambiguous fields', () => {
  const old = structuredClone(DEFAULT_ADVANCED_TUNE);
  old.format = 'AdvancedControllerTune.v1';
  delete old.feedforwardFilterHz;
  const migrated = validateAdvancedTune(old);
  assert.equal(old.format, 'AdvancedControllerTune.v1');
  assert.equal(migrated.format, 'AdvancedControllerTune.v2');
  assert.equal(migrated.feedforwardFilterHz, 0);
  assert.equal(DEFAULT_ADVANCED_TUNE.feedforwardFilterHz, 30);
  assert.throws(
    () => validateAdvancedTune({ ...old, feedforwardFilterHz: 30 }),
    /legacy feedforward/,
  );
  assert.throws(
    () => validateAdvancedTune({ ...migrated, feedforwardFilterHz: -1 }),
    /Filter cutoff/,
  );
  assert.throws(
    () => validateAdvancedTune({ ...migrated, feedforwardFilterHz: 1001 }),
    /Filter cutoff/,
  );
});

test('qualification pins the real worker and complete shared physics dependency closure', async () => {
  const sources = await advancedQualificationSources();
  for (const required of [
    'optional-practice/civilian-fpv/advanced-controller.mjs',
    'optional-practice/civilian-fpv/advanced-simulation.mjs',
    'optional-practice/civilian-fpv/advanced-worker.mjs',
    'optional-practice/civilian-fpv/advanced-worker-client.mjs',
    'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
    'game/data-json.mjs',
    'game/test/helpers/fpv-advanced-qualification.mjs',
  ])
    assert.ok(
      sources.some((source) => source.path === required),
      required,
    );
  assert.ok(sources.every((source) => source.bytes > 0 && /^[0-9a-f]{64}$/.test(source.sha256)));
});
