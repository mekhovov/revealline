import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOptionalPractice } from '../scripts/build-optional-practice.mjs';
import { createOptionalPackageCandidate } from './optional-package-candidate.mjs';
import {
  validateOptionalPackageAdmission,
  createOptionalPackageReview,
  verifyOptionalPackageReview,
} from './optional-package-admission.mjs';
import { editionJSON, editionDescriptor } from './edition-candidate.mjs';
import { readEditionZip, createEditionZip, editionHash } from './edition-zip.mjs';
const root = new URL('../', import.meta.url).pathname;
const binding = { version: 'v1.2.3', sourceRevision: 'a'.repeat(40), sourceTree: 'b'.repeat(40) };
const build = () =>
  buildOptionalPractice(root, {
    engineCommit: binding.sourceRevision,
    engineTree: binding.sourceTree,
  });
function fixture(built) {
  const candidate = createOptionalPackageCandidate({ built, ...binding });
  const envelope = {
    format: 'revealline-optional-packages.v1',
    ...binding,
    packages: [candidate.package],
  };
  return { ...candidate, envelope, read: async (row) => candidate.files.get(row.path) };
}
function replace(f, role, bytes) {
  const name = f.package[role].path;
  f.files.set(name, bytes);
  f.package[role] = editionDescriptor(name, bytes);
}
function manifestChange(f, edit) {
  const manifest = JSON.parse(f.files.get(f.package.manifest.path));
  edit(manifest);
  replace(f, 'manifest', editionJSON(manifest));
}
const built = await build();

test('optional candidate is byte-reproducible and inventories only its selected public dependency closure', async () => {
  const first = fixture(built),
    second = fixture(await build());
  assert.deepEqual(first.files, second.files);
  assert.deepEqual(await validateOptionalPackageAdmission(first.envelope, first), {
    format: 'revealline-optional-package-admission.v1',
    ...binding,
    packages: [
      {
        id: 'civilian-flight',
        revision: built.manifest.revision,
        files: built.entries.length,
        bytes: built.entries.reduce((sum, entry) => sum + entry.bytes.length, 0),
      },
    ],
    zipMembersVerified: true,
    publicEligible: false,
  });
  const source = readEditionZip(first.files.get(first.package.sourceArchive.path));
  const inventory = JSON.parse(source.get('source-inventory.json'));
  assert.ok(inventory.inputs.some((row) => row.path === 'game/locales/uk/errors.json'));
  assert.equal(
    source.has('game/locales/uk/errors.json'),
    false,
    'Only input hashes retain aggregate locale provenance.',
  );
  assert.doesNotMatch(
    source.get('game/i18n/catalogs.mjs').toString(),
    /coupa|droneaid|completionRewards/i,
  );
  assert.equal(inventory.licenses[0].license, 'MIT');
  assert.equal(inventory.licenses[0].version, '26.4.2');
  assert.ok(
    [...source.keys()].every((name) => !/authoring\/|game\/editions\/|game\/content\//.test(name)),
  );
});

test('tampered artifacts, omitted or extra dependencies and foreign commit identities fail admission', async () => {
  const corrupt = fixture(built);
  corrupt.files.set(corrupt.package.distribution.path, Buffer.from('changed'));
  await assert.rejects(
    validateOptionalPackageAdmission(corrupt.envelope, corrupt),
    /artifact bytes differ/,
  );
  const missing = fixture(built);
  manifestChange(missing, (manifest) => manifest.files.pop());
  await assert.rejects(
    validateOptionalPackageAdmission(missing.envelope, missing),
    /inventory is incomplete/,
  );
  const foreign = fixture(built);
  foreign.envelope.sourceRevision = 'c'.repeat(40);
  await assert.rejects(
    validateOptionalPackageAdmission(foreign.envelope, foreign),
    /bind its frozen package/,
  );
  const extra = fixture(built);
  const source = readEditionZip(extra.files.get(extra.package.sourceArchive.path));
  source.set('private/sentinel.txt', Buffer.from('MUST-NOT-PUBLISH'));
  replace(extra, 'sourceArchive', createEditionZip(source));
  await assert.rejects(
    validateOptionalPackageAdmission(extra.envelope, extra),
    /ZIP directory differs/,
  );
  const undeclared = fixture(built);
  manifestChange(undeclared, (manifest) => {
    manifest.files[0].path = 'game/app.mjs';
  });
  await assert.rejects(
    validateOptionalPackageAdmission(undeclared.envelope, undeclared),
    /undeclared dependency/,
  );
  const duplicate = fixture(built);
  duplicate.envelope.packages.push(structuredClone(duplicate.package));
  await assert.rejects(
    validateOptionalPackageAdmission(duplicate.envelope, duplicate),
    /not admitted by policy/,
  );
});

test('source and generated-worker provenance are mandatory and bounded', async () => {
  const unlicensed = fixture(built);
  const inventory = JSON.parse(unlicensed.files.get(unlicensed.package.sourceInventory.path));
  inventory.licenses = [];
  const updated = editionJSON(inventory);
  replace(unlicensed, 'sourceInventory', updated);
  const sources = readEditionZip(unlicensed.files.get(unlicensed.package.sourceArchive.path));
  sources.set('source-inventory.json', updated);
  replace(unlicensed, 'sourceArchive', createEditionZip(sources));
  await assert.rejects(
    validateOptionalPackageAdmission(unlicensed.envelope, unlicensed),
    /license inventory differs/,
  );
  const wrongWorker = fixture(built);
  manifestChange(wrongWorker, (manifest) => {
    manifest.workerTemplateSha256 = 'd'.repeat(64);
  });
  const archive = readEditionZip(wrongWorker.files.get(wrongWorker.package.distribution.path));
  archive.set('optional-package.json', wrongWorker.files.get(wrongWorker.package.manifest.path));
  replace(wrongWorker, 'distribution', createEditionZip(archive));
  await assert.rejects(
    validateOptionalPackageAdmission(wrongWorker.envelope, wrongWorker),
    /worker template pin differs/,
  );
  const tooLarge = fixture(built);
  manifestChange(tooLarge, (manifest) => {
    manifest.files[0].bytes = 8 * 1024 * 1024;
  });
  await assert.rejects(
    validateOptionalPackageAdmission(tooLarge.envelope, tooLarge),
    /byte budget/,
  );
  const development = await buildOptionalPractice(root);
  assert.throws(
    () => createOptionalPackageCandidate({ built: development, ...binding }),
    /bound package/,
  );
});

test('pinned generated launcher code still must match its committed template and isolated closure', async () => {
  for (const [name, message] of [
    ['launcher/app.mjs', /launcher differs from its committed template/],
    ['launcher/context.mjs', /launcher context differs/],
    ['launcher/worker.js', /launcher offline worker differs/],
  ]) {
    const manifest = structuredClone(built.manifest);
    const runtime = new Map(built.entries.map((entry) => [entry.name, entry.bytes]));
    const bytes = Buffer.concat([
      runtime.get(name),
      Buffer.from('\n// altered generated member\n'),
    ]);
    runtime.set(name, bytes);
    const row = manifest.files.find((row) => row.path === name);
    Object.assign(row, editionDescriptor(name, bytes));
    runtime.set('optional-package.json', editionJSON(manifest));
    const f = fixture({
      ...built,
      manifest,
      entries: [...runtime].map(([name, bytes]) => ({ name, bytes })),
      zip: createEditionZip(runtime),
    });
    await assert.rejects(validateOptionalPackageAdmission(f.envelope, f), message);
  }
});

test('pending human/device gates never become promotion approval and reviewed evidence pins are exact', async () => {
  const f = fixture(built),
    bytes = editionJSON(f.envelope),
    review = createOptionalPackageReview(bytes);
  assert.ok(review.packages[0].gates.every((gate) => gate.status === 'pending'));
  await assert.rejects(verifyOptionalPackageReview(bytes, review, f), /requires reviewed evidence/);
  // Synthetic test receipt only; this is never exported as project qualification.
  for (const gate of review.packages[0].gates) {
    const evidence = Buffer.from(`Synthetic fixture for ${gate.id}`);
    const file = `review-optional-${gate.id}.txt`;
    f.files.set(file, evidence);
    Object.assign(gate, {
      status: 'passed',
      reviewer: 'Test fixture',
      reviewedAt: '2026-09-28T10:00:00Z',
      evidence: { ...editionDescriptor(file, evidence), publication: 'public', approved: true },
    });
  }
  assert.equal((await verifyOptionalPackageReview(bytes, review, f)).publicEligible, true);
  const altered = structuredClone(review);
  altered.envelopeSha256 = editionHash(Buffer.from('other envelope'));
  await assert.rejects(
    verifyOptionalPackageReview(bytes, altered, f),
    /differs from its frozen envelope/,
  );
  f.files.set(review.packages[0].gates[0].evidence.path, Buffer.from('changed'));
  await assert.rejects(verifyOptionalPackageReview(bytes, review, f), /artifact bytes differ/);
});
