import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildBundledOptionalPractice, buildOptionalPractice } from './build-optional-practice.mjs';
import { addOfflineEntries } from './game-cli.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';
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

// Seven explicitly admitted visual/theme/loader files extend the prior 52/54 closures.
// Keep exact counts and byte-for-byte runtime/source membership, not looser caps.
const assertSharedRadioClosure = (built, source) => {
  for (const name of ['optional-practice/civilian-fpv/radio-controls.mjs', 'game/fpv-entry.mjs']) {
    const runtime = built.entries.find((entry) => entry.name === name);
    assert.ok(runtime, name);
    assert.deepEqual(source.get(name), runtime.bytes, name);
  }
};

async function bundledFPVEntries() {
  const root = fileURLToPath(new URL('../', import.meta.url)),
    policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'];
  return Promise.all(
    [...policy.localFiles.map((name) => policy.root + name), ...policy.sharedFiles].map(
      async (name) => ({ name, bytes: await readFile(path.join(root, name)) }),
    ),
  );
}

test('bundled FPV pins final default bytes and has its own bounded cache outside core', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url)),
    policy = OPTIONAL_PACKAGE_POLICIES['civilian-fpv'],
    source = await bundledFPVEntries(),
    prepare = async () => {
      const entries = source.map((entry) => ({ ...entry }));
      entries.push({ name: 'game/offline.mjs', bytes: Buffer.from('export {};') });
      await addOfflineEntries(root, entries, { version: 'v1.2.3' }, {});
      return entries;
    },
    first = await prepare(),
    second = await prepare();
  assert.deepEqual(first, second);
  const manifestName = policy.root + 'app.webmanifest',
    originalManifest = JSON.parse(source.find((entry) => entry.name === manifestName).bytes),
    bundledManifest = JSON.parse(first.find((entry) => entry.name === manifestName).bytes);
  assert.deepEqual(
    originalManifest.icons.map((icon) => icon.src),
    ['./icons/icon-192.png', './icons/icon-512.png'],
  );
  assert.deepEqual(bundledManifest, {
    ...originalManifest,
    icons: originalManifest.icons.map((icon) => ({ ...icon, src: '../../' + icon.src.slice(2) })),
  });
  const invalidManifestEntries = source.map((entry) => ({ ...entry }));
  invalidManifestEntries.find((entry) => entry.name === manifestName).bytes = Buffer.from(
    JSON.stringify({ ...originalManifest, icons: [{ src: 'https://example.test/icon.png' }] }),
  );
  invalidManifestEntries.push({ name: 'game/offline.mjs', bytes: Buffer.from('export {};') });
  await assert.rejects(
    addOfflineEntries(root, invalidManifestEntries, { version: 'v1.2.3' }, {}),
    /Bundled FPV manifest icons differ/,
  );
  const workerName = policy.root + 'worker.js',
    worker = first.find((entry) => entry.name === workerName),
    finalInputs = first.filter((entry) => entry.name !== workerName),
    rebuilt = buildBundledOptionalPractice(finalInputs),
    core = JSON.parse(first.find((entry) => entry.name === 'offline-cache.json').bytes),
    catalogue = JSON.parse(first.find((entry) => entry.name === 'offline-content.json').bytes),
    practice = catalogue.groups.find((group) => group.id === 'extras:practice');
  assert.deepEqual(
    worker,
    rebuilt.entries.find((entry) => entry.name === workerName),
  );
  assert.ok(core.files.every((file) => !file.path.startsWith('optional-practice/')));
  for (const name of [workerName]) {
    const bytes = first.find((entry) => entry.name === name).bytes;
    assert.ok(practice.files.includes(name));
    assert.equal(
      catalogue.files.find((file) => file.path === name).sha256,
      createHash('sha256').update(bytes).digest('hex'),
    );
  }
  for (const size of [192, 512]) {
    const name = `icons/icon-${size}.png`,
      bytes = first.find((entry) => entry.name === name).bytes,
      pin = rebuilt.files.find((file) => file.path === name);
    assert.equal(pin.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.ok(worker.bytes.includes(Buffer.from(`../../${name}`)));
    assert.equal(first.filter((entry) => entry.name === name).length, 1);
    assert.ok(!first.some((entry) => entry.name === policy.root + name));
  }
  assert.throws(
    () =>
      buildBundledOptionalPractice(
        finalInputs.map((entry) =>
          entry.name === 'icons/icon-192.png' ? { ...entry, bytes: Buffer.from('changed') } : entry,
        ),
      ),
    /Bundled optional icon differs/,
  );
  assert.ok(rebuilt.files.length + 1 <= policy.limits.files);
  assert.ok(
    rebuilt.files.reduce((total, file) => total + file.bytes, worker.bytes.length) <=
      policy.limits.bytes,
  );
  for (const name of [policy.entry, manifestName, 'game/i18n/catalogs.mjs']) {
    const bytes = first.find((entry) => entry.name === name).bytes,
      pin = rebuilt.files.find((file) => file.path === name);
    assert.equal(pin.sha256, createHash('sha256').update(bytes).digest('hex'));
    assert.ok(worker.bytes.includes(Buffer.from(pin.sha256)));
  }
  assert.match(
    first.find((entry) => entry.name === policy.entry).bytes.toString(),
    /href="\.\.\/\.\.\/icons\/icon-192\.png"/,
  );
  assert.deepEqual(
    first.find((entry) => entry.name === 'game/i18n/catalogs.mjs').bytes,
    source.find((entry) => entry.name === 'game/i18n/catalogs.mjs').bytes,
  );
});

test('bundled FPV rejects missing, unadmitted, changed-vendor and oversized dependencies', async () => {
  const source = (await bundledFPVEntries()).map((entry) => {
      if (!entry.name.endsWith('/civilian-fpv/app.webmanifest')) return entry;
      const manifest = JSON.parse(entry.bytes);
      return {
        ...entry,
        bytes: Buffer.from(
          JSON.stringify({
            ...manifest,
            icons: manifest.icons.map((icon) => ({ ...icon, src: '../../' + icon.src.slice(2) })),
          }),
        ),
      };
    }),
    withBytes = (name, bytes) =>
      source.map((entry) => (entry.name === name ? { name, bytes } : entry));
  assert.equal(buildBundledOptionalPractice([]), null);
  assert.throws(
    () =>
      buildBundledOptionalPractice(source.filter((entry) => entry.name !== 'game/data-json.mjs')),
    /dependency is missing/,
  );
  assert.throws(
    () =>
      buildBundledOptionalPractice(
        withBytes(
          'optional-practice/civilian-fpv/app.mjs',
          Buffer.from("import '../../game/app.mjs';"),
        ),
      ),
    /not admitted: game\/app.mjs/,
  );
  assert.throws(
    () =>
      buildBundledOptionalPractice(
        withBytes('optional-practice/civilian-fpv/vendor/three.core.js', Buffer.from('changed')),
      ),
    /vendor bytes differ/,
  );
  assert.throws(
    () =>
      buildBundledOptionalPractice(
        withBytes('optional-practice/civilian-fpv/README.md', Buffer.alloc(7 * 1024 * 1024, 32)),
      ),
    /Complete bundled optional output exceeds/,
  );
});

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
  assert.equal(admission.packages[0].files, 69);
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
  assert.equal(source.size, 71);
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
  assert.equal(first.entries.length, 69);
  assert.ok(first.entries.reduce((sum, item) => sum + item.bytes.length, 0) < 8 * 1024 * 1024);
  assert.ok(first.entries.every(({ name }) => !name.includes('civilian-flight')));
  const f = candidate(first);
  const admitted = await validateOptionalPackageAdmission(f.envelope, f);
  assert.equal(admitted.publicEligible, false);
  assert.equal(admitted.packages[0].files, 69);
  const localeProjection = first.entries
    .find((entry) => entry.name === 'game/i18n/catalogs.mjs')
    .bytes.toString();
  assert.match(localeProjection, /learningProfiles\.choose/);
  assert.doesNotMatch(localeProjection, /completionRewards|Coupa|DroneAid/);
  const inventory = JSON.parse(f.files.get(f.package.sourceInventory.path));
  assert.equal(inventory.licenses.find((item) => item.dependency === 'three').version, '0.186.1');
  const source = readEditionZip(f.files.get(f.package.sourceArchive.path));
  assert.equal(source.size, 71);
  assertSharedRadioClosure(first, source);
  assert.ok(source.size <= 72);
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
    name = fixture.policy.vendorPins.find((pin) => pin.path.endsWith('/three.core.js')).path,
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
  assert.deepEqual([...caches], [owner + 'old', owner + 'new', ...foreign]);
});
