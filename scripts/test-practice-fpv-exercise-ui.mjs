import test from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import {
  FPV_EXERCISE_PROTOCOL,
  parsePublicFPVSnapshot,
  estimatePublicVerticalVelocity,
  publicFPVFeedback,
  assertPublicFPVCompletion,
  runPublicFPVExercise,
  readPublicFPVSnapshot,
  parseDetailedFPVHUD,
} from './practice-fpv-exercise-ui.mjs';

const specFor = (packageId = 'civilian-fpv', locale = 'en', mode = 'self-level') => ({
  packageId,
  locale,
  mode,
});
const raw = (spec, height = 0, checkpoint = 0, throttle = 0) => ({
  locale: spec.locale,
  mode: spec.mode,
  source: 'keyboard',
  preset: 'two-stick',
  title: spec.locale === 'en' ? 'Lift and land' : 'Підйом і посадка',
  courseNumber: '01 / 12 · manual throttle',
  phase: checkpoint === 2 ? 'complete' : 'active',
  focused: true,
  details:
    spec.locale === 'en'
      ? `Height ${height.toFixed(1)} m · ${checkpoint === 0 ? '1.2–2.4' : '0–0.6'} m`
      : `Висота ${height.toFixed(1).replace('.', ',')} м · ${checkpoint === 0 ? '1,2–2,4' : '0–0,6'} м`,
  gauge: spec.locale === 'en' ? 'Height' : 'Висота',
  action: spec.locale === 'en' ? 'Hold steady' : 'Утримуйте стабільно',
  throttleText: `${Math.round(throttle * 100)}%`,
  stickVisible: true,
  stickY: (1 - 2 * throttle) * 30,
  stickRadius: 30,
  stickModeLabel: spec.locale === 'en' ? 'Flight controls · Mode 2' : 'Органи керування · Mode 2',
  resultVisible: checkpoint === 2,
  resultHeading:
    spec.packageId === 'civilian-fpv'
      ? spec.locale === 'en'
        ? 'Lift and land'
        : 'Підйом і посадка'
      : spec.locale === 'en'
        ? 'Challenge complete'
        : 'Завдання виконано',
});
const observation = (at, height, checkpoint = 0, throttle = 0.5) => ({
  at,
  height,
  checkpoint,
  throttle,
  complete: false,
});
const grounded = (spec) => ({
  ...raw(spec, 0, 1, 0.48),
  details: spec.locale === 'uk' ? 'Газ 48 % · ≤ 10 %' : 'Throttle 48 % · ≤ 10 %',
  gauge: spec.locale === 'uk' ? 'Газ' : 'Throttle',
  action: spec.locale === 'uk' ? 'Повністю опустіть газ' : 'Lower throttle fully',
});
const fakePage = (samples) => {
  const events = [];
  let index = 0;
  return {
    events,
    evaluate: async () => samples[Math.min(index++, samples.length - 1)],
    keyboard: {
      down: async (key) => events.push(`down:${key}`),
      up: async (key) => events.push(`up:${key}`),
    },
  };
};

test('all declared locales/modes/packages parse only their native first exercise and visible measurements', () => {
  for (const packageId of ['civilian-fpv', 'fpv-worlds'])
    for (const locale of ['en', 'uk'])
      for (const mode of ['self-level', 'acro']) {
        const spec = specFor(packageId, locale, mode);
        const sample = parsePublicFPVSnapshot(raw(spec, 1.2, 1, 0.51), spec);
        assert.equal(sample.height, 1.2);
        assert.equal(sample.throttle, 0.51);
        assert.equal(sample.checkpoint, 1);
        for (const patch of [
          { locale: 'de' },
          { mode: 'other' },
          { source: 'touch' },
          { preset: 'wasd' },
          { title: 'Other lesson' },
          { focused: false },
          { phase: 'paused' },
          { phase: 'expired' },
          { details: null },
          { gauge: 'Speed' },
          {
            details: spec.locale === 'en' ? 'Height 9 m · 1.2–2.4 m' : 'Висота 9 м · 1,2–2,4 м',
          },
          ...(packageId === 'civilian-fpv'
            ? [{ stickVisible: false }, { stickY: -50 }, { stickModeLabel: 'Mode 1' }]
            : [{ throttleText: null }, { throttleText: '101%' }]),
        ])
          assert.throws(() => parsePublicFPVSnapshot({ ...raw(spec), ...patch }, spec));
        assert.throws(() =>
          parsePublicFPVSnapshot(
            {
              ...raw(spec),
              details: 'Height 0 m · 0–100 m',
            },
            spec,
          ),
        );
      }
});

test('Recording verified, result heading alone, expired flight and wrong exercise cannot counterfeit completion', () => {
  for (const packageId of ['civilian-fpv', 'fpv-worlds']) {
    const spec = specFor(packageId);
    const complete = {
      ...raw(spec, 0, 2, 0.06),
      heightText: null,
      throttleText: null,
      focused: false,
    };
    assert.equal(parsePublicFPVSnapshot(complete, spec).complete, true);
    for (const patch of [
      { resultHeading: 'Recording verified.' },
      { resultVisible: false },
      { phase: 'expired' },
      { phase: 'active' },
      { title: 'Other exercise' },
    ])
      assert.throws(() => parsePublicFPVSnapshot({ ...complete, ...patch }, spec));
  }
});

test('velocity comes from recent measured height, rejecting stale/reversed samples and unsafe speed', () => {
  assert.deepEqual(estimatePublicVerticalVelocity([observation(0, 0), observation(100, 0.1)]), {
    value: 0,
    ready: false,
  });
  assert.equal(
    estimatePublicVerticalVelocity([
      observation(0, 0),
      observation(200, 0.1),
      observation(400, 0.2),
    ]).value,
    0.5,
  );
  assert.throws(
    () => estimatePublicVerticalVelocity([observation(0, 0), observation(900, 0.1)]),
    /Stale/,
  );
  assert.throws(
    () => estimatePublicVerticalVelocity([observation(100, 0), observation(100, 0)]),
    /Stale/,
  );
  assert.throws(
    () => estimatePublicVerticalVelocity([observation(0, 0), observation(400, 2)]),
    /speed/,
  );
});

test('feedback bounds throttle, uses only W/S/Shift and cuts power only after observed settled landing step', () => {
  const initial = publicFPVFeedback([observation(0, 0, 0, 0)]);
  assert.deepEqual(initial.keys, ['w']);
  assert(initial.desiredThrottle > 0.5 && initial.desiredThrottle <= 0.62);
  const hold = publicFPVFeedback([observation(0, 1.8, 0, 0.5), observation(400, 1.8, 0, 0.5)]);
  assert.deepEqual(hold.keys, []);
  const slowDescent = publicFPVFeedback([observation(0, 1.8, 1), observation(400, 1.8, 1)]);
  assert.deepEqual(slowDescent.keys, ['ShiftLeft', 's']);
  assert(slowDescent.desiredThrottle >= 0.38);
  const ground = [0, 100, 200, 300, 400].map((at) => observation(at, 0, 1));
  assert.notEqual(
    publicFPVFeedback(ground).desiredThrottle,
    0.06,
    'Rounded zero height alone cannot certify actual soft touchdown.',
  );
  assert.equal(
    publicFPVFeedback(ground.map((row) => ({ ...row, checkpoint: 0 }))).settledGround,
    false,
  );
  assert.equal(
    publicFPVFeedback([observation(0, 0.2, 1), observation(400, 0, 1)]).settledGround,
    false,
  );
});

test('Detailed HUD has strict localized target bands and an explicit semantic ground witness', () => {
  for (const locale of ['en', 'uk']) {
    const isUK = locale === 'uk';
    const witness = parseDetailedFPVHUD(
      isUK ? 'Газ 48,1 % · ≤ 10 %' : 'Throttle 48.1 % · ≤ 10 %',
      isUK ? 'Газ' : 'Throttle',
      isUK ? 'Повністю опустіть газ' : 'Lower throttle fully',
      locale,
    );
    assert.equal(witness.height, null);
    assert.equal(witness.groundedWitness, true);
    assert.equal(witness.checkpoint, 1);
    assert.match(witness.measurementSource, /soft-touchdown/);
    const sample = { ...witness, at: 400, throttle: 0.48, complete: false };
    assert.equal(publicFPVFeedback([sample]).desiredThrottle, 0.06);
    assert.equal(publicFPVFeedback([sample, observation(800, 0, 1, 0.08)]).desiredThrottle, 0.06);
    assert.throws(() =>
      parseDetailedFPVHUD(
        isUK ? 'Газ 48 % · ≤ 10 %' : 'Throttle 48 % · ≤ 10 %',
        isUK ? 'Газ' : 'Throttle',
        'Touch down softly on the pad',
        locale,
      ),
    );
  }
  for (const value of [
    'Height 1.8 m · 0–100 m',
    'Height 1,8 m · 1.2–2.4 m',
    'Speed 1 m/s · ≤ 2.2 m/s',
    'Height 0 m · 0–0.6 m extra',
  ])
    assert.throws(() => parseDetailedFPVHUD(value, 'Height', 'Hold steady', 'en'));
});

test('DOM adapter reads maintained visible HUD and visible stick, never hidden legacy measurements', async () => {
  const original = Object.fromEntries(
    ['document', 'getComputedStyle', 'DOMMatrixReadOnly'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const seen = [];
  const element = (text = '', displayed = true) => ({
    innerText: text,
    textContent: text,
    getClientRects: () => (displayed ? [{}] : []),
    closest: () => null,
    contains: () => false,
    value: undefined,
  });
  const viewport = element(),
    parent = { ...element(), clientWidth: 100 };
  const dot = { ...element(), parentElement: parent };
  const nodes = new Map([
    ['#viewport', viewport],
    ['#left-dot', dot],
    ['#complete', element('', false)],
    ['#mode', { ...element(), value: 'self-level' }],
    ['#input-source', { ...element(), value: 'keyboard' }],
    ['#keyboard-preset', { ...element(), value: 'two-stick' }],
    ['#course-title', element('Lift and land', false)],
    ['#course-number', element('01 / 12 · manual throttle', false)],
    ['#flight-app', { ...element(), dataset: { flightState: 'active' } }],
    ['#sticks', { ...element(), getAttribute: () => 'Flight controls · Mode 2' }],
    ['[data-sim-hud="flight"] [data-hud-part="details"]', element('Height 1.8 m · 1.2–2.4 m')],
    ['[data-sim-hud="flight"] [data-hud-part="gauge-name"]', element('Height')],
    ['[data-sim-hud="flight"] [data-hud-part="action"]', element('Hold steady')],
  ]);
  try {
    globalThis.document = {
      documentElement: { lang: 'en' },
      hidden: false,
      hasFocus: () => true,
      activeElement: viewport,
      querySelector(selector) {
        seen.push(selector);
        assert(
          ![
            '#height',
            '#power',
            '#step-progress',
            '#flight-objective',
            '#flight-instruments',
          ].includes(selector),
        );
        return nodes.get(selector) ?? null;
      },
    };
    globalThis.getComputedStyle = () => ({
      visibility: 'visible',
      transform: 'matrix(1,0,0,1,0,-6)',
    });
    globalThis.DOMMatrixReadOnly = class {
      constructor() {
        this.m42 = -6;
      }
    };
    const page = { evaluate: async (fn, input) => fn(input) };
    const value = parsePublicFPVSnapshot(
      await readPublicFPVSnapshot(page, 'civilian-fpv'),
      specFor(),
    );
    assert.equal(value.height, 1.8);
    assert.equal(value.throttle, 0.6);
    assert.match(value.identitySource, /not controller measurements/);
    nodes.set(
      '[data-sim-hud="flight"] [data-hud-part="details"]',
      element('Height 1.8 m · 1.2–2.4 m', false),
    );
    const hidden = await readPublicFPVSnapshot(page, 'civilian-fpv');
    assert.equal(hidden.details, null);
    assert.throws(() => parsePublicFPVSnapshot(hidden, specFor()));
  } finally {
    for (const [key, descriptor] of Object.entries(original)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
  assert(seen.some((selector) => selector.includes('data-hud-part="details"')));
});

test('ordered progress requires genuine lift, low-throttle ground return and terminal complete', () => {
  const success = [
    observation(0, 0),
    observation(400, 1.2),
    observation(800, 1.8, 1),
    { ...observation(1900, null, 1), groundedWitness: true },
    observation(2000, 0, 1, 0.06),
    { ...observation(2500, null, 2), complete: true },
  ];
  assert.doesNotThrow(() => assertPublicFPVCompletion(success));
  for (const invalid of [
    success.slice(1),
    success.filter((row) => row.checkpoint !== 1),
    success.filter((row) => !row.groundedWitness),
    success.map((row) => ({
      ...row,
      height: row.height === null ? null : Math.min(row.height, 0.2),
    })),
    success.map((row) => ({ ...row, throttle: 0.5 })),
    success.map((row) => ({ ...row, complete: false })),
  ])
    assert.throws(() => assertPublicFPVCompletion(invalid));
});

test('mocked public UI journey remains unqualified and captures before returning, with owned keys released', async () => {
  // Scripted observations test orchestration only: they are NOT simulation/browser evidence.
  for (const spec of [specFor(), specFor('fpv-worlds', 'uk', 'acro')]) {
    const samples = [
      raw(spec),
      ...[0.2, 0.4, 0.6, 0.8, 1, 1.2].map((height) => raw(spec, height, 0, 0.53)),
      ...[1.3, 1.1, 0.9, 0.7, 0.5, 0.3, 0.1].map((height) =>
        raw(spec, height, 1, height ? 0.48 : 0.06),
      ),
      grounded(spec),
      raw(spec, 0, 1, 0.06),
      { ...raw(spec, 0, 2, 0.06), heightText: null, throttleText: null },
    ];
    const page = fakePage(samples);
    let captures = 0;
    const result = await runPublicFPVExercise(page, {
      ...spec,
      timeoutMs: 5000,
      onComplete: async (value) => {
        assert.equal(value.complete, true);
        assert(Object.isFrozen(value));
        captures++;
      },
    });
    assert.equal(result.error, undefined);
    assert.equal(result.completed, undefined);
    assert.equal(result.nativeCompleted, true);
    assert.equal(captures, 1);
    assert.equal(result.qualified, false);
    assert.equal(result.independentReplayVerified, false);
    assert.equal(result.gainsNativeTested, false);
    assert.equal(result.cleanup.keysReleased, true);
    for (const name of ['w', 's', 'ShiftLeft'])
      if (page.events.includes(`down:${name}`)) assert(page.events.includes(`up:${name}`));
  }
});

test('fresh-state, pause and skipped progress failures never become success', async () => {
  const spec = specFor();
  for (const samples of [
    [raw(spec, 0, 2)],
    [raw(spec, 0, 0, 0.5)],
    [raw(spec), { ...raw(spec), phase: 'paused' }],
    [raw(spec), raw(spec, 0, 2)],
  ]) {
    const page = fakePage(samples);
    const result = await runPublicFPVExercise(page, {
      ...spec,
      timeoutMs: 2000,
    });
    assert.ok(result.error);
    assert.equal(result.nativeCompleted, false);
    if (page.events.includes('down:w')) assert(page.events.includes('up:w'));
  }
});

test('deadline, abort and late input cannot leave a passing cleanup receipt', async () => {
  const spec = specFor(),
    controller = new AbortController();
  const page = fakePage([raw(spec)]);
  page.keyboard.down = async (name) => {
    page.events.push(`down:${name}`);
    controller.abort();
  };
  const aborted = await runPublicFPVExercise(page, {
    ...spec,
    signal: controller.signal,
    timeoutMs: 500,
  });
  assert.equal(aborted.nativeCompleted, false);
  assert(page.events.includes('up:w'));
  const timedPage = fakePage([raw(spec)]);
  const timed = await runPublicFPVExercise(timedPage, {
    ...spec,
    timeoutMs: 25,
  });
  assert.equal(timed.nativeCompleted, false);
  assert(timedPage.events.includes('up:w'));
  let settle;
  const latePage = fakePage([raw(spec)]);
  latePage.keyboard.down = () =>
    new Promise((resolve) => {
      settle = resolve;
    });
  const late = await runPublicFPVExercise(latePage, { ...spec, timeoutMs: 25 });
  assert.equal(late.cleanup.keysReleased, false);
  assert.equal(late.nativeCompleted, false);
  settle();
  await delay(5);
  assert.deepEqual(latePage.events, ['up:w', 'up:w']);
});

test('invalid package, mode, locale and deadline reject without browser actions', async () => {
  const page = fakePage([]);
  for (const patch of [
    { packageId: 'civilian-flight' },
    { mode: 'auto' },
    { locale: 'fr' },
    { timeoutMs: 90001 },
    { timeoutMs: 0 },
  ])
    await assert.rejects(runPublicFPVExercise(page, { ...specFor(), ...patch }));
  assert.equal(FPV_EXERCISE_PROTOCOL.gainsNativeTested, false);
  assert.deepEqual(page.events, []);
});
