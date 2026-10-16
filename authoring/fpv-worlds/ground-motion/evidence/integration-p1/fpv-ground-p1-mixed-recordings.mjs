// Manual mixed-policy V3 practice recording; no completed flight claim.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
const [root, out] = process.argv.slice(2);
const load = (name) => import(pathToFileURL(path.join(root, 'optional-practice/civilian-fpv', name)));
const model = await load('world-model.mjs');
const { NATIVE_PURSUIT_COURSES, NATIVE_PURSUIT_V2_COURSES } = await load('native-pursuit-courses.mjs');
await model.initWorldRuntime();
const receipt = { format: 'FPVGroundP1MixedRecordings.v1', runtimeRevision: execFileSync('git',['rev-parse','HEAD'],{cwd:root,env:{...process.env,GIT_NO_LAZY_FETCH:'1'}}).toString().trim(), scope: 'Synthetic opted-in variants, 300 native neutral ticks and independent partial-practice replay; not authored completion', records: [], complete: false };
try {
  for (const original of [NATIVE_PURSUIT_COURSES[3], NATIVE_PURSUIT_V2_COURSES[1]]) for (const optedIndex of [0, 1]) for (const mode of ['self-level', 'acro']) {
    const course = structuredClone(original);
    course.actors[optedIndex].groundMotion = 'support-v1';
    const flight = model.createWorldFlight({ course, mode });
    let proof;
    try {
      const recorder = model.createWorldRecorder(flight);
      flight.arm();
      for (let i = 0; i < 300; i++) { flight.step({ throttle: 0, roll: 0, pitch: 0, yaw: 0, actions: 0 }); recorder.record(); }
      proof = recorder.export();
      assert.equal(proof.format, 'FlightAttempt.v3');
      assert.equal(proof.frames.length, 300);
      assert(flight.snapshot().actors.every((a) => !Object.hasOwn(a, 'groundMotion')));
    } finally { flight.dispose(); }
    const replay = await model.replayWorldFlight(course, proof, { yieldControl: async () => {} });
    assert.equal(model.worldStateIdentity(replay.state), proof.finalStateIdentity);
    await assert.rejects(model.replayWorldFlight(original, proof, { yieldControl: async () => {} }), /identity|dependency/i);
    receipt.records.push({ course: course.id, pursuitFormat: course.pursuit.format, optedActor: course.actors[optedIndex].id, mode, proof, finalState: replay.state, policyRemovalRejected: true });
  }
  receipt.complete = true;
} finally {
  await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ complete: receipt.complete, records: receipt.records.length }));
}
