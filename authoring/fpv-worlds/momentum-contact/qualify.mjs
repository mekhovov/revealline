/** Manual production-runtime probe, outside the permanent unit-test suites.
 * node authoring/fpv-worlds/momentum-contact/qualify.mjs [--write]
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { dataIdentity } from '../../../game/data-json.mjs';
import { WORLD_CATALOGUE } from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import {
  initWorldRuntime,
  validateWorldCourse,
  exportWorldCourse,
  createWorldFlight,
  createWorldRecorder,
  replayWorldFlight,
  recoverWorldFlight,
  worldStateIdentity,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
import { responseCurve } from '../../../optional-practice/civilian-fpv/radio-profile.mjs';
import { momentumPracticeCourse } from './course.mjs';
import { probeEditor } from './editor-probe.mjs';
import { probePack } from './pack.mjs';

const directory = new URL('./evidence/', import.meta.url);
const baseline = JSON.parse(fs.readFileSync(new URL('baseline.json', directory)));
const archive = JSON.parse(
  fs.readFileSync(
    new URL('../../../docs/evidence/sim-snake-hunt-flight-proofs.json', import.meta.url),
  ),
);
const rows = [];
let checks = 0;
const check = (condition, message) => {
  checks++;
  assert.ok(condition, message);
};
const equal = (actual, expected, message) => {
  checks++;
  assert.deepEqual(actual, expected, message);
};
const reject = (fn, message) => {
  checks++;
  assert.throws(fn, undefined, message);
};
const rejectReplay = async (course, proof, message) => {
  checks++;
  await assert.rejects(replayWorldFlight(course, proof), (error) => {
    assert.match(error.message, /Exact world, runtime/, message);
    rows.push({ kind: 'replay-rejection', check: message, reason: error.message });
    return true;
  });
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const speed = (velocity) => Math.hypot(velocity.x, velocity.y, velocity.z);
const unshape = (output) => {
  const magnitude = Math.min(1000, Math.abs(output));
  let input = 0;
  while (input < 1000 && responseCurve(input, 30) < magnitude) input++;
  return Math.sign(output) * input;
};
function approach(state, destination, mode = 'self-level') {
  const acceleration = {};
  for (const axis of ['x', 'z']) {
    const velocity = clamp((destination[axis] - state.position[axis]) * 0.6, -2400, 2400);
    acceleration[axis] = clamp((velocity - state.velocity[axis]) * 2.4, -4000, 4000);
  }
  const angles = {
    roll: (Math.atan2(acceleration.x, 9810) * 180) / Math.PI,
    pitch: (-Math.atan2(acceleration.z, 9810) * 180) / Math.PI,
  };
  const vertical = clamp(
    (destination.y - state.position.y) * 4 - state.velocity.y * 3,
    -6000,
    7000,
  );
  return {
    ...Object.fromEntries(
      Object.entries(angles).map(([axis, angle]) => [
        axis,
        unshape(
          mode === 'acro'
            ? ((angle - state.attitude[axis] / 100) * 4 * 1000) / 240
            : (angle * 1000) / 30,
        ),
      ]),
    ),
    yaw: 0,
    actions: 0,
    throttle: Math.round(
      clamp(
        ((9810 + vertical) / 19620 / Math.max(0.65, state.attitude.up.y / 1000000)) * 1000,
        0,
        1000,
      ),
    ),
  };
}
const ordinary = (source) => {
  const course = structuredClone(source);
  for (const steps of Object.values(course.steps))
    for (const step of steps) delete step.contactPolicy;
  return course;
};
const run = async (course, mode) => {
  const flight = createWorldFlight({ course, mode });
  const recorder = createWorldRecorder(flight, { session: 'demonstration' });
  const catches = [];
  let prefix,
    movingTicks = 0;
  try {
    flight.arm();
    let state = flight.snapshot();
    while (state.status === 'active') {
      const target = state.actors.find((actor) => actor.status === 'active');
      const destination = target ? { ...target.position, y: 1000 } : { ...state.position, y: 1000 };
      const before = target?.position;
      state = flight.step(approach(state, destination, mode), { quantized: true });
      recorder.record();
      if (target) {
        const after = state.actors.find((actor) => actor.id === target.id).position;
        if (before.x !== after.x || before.z !== after.z) movingTicks++;
      }
      for (const event of state.events.filter((event) => event.type === 'catch')) {
        const caught = state.hunt.catches.find((row) => row.id === event.actor);
        catches.push({
          actor: event.actor,
          tick: state.ticks,
          position: state.position,
          incoming: caught.velocity,
          outgoing: state.velocity,
        });
      }
      if (!prefix && catches.length === 1) prefix = recorder.export();
    }
    check(state.status === 'complete', `${mode}: practice completes through legal inputs`);
    equal(state.hunt.caught, ['runner-01', 'runner-02'], `${mode}: exact ordered catches`);
    check(movingTicks > 0, `${mode}: targets actually moved`);
    const proof = recorder.export();
    const replay = await replayWorldFlight(course, proof);
    equal(
      worldStateIdentity(replay.state),
      proof.finalStateIdentity,
      `${mode}: exact fresh replay`,
    );
    return { course, proof, prefix, catches, movingTicks };
  } finally {
    flight.dispose();
  }
};

await initWorldRuntime();
const courses = WORLD_CATALOGUE.filter((entry) => !entry.legacy).map((entry) => ({
  id: entry.id,
  identity: dataIdentity(validateWorldCourse(entry.course)),
}));
equal(courses, baseline.courses, 'All 134 prior normalized course identities remain exact');
for (const row of archive.flights) {
  const course =
    typeof row.course === 'object'
      ? row.course
      : WORLD_CATALOGUE.find((entry) => entry.id === row.course).course;
  const { state } = await replayWorldFlight(course, row.proof);
  const expected = baseline.replays.find((item) => item.kind === row.kind);
  equal(
    {
      kind: row.kind,
      finalStateIdentity: worldStateIdentity(state),
      status: state.status,
      ticks: state.ticks,
    },
    expected,
    `${row.kind}: immutable original replay`,
  );
}
rows.push({ kind: 'legacy', courses: courses.length, archivedReplays: baseline.replays });

const source = momentumPracticeCourse();
const oldValidatorSource = execFileSync(
  'git',
  ['show', `${baseline.sourceRevision}:optional-practice/civilian-fpv/snake-hunt.mjs`],
  { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8' },
);
equal(
  crypto.createHash('sha256').update(oldValidatorSource).digest('hex'),
  baseline.files['optional-practice/civilian-fpv/snake-hunt.mjs'],
  'Legacy admission probe uses the exact captured baseline source',
);
const oldValidatorURL = `data:text/javascript;base64,${Buffer.from(
  oldValidatorSource
    .replace(
      '../../game/data-json.mjs',
      new URL('../../../game/data-json.mjs', import.meta.url).href,
    )
    .replace(
      './math.mjs',
      new URL('../../../optional-practice/civilian-fpv/math.mjs', import.meta.url).href,
    ),
).toString('base64')}`;
const oldValidator = await import(oldValidatorURL);
const oldModelSource = execFileSync(
  'git',
  ['show', `${baseline.sourceRevision}:optional-practice/civilian-fpv/world-model.mjs`],
  { cwd: fileURLToPath(new URL('../../../', import.meta.url)), encoding: 'utf8' },
);
equal(
  crypto.createHash('sha256').update(oldModelSource).digest('hex'),
  baseline.files['optional-practice/civilian-fpv/world-model.mjs'],
  'Normalized-byte comparison uses the exact captured baseline model source',
);
const oldModelURL = `data:text/javascript;base64,${Buffer.from(
  oldModelSource.replace(
    /from (['"])(\.[^'"]+)\1/g,
    (_match, _quote, specifier) =>
      `from '${specifier === './snake-hunt.mjs' ? oldValidatorURL : new URL(specifier, new URL('../../../optional-practice/civilian-fpv/world-model.mjs', import.meta.url)).href}'`,
  ),
).toString('base64')}`;
const oldModel = await import(oldModelURL);
for (const entry of WORLD_CATALOGUE.filter((entry) => !entry.legacy))
  equal(
    exportWorldCourse(entry.course),
    oldModel.exportWorldCourse(entry.course),
    `${entry.id}: normalized exported course bytes remain identical to baseline`,
  );
reject(
  () => oldValidator.validateHuntContact(source.steps['self-level'][0], source),
  'Original baseline validator rejects the opt-in policy instead of reinterpreting it',
);
oldValidator.validateHuntContact(ordinary(source).steps['self-level'][0], source);
rows.push({
  kind: 'baseline-admission',
  sourceRevision: baseline.sourceRevision,
  absentPolicyAccepted: true,
  newPolicyRejected: true,
  normalizedCourseBytesExact: courses.length,
});
equal(
  JSON.parse(exportWorldCourse(source)),
  validateWorldCourse(source),
  'Accepted JSON round-trip retains explicit contact policy',
);
for (const value of ['retain-momentum-v2', 'stop', null, {}]) {
  const invalid = structuredClone(source);
  invalid.steps['self-level'][0].contactPolicy = value;
  reject(() => validateWorldCourse(invalid), 'Unknown contact policy is rejected');
}
const pursuit = structuredClone(
  WORLD_CATALOGUE.find((entry) => entry.id === 'native-pursuit-runner-court').course,
);
pursuit.steps['self-level'].find((step) => step.type === 'hunt-contact-v1').contactPolicy =
  'retain-momentum-v1';
reject(
  () => validateWorldCourse(pursuit),
  'Pursuit contact policies require their own later version',
);

const fresh = [];
for (const mode of ['self-level', 'acro']) {
  const legacy = await run(ordinary(source), mode);
  const candidate = await run(source, mode);
  equal(
    legacy.proof.model,
    'civilian-world-hunt.v1',
    `${mode}: absent policy keeps old runtime model`,
  );
  equal(
    candidate.proof.model,
    'civilian-world-hunt.v2',
    `${mode}: opt-in has distinct runtime model`,
  );
  check(
    legacy.proof.courseIdentity !== candidate.proof.courseIdentity,
    `${mode}: contact policy participates in course identity`,
  );
  equal(
    candidate.catches[0].tick,
    legacy.catches[0].tick,
    `${mode}: first physical catch tick unchanged`,
  );
  equal(
    candidate.catches[0].position,
    legacy.catches[0].position,
    `${mode}: swept contact position unchanged`,
  );
  equal(
    candidate.catches[0].incoming,
    legacy.catches[0].incoming,
    `${mode}: incoming momentum unchanged`,
  );
  for (const caught of candidate.catches) {
    check(speed(caught.incoming) > 100, `${mode}: catch has meaningful incoming momentum`);
    equal(caught.outgoing, caught.incoming, `${mode}: eligible catch retains exact momentum`);
  }
  for (const caught of legacy.catches)
    equal(caught.outgoing, { x: 0, y: 0, z: 0 }, `${mode}: legacy moving contact remains stopped`);
  await rejectReplay(
    source,
    legacy.proof,
    `${mode}: legacy proof cannot be relabeled as new policy`,
  );
  await rejectReplay(
    ordinary(source),
    candidate.proof,
    `${mode}: new proof cannot replay under legacy policy`,
  );
  await rejectReplay(
    source,
    { ...candidate.proof, model: legacy.proof.model },
    `${mode}: model-only substitution is rejected`,
  );
  const recovered = await recoverWorldFlight(source, candidate.prefix);
  try {
    check(
      recovered.state.status === 'paused',
      `${mode}: recovered new-policy recording remains paused`,
    );
    recovered.flight.arm();
    for (const frame of candidate.proof.frames.slice(candidate.prefix.frames.length)) {
      recovered.flight.step(
        Object.fromEntries(
          ['roll', 'pitch', 'yaw', 'throttle', 'actions'].map((key, index) => [key, frame[index]]),
        ),
        { quantized: true },
      );
      recovered.recorder.record();
    }
    equal(
      recovered.recorder.export(),
      candidate.proof,
      `${mode}: recovered continuation preserves exact proof`,
    );
  } finally {
    recovered.flight.dispose();
  }
  fresh.push(candidate);
  rows.push({
    kind: 'fresh-practice',
    mode,
    oldModel: legacy.proof.model,
    newModel: candidate.proof.model,
    oldTicks: legacy.proof.frames.length,
    newTicks: candidate.proof.frames.length,
    catches: candidate.catches,
    movingTicks: candidate.movingTicks,
    recoveredContinuationExact: true,
    finalStateIdentity: candidate.proof.finalStateIdentity,
  });
}

// Feed matching ordinary commands into old/new policies while deliberately
// contacting objects that must not become successful catches.
const scenarios = [
  [
    'wrong-order',
    (course) => {
      for (const steps of Object.values(course.steps)) steps[0].targets.reverse();
    },
  ],
  [
    'non-target',
    (course) => {
      for (const steps of Object.values(course.steps)) steps[0].targets = ['runner-02'];
    },
  ],
  [
    'inactive-objective',
    (course) => {
      for (const steps of Object.values(course.steps))
        steps.unshift({ type: 'survive', ticks: 4000 });
    },
  ],
  [
    'moving-hazard',
    (course) => {
      for (const steps of Object.values(course.steps)) steps[0].targets = ['runner-02'];
      course.actors[0].type = 'hazard';
      course.actors[0].damage = 11;
      course.actors[0].position.y = 700;
      for (const point of course.actors[0].path) point.y = 700;
      delete course.actors[0].role;
    },
  ],
  [
    'solid-wall',
    (course) => {
      course.obstacles.push({
        id: 'practice-wall',
        min: { x: -19000, y: 0, z: -2000 },
        max: { x: 19000, y: 4000, z: -1500 },
      });
    },
  ],
  [
    'ground-support',
    (course) => {
      course.spawn.y = 0;
    },
  ],
  ['world-bounds', () => {}],
];
for (const [name, configure] of scenarios) {
  const course = momentumPracticeCourse();
  configure(course);
  const old = createWorldFlight({ course: ordinary(course) }),
    next = createWorldFlight({ course });
  let contactTicks = 0,
    supportedTicks = 0,
    stoppedTicks = 0;
  try {
    old.arm();
    next.arm();
    for (let tick = 0; tick < 1200; tick++) {
      const before = old.snapshot();
      const target = before.actors.find((actor) => actor.id === 'runner-01');
      const command =
        name === 'ground-support'
          ? { roll: 0, pitch: 0, yaw: 0, throttle: 0, actions: 0 }
          : approach(
              before,
              name === 'world-bounds'
                ? { x: 30000, y: 1000, z: 8000 }
                : { ...target.position, y: 1000 },
            );
      const a = old.step(command, { quantized: true }),
        b = next.step(command, { quantized: true });
      equal(
        worldStateIdentity(b),
        worldStateIdentity(a),
        `${name}: exact native state at tick ${tick + 1}`,
      );
      check(b.hunt.caught.length === 0, `${name}: no ineligible catch`);
      if (b.contacts > before.contacts) contactTicks++;
      if (b.grounded) supportedTicks++;
      if (b.contacts > before.contacts && speed(b.velocity) < 1) stoppedTicks++;
      if (a.status !== 'active') break;
    }
    check(
      name === 'ground-support' ? supportedTicks > 0 : contactTicks > 0,
      `${name}: actual physical contact observed`,
    );
    if (['wrong-order', 'non-target', 'inactive-objective'].includes(name))
      check(stoppedTicks > 0, `${name}: moving collision still stops the drone`);
    rows.push({
      kind: 'unchanged-contact',
      scenario: name,
      ticks: old.snapshot().ticks,
      contactTicks,
      supportedTicks,
      stoppedTicks,
    });
  } finally {
    old.dispose();
    next.dispose();
  }
}

const runtimeFiles = ['world-model.mjs', 'snake-hunt.mjs', 'world-actor-editor.mjs'].map((name) => {
  const url = new URL(`../../../optional-practice/civilian-fpv/${name}`, import.meta.url);
  return {
    path: `optional-practice/civilian-fpv/${name}`,
    bytes: fs.statSync(url).size,
    sha256: crypto.createHash('sha256').update(fs.readFileSync(url)).digest('hex'),
  };
});
rows.push(...(await probeEditor({ check, equal })));
rows.push(await probePack({ check, equal, write: process.argv.includes('--write') }));
const receipt = {
  format: 'fpv-hunt-momentum-qualification.v1',
  baselineRevision: baseline.sourceRevision,
  runtime: process.version,
  checks,
  passed: true,
  runtimeFiles,
  rows,
  limitations: [
    'Manual functional probe; no permanent unit coverage is added.',
    'Ordinary FlightCourse.v2 Hunt only; pursuit opt-in is rejected.',
    'No browser, package, deployment, physical device or player-acceptance claim.',
  ],
};
if (process.argv.includes('--write')) {
  fs.writeFileSync(
    new URL('qualification.json', directory),
    JSON.stringify(receipt, null, 2) + '\n',
  );
  fs.writeFileSync(
    new URL('practice-proofs.json', directory),
    JSON.stringify(
      {
        format: 'fpv-hunt-momentum-practice.v1',
        course: source,
        flights: fresh.map(({ proof }) => proof),
      },
      null,
      2,
    ) + '\n',
  );
}
console.log(
  JSON.stringify(
    {
      passed: true,
      checks,
      legacyCourses: courses.length,
      output: process.argv.includes('--write') ? fileURLToPath(directory) : null,
      rows,
    },
    null,
    2,
  ),
);
