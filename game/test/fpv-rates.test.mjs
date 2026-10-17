import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  RATE_ALGORITHMS,
  RATE_AXES,
  RATE_PARAMETER_LIMITS,
  RATE_PROFILE_FORMAT,
  createRateEvaluator,
  createRateProfile,
  evaluateRate,
  evaluateThrottle,
  rateAxisDisplayValues,
  rateProfileIdentity,
  validateRateProfile,
} from '../../optional-practice/civilian-fpv/rates.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/fpv-betaflight-rates.json', import.meta.url), 'utf8'),
);

test('all five pinned firmware versions have independently compiled numerical references', () => {
  assert.deepEqual(
    fixture.sources.map(({ version }) => version),
    ['4.5.2', '4.5.5', '2025.12.4', '2025.12.5', '2026.6.2'],
  );
  assert.equal(fixture.format, 'BetaflightRateReference.v1');
  for (const source of fixture.sources) {
    assert.match(source.sha256, /^[a-f0-9]{64}$/);
    assert.match(source.rateFunctionsSha256, /^[a-f0-9]{64}$/);
    assert.match(source.throttleFunctionsSha256, /^[a-f0-9]{64}$/);
    assert.ok(source.url.includes(`/${source.version}/src/main/fc/rc.c`));
  }
});

for (const [index, sample] of fixture.rates.entries()) {
  test(`tagged C reference rate sweep ${index + 1}: ${sample.algorithm}, Quick expo ${sample.quickRatesRcExpo}`, () => {
    const evaluator = createRateEvaluator(
      createRateProfile({
        algorithm: sample.algorithm,
        quickRatesRcExpo: sample.quickRatesRcExpo,
        axes: { roll: sample.axis },
      }),
    );
    assert.equal(sample.expected.length, 2001);
    let worst = 0;
    for (let i = 0; i <= 2000; i++) {
      const actual = evaluator.rate('roll', (i - 1000) / 1000);
      worst = Math.max(worst, Math.abs(actual - sample.expected[i]));
    }
    assert.ok(worst <= 0.1, `Maximum rate error ${worst} exceeds 0.1 degrees/s`);
  });
}

for (const group of fixture.throttle) {
  for (const sample of group.cases) {
    test(`tagged C reference throttle sweep: ${group.model}, mid ${sample.mid}, expo ${sample.expo}, hover ${sample.hover}`, () => {
      const { expected, ...throttle } = sample;
      const evaluator = createRateEvaluator(
        createRateProfile({ throttle: { ...throttle, model: group.model } }),
      );
      assert.equal(expected.length, 1001);
      let worst = 0;
      for (let i = 0; i <= 1000; i++) {
        const actual = evaluator.throttle(i / 1000) * 1000;
        worst = Math.max(worst, Math.abs(actual - expected[i]));
      }
      assert.ok(worst <= 1 + 1e-9, `Maximum throttle error ${worst} exceeds one count`);
    });
  }
}

test('defaults are Actual, retain native CLI units, and impose no legacy 720 degrees/s ceiling', () => {
  const profile = createRateProfile();
  assert.equal(profile.format, RATE_PROFILE_FORMAT);
  assert.equal(profile.algorithm, 'actual');
  assert.deepEqual(rateAxisDisplayValues(profile, 'roll'), {
    rcRate: 70,
    rate: 670,
    expo: 0,
    limit: 1998,
  });
  assert.equal(evaluateRate(profile, 'roll', 1), 670);
  assert.equal(
    evaluateRate(createRateProfile({ axes: { roll: { rcRate: 200, rate: 200 } } }), 'roll', 1),
    1998,
  );
});

test('each axis uses its own parameters and limit; calibrated input receives no hidden deadband', () => {
  const evaluator = createRateEvaluator(
    createRateProfile({
      axes: {
        roll: { rcRate: 10, rate: 100, expo: 20, limit: 900 },
        pitch: { rcRate: 20, rate: 80, expo: 30, limit: 700 },
        yaw: { rcRate: 30, rate: 60, expo: 40, limit: 500 },
      },
    }),
  );
  assert.equal(evaluator.rate('roll', 1), 900);
  assert.equal(evaluator.rate('pitch', 1), 700);
  assert.equal(evaluator.rate('yaw', 1), 500);
  for (const axis of RATE_AXES) {
    assert.equal(evaluator.rate(axis, 0), 0);
    assert.ok(evaluator.rate(axis, 0.001) > 0);
    assert.equal(evaluator.rate(axis, -0.43), -evaluator.rate(axis, 0.43));
  }
});

test('Quick exposes both distinct expo modes and clamps maximum below center without dividing by zero', () => {
  const profile = createRateProfile({ algorithm: 'quick', axes: { roll: { expo: 65 } } });
  assert.notEqual(
    evaluateRate(profile, 'roll', 0.5),
    evaluateRate({ ...profile, quickRatesRcExpo: true }, 'roll', 0.5),
  );
  const belowCenter = createRateProfile({
    algorithm: 'quick',
    axes: { roll: { rcRate: 200, rate: 1 } },
  });
  assert.equal(evaluateRate(belowCenter, 'roll', 1), 400);
});

test('throttle limiting follows curve shaping and distinguishes scale, clip and off', () => {
  const profile = createRateProfile({ throttle: { model: 'betaflight-4.5', mid: 35, expo: 65 } });
  const unlimited = evaluateThrottle(profile, 0.7);
  const scale = createRateProfile({
    ...profile,
    throttle: { ...profile.throttle, limitType: 'scale', limitPercent: 50 },
  });
  const clip = createRateProfile({
    ...profile,
    throttle: { ...profile.throttle, limitType: 'clip', limitPercent: 50 },
  });
  const off = createRateProfile({
    ...profile,
    throttle: { ...profile.throttle, limitPercent: 25 },
  });
  assert.equal(evaluateThrottle(scale, 0.7), unlimited * 0.5);
  assert.equal(evaluateThrottle(clip, 0.7), Math.min(unlimited, 0.5));
  assert.equal(evaluateThrottle(off, 0.7), unlimited);
});

test('versioned throttle preserves old midpoint meaning and supports new hover coordinate', () => {
  const old = createRateProfile({
    throttle: { model: 'betaflight-4.5', mid: 50, expo: 0, hover: 30 },
  });
  const current = createRateProfile({
    throttle: { model: 'betaflight-2025.12', mid: 50, expo: 0, hover: 30 },
  });
  assert.equal(evaluateThrottle(old, 0.5), 0.5);
  assert.ok(evaluateThrottle(current, 0.5) < 0.32);
  for (const model of ['betaflight-4.5', 'betaflight-2025.12']) {
    for (const mid of [0, 100]) {
      const evaluator = createRateEvaluator(
        createRateProfile({ throttle: { model, mid, expo: 100 } }),
      );
      for (const value of [0, 0.001, 0.5, 0.999, 1]) {
        assert.ok(Number.isFinite(evaluator.throttle(value)));
        assert.ok(evaluator.throttle(value) >= 0 && evaluator.throttle(value) <= 1);
      }
    }
  }
});

test('compiled evaluators own immutable values, so drafts cannot mutate an in-progress attempt', () => {
  const profile = createRateProfile();
  const evaluator = createRateEvaluator(profile);
  const identity = rateProfileIdentity(evaluator.profile);
  profile.axes.roll.rate = 199;
  profile.throttle.limitType = 'scale';
  profile.throttle.limitPercent = 25;
  assert.equal(evaluator.rate('roll', 1), 670);
  assert.equal(evaluator.throttle(1), 1);
  assert.equal(rateProfileIdentity(evaluator.profile), identity);
  assert.throws(() => {
    evaluator.profile.axes.roll.rate = 10;
  }, TypeError);
});

test('validators reject ambiguous units, unsupported data and unsafe boundary values atomically', () => {
  for (const algorithm of RATE_ALGORITHMS) {
    const maximum = RATE_PARAMETER_LIMITS[algorithm];
    assert.doesNotThrow(() =>
      createRateProfile({ algorithm, axes: { roll: { ...maximum, limit: 1998 } } }),
    );
    assert.throws(() =>
      createRateProfile({ algorithm, axes: { roll: { rcRate: maximum.rcRate + 1 } } }),
    );
    assert.throws(() =>
      createRateProfile({ algorithm, axes: { roll: { rate: maximum.rate + 1 } } }),
    );
  }
  const profile = createRateProfile();
  assert.throws(() => createRateProfile({ axes: { roll: { rcRate: 0 } } }));
  assert.throws(() => createRateProfile({ axes: { roll: { expo: 0.5 } } }));
  assert.throws(() => createRateProfile({ throttle: { limitPercent: 24 } }));
  assert.throws(() => validateRateProfile({ ...profile, name: 'Names belong to the library' }));
  assert.throws(() => evaluateRate(profile, 'throttle', 0));
  assert.throws(() => evaluateRate(profile, 'roll', NaN));
  assert.throws(() => evaluateThrottle(profile, Infinity));
  assert.equal(evaluateRate(profile, 'roll', 2), evaluateRate(profile, 'roll', 1));
});
