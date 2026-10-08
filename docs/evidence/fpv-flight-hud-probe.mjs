// Bounded manual functional qualification. This is not a new unit-test suite.
// Run from the repository root: node docs/evidence/fpv-flight-hud-probe.mjs
// Writes only docs/fpv-flight-hud-verification.json, using an atomic replacement.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { flightGoalFeedback as feedback } from '../../optional-practice/civilian-fpv/sim-presentation.mjs';
import {
  BEGINNER_LESSONS,
  WORLD_CATALOGUE,
} from '../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { WORLD_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/world-demonstrations.mjs';
import {
  initWorldRuntime,
  createWorldFlight,
  replayWorldFlight,
  worldStateIdentity,
} from '../../optional-practice/civilian-fpv/world-model.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { FLIGHT_DEMONSTRATIONS } from '../../optional-practice/civilian-fpv/demonstrations.mjs';
import { createFlight, replayFlight } from '../../optional-practice/civilian-fpv/model.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const inputPaths = [
  'optional-practice/civilian-fpv/sim-presentation.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-demonstrations.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/catalogue.mjs',
  'optional-practice/civilian-fpv/demonstrations.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
];
const sources = {};
for (const path of inputPaths)
  sources[path] = hash(await readFile(new URL('../../' + path, import.meta.url)));
const checks = [];
const check = (name, value) => {
  assert(value, name);
  checks.push({ name, passed: true });
};
const typed = (value) => {
  assert(value.action.length && typeof value.label === 'string');
  assert(!/undefined|NaN/.test(JSON.stringify(value)));
  assert(Number.isFinite(value.gauge.min) && Number.isFinite(value.gauge.max));
  assert(value.gauge.min <= value.gauge.max);
  assert(value.gauge.valid ? Number.isFinite(value.gauge.value) : value.gauge.value === null);
  assert(value.gauge.valid || !value.gauge.met);
  assert([null, 'min', 'max'].includes(value.gauge.oneSided));
  assert(Number.isFinite(value.earned.value) && value.earned.value >= 0);
  assert(Number.isFinite(value.earned.total) && value.earned.total >= 0);
  assert(typeof value.earned.complete === 'boolean');
  for (const item of value.checks) {
    assert(
      item.id && item.label && typeof item.valid === 'boolean' && typeof item.met === 'boolean',
    );
    assert(item.valid || !item.met);
  }
  return value;
};
const take = (options) => typed(feedback(options));

// Focused edge fixtures use production definitions and the public adapter; they
// cannot advance physics, award objective credit or generate accepted recordings.
const course = BEGINNER_LESSONS.find((entry) => entry.id === 'beginner-13').course;
const target = course.steps.acro[1];
const state = {
  step: 1,
  ticks: 5,
  target,
  position: { x: 0, y: 4000, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  attitude: { roll: 0, pitch: 1000, yaw: 0 },
  lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 500 },
  hold: 0,
  grounded: false,
};
let value = take({ course, state });
check(
  'Acro tilt in range does not invent dwell',
  value.phase === 'hold' && value.gauge.kind === 'tilt' && value.earned.value === 0,
);
value = take({ course, state: { ...state, lastInput: { ...state.lastInput, pitch: 51 } } });
check(
  'Centre sticks action retains actual tilt gauge',
  value.gauge.kind === 'tilt' && value.gauge.value === 10 && value.action.includes('Centre'),
);
value = take({ course, state: { ...state, attitude: { roll: 0, pitch: 0, yaw: 0 } } });
check(
  'Level hover does not qualify as retained tilt',
  value.action === 'Tilt gently' && !value.gauge.met,
);
value = take({ course, state, legacy: true });
check(
  'Missing legacy facts are unknown, never passed',
  value.checks
    .filter((row) => ['speed', 'tilt', 'centred'].includes(row.id))
    .every((row) => !row.valid && !row.met),
);
const legacyFacts = {
  tick: 5,
  index: 1,
  speed: 1000,
  tilt: 1000,
  headingError: 0,
  hold: 2,
  conditions: { centred: true },
  throttle: 500,
};
value = take({ course, state, legacy: true, legacyFacts });
check(
  'Exact legacy facts supply consumed-tick credit',
  value.checks.every((row) => row.valid && row.met) && value.earned.value === 0.04,
);
value = take({ course, state, legacy: true, legacyFacts: { ...legacyFacts, tick: 4 } });
check(
  'Stale legacy facts are ignored',
  value.checks.some((row) => row.id === 'speed' && !row.valid),
);
const land = {
  ...target,
  type: 'land',
  min: { x: -1000, y: 0, z: -1000 },
  max: { x: 1000, y: 1000, z: 1000 },
  minTilt: 0,
  maxTilt: 1000,
  maxSpeed: 1000,
  centred: false,
};
const landed = {
  ...state,
  target: land,
  position: { x: 0, y: 0, z: 0 },
  attitude: { roll: 0, pitch: 0, yaw: 0 },
  grounded: true,
  landingSpeed: 1500,
  landingTilt: 0,
};
value = take({ course, state: landed });
check(
  'Zero velocity cannot hide a hard touchdown',
  value.action.includes('land softly again') &&
    !value.checks.find((row) => row.id === 'touchdown').met,
);
value = take({ course, state: { ...landed, landingSpeed: 500 } });
check(
  'Soft touchdown then requests throttle down',
  value.gauge.kind === 'throttle' && value.action === 'Lower throttle fully',
);
const gate = {
  type: 'gate',
  axis: 'z',
  at: -1000,
  direction: -1,
  minSide: -1000,
  maxSide: 1000,
  minY: 0,
  maxY: 5000,
};
value = take({ course, state: { ...state, target: gate, position: { x: 0, y: 2000, z: -2000 } } });
check(
  'Wrong-side gate asks for approach-side return',
  value.phase === 'approach' && value.action.includes('Return') && value.earned.value === 0,
);
const track = WORLD_CATALOGUE.flatMap((entry) => entry.course?.steps.acro ?? []).find(
  (step) => step.type === 'actor-track-v1',
);
assert(track);
value = take({
  course,
  state: {
    ...state,
    target: track,
    hold: 999,
    actorTrack: { index: 0, status: 'tracking', travel: 10000 },
  },
});
check(
  'Stale actor tracking cannot supply credit',
  value.earned.value === 0 && value.checks.every((row) => !row.valid),
);
value = take({
  course,
  state: {
    ...state,
    target: track,
    actorTrack: { index: 1, status: 'acquire', reason: 'subject-occluded', travel: 0 },
  },
});
check(
  'Occlusion uses authoritative evaluation order',
  value.checks.slice(0, 6).every((row) => row.valid && row.met) &&
    !value.checks[6].met &&
    value.action.includes('sight line'),
);
value = take({
  course,
  state: {
    ...state,
    target: { type: 'hunt-contact-v1', targets: ['a', 'b'], ordered: true },
    hunt: { caught: ['a'] },
    actors: [{ id: 'a', health: 100, status: 'caught' }],
  },
});
check(
  'Contact hunt uses caught IDs, not retained health',
  value.interaction === 'touch' &&
    value.worldTargetId === 'b' &&
    value.earned.value === 1 &&
    !value.earned.complete,
);
value = take({
  course,
  state: {
    ...state,
    target: { type: 'eliminate', targets: ['a', 'b'] },
    actors: [
      { id: 'a', health: 0, status: 'active' },
      { id: 'b', status: 'defeated' },
    ],
  },
});
check(
  'Combat uses defeated status, not guessed health',
  value.interaction === 'fire' && value.earned.value === 1 && value.worldTargetId === 'a',
);
value = take({
  course,
  state: { ...state, target: { type: 'survive', ticks: 50 }, grounded: true, hold: 25 },
});
check(
  'Survival has no invented airborne condition',
  value.earned.value === 0.5 && value.checks.length === 0,
);
value = take({ course, state: { ...state, step: 999, target: null, status: 'complete' } });
check(
  'Terminal route completion comes from runtime state',
  value.earned.complete && value.phase === 'complete',
);

const initial = { catalogue: 0, school: 0, types: {} };
for (const [name, entries] of [
  ['catalogue', WORLD_CATALOGUE],
  ['school', BEGINNER_LESSONS],
])
  for (const entry of entries) {
    if (!entry.course) continue;
    for (const mode of ['acro', 'self-level'])
      for (let step = 0; step < entry.course.steps[mode].length; step++)
        for (const locale of ['en', 'uk']) {
          const target = entry.course.steps[mode][step];
          const result = take({ course: entry.course, mode, locale, state: { step, target } });
          assert.equal(result.earned.value, 0);
          assert.equal(result.earned.complete, false);
          initial[name]++;
          initial.types[target.type] = (initial.types[target.type] ?? 0) + 1;
        }
  }
check(
  'Every catalogue and School mode has safe EN/UK initial feedback',
  initial.catalogue > 0 && initial.school > 0,
);

assert.equal(BEGINNER_LESSONS.length, 58, 'Qualify catalogue expansion explicitly');
assert.equal(FLIGHT_DEMONSTRATIONS.length, 24, 'Qualify Academy expansion explicitly');
const school = {
  demonstrations: [],
  frames: 0,
  replayFrames: 0,
  predicateComparisons: 0,
  transitions: 0,
};
await initWorldRuntime();
for (const lesson of BEGINNER_LESSONS) {
  const demo = WORLD_DEMONSTRATIONS.find(
    (entry) => entry.proof.course === lesson.id && entry.proof.mode === lesson.mode,
  );
  assert(demo, lesson.id + ' recommended-mode demonstration');
  const proof = demo.proof;
  assert(proof.frames.length > 0 && proof.frames.length <= 36000);
  const flight = createWorldFlight({
    course: lesson.course,
    mode: proof.mode,
    response: proof.response,
  });
  flight.arm();
  let transitions = 0,
    predicateComparisons = 0;
  try {
    for (const row of proof.frames) {
      const previous = flight.snapshot();
      const state = flight.step(
        { roll: row[0], pitch: row[1], yaw: row[2], throttle: row[3], actions: row[4] },
        { quantized: true },
      );
      const result = take({ course: lesson.course, mode: proof.mode, state });
      if (state.step === previous.step && ['hold', 'land'].includes(state.target.type)) {
        assert.equal(
          result.checks.every((row) => row.valid && row.met),
          state.hold > 0,
          lesson.id + ' predicate tick ' + state.ticks,
        );
        predicateComparisons++;
      }
      if (state.step > previous.step) transitions++;
    }
    const final = flight.snapshot();
    assert.equal(final.status, 'complete', lesson.id);
    assert.equal(
      worldStateIdentity(final),
      proof.finalStateIdentity,
      lesson.id + ' original proof identity',
    );
    const replay = await replayWorldFlight(lesson.course, proof);
    assert.equal(replay.state.status, 'complete', lesson.id + ' independent replay');
    assert.equal(
      worldStateIdentity(replay.state),
      proof.finalStateIdentity,
      lesson.id + ' independent proof identity',
    );
    school.demonstrations.push({
      id: lesson.id,
      mode: proof.mode,
      proofSha256: hash(JSON.stringify(proof)),
      frames: proof.frames.length,
      finalStateIdentity: proof.finalStateIdentity,
      direct: final.status,
      replay: replay.state.status,
      predicateComparisons,
      transitions,
    });
    school.frames += proof.frames.length;
    school.replayFrames += proof.frames.length;
    school.predicateComparisons += predicateComparisons;
    school.transitions += transitions;
  } finally {
    flight.dispose();
  }
}
check(
  'All58 School demonstrations complete with original final identities and independent replay',
  school.demonstrations.length === 58,
);

const academy = {
  demonstrations: [],
  frames: 0,
  replayFrames: 0,
  predicateComparisons: 0,
  transitions: 0,
};
for (const proof of FLIGHT_DEMONSTRATIONS) {
  const course = FLIGHT_COURSES.find((entry) => entry.id === proof.course);
  assert(proof.frames.length > 0 && proof.frames.length <= 36000);
  const flight = createFlight({ course, mode: proof.mode, response: proof.response });
  flight.arm();
  let predicateComparisons = 0,
    transitions = 0;
  for (const row of proof.frames) {
    const state = flight.step(
      { roll: row[0], pitch: row[1], yaw: row[2], throttle: row[3] },
      { quantized: true },
    );
    const legacyFacts = flight.objectiveFeedback();
    const result = take({ course, mode: proof.mode, state, legacy: true, legacyFacts });
    if (legacyFacts.index === state.step && ['hold', 'land'].includes(legacyFacts.type)) {
      assert.equal(
        result.checks.every((row) => row.valid && row.met),
        legacyFacts.eligible,
        course.id + ' consumed legacy criterion tick ' + state.ticks,
      );
      predicateComparisons++;
    } else if (legacyFacts.accepted) transitions++;
  }
  const final = flight.snapshot();
  assert.equal(final.status, 'complete', course.id);
  const replay = replayFlight(course, proof);
  assert.deepEqual(replay.state, final, course.id + ' independent Academy replay state');
  academy.demonstrations.push({
    id: course.id,
    mode: proof.mode,
    proofSha256: hash(JSON.stringify(proof)),
    frames: proof.frames.length,
    finalStateSha256: hash(JSON.stringify(final)),
    direct: final.status,
    replay: replay.state.status,
    predicateComparisons,
    transitions,
  });
  academy.frames += proof.frames.length;
  academy.replayFrames += proof.frames.length;
  academy.predicateComparisons += predicateComparisons;
  academy.transitions += transitions;
}
check(
  'All24 original Academy recordings complete and independently replay exactly',
  academy.demonstrations.length === 24,
);
for (const path of inputPaths)
  assert.equal(
    hash(await readFile(new URL('../../' + path, import.meta.url))),
    sources[path],
    'Source changed during qualification: ' + path,
  );
const receipt = {
  format: 'FpvFlightHudFunctionalVerification.v1',
  createdAt: new Date().toISOString(),
  baseline,
  node: process.version,
  command: 'node docs/evidence/fpv-flight-hud-probe.mjs',
  scope:
    'Observer-only typed HUD feedback and the existing 58 School plus24 Academy recommended-mode recordings. No browser, native/mobile hardware, novice acceptance, sustained FPS or new unit-suite coverage claimed.',
  limitations: [
    'Focused malformed/missing/stale-state cases are synthetic adapter inputs, not accepted flight recordings.',
    'Existing School recordings supply original final state identities. Academy v1 recordings have no final-state identity; direct and independent current-runtime replay states are compared here.',
    'This probe does not exercise DOM layout, fullscreen, pointer ownership, real radio/controller hardware or offline packaging.',
    'World hold/land comparisons use same-objective frames; transition snapshots already contain the next target. Runtime transitions and all final proof outcomes are checked separately.',
    'All predicates are read-only presentation; no physics, proof bytes or course definitions are changed.',
  ],
  sources,
  probeSha256: hash(await readFile(new URL(import.meta.url))),
  checks,
  initial,
  school,
  academy,
  totals: {
    demonstrations: school.demonstrations.length + academy.demonstrations.length,
    directlySteppedFrames: school.frames + academy.frames,
    independentlyReplayedFrames: school.replayFrames + academy.replayFrames,
    holdLandingPredicateComparisons: school.predicateComparisons + academy.predicateComparisons,
    runtimeTransitions: school.transitions + academy.transitions,
    initialLocalizedFeedbackCalls: initial.catalogue + initial.school,
  },
};
const destination = new URL('../fpv-flight-hud-verification.json', import.meta.url);
const temporary = new URL(
  '../.fpv-flight-hud-verification-' + process.pid + '.tmp',
  import.meta.url,
);
try {
  await writeFile(temporary, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  await rename(temporary, destination);
} catch (error) {
  await unlink(temporary).catch(() => {});
  throw error;
}
console.log(
  JSON.stringify(
    { passed: true, checks: checks.length, ...receipt.totals, receipt: fileURLToPath(destination) },
    null,
    2,
  ),
);
