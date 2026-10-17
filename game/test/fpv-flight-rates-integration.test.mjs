import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { createRateProfile } from '../../optional-practice/civilian-fpv/rates.mjs';
import { createTunedResponse } from '../../optional-practice/civilian-fpv/flight-response.mjs';
import { DEFAULT_RESPONSE } from '../../optional-practice/civilian-fpv/radio-profile.mjs';
import {
  advanceFlightAir,
  createFlight,
  createFlightRecorder,
  replayFlight,
} from '../../optional-practice/civilian-fpv/model.mjs';
import { Q } from '../../optional-practice/civilian-fpv/math.mjs';
import {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  replayWorldFlight,
  worldFlightIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import {
  compatibleFlightComparison,
  compatibleGhost,
} from '../../optional-practice/civilian-fpv/world-progress.mjs';

await initWorldRuntime();
const neutral = { roll: 0, pitch: 0, yaw: 0, throttle: 0 };
const academyCourse = () => {
  const course = structuredClone(FLIGHT_COURSES[0]);
  course.steps['self-level'] = [
    {
      ...course.steps['self-level'][0],
      min: { x: 15000, y: 8000, z: 15000 },
      max: { x: 16000, y: 9000, z: 16000 },
    },
  ];
  course.steps.acro = structuredClone(course.steps['self-level']);
  return course;
};
const worldCourse = () => ({
  format: 'FlightCourse.v2',
  id: 'rates-world-test',
  revision: 'r1',
  environment: 'test-world',
  world: { id: 'test-world', theme: 'test-theme', style: 'test-style' },
  locales: Object.fromEntries(
    ['en', 'uk'].map((lang) => [lang, { title: 'World', brief: 'Fly', lesson: 'Practice' }]),
  ),
  spawn: { x: 0, y: 0, z: 0 },
  bounds: { min: { x: -10000, y: 0, z: -10000 }, max: { x: 10000, y: 15000, z: 10000 } },
  obstacles: [],
  actors: [],
  steps: { 'self-level': [{ type: 'survive', ticks: 25 }], acro: [{ type: 'survive', ticks: 25 }] },
});
const recordFor = (proof) => ({ status: 'verified', diagnostic: 'complete', proof });

test('every published Academy demonstration keeps its exact legacy identity and completion', () => {
  for (const proof of FLIGHT_DEMONSTRATIONS) {
    const course = FLIGHT_COURSES.find((entry) => entry.id === proof.course);
    const checked = replayFlight(course, proof);
    assert.equal(checked.state.status, 'complete', proof.course);
    assert.equal(checked.state.ticks, proof.frames.length);
    assert.equal(Object.hasOwn(checked.identity, 'comparisonIdentity'), false);
    for (const [key, value] of Object.entries(checked.identity)) assert.equal(proof[key], value);
  }
});

test('Academy Acro commands full supported rates and records an immutable response for replay', () => {
  const course = academyCourse();
  const response = createTunedResponse(
    createRateProfile({ axes: { roll: { rcRate: 200, rate: 200 } } }),
    { responseTicks: 1 },
  );
  const flight = createFlight({ course, mode: 'acro', response });
  const recorder = createFlightRecorder(flight);
  assert.equal(Object.isFrozen(flight.identity), true);
  assert.throws(() => {
    flight.identity.responseIdentity = 'changed';
  }, TypeError);
  flight.arm();
  const input = { ...neutral, roll: 1 };
  recorder.record(input);
  const first = flight.step(input);
  assert.equal(first.angular.roll, 199800);
  response.rates.axes.roll.rate = 1;
  const returned = flight.response();
  returned.rates.axes.roll.rate = 1;
  assert.equal(flight.response().rates.axes.roll.rate, 200);
  const proof = recorder.export();
  assert.deepEqual(replayFlight(course, proof).state, first);
  assert.equal(proof.comparisonIdentity, flight.identity.comparisonIdentity);
  const forged = structuredClone(proof);
  forged.response.rates.axes.roll.rate = 1;
  assert.throws(() => replayFlight(course, forged), /Exact flight/);
  assert.throws(
    () => replayFlight(course, { ...proof, comparisonIdentity: 'forged' }),
    /Exact flight/,
  );
  delete forged.comparisonIdentity;
  assert.throws(() => replayFlight(course, forged), /Exact flight/);
});

test('maximum coupled rates remain bounded and deterministic through a full-duration changing-input flight', () => {
  const maximum = { rcRate: 200, rate: 200, limit: 1998 };
  const response = createTunedResponse(
    createRateProfile({
      axes: { roll: maximum, pitch: maximum, yaw: maximum },
      throttle: { mid: 35, expo: 70, hover: 20, limitType: 'scale', limitPercent: 90 },
    }),
    { responseTicks: 1 },
  );
  const start = () => ({
    orientation: [0, 0, 0, Q],
    angular: { roll: 0, pitch: 0, yaw: 0 },
    velocity: { x: 0, y: 0, z: 0 },
  });
  const first = start(),
    repeated = start(),
    displacement = {},
    repeatedDisplacement = {};
  for (let tick = 0; tick < 36000; tick++) {
    const command = {
      roll: Math.floor(tick / 11) % 2 ? -1000 : 1000,
      pitch: Math.floor(tick / 17) % 2 ? -1000 : 1000,
      yaw: Math.floor(tick / 23) % 2 ? -1000 : 1000,
      throttle: tick % 1001,
    };
    advanceFlightAir(first, command, 'acro', response, displacement);
    advanceFlightAir(repeated, command, 'acro', response, repeatedDisplacement);
    for (const axis of ['roll', 'pitch', 'yaw'])
      assert.equal(Math.abs(first.angular[axis]), 199800);
    assert.ok(Math.abs(Math.hypot(...first.orientation) - Q) < 3);
    assert.ok(
      [
        ...first.orientation,
        ...Object.values(first.velocity),
        ...Object.values(displacement),
      ].every(Number.isSafeInteger),
    );
    assert.ok(Object.values(first.velocity).every((value) => Math.abs(value) <= 30000));
  }
  assert.deepEqual(first, repeated);
  assert.deepEqual(displacement, repeatedDisplacement);
});

test('World ghosts compare personal rotation profiles but replay each frozen configuration exactly', async () => {
  const course = worldCourse();
  const response = createTunedResponse(
    createRateProfile({ algorithm: 'quick', axes: { yaw: { expo: 40 } } }),
  );
  const flight = createWorldFlight({ course, mode: 'acro', response });
  const recorder = createWorldRecorder(flight);
  try {
    flight.arm();
    for (let i = 0; i < 25; i++) {
      flight.step({ ...neutral, yaw: i < 10 ? 0.7 : 0 });
      recorder.record();
    }
    const proof = recorder.export();
    const alternative = worldFlightIdentity({
      course,
      mode: 'acro',
      response: createTunedResponse(
        createRateProfile({
          algorithm: 'actual',
          axes: { yaw: { rcRate: 40, rate: 150, expo: 80 } },
        }),
      ),
    });
    assert.notEqual(alternative.responseIdentity, proof.responseIdentity);
    assert.equal(alternative.comparisonIdentity, proof.comparisonIdentity);
    assert.equal(compatibleGhost(recordFor(proof), alternative), true);
    const checked = await replayWorldFlight(course, proof);
    assert.deepEqual(checked.state, flight.snapshot());
    const exported = flight.response();
    exported.rates.axes.yaw.expo = 99;
    assert.equal(flight.response().rates.axes.yaw.expo, 40);
    await assert.rejects(
      replayWorldFlight(course, { ...proof, comparisonIdentity: 'forged' }),
      /Exact world/,
    );
    const missing = structuredClone(proof);
    delete missing.comparisonIdentity;
    await assert.rejects(replayWorldFlight(course, missing), /Exact world/);
  } finally {
    flight.dispose();
  }
});

test('comparison classes keep throttle, assists, physical response, mode, and world constraints', () => {
  const course = worldCourse();
  const response = createTunedResponse();
  const original = worldFlightIdentity({ course, response });
  const comparison = (changed, changedCourse = course, mode = 'self-level') =>
    compatibleFlightComparison(
      original,
      worldFlightIdentity({ course: changedCourse, response: changed, mode }),
    );
  assert.equal(
    comparison(createTunedResponse(createRateProfile({ algorithm: 'raceflight' }))),
    true,
  );
  for (const throttle of [
    { mid: 45 },
    { expo: 20 },
    { hover: 45 },
    { model: 'betaflight-4.5' },
    { limitType: 'scale', limitPercent: 50 },
    { limitType: 'clip', limitPercent: 50 },
  ])
    assert.equal(comparison(createTunedResponse(createRateProfile({ throttle }))), false);
  assert.equal(comparison(createTunedResponse(undefined, { maxTilt: 35 })), false);
  assert.equal(comparison(createTunedResponse(undefined, { responseTicks: 4 })), false);
  assert.equal(comparison(response, course, 'acro'), false);
  assert.equal(comparison(response, { ...course, revision: 'r2' }), false);
  const alteredBounds = structuredClone(course);
  alteredBounds.bounds.max.x += 1;
  assert.equal(comparison(response, alteredBounds), false);
});

test('legacy comparisons remain exact and cannot be upgraded by an imported metadata field', async () => {
  const course = worldCourse();
  const flight = createWorldFlight({ course });
  const recorder = createWorldRecorder(flight);
  try {
    const proof = recorder.export();
    const identical = worldFlightIdentity({ course });
    const changed = worldFlightIdentity({
      course,
      response: { ...DEFAULT_RESPONSE, maxRate: 360 },
    });
    assert.equal(Object.hasOwn(proof, 'comparisonIdentity'), false);
    assert.equal(compatibleFlightComparison(proof, identical), true);
    assert.equal(compatibleFlightComparison(proof, changed), false);
    await assert.rejects(
      replayWorldFlight(course, { ...proof, comparisonIdentity: 'invented' }),
      /Exact world/,
    );
    const academy = createFlight({ course: academyCourse() });
    assert.throws(
      () =>
        replayFlight(academyCourse(), {
          ...createFlightRecorder(academy).export(),
          comparisonIdentity: 'invented',
        }),
      /Exact flight/,
    );
    const tuned = worldFlightIdentity({ course, response: createTunedResponse() });
    assert.equal(
      compatibleGhost(recordFor({ ...proof, comparisonIdentity: tuned.comparisonIdentity }), tuned),
      false,
    );
  } finally {
    flight.dispose();
  }
});

test('forged comparison labels do not let a different throttle configuration enter a class', () => {
  const course = worldCourse();
  const response = createTunedResponse();
  const identity = worldFlightIdentity({ course, response });
  const proof = {
    ...identity,
    format: 'FlightAttempt.v2',
    session: 'practice',
    frames: [],
    response,
  };
  assert.equal(compatibleGhost(recordFor(proof), identity), true);
  const forged = structuredClone(proof);
  forged.response.rates.throttle.limitType = 'scale';
  forged.response.rates.throttle.limitPercent = 25;
  assert.equal(compatibleGhost(recordFor(forged), identity), false);
  delete forged.response;
  assert.equal(compatibleGhost(recordFor(forged), identity), false);
  assert.equal(compatibleGhost({ ...recordFor(proof), status: 'unverified' }, identity), false);
});
