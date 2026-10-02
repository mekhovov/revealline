#!/usr/bin/env node
/** Actual fixed-step checkpoints and portable proofs; no additional unit suite. */
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output'))
  throw new Error(
    'Usage: node scripts/qualify-fpv-checkpoint-practice.mjs [--output receipt.json]',
  );
const output = path.resolve(root, args[1] ?? 'dist/fpv-checkpoint-functional.json');
const files = [
  'world-model.mjs',
  'world-progress.mjs',
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
  worldCourseRequiresAcro,
  worldStateIdentity,
} = await load('world-model.mjs');
const { checkpointPractice, prepareCheckpointPractice } = await load('world-progress.mjs');
const { WORLD_CATALOGUE, BEGINNER_CATALOGUE } = await load('world-catalogue.mjs');
const { WORLD_DEMONSTRATIONS } = await load('world-demonstrations.mjs');
await initWorldRuntime();
const rows = [...WORLD_CATALOGUE, ...BEGINNER_CATALOGUE].filter((row) => !row.legacy);
const proofMap = new Map(
  WORLD_DEMONSTRATIONS.map((row) => [row.proof.course + ':' + row.proof.mode, row.proof]),
);
const noYield = async () => {};
const results = [];
async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, pass: true, ...detail });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, pass: false, error: error.message, stack: error.stack });
    console.log('FAIL ' + name + ': ' + error.message);
  }
}
const command = (frame) =>
  Object.fromEntries(
    ['roll', 'pitch', 'yaw', 'throttle', 'actions'].map((key, i) => [key, frame[i]]),
  );
const normalized = (state) => ({ ...state, status: 'active' });
const frameStep = (flight, frame) => flight.step(command(frame), { quantized: true });
function rejectsRecorders(flight) {
  for (const session of ['practice', 'demonstration', 'authoring', 'replay'])
    assert.throws(() => createWorldRecorder(flight, { session }), /Unscored/);
}
const ordinary = new Map();
await check(
  'Independently replay every bundled v2 proof and retain exact objective boundaries',
  () => {
    let frames = 0,
      actorBoundaries = 0,
      movingBoundaries = 0;
    for (const row of WORLD_DEMONSTRATIONS) {
      const proof = row.proof,
        course = rows.find((row) => row.id === proof.course)?.course;
      assert.ok(course, proof.course);
      const flight = createWorldFlight({ course, mode: proof.mode, response: proof.response });
      try {
        flight.arm();
        const entries = [flight.snapshot()],
          ends = [];
        let state = entries[0];
        for (const frame of proof.frames) {
          assert.equal(state.status, 'active', proof.course);
          state = frameStep(flight, frame);
          frames++;
          if (state.step > ends.length) {
            ends.push(state);
            entries[state.step] = state;
            if (state.actors.length) actorBoundaries++;
            if (Object.values(state.velocity).some((v) => v !== 0)) movingBoundaries++;
          }
        }
        assert.equal(worldStateIdentity(state), proof.finalStateIdentity, proof.course);
        assert.equal(state.status, 'complete', proof.course);
        ordinary.set(proof.course + ':' + proof.mode, {
          identity: flight.identity,
          entries,
          ends,
          course,
          proof,
        });
      } finally {
        flight.dispose();
      }
    }
    return { proofs: ordinary.size, frames, actorBoundaries, movingBoundaries };
  },
);
await check(
  'Every supported checkpoint restores exact entry state or safe original-route fallback',
  async () => {
    let checkpoints = 0,
      restored = 0,
      fallbacks = 0,
      oldSpawnFailures = [];
    const byWorld = {};
    for (const row of rows) {
      for (const mode of worldCourseRequiresAcro(row.course) ? ['acro'] : ['self-level', 'acro']) {
        const expected = ordinary.get(row.id + ':' + mode),
          proof = proofMap.get(row.id + ':' + mode);
        for (let index = 0; index < row.course.steps[mode].length; index++) {
          const label = `${row.id}/${mode}/${index}`;
          const safe = checkpointPractice(row.course, mode, index);
          assert.deepEqual(safe, validateWorldCourse(row.course), label);
          // Reproduce the removed centre-spawn heuristic to bind its known regressions.
          const old = structuredClone(safe),
            prior = old.steps[mode][Math.max(0, index - 1)],
            target = old.steps[mode][index];
          const centre = prior.min
            ? Object.fromEntries(['x', 'y', 'z'].map((k) => [k, (prior.min[k] + prior.max[k]) / 2]))
            : prior.type === 'gate'
              ? {
                  x: prior.axis === 'x' ? prior.at : (prior.minSide + prior.maxSide) / 2,
                  y: (prior.minY + prior.maxY) / 2,
                  z: prior.axis === 'z' ? prior.at : (prior.minSide + prior.maxSide) / 2,
                }
              : null;
          if (index > 0 && centre)
            old.spawn = {
              x: Math.round(centre.x),
              y: Math.max(300, Math.round(centre.y)),
              z: Math.round(centre.z),
            };
          old.steps = { 'self-level': [structuredClone(target)], acro: [structuredClone(target)] };
          try {
            createWorldFlight({ course: old, mode }).dispose();
          } catch (error) {
            oldSpawnFailures.push({ checkpoint: label, error: error.message });
          }
          const prepared = await prepareCheckpointPractice(row.course, mode, index, {
            proof,
            yieldControl: noYield,
          });
          const f = prepared.flight;
          try {
            assert.equal(f.snapshot().status, 'paused', label);
            assert.deepEqual(f.course(), safe, label);
            assert.equal(prepared.requestedIndex, index, label);
            rejectsRecorders(f);
            if (expected) {
              assert.equal(prepared.kind, 'checkpoint', label);
              assert.equal(prepared.reason, null, label);
              assert.equal(prepared.goalCount, 1, label);
              assert.equal(prepared.startTick, expected.entries[index].ticks, label);
              assert.deepEqual(f.identity, expected.identity, label);
              assert.deepEqual(
                normalized(f.snapshot()),
                normalized(expected.entries[index]),
                label,
              );
              assert.deepEqual(
                prepared.pickup,
                Object.fromEntries(
                  ['roll', 'pitch', 'yaw', 'throttle'].map((k) => [
                    k,
                    expected.entries[index].lastInput[k] / 1000,
                  ]),
                ),
                label,
              );
              const paused = f.snapshot();
              frameStep(f, [1000, 1000, 1000, 1000, 1]);
              assert.deepEqual(f.snapshot(), paused, label);
              f.arm();
              for (let tick = prepared.startTick; tick < expected.ends[index].ticks; tick++)
                frameStep(f, proof.frames[tick]);
              assert.equal(f.snapshot().status, 'complete', label);
              assert.deepEqual(normalized(f.snapshot()), normalized(expected.ends[index]), label);
              const completed = f.snapshot();
              frameStep(f, [1000, 1000, 1000, 1000, 1]);
              assert.deepEqual(f.snapshot(), completed, label);
              rejectsRecorders(f);
              restored++;
            } else {
              assert.equal(prepared.kind, 'full-attempt', label);
              assert.equal(prepared.reason, 'missing-proof', label);
              assert.equal(prepared.startTick, 0, label);
              assert.equal(prepared.index, 0, label);
              assert.equal(prepared.goalCount, safe.steps[mode].length, label);
              assert.deepEqual(f.snapshot().position, safe.spawn, label);
              assert.deepEqual(f.snapshot().velocity, { x: 0, y: 0, z: 0 }, label);
              fallbacks++;
            }
            checkpoints++;
            byWorld[row.world] = (byWorld[row.world] ?? 0) + 1;
          } finally {
            f.dispose();
          }
        }
      }
      if (checkpoints % 100 < 20) console.log(`Checked ${checkpoints} checkpoint positions`);
    }
    assert.equal(
      checkpoints,
      rows.reduce(
        (sum, row) =>
          sum +
          row.course.steps.acro.length +
          (worldCourseRequiresAcro(row.course) ? 0 : row.course.steps['self-level'].length),
        0,
      ),
    );
    assert.equal(
      oldSpawnFailures.length,
      4,
      'The four original obstructed centre-spawn regressions remain represented',
    );
    return { checkpoints, restored, fallbacks, oldSpawnFailures, byWorld };
  },
);
const sample = [...ordinary.values()].find(
  (r) => r.entries.length > 3 && r.proof.mode === 'self-level',
);
await check(
  'Incomplete recorded attempt restores a reached objective and falls back for an unreached objective',
  async () => {
    const { course, proof, entries } = sample,
      index = 1;
    const f = createWorldFlight({ course, mode: proof.mode, response: proof.response });
    f.arm();
    const recorder = createWorldRecorder(f, { session: 'practice' });
    for (let tick = 0; tick < entries[index].ticks + 1; tick++) {
      frameStep(f, proof.frames[tick]);
      recorder.record();
    }
    const partial = recorder.export();
    f.dispose();
    const reached = await prepareCheckpointPractice(course, proof.mode, index, {
      proof: partial,
      yieldControl: noYield,
    });
    try {
      assert.equal(reached.kind, 'checkpoint');
      assert.deepEqual(normalized(reached.flight.snapshot()), normalized(entries[index]));
      rejectsRecorders(reached.flight);
    } finally {
      reached.flight.dispose();
    }
    const unreached = await prepareCheckpointPractice(
      course,
      proof.mode,
      course.steps[proof.mode].length - 1,
      { proof: partial, yieldControl: noYield },
    );
    try {
      assert.equal(unreached.kind, 'full-attempt');
      assert.equal(unreached.reason, 'unreached-checkpoint');
      assert.deepEqual(unreached.flight.snapshot().position, course.spawn);
    } finally {
      unreached.flight.dispose();
    }
    return { course: course.id, prefixTicks: partial.frames.length };
  },
);
await check(
  'Tampered, wrong-mode and incompatible revision proofs fail closed to unscored original start',
  async () => {
    const { course, proof } = sample;
    for (const [name, candidate, expected] of [
      ['state hash', { ...proof, finalStateIdentity: 'invalid' }, 'invalid-proof'],
      ['revision', { ...proof, courseIdentity: 'invalid' }, 'invalid-proof'],
      ['mode', { ...proof, mode: 'acro' }, 'incompatible-proof'],
      [
        'command',
        { ...proof, frames: [[0, 0, 0, 500, 99], ...proof.frames.slice(1)] },
        'invalid-proof',
      ],
    ]) {
      const prepared = await prepareCheckpointPractice(course, proof.mode, 1, {
        proof: candidate,
        yieldControl: noYield,
      });
      try {
        assert.equal(prepared.kind, 'full-attempt', name);
        assert.equal(prepared.reason, expected, name);
        assert.deepEqual(prepared.flight.snapshot().position, course.spawn);
        rejectsRecorders(prepared.flight);
      } finally {
        prepared.flight.dispose();
      }
    }
  },
);
await check(
  'Caller mutation across asynchronous yields cannot change verified checkpoint commands',
  async () => {
    const { course, proof, entries } = sample,
      candidate = structuredClone(proof);
    let yields = 0;
    const prepared = await prepareCheckpointPractice(course, proof.mode, 1, {
      proof: candidate,
      yieldControl: async () => {
        if (yields++ === 0) {
          candidate.frames[0] = [1000, 1000, 1000, 1000, 1];
          candidate.frames.length = 1;
          candidate.finalStateIdentity = 'changed';
        }
      },
    });
    try {
      assert.equal(prepared.kind, 'checkpoint');
      assert.deepEqual(normalized(prepared.flight.snapshot()), normalized(entries[1]));
      assert.ok(yields > 0);
    } finally {
      prepared.flight.dispose();
    }
    return { yields };
  },
);
await check(
  'Cancellation during proof verification and prefix replay yields no usable flight',
  async () => {
    const { course, proof } = sample;
    const verificationYields = Math.ceil(proof.frames.length / 200);
    for (const abortAt of [1, verificationYields + 1]) {
      const abort = new AbortController();
      let yields = 0;
      await assert.rejects(
        prepareCheckpointPractice(course, proof.mode, 1, {
          proof,
          signal: abort.signal,
          yieldControl: async () => {
            if (++yields === abortAt) abort.abort();
          },
        }),
        { name: 'AbortError' },
      );
      assert.equal(yields, abortAt);
    }
  },
);
await check(
  'Checkpoint contracts reject out-of-range indices and scored practice endpoints',
  async () => {
    const { course, proof } = sample;
    for (const index of [-1, 0.5, course.steps[proof.mode].length])
      await assert.rejects(prepareCheckpointPractice(course, proof.mode, index));
    assert.throws(
      () => createWorldFlight({ course, mode: proof.mode, practiceEndStep: 1 }),
      /unscored/,
    );
  },
);
await check('Bound source bytes remain unchanged during verification', async () =>
  assert.deepEqual(await hashes(), source),
);
const receipt = {
  format: 'fpv-checkpoint-functional.v1',
  generatedAt: new Date().toISOString(),
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sourceFiles: source,
  scope:
    'Actual fixed-step simulation and recorded command replay. No browser, physical controller, new unit coverage or live deployment claim.',
  passed: results.filter((r) => r.pass).length,
  total: results.length,
  results,
};
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ passed: receipt.passed, total: receipt.total, output }));
if (receipt.passed !== receipt.total) process.exitCode = 1;
