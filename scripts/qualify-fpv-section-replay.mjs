#!/usr/bin/env node
/** Manual functional qualification using the real integrator and portable proofs. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output'))
  throw Error('Usage: node scripts/qualify-fpv-section-replay.mjs [--output receipt.json]');
const output = path.resolve(root, args[1] ?? 'dist/fpv-section-replay-functional.json');
const files = [
  'world-model.mjs',
  'world-progress.mjs',
  'world-collision.mjs',
  'world-catalogue.mjs',
  'world-demonstrations.mjs',
];
const hashes = async () =>
  Object.fromEntries(
    await Promise.all(
      files.map(async (name) => {
        const bytes = await readFile(path.join(root, 'optional-practice/civilian-fpv', name));
        return [
          name,
          { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') },
        ];
      }),
    ),
  );
const source = await hashes();
const load = (name) =>
  import(new URL('../optional-practice/civilian-fpv/' + name, import.meta.url));
const {
  createWorldFlight,
  createWorldRecorder,
  initWorldRuntime,
  validateWorldCourse,
  worldStateIdentity,
} = await load('world-model.mjs');
const { prepareSectionReplay, prepareCheckpointPractice } = await load('world-progress.mjs');
const { WORLD_CATALOGUE, BEGINNER_CATALOGUE } = await load('world-catalogue.mjs');
const { WORLD_DEMONSTRATIONS } = await load('world-demonstrations.mjs');
await initWorldRuntime();
const entries = new Map(
  [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].filter((e) => !e.legacy).map((e) => [e.id, e]),
);
const command = (frame) =>
  Object.fromEntries(
    ['roll', 'pitch', 'yaw', 'throttle', 'actions'].map((key, i) => [key, frame[i]]),
  );
const step = (flight, frame) => flight.step(command(frame), { quantized: true });
const normalized = (state) => ({ ...state, status: 'active' });
const noYield = async () => {};
const results = [],
  ordinary = new Map();
async function check(name, run) {
  try {
    results.push({ name, pass: true, ...(await run()) });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message, stack: error.stack });
    console.log('FAIL ' + name + ': ' + error.message);
  }
}
function recorderGuard(flight) {
  for (const session of ['practice', 'demonstration', 'authoring', 'replay'])
    assert.throws(() => createWorldRecorder(flight, { session }), /Unscored/);
}
function replay(proof, course) {
  const f = createWorldFlight({ course, mode: proof.mode, response: proof.response });
  try {
    f.arm();
    const starts = [f.snapshot()],
      ends = [];
    let state = starts[0];
    for (const frame of proof.frames) {
      assert.equal(state.status, 'active');
      state = step(f, frame);
      if (state.step > ends.length) {
        ends.push(state);
        starts[state.step] = state;
      }
    }
    assert.equal(worldStateIdentity(state), proof.finalStateIdentity);
    return { course, proof, starts, ends, state, identity: f.identity };
  } finally {
    f.dispose();
  }
}
await check(
  'Independently replay every installed v2 recording and retain exact section boundaries',
  () => {
    let frames = 0;
    for (const row of WORLD_DEMONSTRATIONS) {
      const proof = row.proof,
        course = entries.get(proof.course)?.course;
      assert.ok(course, proof.course);
      const r = replay(proof, course);
      assert.equal(r.state.status, 'complete', proof.course);
      ordinary.set(proof.course + ':' + proof.mode, r);
      frames += proof.frames.length;
    }
    return { proofs: ordinary.size, frames };
  },
);
await check(
  'Every recorded section restores its exact prefix and stops at the exact selected objective',
  async () => {
    let sections = 0,
      actorSections = 0,
      combatSections = 0,
      frames = 0;
    const worlds = {};
    for (const row of ordinary.values()) {
      const { course, proof, starts, ends } = row;
      for (let index = 0; index < ends.length; index++) {
        const p = await prepareSectionReplay(course, proof.mode, index, {
          proof,
          yieldControl: noYield,
        });
        const label = course.id + '/' + proof.mode + '/' + index;
        try {
          assert.equal(p.kind, 'section-replay', label);
          assert.equal(p.sectionComplete, true, label);
          assert.equal(p.recordedStatus, 'complete', label);
          assert.equal(p.startTick, starts[index].ticks, label);
          assert.equal(p.endTick, ends[index].ticks, label);
          assert.equal(p.stopStep, index + 1, label);
          assert.deepEqual(p.flight.identity, row.identity, label);
          assert.deepEqual(normalized(p.flight.snapshot()), normalized(starts[index]), label);
          assert.equal(p.flight.snapshot().status, 'paused', label);
          recorderGuard(p.flight);
          const paused = p.flight.snapshot();
          step(p.flight, [1000, 1000, 1000, 1000, 1]);
          assert.deepEqual(p.flight.snapshot(), paused, label);
          p.flight.arm();
          for (let tick = p.startTick; tick < p.endTick; tick++) {
            step(p.flight, p.proof.frames[tick]);
            frames++;
          }
          assert.equal(p.flight.snapshot().status, 'complete', label);
          assert.deepEqual(normalized(p.flight.snapshot()), normalized(ends[index]), label);
          const terminal = p.flight.snapshot();
          step(p.flight, [1000, 1000, 1000, 1000, 1]);
          assert.deepEqual(p.flight.snapshot(), terminal, label);
          recorderGuard(p.flight);
          sections++;
          if (starts[index].actors.length) actorSections++;
          if (p.proof.frames.slice(p.startTick, p.endTick).some((f) => f[4])) combatSections++;
          worlds[course.environment] = (worlds[course.environment] ?? 0) + 1;
        } finally {
          p.flight.dispose();
        }
      }
    }
    return { sections, actorSections, combatSections, consumedSectionFrames: frames, worlds };
  },
);
function synthetic({ failed = false, expired = false } = {}) {
  const base = entries.get('woodland-01').course;
  const hold = (ticks, minY = 2000, maxY = 4000) => ({
    type: 'hold',
    min: { x: -1000, y: minY, z: -1000 },
    max: { x: 1000, y: maxY, z: 1000 },
    ticks,
    maxSpeed: 6000,
    maxTilt: 9000,
    minTilt: 0,
    centred: false,
    heading: null,
  });
  const steps = [hold(5), hold(40, failed ? 10000 : 2000, failed ? 11000 : 4000), hold(15)];
  const course = validateWorldCourse({
    ...base,
    id: 'section-replay-functional',
    revision: failed ? 'failure' : expired ? 'expiry' : 'complete',
    spawn: { x: 0, y: 3000, z: 0 },
    actors: [],
    obstacles: failed
      ? [
          {
            id: 'failure-floor',
            min: { x: -10000, y: 0, z: -10000 },
            max: { x: 10000, y: 1000, z: 10000 },
          },
        ]
      : [],
    rules: { ...base.rules, maxTicks: expired ? 12 : 500, playerHealth: 10, collisionDamage: 20 },
    steps: { 'self-level': steps, acro: structuredClone(steps) },
  });
  const f = createWorldFlight({ course });
  f.arm();
  const recorder = createWorldRecorder(f, { session: 'practice' });
  let prefix = null;
  try {
    while (f.snapshot().status === 'active') {
      f.step({ roll: 0, pitch: 0, yaw: 0, throttle: failed ? 0 : 0.5, actions: 0 });
      recorder.record();
      if (f.snapshot().ticks === 6) prefix = recorder.export();
    }
    const proof = recorder.export();
    return { ...replay(proof, course), prefix };
  } finally {
    f.dispose();
  }
}
const short = synthetic();
await check(
  'Interrupted, expired and failed recordings watch only reached evidence with honest incomplete metadata',
  async () => {
    const rows = [
      { ...short, proof: short.prefix },
      synthetic({ expired: true }),
      synthetic({ failed: true }),
    ];
    const details = [];
    for (const row of rows) {
      const expected = replay(row.proof, row.course);
      const p = await prepareSectionReplay(row.course, 'self-level', 1, {
        proof: row.proof,
        yieldControl: noYield,
      });
      try {
        assert.equal(p.kind, 'section-replay');
        assert.equal(p.sectionComplete, false);
        assert.equal(p.recordedStatus, expected.state.status);
        assert.equal(p.startTick, 5);
        assert.equal(p.endTick, row.proof.frames.length);
        p.flight.arm();
        for (let tick = p.startTick; tick < p.endTick; tick++) step(p.flight, p.proof.frames[tick]);
        assert.deepEqual(normalized(p.flight.snapshot()), normalized(expected.state));
        recorderGuard(p.flight);
        details.push({ status: expected.state.status, startTick: p.startTick, endTick: p.endTick });
      } finally {
        p.flight.dispose();
      }
      const unavailable = await prepareSectionReplay(row.course, 'self-level', 2, {
        proof: row.proof,
        yieldControl: noYield,
      });
      try {
        assert.equal(unavailable.kind, 'full-attempt');
        assert.equal(unavailable.reason, 'unreached-checkpoint');
        assert.equal(unavailable.proof, null);
        assert.equal(unavailable.flight.snapshot().ticks, 0);
        recorderGuard(unavailable.flight);
      } finally {
        unavailable.flight.dispose();
      }
    }
    assert.equal(rows[1].state.status, 'expired');
    assert.equal(rows[2].state.status, 'failed');
    return { recordings: details };
  },
);
await check(
  'Missing, incompatible, corrupted and unreached recordings never masquerade as section playback',
  async () => {
    const proof = short.proof,
      course = short.course;
    const cases = [
      ['missing', null, 'missing-proof'],
      ['wrong mode', { ...proof, mode: 'acro' }, 'incompatible-proof'],
      ['wrong revision', { ...proof, courseIdentity: 'invalid' }, 'invalid-proof'],
      ['bad terminal hash', { ...proof, finalStateIdentity: 'invalid' }, 'invalid-proof'],
      [
        'invalid action',
        { ...proof, frames: [[0, 0, 0, 500, 99], ...proof.frames.slice(1)] },
        'invalid-proof',
      ],
    ];
    for (const [name, candidate, reason] of cases) {
      const p = await prepareSectionReplay(course, 'self-level', 1, {
        proof: candidate,
        yieldControl: noYield,
      });
      try {
        assert.equal(p.kind, 'full-attempt', name);
        assert.equal(p.reason, reason, name);
        assert.equal(p.proof, null, name);
        assert.equal(p.flight.snapshot().status, 'paused');
        assert.deepEqual(p.flight.snapshot().position, course.spawn);
        recorderGuard(p.flight);
      } finally {
        p.flight.dispose();
      }
    }
    for (const index of [-1, 0.5, 3])
      await assert.rejects(prepareSectionReplay(course, 'self-level', index));
    return { cases: cases.length, invalidIndices: 3 };
  },
);
const sample = [...ordinary.values()].find(
  (r) => r.proof.frames.length > 600 && r.starts.length > 3,
);
await check(
  'Watching and practice use the same recorded entry, rate profile and immutable caller evidence',
  async () => {
    const candidate = structuredClone(sample.proof),
      index = sample.ends.length - 1;
    let yields = 0;
    const p = await prepareSectionReplay(sample.course, candidate.mode, index, {
      proof: candidate,
      yieldControl: async () => {
        if (yields++ === 0) {
          candidate.frames[0] = [1000, 1000, 1000, 1000, 1];
          candidate.frames.length = 1;
          candidate.finalStateIdentity = 'changed';
        }
      },
    });
    const practice = await prepareCheckpointPractice(sample.course, sample.proof.mode, index, {
      proof: sample.proof,
      yieldControl: noYield,
    });
    try {
      assert.equal(p.kind, 'section-replay');
      assert.ok(yields > 0);
      assert.deepEqual(p.proof, sample.proof);
      assert.deepEqual(p.flight.snapshot(), practice.flight.snapshot());
      assert.deepEqual(p.flight.response(), sample.proof.response);
      assert.deepEqual(p.flight.identity, practice.flight.identity);
      recorderGuard(p.flight);
    } finally {
      p.flight.dispose();
      practice.flight.dispose();
    }
    assert.throws(() => p.flight.step(command([0, 0, 0, 500, 0])), /disposed/i);
    return { course: sample.course.id, index, yields };
  },
);
await check(
  'Cancellation during validation or prefix reconstruction returns no usable flight',
  async () => {
    const index = sample.ends.length - 1;
    let count = 0;
    const counted = await prepareSectionReplay(sample.course, sample.proof.mode, index, {
      proof: sample.proof,
      yieldControl: async () => {
        count++;
      },
    });
    counted.flight.dispose();
    for (const abortAt of [1, count]) {
      const controller = new AbortController();
      let yields = 0;
      await assert.rejects(
        prepareSectionReplay(sample.course, sample.proof.mode, index, {
          proof: sample.proof,
          signal: controller.signal,
          yieldControl: async () => {
            if (++yields === abortAt) controller.abort();
          },
        }),
        { name: 'AbortError' },
      );
      assert.equal(yields, abortAt);
    }
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(
      prepareSectionReplay(sample.course, sample.proof.mode, index, {
        proof: sample.proof,
        signal: controller.signal,
      }),
      { name: 'AbortError' },
    );
    return { cooperativeYields: count, abortPositions: [1, count] };
  },
);
await check('Source bytes remain bound to this qualification', async () =>
  assert.deepEqual(await hashes(), source),
);
const receipt = {
  format: 'FPVSectionReplayFunctional.v1',
  generatedAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceFiles: source,
  scope:
    'Actual fixed-step simulation and exact portable recordings. Manual functional qualifier, not new unit coverage, browser acceptance, physical controls or deployment.',
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  results,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ passed: receipt.passed, total: receipt.total, output }));
if (receipt.passed !== receipt.total) process.exitCode = 1;
