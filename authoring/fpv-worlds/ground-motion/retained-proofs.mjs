// Manual replay of pre-existing, unmodified recordings; no generated replacement proof.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { WORLD_DEMONSTRATIONS } from '../../../optional-practice/civilian-fpv/world-demonstrations.mjs';
import { WORLD_CATALOGUE } from '../../../optional-practice/civilian-fpv/world-catalogue.mjs';
import { importProofPart } from '../../../optional-practice/civilian-fpv/world-records.mjs';
import {
  replayWorldFlight,
  worldStateIdentity,
} from '../../../optional-practice/civilian-fpv/world-model.mjs';
assert(process.argv[2] && process.argv[3], 'Pass retained Festival archive and new receipt path');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const bytes = await readFile(process.argv[2]);
assert.equal(sha(bytes), '277503e86f3cb0b9cd60bc405ec41562bed1533c3f8a779391141ac3985884b6');
const festival = await importProofPart(bytes.toString());
const selected = WORLD_DEMONSTRATIONS.filter((v) =>
  ['woodland-01', 'container-yard-07', 'container-yard-04'].includes(v.proof.course),
).map((v) => ({
  course: WORLD_CATALOGUE.find((e) => e.course.id === v.proof.course).course,
  proof: v.proof,
}));
selected.push(
  ...festival.filter((v) => ['festival-grounds-06', 'festival-grounds-07'].includes(v.course.id)),
);
const receipt = {
  format: 'FPVGroundMotionRetainedReplay.v1',
  archive: { bytes: bytes.length, sha256: sha(bytes) },
  records: [],
  complete: false,
};
try {
  assert.equal(selected.length, 10);
  for (const { course, proof } of selected) {
    assert(course.actors.every((a) => !Object.hasOwn(a, 'groundMotion')));
    const replay = await replayWorldFlight(course, proof, { yieldControl: async () => {} });
    assert.equal(worldStateIdentity(replay.state), proof.finalStateIdentity);
    assert.equal(replay.state.status, 'complete');
    receipt.records.push({
      course: course.id,
      mode: proof.mode,
      frames: proof.frames.length,
      courseIdentity: proof.courseIdentity,
      finalStateIdentity: proof.finalStateIdentity,
      proofSHA256: sha(JSON.stringify(proof)),
      actors: course.actors.map((a) => ({ type: a.type, role: a.role })),
      pass: true,
    });
  }
  receipt.complete = true;
} catch (e) {
  receipt.error = { message: e.message, stack: e.stack };
  throw e;
} finally {
  await writeFile(process.argv[3], JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ complete: receipt.complete, records: receipt.records.length }));
}
