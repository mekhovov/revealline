import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { OPTIONAL_PACKAGE_POLICIES } from './optional-package-policy.mjs';
import { validateOptionalModuleClosure } from './optional-module-closure.mjs';
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

test('archive admission rejects a missing transitive import even when member hashes and counts match', async () => {
  const f = fixture(built);
  const manifest = JSON.parse(f.files.get(f.package.manifest.path));
  const runtime = readEditionZip(f.files.get(f.package.distribution.path));
  const owner = 'optional-practice/civilian-flight/model.mjs';
  const bytes = Buffer.concat([
    runtime.get(owner),
    Buffer.from("\nexport * from './missing-runtime-dependency.mjs';\n"),
  ]);
  runtime.set(owner, bytes);
  manifest.files = manifest.files.map((row) =>
    row.path === owner ? editionDescriptor(owner, bytes) : row,
  );
  const manifestBytes = editionJSON(manifest);
  replace(f, 'manifest', manifestBytes);
  runtime.set('optional-package.json', manifestBytes);
  replace(f, 'distribution', createEditionZip(runtime));
  await assert.rejects(
    validateOptionalPackageAdmission(f.envelope, f),
    /Optional archive module dependency is missing: .*model.mjs -> .*missing-runtime-dependency.mjs/,
  );
});

test('SIM Worlds ships the shared defeat choice and recorded reactions in its verified offline closure', async () => {
  const world = await buildOptionalPractice(root, {
    packageId: 'fpv-worlds',
    engineCommit: binding.sourceRevision,
    engineTree: binding.sourceTree,
  });
  const f = fixture(world);
  const admission = await validateOptionalPackageAdmission(f.envelope, f);
  assert.equal(admission.packages[0].id, 'fpv-worlds');
  const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
  for (const name of [
    'game/ui/defeat-sound-controls.mjs',
    'game/hunt/preferences.mjs',
    'game/hunt/copy.mjs',
    'game/ui/destruction-audio.mjs',
    'game/ui/human-reaction-policy.mjs',
    'game/audio/human-reactions/portable.mjs',
  ]) {
    const runtime = world.entries.find((entry) => entry.name === name);
    assert.ok(runtime, `${name} is available without the core installation`);
    assert.deepEqual(source.get(name), runtime.bytes);
  }
});

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
    /company-campaigns|completionRewards/i,
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

test('new launcher cannot omit its failure-copy import or service even with updated member pins', async () => {
  for (const target of [" } from './context.mjs'", ', mountPracticeNavigation });']) {
    const manifest = structuredClone(built.manifest);
    const runtime = new Map(built.entries.map((entry) => [entry.name, entry.bytes]));
    const original = runtime.get('launcher/app.mjs').toString();
    const changed = original.replace(', optionalOfflineFailureMessage' + target, target);
    assert.notEqual(changed, original);
    const bytes = Buffer.from(changed);
    runtime.set('launcher/app.mjs', bytes);
    Object.assign(
      manifest.files.find((row) => row.path === 'launcher/app.mjs'),
      editionDescriptor('launcher/app.mjs', bytes),
    );
    runtime.set('optional-package.json', editionJSON(manifest));
    const f = fixture({
      ...built,
      manifest,
      entries: [...runtime].map(([name, bytes]) => ({ name, bytes })),
      zip: createEditionZip(runtime),
    });
    await assert.rejects(
      validateOptionalPackageAdmission(f.envelope, f),
      /launcher differs from its committed template/,
    );
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

for (const packageId of ['civilian-flight', 'civilian-fpv', 'fpv-worlds'])
  test(
    packageId + ' retains one complete launcher navigation module with its original input pin',
    async () => {
      const b =
        packageId === 'civilian-flight'
          ? built
          : await buildOptionalPractice(root, {
              packageId,
              engineCommit: binding.sourceRevision,
              engineTree: binding.sourceTree,
            });
      const f = fixture(b),
        policy = OPTIONAL_PACKAGE_POLICIES[packageId];
      assert.equal(
        (await validateOptionalPackageAdmission(f.envelope, f)).packages[0].id,
        packageId,
      );
      const runtime = readEditionZip(f.files.get(f.package.distribution.path));
      const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
      const inventory = JSON.parse(source.get('source-inventory.json'));
      const input = 'optional-practice/navigation.mjs',
        output = 'launcher/navigation.mjs';
      assert.equal(runtime.has(input), false);
      assert.equal(source.has(input), false);
      assert.deepEqual(source.get(output), b.inputs.get(input));
      assert.deepEqual(runtime.get(output), b.inputs.get(input));
      assert.deepEqual(
        inventory.inputs.find((row) => row.path === input),
        editionDescriptor(input, b.inputs.get(input)),
      );
      assert.deepEqual(
        inventory.projections.find((row) => row.kind === 'shared-launcher-source'),
        {
          kind: 'shared-launcher-source',
          output: editionDescriptor(output, b.inputs.get(input)),
          inputs: [input],
        },
      );
      assert.ok(runtime.size <= policy.limits.files);
      assert.ok(source.size <= policy.limits.files);
      assert.ok(validateOptionalModuleClosure(runtime, policy).modules > 0);
      assert.ok(validateOptionalModuleClosure(source, policy).modules > 0);
    },
  );

function changeSourceInventory(f, mutate) {
  const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
  const inventory = JSON.parse(source.get('source-inventory.json'));
  mutate(inventory);
  const bytes = editionJSON(inventory);
  source.set('source-inventory.json', bytes);
  replace(f, 'sourceInventory', bytes);
  replace(f, 'sourceArchive', createEditionZip(source));
}

test('launcher alias admission rejects forged canonical input pins and unknown projection inputs', async () => {
  for (const mutate of [
    (inventory) => {
      inventory.inputs.find((row) => row.path === 'optional-practice/navigation.mjs').sha256 =
        '0'.repeat(64);
    },
    (inventory) => {
      inventory.inputs = inventory.inputs.filter(
        (row) => row.path !== 'optional-practice/navigation.mjs',
      );
    },
    (inventory) => {
      inventory.projections.find((row) => row.kind === 'shared-launcher-source').inputs = [
        'optional-practice/foreign.mjs',
      ];
    },
  ]) {
    const f = fixture(built);
    changeSourceInventory(f, mutate);
    await assert.rejects(
      validateOptionalPackageAdmission(f.envelope, f),
      /bytes differ|inventory is incomplete|Unknown optional source projection/,
    );
  }
});

test('source discovery preserves canonical launcher inputs before frozen packaging', async () => {
  const discovered = await buildOptionalPractice(root);
  const input = 'optional-practice/navigation.mjs';
  assert.deepEqual(discovered.inputs.get(input), built.inputs.get(input));
  const runtime = new Map(discovered.entries.map((entry) => [entry.name, entry.bytes]));
  assert.equal(runtime.has(input), false, 'Discovery must not restore the duplicate runtime seed.');
  assert.equal(
    runtime.has('launcher/navigation.mjs'),
    false,
    'Only frozen builds emit a launcher.',
  );
});

test('explicit launcher inputs retain the optional-package no-network admission rule', async (t) => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'optional-launcher-input-'));
  t.after(() => fs.rm(temporary, { recursive: true, force: true }));
  for (const [name, bytes] of built.inputs) {
    await fs.mkdir(path.dirname(path.join(temporary, name)), { recursive: true });
    await fs.writeFile(path.join(temporary, name), bytes);
  }
  await fs.appendFile(
    path.join(temporary, 'optional-practice/navigation.mjs'),
    "\nfetch('./unadmitted-network.json');\n",
  );
  for (const options of [
    {},
    { engineCommit: binding.sourceRevision, engineTree: binding.sourceTree },
  ])
    await assert.rejects(
      buildOptionalPractice(temporary, options),
      /network requests belong only to its generated verified worker/,
    );
});
