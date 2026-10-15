import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { CIVILIAN_PRACTICE_CATALOGUE } from '../optional-practice/civilian-flight/catalogue.mjs';
import {
  PRACTICE_EXERCISE_UI,
  parseGymExerciseSnapshot,
  gymExerciseKey,
  assertGymExerciseProgress,
  describeGymTranscript,
  exportGymExerciseTranscript,
  runGymLiftAndLand,
} from './practice-exercise-ui.mjs';

const transcript = () =>
  JSON.stringify({
    format: 'revealline-practice-transcript.v1',
    catalogueIdentity: 'a'.repeat(16),
    drillId: 'lift-and-land',
    commands: [{ ticks: 1, input: { pitch: 0, roll: 0, yaw: 0, throttle: 0 } }],
  });

// Scripted DOM observations are controller unit fixtures, not browser evidence.
const raw = (height = 0, checkpoint = 0, locale = 'en') => ({
  locale,
  drill: 'lift-and-land',
  visible: true,
  focused: true,
  readout:
    locale === 'en'
      ? `Position 10.0, 16.0 m · Height ${height.toFixed(2)} m · Heading 0°`
      : `Положення 10.0, 16.0 m · Висота ${height.toFixed(2)} m · Курс 0°`,
  status:
    checkpoint === 2
      ? `${locale === 'en' ? 'Practice route complete · Checkpoints' : 'Тренувальний маршрут завершено · Контрольні точки'} 2/2`
      : `${locale === 'en' ? 'Practising · Checkpoints' : 'Тренування · Контрольні точки'} ${checkpoint}/2`,
  phase: checkpoint === 2 ? 'results' : 'playing',
  verified: checkpoint === 2,
});
const pageFor = (samples) => {
  const actions = [];
  let index = 0;
  return {
    actions,
    evaluate: async () => samples[Math.min(index++, samples.length - 1)],
    keyboard: {
      down: async (key) => actions.push(`down:${key}`),
      up: async (key) => actions.push(`up:${key}`),
    },
    locator: () => ({
      waitFor: async () => {},
      press: async () => {},
      inputValue: async () => transcript(),
      locator: () => ({ getAttribute: async () => '' }),
    }),
  };
};

test('declared first Gym geometry and key bindings match native source', async () => {
  const drill = CIVILIAN_PRACTICE_CATALOGUE.drills[0];
  assert.equal(drill.id, PRACTICE_EXERCISE_UI.exercise);
  assert.equal(drill.checkpoints.length, 2);
  assert.deepEqual(
    drill.checkpoints.map(({ altitude, holdTicks, landed }) => ({ altitude, holdTicks, landed })),
    [
      { altitude: 100, holdTicks: 20, landed: false },
      { altitude: 0, holdTicks: 20, landed: true },
    ],
  );
  assert.equal(drill.checkpoints[0].verticalTolerance, 15);
  assert.deepEqual(drill.spawn, { x: 1000, z: 1600, altitude: 0, heading: 0 });
  const input = await readFile(
    new URL('../optional-practice/civilian-flight/input.mjs', import.meta.url),
    'utf8',
  );
  assert.match(input, /KeyR: \['throttle', 1\]/);
  assert.match(input, /KeyF: \['throttle', -1\]/);
  const app = await readFile(
    new URL('../optional-practice/civilian-flight/app.mjs', import.meta.url),
    'utf8',
  );
  assert.match(
    app,
    /if \(replayPractice\(catalogue, trace\(\)\).status === 'complete'\)\s*completed.add/,
  );
});

test('EN and UK parse actual measurement order and require native identity, focus and visible HUD', () => {
  for (const locale of ['en', 'uk']) {
    assert.equal(parseGymExerciseSnapshot(raw(0.95, 0, locale), locale).height, 0.95);
    for (const patch of [
      { locale: 'other' },
      { drill: 'steady-hover' },
      { visible: false },
      { focused: false },
      { phase: 'paused' },
      { verified: true },
      { readout: 'Height 1.0m' },
      { readout: 'Position 11, 16 m · Height 1 m · Heading 0°' },
      { readout: 'Position 10, 16 m · Height 2.0 m · Heading 0°' },
      { status: 'Loading 20/2' },
    ])
      assert.throws(() => parseGymExerciseSnapshot({ ...raw(0, 0, locale), ...patch }, locale));
  }
});

test('result text, a checkmark, partial progress or a lifted position cannot counterfeit completion', () => {
  for (const locale of ['en', 'uk']) {
    const success = raw(0, 2, locale);
    assert.equal(parseGymExerciseSnapshot(success, locale).complete, true);
    for (const patch of [
      { verified: false },
      { phase: 'playing' },
      { status: 'Practising · Checkpoints 2/2' },
      { readout: raw(0.5).readout },
      { status: success.status.replace('2/2', '1/2') },
    ])
      assert.throws(() => parseGymExerciseSnapshot({ ...success, ...patch }, locale));
    const parse = (row) => parseGymExerciseSnapshot(row, locale);
    assert.throws(() => assertGymExerciseProgress([parse(raw(0, 0, locale)), parse(success)]));
    assert.throws(
      () =>
        assertGymExerciseProgress([
          parse(raw(0, 0, locale)),
          parse(raw(0.2, 1, locale)),
          parse(success),
        ]),
      /lift/,
    );
    assert.throws(
      () =>
        assertGymExerciseProgress([
          parse(raw(0, 0, locale)),
          parse(raw(1, 1, locale)),
          parse(raw(1, 0, locale)),
          parse(success),
        ]),
      /ordered/,
    );
  }
});

test('feedback holds in the inner lift band and descends only after actual checkpoint advance', () => {
  assert.equal(gymExerciseKey({ checkpoint: 0, height: 0 }), 'r');
  assert.equal(gymExerciseKey({ checkpoint: 0, height: 0.95 }), null);
  assert.equal(gymExerciseKey({ checkpoint: 0, height: 1.05 }), null);
  assert.equal(gymExerciseKey({ checkpoint: 0, height: 1.2 }), 'f');
  assert.equal(gymExerciseKey({ checkpoint: 1, height: 1.0 }), 'f');
  assert.equal(gymExerciseKey({ checkpoint: 1, height: 0 }), null);
  assert.equal(gymExerciseKey({ complete: true, checkpoint: 2, height: 0 }), null);
});

test('bounded public-controller unit journey requires ordered lift/land and always releases R/F', async () => {
  for (const locale of ['en', 'uk']) {
    const page = pageFor([
      raw(0, 0, locale),
      raw(1, 0, locale),
      raw(1, 1, locale),
      raw(0, 1, locale),
      raw(0, 2, locale),
    ]);
    const report = await runGymLiftAndLand(page, { locale, timeoutMs: 2000 });
    assert.equal(report.completed, true);
    assert.equal(report.qualified, false);
    assert.equal(report.cleanup.released, true);
    assert.equal(report.nativeCompleted, true);
    assert.equal(report.transcript.independentReplayVerified, false);
    assert.deepEqual(page.actions, ['down:r', 'up:r', 'down:f', 'up:f', 'up:r', 'up:f']);
    assert(report.samples.length <= PRACTICE_EXERCISE_UI.maximumSamples);
  }
});

test('transcript export opens only normal Settings Data/disclosure controls and retains actual text', async () => {
  const actions = [];
  let open = false;
  const locator = (selector) => ({
    waitFor: async ({ state }) => {
      assert.equal(state, 'visible');
      actions.push(`visible:${selector}`);
    },
    press: async (key) => {
      assert.equal(key, 'Enter');
      actions.push(`Enter:${selector}`);
      if (selector === 'summary') open = true;
    },
    inputValue: async () => {
      actions.push('read textarea');
      return transcript();
    },
    locator: (next) => locator(next),
    getAttribute: async (attribute) => {
      assert.equal(attribute, 'open');
      return open ? '' : null;
    },
  });
  const result = await exportGymExerciseTranscript({ locator });
  assert.equal(result.json, transcript());
  assert.equal(result.commandCount, 1);
  assert.deepEqual(actions, [
    'visible:#gym-shell-action-settings',
    'Enter:#gym-shell-action-settings',
    'visible:#gym-settings-tab-data',
    'Enter:#gym-settings-tab-data',
    'visible:summary',
    'Enter:summary',
    'visible:#export-trace',
    'Enter:#export-trace',
    'visible:#catalogue',
    'read textarea',
  ]);
  actions.length = 0;
  await exportGymExerciseTranscript({ locator });
  assert(!actions.includes('Enter:summary'), 'Already-open disclosure must not close.');
});

test('trusted completion capture precedes public export and its failure cannot qualify the run', async () => {
  const rows = [raw(0), raw(1, 1), raw(0, 2)];
  const page = pageFor(rows);
  const events = [];
  page.locator = (selector) => ({
    waitFor: async () => {},
    press: async () => events.push(selector),
    inputValue: async () => transcript(),
    locator: () => ({ getAttribute: async () => '' }),
  });
  const result = await runGymLiftAndLand(page, {
    timeoutMs: 2000,
    onComplete: async (witness) => {
      assert.equal(witness.checkpoint, 2);
      assert.equal(witness.complete, true);
      assert(Object.isFrozen(witness));
      events.push('capture completed exercise');
    },
  });
  assert.equal(result.completed, true);
  assert.equal(events[0], 'capture completed exercise');
  assert.equal(events[1], '#gym-shell-action-settings');
  const failed = await runGymLiftAndLand(pageFor(rows), {
    timeoutMs: 2000,
    onComplete: async () => {
      throw new Error('Screenshot unavailable');
    },
  });
  assert.equal(failed.completed, false);
  assert.equal(failed.nativeCompleted, true);
  assert.equal(failed.transcript, undefined);
  assert.match(failed.error, /Screenshot unavailable/);
});

test('transcript identity/shape validation rejects counterfeit success flags and excessive payloads without claiming replay', () => {
  const parsed = JSON.parse(transcript());
  assert.equal(describeGymTranscript(transcript()).independentReplayVerified, false);
  for (const patch of [
    { complete: true },
    { drillId: 'steady-hover' },
    { catalogueIdentity: 'latest' },
    { commands: [] },
    { commands: [{ ticks: 201, input: parsed.commands[0].input }] },
    { commands: [{ ticks: 1, input: { ...parsed.commands[0].input, throttle: 2 } }] },
  ])
    assert.throws(() => describeGymTranscript(JSON.stringify({ ...parsed, ...patch })));
  assert.throws(() => describeGymTranscript(' '.repeat(131073)));
});

test('precompleted, skipped, paused and hidden observations fail closed and release owned input', async () => {
  for (const samples of [
    [raw(0, 2)],
    [raw(0), raw(0, 2)],
    [raw(0), { ...raw(1), phase: 'paused' }],
    [raw(0), { ...raw(1), visible: false }],
  ]) {
    const page = pageFor(samples);
    const report = await runGymLiftAndLand(page, { timeoutMs: 1000 });
    assert.equal(report.completed, false);
    assert.ok(report.error);
    if (page.actions.includes('down:r')) assert.equal(page.actions.at(-1), 'up:r');
  }
});

test('abort and deadline are bounded and input release does not inherit an already-aborted signal', async () => {
  const controller = new AbortController();
  const page = pageFor([raw(0)]);
  page.keyboard.down = async (key) => {
    page.actions.push(`down:${key}`);
    controller.abort();
  };
  const report = await runGymLiftAndLand(page, { signal: controller.signal, timeoutMs: 500 });
  assert.equal(report.completed, false);
  assert.equal(page.actions.at(-1), 'up:r');
  const deadlinePage = pageFor([raw(0)]);
  const timed = await runGymLiftAndLand(deadlinePage, { timeoutMs: 30 });
  assert.equal(timed.completed, false);
  assert.equal(deadlinePage.actions.at(-1), 'up:r');
  assert.match(timed.error, /timed out|deadline/i);
});

test('late key-down cannot report verified cleanup and gets a second release after settling', async () => {
  let resolveDown;
  const page = pageFor([raw(0)]);
  page.keyboard.down = () =>
    new Promise((resolve) => {
      resolveDown = resolve;
    });
  const report = await runGymLiftAndLand(page, { timeoutMs: 25 });
  assert.equal(report.completed, false);
  assert.equal(report.cleanup.released, false);
  assert.deepEqual(page.actions, ['up:r']);
  resolveDown();
  await delay(5);
  assert.deepEqual(page.actions, ['up:r', 'up:r']);
  assert.equal(report.completed, false);
});

test('unsupported mode and extended deadline are rejected before any input', async () => {
  const page = pageFor([raw()]);
  for (const options of [
    { mode: 'acro' },
    { locale: 'fr' },
    { timeoutMs: 90_001 },
    { timeoutMs: 0 },
  ])
    await assert.rejects(runGymLiftAndLand(page, options));
  assert.deepEqual(page.actions, []);
});
