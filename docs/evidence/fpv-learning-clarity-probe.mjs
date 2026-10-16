// Manual runtime/recording qualification, not new unit-test coverage.
// Run from the repository root: node docs/evidence/fpv-learning-clarity-probe.mjs
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { learningObjectiveFeedback as feedback } from '../../optional-practice/civilian-fpv/beginner-coach.mjs';
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
const root = fileURLToPath(new URL('../../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const baseline = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const checks = [],
  lessons = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  assert(condition, name);
};
const inputFiles = [
  'optional-practice/civilian-fpv/beginner-coach.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-demonstrations.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/sim-presentation.mjs',
];
const sources = {};
for (const path of inputFiles)
  sources[path] = hash(await readFile(new URL('../../' + path, import.meta.url)));
for (const path of inputFiles.filter((path) =>
  /(?:world-demonstrations|world-model|world-collision|math|radio-profile)\.mjs$/.test(path),
))
  check(
    'Unmodified runtime or proof bytes: ' + path,
    sources[path] ===
      hash(
        execFileSync('git', ['show', baseline + ':' + path], {
          cwd: root,
          maxBuffer: 32 * 1024 * 1024,
        }),
      ),
  );
const tilt = BEGINNER_LESSONS.find((lesson) => lesson.id === 'beginner-13').course.steps.acro[1];
const state = {
  step: 1,
  total: 4,
  position: { x: 0, y: 4000, z: 0 },
  velocity: { x: 0, y: 0, z: 0 },
  attitude: { roll: 0, pitch: 0, yaw: 0 },
  lastInput: { roll: 0, pitch: 0, yaw: 0, throttle: 500 },
  hold: 0,
};
const tilted = { ...state, attitude: { ...state.attitude, pitch: 1000 } };
check(
  'Acro13 upright hovering explains missing tilt',
  /Tip a little/.test(feedback(tilt, state).hint),
);
check(
  'Acro13 objective displays tilt range and centred requirement',
  /6–18°/.test(feedback(tilt, state).objective) && /centred/.test(feedback(tilt, state).objective),
);
check(
  'Acro13 all predicates qualify at10degrees with rotation centred',
  feedback(tilt, tilted).checks.every((row) => row.met),
);
check(
  'Acro13 centred input50 accepted',
  feedback(tilt, { ...tilted, lastInput: { ...state.lastInput, pitch: 50 } }).checks.every(
    (row) => row.met,
  ),
);
check(
  'Acro13 input51 explains centring',
  /Release pitch/.test(
    feedback(tilt, { ...tilted, lastInput: { ...state.lastInput, pitch: 51 } }).hint,
  ),
);
check(
  'Acro13 minimum6degrees accepted',
  feedback(tilt, { ...tilted, attitude: { ...state.attitude, pitch: 600 } }).checks.every(
    (row) => row.met,
  ),
);
check(
  'Acro13 tilt599 rejected',
  !feedback(tilt, { ...tilted, attitude: { ...state.attitude, pitch: 599 } }).checks.find(
    (row) => row.id === 'tilt',
  ).met,
);
check(
  'Acro13 tilt1801 rejected',
  !feedback(tilt, { ...tilted, attitude: { ...state.attitude, pitch: 1801 } }).checks.find(
    (row) => row.id === 'tilt',
  ).met,
);
check(
  'Acro13 horizontal zone is inclusive',
  feedback(tilt, { ...tilted, position: { x: 12000, y: 4000, z: -12000 } }).checks.every(
    (row) => row.met,
  ),
);
check(
  'Acro13 leaving horizontal zone gives position hint',
  /marked target/.test(feedback(tilt, { ...tilted, position: { x: 12001, y: 4000, z: 0 } }).hint),
);
check(
  'Speed includes vertical motion',
  !feedback(tilt, { ...tilted, velocity: { x: 0, y: 12001, z: 0 } }).checks.find(
    (row) => row.id === 'speed',
  ).met,
);
check(
  'Self-level remains honest about retained tilt',
  /Self-level returns/.test(feedback(tilt, state, { mode: 'self-level' }).modeNote),
);
check(
  'Dwell displays exact12tick duration',
  feedback(tilt, { ...tilted, hold: 6 }).progress === 0.5 &&
    /0.24/.test(feedback(tilt, tilted).detail),
);
check(
  'No telemetry is fabricated before state arrives',
  feedback(tilt, null).checks.every((row) => row.value === '—' && !row.met),
);
check(
  'Missing target does not imply completion without runtime state',
  feedback(null, null).progress === 0,
);
check(
  'Finished runtime route permits completion summary',
  feedback(null, { ...state, step: 4 }).progress === 1,
);
const gate = BEGINNER_LESSONS.flatMap((lesson) => lesson.course.steps.acro).find(
  (target) => target.type === 'gate',
);
const approach = {
  ...state,
  position: {
    ...state.position,
    [gate.axis]: gate.at - gate.direction * 1000,
    [gate.axis === 'x' ? 'z' : 'x']: (gate.minSide + gate.maxSide) / 2,
    y: (gate.minY + gate.maxY) / 2,
  },
};
check(
  'Gate height alone never fabricates completed crossing',
  feedback(gate, approach).progress === 0 && /Hovering/.test(feedback(gate, approach).hint),
);
check(
  'Passed gate plane without crossing requests return',
  /Return/.test(
    feedback(gate, {
      ...approach,
      position: { ...approach.position, [gate.axis]: gate.at + gate.direction * 1000 },
    }).detail,
  ),
);
check(
  'Gate missing state is unmeasured',
  feedback(gate, null).checks.every((row) => row.value === '—' && !row.met),
);
check(
  'Gate lateral miss is explained',
  /Line up/.test(
    feedback(gate, {
      ...approach,
      position: { ...approach.position, [gate.axis === 'x' ? 'z' : 'x']: gate.maxSide + 1 },
    }).hint,
  ),
);
const track = WORLD_CATALOGUE.flatMap((entry) => entry.course.steps.acro).find(
  (target) => target.type === 'actor-track-v1',
);
check('Actor-track fixture exists', Boolean(track));
check('Actor-track missing state is safe', feedback(track, null).progress === 0);
check(
  'Actor-track stale step counters do not count',
  feedback(track, {
    ...state,
    hold: track.ticks,
    actorTrack: { index: 0, travel: track.minTargetTravel },
  }).progress === 0,
);
check(
  'Actor-track runtime occlusion reason is respected',
  /sight line/.test(
    feedback(track, { ...state, actorTrack: { index: 1, reason: 'subject-occluded', travel: 0 } })
      .hint,
  ),
);
check(
  'Actor-track duration alone cannot replace target travel',
  feedback(
    { ...track, minTargetTravel: 1000 },
    {
      ...state,
      hold: track.ticks,
      actorTrack: { index: 1, reason: 'subject-travel', travel: 500 },
    },
  ).progress === 0.5,
);
check(
  'Unordered contact does not invent target order',
  !/order/.test(
    feedback({ type: 'hunt-contact-v1', targets: ['a'], ordered: false }, state).objective,
  ),
);
check(
  'Eliminate counts defeated actors only',
  feedback(
    { type: 'eliminate', targets: ['a', 'b'] },
    {
      ...state,
      actors: [
        { id: 'a', status: 'defeated' },
        { id: 'b', status: 'active' },
      ],
    },
  ).progress === 0.5,
);
check(
  'Survive uses runtime ticks only',
  feedback({ type: 'survive', ticks: 50 }, { ...state, hold: 25 }).progress === 0.5,
);
let localizedObjectives = 0;
const types = {};
for (const lesson of BEGINNER_LESSONS)
  for (const mode of ['acro', 'self-level'])
    for (const target of lesson.course.steps[mode]) {
      types[target.type] = (types[target.type] ?? 0) + 1;
      for (const locale of ['en', 'uk']) {
        const value = feedback(target, null, { mode, locale });
        assert(
          value.objective.length && Number.isFinite(value.progress) && Array.isArray(value.checks),
        );
        assert(!/undefined|NaN/.test(JSON.stringify(value)));
        assert.equal(value.progress, 0);
        localizedObjectives++;
      }
    }
check('Every EN/UK lesson and mode has safe initial guidance', localizedObjectives > 0);
await initWorldRuntime();
let totalTicks = 0,
  holdComparisons = 0,
  acceptedHoldComparisons = 0;
for (const lesson of BEGINNER_LESSONS) {
  const demonstration = WORLD_DEMONSTRATIONS.find(
    (entry) => entry.proof.course === lesson.id && entry.proof.mode === lesson.mode,
  );
  assert(demonstration, lesson.id + ' recommended example');
  const proof = demonstration.proof;
  const flight = createWorldFlight({
    course: lesson.course,
    mode: proof.mode,
    response: proof.response,
  });
  flight.arm();
  const transitions = [];
  let compared = 0;
  try {
    for (const row of proof.frames) {
      const before = flight.snapshot();
      const current = flight.step(
        { roll: row[0], pitch: row[1], yaw: row[2], throttle: row[3], actions: row[4] },
        { quantized: true },
      );
      if (['hold', 'land'].includes(before.target.type)) {
        const qualified = feedback(before.target, current).checks.every((value) => value.met);
        if (current.step === before.step) {
          assert.equal(qualified, current.hold > 0, lesson.id + ' predicate tick' + current.ticks);
          holdComparisons++;
          compared++;
        } else {
          assert(qualified, lesson.id + ' accepted criterion');
          acceptedHoldComparisons++;
        }
      }
      if (current.step > before.step)
        transitions.push({
          index: before.step,
          title: lesson.steps[before.step].title.en,
          criterion: before.target.type,
          tick: current.ticks,
        });
    }
    const final = flight.snapshot();
    assert.equal(final.status, 'complete', lesson.id);
    assert.equal(transitions.length, lesson.steps.length, lesson.id + ' every real step');
    assert.equal(worldStateIdentity(final), proof.finalStateIdentity, lesson.id);
    const independent = await replayWorldFlight(lesson.course, proof);
    assert.equal(independent.state.status, 'complete', lesson.id + ' independent replay');
    assert.equal(
      worldStateIdentity(independent.state),
      proof.finalStateIdentity,
      lesson.id + ' independent identity',
    );
    totalTicks += proof.frames.length;
    lessons.push({
      id: lesson.id,
      title: lesson.title.en,
      mode: proof.mode,
      sourceIdentity: demonstration.sourceIdentity,
      proofSha256: hash(JSON.stringify(proof)),
      frames: proof.frames.length,
      finalStateIdentity: proof.finalStateIdentity,
      directStatus: final.status,
      independentStatus: independent.state.status,
      holdPredicateFrames: compared,
      transitions,
    });
  } finally {
    flight.dispose();
  }
}
check(
  'All58 current School recommended examples complete and replay exactly',
  lessons.length === 58,
);
const receipt = {
  format: 'FpvLearningClarityManualVerification.v1',
  createdAt: new Date().toISOString(),
  baseline,
  node: process.version,
  command: 'node docs/evidence/fpv-learning-clarity-probe.mjs',
  scope:
    'Observer criteria and unchanged recommended-mode lesson recordings; no browser, hardware, novice acceptance or new unit coverage claimed.',
  sources,
  probeSha256: hash(await readFile(new URL(import.meta.url))),
  checks,
  summary: {
    checks: checks.length,
    localizedObjectives,
    lessonCount: lessons.length,
    stepTypesAcrossBothModes: types,
    recordedTicks: totalTicks,
    independentReplayTicks: totalTicks,
    holdPredicateComparisons: holdComparisons,
    acceptedHoldComparisons,
    predicateMismatches: 0,
  },
  lessons,
  browser: { status: 'not-run-by-this-probe' },
};
await writeFile(
  new URL('../fpv-learning-clarity-verification.json', import.meta.url),
  JSON.stringify(receipt, null, 2) + '\n',
);
console.log(JSON.stringify(receipt.summary));
