import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {
  qualificationCadenceOption,
  prepareCadenceViewport,
  observeSettledCadence,
  calibrateSettledCadence,
} from './solo-qualification-cadence.mjs';
import { frozenExternalCadence } from './solo-qualification-observation.mjs';

function blankBrowser() {
  let clock = 5,
    scheduled,
    timer,
    focused = true,
    callbacks = 0,
    meta;
  const listeners = new Map();
  const environment = {
    location: { href: 'about:blank' },
    innerWidth: 400,
    innerHeight: 850,
    devicePixelRatio: 3,
    performance: { now: () => clock },
    requestAnimationFrame(callback) {
      scheduled = callback;
      return ++callbacks;
    },
    cancelAnimationFrame: () => (scheduled = null),
    setTimeout: (callback) => (timer = callback),
    clearTimeout: () => (timer = null),
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
    document: {
      hidden: false,
      visibilityState: 'visible',
      hasFocus: () => focused,
      querySelector: () => meta,
      createElement: () => ({}),
      head: { append: (value) => (meta = value) },
      addEventListener: (name, callback) => listeners.set(name, callback),
      removeEventListener: (name) => listeners.delete(name),
    },
  };
  return {
    environment,
    listeners,
    frame(timestamp) {
      clock = timestamp + 10;
      const callback = scheduled;
      scheduled = null;
      callback?.(timestamp);
    },
    blur() {
      focused = false;
      listeners.get('blur')?.();
      focused = true;
    },
    timeout() {
      clock = 10005;
      timer?.();
    },
    callbacks: () => callbacks,
    scheduled: () => scheduled,
  };
}
const expected = { width: 400, height: 850, dpr: 3 };

test('settled120 is explicit and leaves historical blank30 as the default', () => {
  assert.equal(qualificationCadenceOption([]), 'blank30');
  assert.equal(qualificationCadenceOption(['--cadence=settled120']), 'settled120');
  assert.throws(() => qualificationCadenceOption(['--cadence=best-window']));
  assert.throws(() => qualificationCadenceOption(['--cadence']));
  assert.throws(() => qualificationCadenceOption(['--cadence=blank30', '--cadence=settled120']));
});

test('viewport metadata is limited to the pre-navigation blank fixture', () => {
  const fake = blankBrowser();
  const result = prepareCadenceViewport(expected, fake.environment);
  assert.deepEqual(result.before, expected);
  assert.equal(result.metaContent, 'width=device-width, initial-scale=1');
  assert.equal(fake.environment.document.querySelector().name, 'viewport');
  fake.environment.location.href = 'https://example.test/game/';
  assert.throws(() => prepareCadenceViewport(expected, fake.environment), /before|precede/);
});

test('settled120 serializes without imports and retains the full fixed settle and measurement', async () => {
  const fake = blankBrowser();
  const pending = vm.runInNewContext(
    `(${observeSettledCadence.toString()})({expected:${JSON.stringify(expected)}})`,
    fake.environment,
  );
  fake.frame(0);
  fake.frame(500);
  fake.frame(1700);
  fake.frame(2000);
  for (let i = 1; i <= 120; i++) fake.frame(2000 + i * (1000 / 120));
  const observation = await pending;
  assert.deepEqual(Array.from(observation.settleSamples), [500, 1200, 300]);
  assert.equal(observation.samples.length, 120);
  assert.equal(observation.firstRafCallback.timestampMinusRegistrationMs, -5);
  assert.equal(observation.measurementAnchor.timestampMs, 2000);
  assert.equal(fake.callbacks(), 124);
  assert.equal(fake.listeners.size, 0);
  assert.equal(fake.scheduled(), null);
  const calibration = calibrateSettledCadence(observation);
  assert.equal(calibration.status, 'measured-before-play');
  assert.equal(calibration.protocol, 'foreground-about-blank-settled-120-v1');
  assert(Math.abs(calibration.baselineMs - 1000 / 120) < 1e-9);
  const frozen = frozenExternalCadence(calibration);
  assert.throws(() => (frozen.baselineMs = 1000 / 60));
  assert.equal(frozen.baselineMs, calibration.baselineMs);
});

test('settled120 never replaces a disturbed window or loses transient environment changes', async () => {
  for (const failure of [
    'unstable',
    'settle-blur',
    'measure-blur',
    'restored-width',
    'restored-dpr',
    'wrong-viewport',
    'deadline',
    'nonpositive',
  ]) {
    const fake = blankBrowser();
    if (failure === 'wrong-viewport') fake.environment.innerWidth = 980;
    const pending = observeSettledCadence({ expected }, fake.environment);
    fake.frame(0);
    if (failure === 'settle-blur') fake.blur();
    fake.frame(2000);
    let timestamp = 2000;
    for (let i = 1; i <= 120; i++) {
      if (i === 4 && failure === 'deadline') {
        fake.timeout();
        break;
      }
      if (i === 4 && failure === 'measure-blur') fake.blur();
      if (i === 4 && failure.startsWith('restored-')) {
        const key = failure === 'restored-width' ? 'innerWidth' : 'devicePixelRatio';
        const original = fake.environment[key];
        fake.environment[key] = 999;
        fake.listeners.get('resize')();
        fake.environment[key] = original;
        fake.listeners.get('resize')();
      }
      const increment = i === 4 && failure === 'unstable' ? 100 : 1000 / 60;
      if (!(i === 4 && failure === 'nonpositive')) timestamp += increment;
      fake.frame(timestamp);
    }
    const observation = await pending;
    const calibration = calibrateSettledCadence(observation);
    assert.notEqual(calibration.status, 'measured-before-play', failure);
    assert.equal(frozenExternalCadence(calibration).baselineMs, null, failure);
    assert.equal(fake.scheduled(), null, failure);
    assert.equal(fake.listeners.size, 0, failure);
    assert.equal(observation.samples.length, failure === 'deadline' ? 3 : 120, failure);
    if (failure === 'unstable') assert.equal(calibration.maximumMs, 100);
    if (failure === 'deadline') assert.equal(observation.deadlineReached, true);
  }
});
