import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { bundleOptionalPractice } from './bundle-optional-practice.mjs';
import { optionalFPVSourceFixture } from '../publishing/optional-package-source-fixture.mjs';
import { createOptionalPackageCandidate } from '../publishing/optional-package-candidate.mjs';
import { validateOptionalPackageAdmission } from '../publishing/optional-package-admission.mjs';
import { editionJSON, editionDescriptor } from '../publishing/edition-candidate.mjs';
import { readEditionZip, createEditionZip } from '../publishing/edition-zip.mjs';
import { installPracticeWorker } from '../optional-practice/worker-template.mjs';

const binding = { version: 'v1.2.3', sourceRevision: 'a'.repeat(40), sourceTree: 'b'.repeat(40) };
const options = {
  packageId: 'civilian-fpv',
  engineCommit: binding.sourceRevision,
  engineTree: binding.sourceTree,
  basePath: '/revealline/',
};
const candidate = (built) => {
  const result = createOptionalPackageCandidate({ built, ...binding });
  return {
    ...result,
    envelope: { format: 'revealline-optional-packages.v1', ...binding, packages: [result.package] },
    read: async (row) => result.files.get(row.path),
  };
};

// Shared radio controls add two admitted modules to the former 50/52 closures.
// Keep exact counts and byte-for-byte runtime/source membership, not looser caps.
const assertSharedRadioClosure = (built, source) => {
  for (const name of ['optional-practice/civilian-fpv/radio-controls.mjs', 'game/fpv-entry.mjs']) {
    const runtime = built.entries.find((entry) => entry.name === name);
    assert.ok(runtime, name);
    assert.deepEqual(source.get(name), runtime.bytes, name);
  }
};

test('actual FPV application, native notebook and installation launcher close inside unchanged runtime/source budgets', async () => {
  // Synthetic commit binding exercises archive admission only; the clean frozen
  // CLI independently binds real committed inputs before candidate publication.
  const root = fileURLToPath(new URL('../', import.meta.url)),
    first = await buildOptionalPractice(root, options),
    second = await buildOptionalPractice(root, options),
    f = candidate(first),
    admission = await validateOptionalPackageAdmission(f.envelope, f);
  assert.deepEqual(first.zip, second.zip);
  assert.equal(admission.publicEligible, false);
  assert.equal(admission.packages[0].files, 52);
  assert.ok(admission.packages[0].bytes <= 8 * 1024 * 1024);
  for (const name of ['notebook.mjs', 'studio.mjs', 'radio-setup.mjs', 'vendor/three.core.js'])
    assert.ok(
      first.entries.some((entry) => entry.name === `optional-practice/civilian-fpv/${name}`),
    );
  const manifest = JSON.parse(
    first.entries.find((entry) => entry.name.endsWith('/civilian-fpv/app.webmanifest')).bytes,
  );
  assert.equal(manifest.icons.length, 2);
  assert.equal(manifest.id, '/revealline/practice/civilian-fpv/');
  const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
  assert.equal(source.size, 54);
  assertSharedRadioClosure(first, source);
  assert.ok(
    [...source.values()].reduce((total, bytes) => total + bytes.length, 0) <= 8 * 1024 * 1024,
  );
});

test('explicit FPV package remains independently reproducible with complete pinned runtime and source closures', async (t) => {
  const fixture = await optionalFPVSourceFixture(t),
    first = await buildOptionalPractice(fixture.root, options),
    second = await buildOptionalPractice(fixture.root, options);
  assert.deepEqual(first.zip, second.zip);
  assert.equal(first.manifest.id, 'civilian-fpv');
  assert.equal(first.manifest.installation.id, '/revealline/practice/civilian-fpv/');
  assert.equal(first.entries.length, 52);
  assert.ok(first.entries.reduce((sum, item) => sum + item.bytes.length, 0) < 8 * 1024 * 1024);
  assert.ok(first.entries.every(({ name }) => !name.includes('civilian-flight')));
  const f = candidate(first);
  const admitted = await validateOptionalPackageAdmission(f.envelope, f);
  assert.equal(admitted.publicEligible, false);
  assert.equal(admitted.packages[0].files, 52);
  const localeProjection = first.entries
    .find((entry) => entry.name === 'game/i18n/catalogs.mjs')
    .bytes.toString();
  assert.match(localeProjection, /learningProfiles\.choose/);
  assert.doesNotMatch(localeProjection, /completionRewards|Coupa|DroneAid/);
  const inventory = JSON.parse(f.files.get(f.package.sourceInventory.path));
  assert.equal(inventory.licenses.find((item) => item.dependency === 'three').version, '0.186.1');
  const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
  assert.equal(source.size, 54);
  assertSharedRadioClosure(first, source);
  assert.ok(source.size <= 64);
  assert.ok([...source.values()].reduce((sum, bytes) => sum + bytes.length, 0) <= 8 * 1024 * 1024);
  assert.ok(source.has(fixture.policy.template));
  for (const pin of fixture.policy.vendorPins)
    assert.deepEqual(
      source.get(pin.path),
      first.entries.find((entry) => entry.name === pin.path).bytes,
    );
  const worker = first.entries
    .find((entry) => entry.name === fixture.policy.root + 'worker.js')
    .bytes.toString();
  assert.match(worker, /revealline\.optional\.package\.v1:/);
  const defaultBuild = await buildOptionalPractice(fixture.root),
    explicitLegacy = await buildOptionalPractice(fixture.root, { packageId: 'civilian-flight' });
  assert.deepEqual(defaultBuild.zip, explicitLegacy.zip);
});

test('vendor pins are checked before parser exemptions while application fetch and foreign imports stay forbidden', async (t) => {
  const f = await optionalFPVSourceFixture(t),
    vendor = path.join(f.root, f.policy.vendorPins[0].path),
    original = await readFile(vendor);
  await writeFile(vendor, Buffer.concat([original, Buffer.from('\n// changed')]));
  await assert.rejects(buildOptionalPractice(f.root, options), /vendor bytes differ/);
  await writeFile(vendor, original);
  const app = path.join(f.root, f.policy.root, 'app.mjs');
  await writeFile(app, "fetch('https://example.test/hidden');\n");
  await assert.rejects(buildOptionalPractice(f.root, options), /network requests belong only/);
  await writeFile(app, "import '../../game/app.mjs';\n");
  await assert.rejects(buildOptionalPractice(f.root, options), /not admitted: game\/app.mjs/);
});

test('rewritten archive hashes cannot replace a reviewed vendor dependency', async (t) => {
  const fixture = await optionalFPVSourceFixture(t),
    f = candidate(await buildOptionalPractice(fixture.root, options));
  const archive = readEditionZip(f.files.get(f.package.distribution.path)),
    name = fixture.policy.vendorPins[0].path,
    changed = Buffer.concat([archive.get(name), Buffer.from('\n// tampered')]);
  archive.set(name, changed);
  const manifest = JSON.parse(f.files.get(f.package.manifest.path));
  Object.assign(
    manifest.files.find((row) => row.path === name),
    editionDescriptor(name, changed),
  );
  const manifestBytes = editionJSON(manifest);
  f.files.set(f.package.manifest.path, manifestBytes);
  f.package.manifest = editionDescriptor(f.package.manifest.path, manifestBytes);
  archive.set('optional-package.json', manifestBytes);
  const zipped = createEditionZip(archive);
  f.files.set(f.package.distribution.path, zipped);
  f.package.distribution = editionDescriptor(f.package.distribution.path, zipped);
  await assert.rejects(
    validateOptionalPackageAdmission(f.envelope, f),
    /Optional artifact bytes differ: .*three\.core\.js/,
  );
});

test('package selection rejects unknown, duplicate and empty lists before touching frozen inputs', async () => {
  for (const packageIds of [
    [],
    ['unknown'],
    ['civilian-fpv', 'civilian-fpv'],
    ['constructor'],
    'civilian-fpv',
  ])
    await assert.rejects(bundleOptionalPractice({ packageIds }), /unique registered package IDs/);
  await assert.rejects(
    buildOptionalPractice('/nonexistent', { packageId: 'constructor' }),
    /not admitted by policy/,
  );
  await assert.rejects(
    buildOptionalPractice('/nonexistent', { packageId: ['civilian-flight'] }),
    /not admitted by policy/,
  );
});

test('source budget includes the final source-inventory member, not only its listed dependencies', async (t) => {
  const fixture = await optionalFPVSourceFixture(t),
    built = await buildOptionalPractice(fixture.root, options),
    original = candidate(built),
    source = readEditionZip(original.files.get(original.package.sourceArchive.path));
  source.delete('source-inventory.json');
  const bytes = [...source.values()].reduce((sum, value) => sum + value.length, 0),
    template = built.inputs.get(fixture.policy.template),
    extra = fixture.policy.limits.bytes - bytes - 10;
  assert.ok(extra > 0);
  built.inputs.set(fixture.policy.template, Buffer.concat([template, Buffer.alloc(extra, 32)]));
  assert.throws(() => candidate(built), /Complete optional source output exceeds/);
});

test('generic optional worker cleanup owns only its exact package scope', async () => {
  const base = 'https://example.test/revealline/practice/civilian-fpv/app/',
    owner = `revealline.optional.package.v1:${new URL(base).pathname}:`,
    foreign = [
      'revealline.optional.civilian-flight.v1:/revealline/practice/civilian-flight/app/:old',
      'revealline.optional.package.v1:/revealline/practice/civilian-fpv/releases/v1.2.2/site/:old',
      'revealline.optional.package.v1:/another/practice/civilian-fpv/app/:old',
      'game-core',
    ],
    caches = new Set([owner + 'old', owner + 'new', ...foreign]),
    listeners = new Map();
  installPracticeWorker(
    {
      registration: { scope: base },
      addEventListener(name, listener) {
        listeners.set(name, listener);
      },
      caches: {
        keys: async () => [...caches],
        delete: async (name) => caches.delete(name),
      },
      clients: { claim: async () => {} },
    },
    [],
    'new',
  );
  let pending;
  listeners.get('activate')({
    waitUntil(value) {
      pending = value;
    },
  });
  await pending;
  assert.deepEqual([...caches], [owner + 'new', ...foreign]);
});
