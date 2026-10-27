// Synthetic model-generated fixtures below are unit tests, never native UI evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  FPV_REPLAY_ROOT,
  fpvReplayInputs,
  assertFPVReplayImports,
  verifyFrozenFPVExercise,
} from './practice-fpv-exercise-replay.mjs';

const load = (name) => import(pathToFileURL(`${FPV_REPLAY_ROOT}/${name}`));
const { FLIGHT_COURSES } = await load('optional-practice/civilian-fpv/catalogue.mjs');
const { createFlight, createFlightRecorder } = await load(
  'optional-practice/civilian-fpv/model.mjs',
);
const { dataIdentity } = await load('game/data-json.mjs');
const { createTunedResponse } = await load('optional-practice/civilian-fpv/flight-response.mjs');
const { academyRecording } = await load('optional-practice/civilian-fpv/world-themes.mjs');
const { exportProofParts } = await load('optional-practice/civilian-fpv/world-records.mjs');
const course = FLIGHT_COURSES.find((row) => row.id === 'flight-01');
const appearance = { collectionId: 'legacy', revision: 'v1', drone: 'racer' };
const sources = new Map(
  await Promise.all(
    fpvReplayInputs('fpv-worlds').map(async (name) => [
      name,
      name === 'game/i18n/catalogs.mjs'
        ? Buffer.from(
            '// Selected optional-practice validator and settings messages.\nglobalThis.RevealLineTranslations={"en":{},"uk":{}};\n',
          )
        : await readFile(`${FPV_REPLAY_ROOT}/${name}`),
    ]),
  ),
);

function syntheticProof(mode = 'self-level', response) {
  const flight = createFlight({ course, mode, ...(response ? { response } : {}) });
  const recorder = createFlightRecorder(flight);
  flight.arm();
  for (let tick = 0; tick < 5000 && flight.snapshot().status === 'active'; tick++) {
    const state = flight.snapshot();
    const height = state.position.y / 1000,
      velocity = state.velocity.y / 1000;
    const desired = state.step === 0 ? Math.max(-0.5, Math.min(0.9, (1.8 - height) * 1.4)) : -0.3;
    const throttle =
      state.step > 0 && height === 0
        ? 0
        : Math.max(0.2, Math.min(0.75, 0.5 + (desired - velocity) * 0.18));
    const input = { roll: 0, pitch: 0, yaw: 0, throttle };
    recorder.record(input);
    flight.step(input);
  }
  assert.equal(flight.snapshot().status, 'complete', 'Synthetic unit fixture must complete.');
  return recorder.export();
}
const proofs = { 'self-level': syntheticProof(), acro: syntheticProof('acro') };
const copy = (value) => JSON.parse(JSON.stringify(value));
const academy = (proof = proofs['self-level'], presentation) => ({
  format: presentation ? 'FlightProofBackup.v2' : 'FlightProofBackup.v1',
  packageId: 'civilian-fpv',
  attempts: [academyRecording(proof, presentation)],
});
async function worlds(proof = proofs['self-level'], presentation, mutate = () => {}) {
  const clean = {
    course: copy(course),
    proof: copy(proof),
    ...(presentation ? { presentation } : {}),
  };
  const record = {
    id: dataIdentity(clean),
    ...clean,
    status: 'verified',
    diagnostic: 'complete',
    packIdentity: `fpv-academy:${dataIdentity(FLIGHT_COURSES)}`,
    savedAt: 0,
  };
  record.byteLength = Buffer.byteLength(JSON.stringify(record)) + 64;
  mutate(record);
  return (await exportProofParts([record]))[0];
}
const verify = (value, packageId = 'civilian-fpv', mode = 'self-level', files = sources) =>
  verifyFrozenFPVExercise(files, JSON.stringify(value), { packageId, mode });

for (const packageId of ['civilian-fpv', 'fpv-worlds']) {
  for (const mode of ['self-level', 'acro']) {
    test(`synthetic-only ${packageId} ${mode} independently replays two sectors and ground`, async () => {
      const value =
        packageId === 'civilian-fpv' ? academy(proofs[mode]) : await worlds(proofs[mode]);
      const result = await verify(value, packageId, mode);
      assert.equal(result.verified, true);
      assert.equal(result.qualified, false);
      assert.equal(result.state.position.y, 0);
      assert.equal(result.state.status, 'complete');
      assert.deepEqual(
        result.sectors.map((row) => row.index),
        [0, 1],
      );
      assert.equal(result.inputs.length, packageId === 'civilian-fpv' ? 27 : 28);
    });
  }
}
test('production appearance wrappers and v3 archive checks are supported', async () => {
  assert.equal((await verify(academy(undefined, appearance))).format, 'FlightProofBackup.v2');
  assert.equal(
    (await verify(await worlds(undefined, appearance), 'fpv-worlds')).format,
    'FPVProofArchive.v3',
  );
});
for (const packageId of ['civilian-fpv', 'fpv-worlds'])
  test(`synthetic-only ${packageId} tuned rates replay with the complete frozen dependency closure`, async () => {
    const response = createTunedResponse(),
      proof = syntheticProof('acro', response),
      value = packageId === 'civilian-fpv' ? academy(proof) : await worlds(proof),
      result = await verify(value, packageId, 'acro');
    assert.equal(result.verified, true);
    assert.equal(result.qualified, false);
    assert.equal(result.state.status, 'complete');
    assert.equal(result.identity.responseIdentity, proof.responseIdentity);
    for (const name of ['flight-response.mjs', 'rates.mjs'])
      assert(
        result.inputs.some((input) => input.path === `optional-practice/civilian-fpv/${name}`),
      );
  });
test('fixed executable bytes and complete dependency closure are mandatory', async () => {
  for (const module of ['radio-profile.mjs', 'flight-response.mjs', 'rates.mjs']) {
    const missing = new Map(sources);
    missing.delete(`optional-practice/civilian-fpv/${module}`);
    await assert.rejects(verify(academy(), 'civilian-fpv', 'self-level', missing), /Missing/);
  }
  const altered = new Map(sources);
  altered.set('optional-practice/civilian-fpv/model.mjs', Buffer.from('export const forged=true;'));
  await assert.rejects(verify(academy(), 'civilian-fpv', 'self-level', altered), /differs/);
});
test('locale is JSON-only en/uk, never an executable projection', async () => {
  for (const value of [
    'globalThis.RevealLineTranslations={};\n',
    '// Selected optional-practice validator and settings messages.\nglobalThis.RevealLineTranslations={"en":{}};\n',
    sources.get('game/i18n/catalogs.mjs').toString() + 'process.exit(0);\n',
  ]) {
    const files = new Map(sources);
    files.set('game/i18n/catalogs.mjs', Buffer.from(value));
    await assert.rejects(verify(academy(), 'civilian-fpv', 'self-level', files));
  }
});
test('static dependency validator rejects dynamic, CommonJS, bare and unpinned imports', () => {
  for (const source of [
    'import("./math.mjs")',
    'require("fs")',
    'import fs from "node:fs"',
    'export * from "./untrusted.mjs"',
  ]) {
    assert.throws(() =>
      assertFPVReplayImports(
        'optional-practice/civilian-fpv/model.mjs',
        Buffer.from(source),
        'civilian-fpv',
      ),
    );
  }
});
test('only one fresh practice proof with exact course/mode/model identities qualifies', async () => {
  for (const [key, value] of [
    ['session', 'demonstration'],
    ['course', 'flight-02'],
    ['mode', 'acro'],
    ['model', 'forged'],
    ['courseIdentity', 'forged'],
    ['responseIdentity', 'forged'],
  ]) {
    const proof = copy(proofs['self-level']);
    proof[key] = value;
    await assert.rejects(verify(academy(proof)));
  }
  const extra = academy();
  extra.attempts.push(copy(extra.attempts[0]));
  await assert.rejects(verify(extra));
  const wrongPackage = academy();
  wrongPackage.packageId = 'fpv-worlds';
  await assert.rejects(verify(wrongPackage));
});
test('partial, counterfeit terminal fields, and frames after terminal completion fail', async () => {
  const partial = copy(proofs['self-level']);
  partial.frames = partial.frames.slice(0, 2);
  await assert.rejects(verify(academy(partial)));
  const forged = copy(partial);
  forged.status = 'complete';
  await assert.rejects(verify(academy(forged)));
  const extra = copy(proofs['self-level']);
  extra.frames.push([0, 0, 0, 0]);
  await assert.rejects(verify(academy(extra)));
});
test('archive transport identity, exact metadata and completed record status are checked', async () => {
  for (const key of ['sha256', 'archiveId']) {
    const value = await worlds();
    value[key] = '0'.repeat(64);
    await assert.rejects(verify(value, 'fpv-worlds'));
  }
  for (const [key, value] of [
    ['diagnostic', 'expired'],
    ['status', 'missing-dependency'],
    ['packIdentity', 'other-source'],
    ['byteLength', 1],
  ]) {
    await assert.rejects(
      verify(
        await worlds(undefined, undefined, (record) => {
          record[key] = value;
        }),
        'fpv-worlds',
      ),
    );
  }
  const parts = await worlds();
  parts.parts = 2;
  await assert.rejects(verify(parts, 'fpv-worlds'));
});
test('unsupported packages/modes and excessive input are rejected before execution', async () => {
  await assert.rejects(verify(academy(), 'unknown'));
  await assert.rejects(verify(academy(), 'civilian-fpv', 'unknown'));
  await assert.rejects(
    verifyFrozenFPVExercise(sources, ' '.repeat(2097153), {
      packageId: 'civilian-fpv',
      mode: 'acro',
    }),
    /2 MiB/,
  );
});

test('native wrappers reject invalid appearance and unrecognized metadata', async () => {
  const wrapped = academy(undefined, appearance);
  wrapped.attempts[0].presentation.drone = 'forged-drone';
  await assert.rejects(verify(wrapped));
  const legacy = academy(undefined, appearance);
  legacy.format = 'FlightProofBackup.v1';
  await assert.rejects(verify(legacy));
  const value = academy();
  value.completed = true;
  await assert.rejects(verify(value));
  const archive = await worlds();
  archive.records.push(copy(archive.records[0]));
  await assert.rejects(verify(archive, 'fpv-worlds'));
});
