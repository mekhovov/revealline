import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildOptionalPractice, buildBundledOptionalPractice } from './build-optional-practice.mjs';
import { addOfflineEntries } from './game-cli.mjs';
import { OPTIONAL_PACKAGE_POLICIES } from '../publishing/optional-package-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const battlefieldFiles = [
  'optional-practice/civilian-fpv/battlefield-ground.mjs',
  'game/overflight/worlds.mjs',
  'game/overflight/terrain.mjs',
  'game/presentation/overflight-world-art.mjs',
  'game/presentation/overflight-world-slots.mjs',
  'game/overflight/world-layout-presentation.mjs',
  'game/presentation/overflight-world-art-v2.mjs',
  'game/snake/classic-structure-art.mjs',
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('every standalone SIM selector includes exact shared battlefield bytes without the combat runtime', async () => {
  for (const packageId of ['civilian-flight', 'civilian-fpv', 'fpv-worlds']) {
    const built = await buildOptionalPractice(root, { packageId });
    for (const name of battlefieldFiles) {
      const source = await readFile(path.join(root, name));
      const pin = built.manifest.files.find((file) => file.path === name);
      assert.ok(pin, `${packageId} includes ${name}`);
      assert.equal(pin.sha256, hash(source));
      assert.equal(pin.bytes, source.length);
    }
    assert.ok(
      built.manifest.files.every(
        ({ path: name }) =>
          !/^game\/overflight\/(?:app|core|renderer|project)\.mjs$/.test(name) &&
          !name.startsWith('game/studio/'),
      ),
      `${packageId} admits presentation without the combat or authoring runtime`,
    );
    if (packageId === 'civilian-flight')
      assert.ok(
        built.manifest.files.some(({ path: name }) => name === 'game/ui/world-ambience.mjs'),
      );
  }
});

test('final bundled SIM caches pin the full battlefield closure and still reject missing or foreign imports', async () => {
  const packages = ['civilian-fpv', 'fpv-worlds'];
  const names = new Set(
    packages.flatMap((id) => {
      const policy = OPTIONAL_PACKAGE_POLICIES[id];
      return [...policy.localFiles.map((name) => policy.root + name), ...policy.sharedFiles];
    }),
  );
  const entries = await Promise.all(
    [...names].map(async (name) => ({ name, bytes: await readFile(path.join(root, name)) })),
  );
  entries.push({ name: 'game/offline.mjs', bytes: Buffer.from('export {};') });
  await addOfflineEntries(root, entries, { version: 'v1.2.3' }, {});
  for (const packageId of packages) {
    const workerName = OPTIONAL_PACKAGE_POLICIES[packageId].root + 'worker.js';
    const inputs = entries.filter(({ name }) => name !== workerName);
    const bundled = buildBundledOptionalPractice(inputs, { packageId });
    const worker = entries.find(({ name }) => name === workerName);
    assert.deepEqual(
      worker,
      bundled.entries.find(({ name }) => name === workerName),
    );
    for (const name of battlefieldFiles) {
      const pin = bundled.files.find((file) => file.path === name);
      assert.ok(pin, `${packageId} includes ${name}`);
      assert.equal(pin.sha256, hash(entries.find((entry) => entry.name === name).bytes));
      assert.ok(worker.bytes.includes(Buffer.from(pin.sha256)));
    }
    assert.throws(
      () =>
        buildBundledOptionalPractice(
          inputs.filter(({ name }) => name !== 'game/overflight/terrain.mjs'),
          { packageId },
        ),
      /dependency is missing.*game\/overflight\/terrain\.mjs/,
    );
    assert.throws(
      () =>
        buildBundledOptionalPractice(
          inputs.map((entry) =>
            entry.name === 'game/overflight/worlds.mjs'
              ? {
                  ...entry,
                  bytes: Buffer.concat([entry.bytes, Buffer.from("\nimport './core.mjs';\n")]),
                }
              : entry,
          ),
          { packageId },
        ),
      /not admitted: game\/overflight\/core\.mjs/,
    );
  }
});
