import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { inspectPresentationDependencies } from '../presentation/dependencies.mjs';
import {
  FIELD_KIT_RETAINED_RUNTIME as pin,
  readFieldKitRetainedOutput,
} from '../../scripts/field-kit-retained-runtime.mjs';
import { compileFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';
import { verifyPresentationOutput } from '../../scripts/write-presentation.mjs';

const read = (relative) => fs.readFile(new URL(`../../${relative}`, import.meta.url));
const sha = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
let fixturePromise;
function fixture() {
  return (fixturePromise ??= (async () => {
    const original = await read(pin.path);
    const production = await importThemeBundle(
      new Blob([await read('authoring/library/fpv-field-kit/production.rltheme')]),
      { decodeImage: null },
    );
    const inventory = await inspectPresentationDependencies(original);
    return { original, production, inventory };
  })());
}

test('retained production input has one code-owned original path and validates raw bytes', async () => {
  const { original, production } = await fixture();
  const reads = [];
  const files = await readFieldKitRetainedOutput({
    assets: production.assets,
    read: async (path) => {
      reads.push(path);
      return original;
    },
  });
  assert.deepEqual(reads, [pin.path]);
  assert.equal(pin.commit, 'b810521a53af7be145acb8dedce0a01a747339cf');
  assert.equal(pin.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(sha(files.get('runtime.json')), pin.sha256);
  assert.deepEqual(files.get('runtime.json'), original);
  await verifyPresentationOutput(files);
  const corrupt = Buffer.from(original);
  corrupt[10] ^= 1;
  await assert.rejects(
    readFieldKitRetainedOutput({ assets: new Map(), read: async () => corrupt }),
    /runtime input hash differs/,
  );
  await assert.rejects(
    readFieldKitRetainedOutput({ assets: new Map(), read: async () => original.subarray(1) }),
    /runtime byte count differs/,
  );
});

test('retained runtime refuses missing and corrupt lazy dependency originals', async () => {
  const { original, production, inventory } = await fixture();
  const file = inventory.files[0];
  assert(file);
  const missing = new Map(production.assets);
  missing.delete(file.sha256);
  await assert.rejects(
    readFieldKitRetainedOutput({ read: async () => original, assets: missing }),
    /dependency is unavailable/,
  );
  const corrupt = new Map(production.assets);
  const bytes = Buffer.from(await corrupt.get(file.sha256).arrayBuffer());
  bytes[0] ^= 1;
  corrupt.set(file.sha256, new Blob([bytes]));
  await assert.rejects(
    readFieldKitRetainedOutput({ read: async () => original, assets: corrupt }),
    /dependency hash differs/,
  );
});

test('production regeneration retains raw runtime54 and originals without changing current output or history', async () => {
  const { original, production, inventory } = await fixture();
  const before = structuredClone(production.document);
  const payloads = new Map(
    await Promise.all(
      [...production.assets].map(async ([hash, blob]) => [hash, sha(await blob.arrayBuffer())]),
    ),
  );
  assert.equal(payloads.size, 127);
  for (const [hash, actual] of payloads) assert.equal(actual, hash);
  for (const revision of [54, 55, 56, 57, 58])
    assert(before.themes.some((theme) => theme.id === 'fpv' && theme.revision === revision));
  const config = JSON.parse(await read('.prettierrc.json'));
  const reads = [];
  const options = {
    config,
    read: async (path) => {
      reads.push(path);
      assert.equal(path, pin.path, 'no incidental compiled-output history read');
      return original;
    },
  };
  const first = await compileFieldKitProduction(production, options);
  const second = await compileFieldKitProduction(production, options);
  assert.deepEqual(reads, [pin.path, pin.path]);
  assert.deepEqual([...first.files], [...second.files], 'repeat generation is byte-identical');
  await verifyPresentationOutput(first.files);
  assert.deepEqual(first.files.get(`runtime.${pin.sha256}.json`), original);
  for (const file of inventory.files)
    assert.equal(sha(first.files.get(file.path)), file.sha256, file.path);
  for (const name of ['runtime.json', 'studio.json', 'theme.css'])
    assert.deepEqual(
      first.files.get(name),
      await read(`game/presentation/compiled/${name}`),
      `retention does not change current ${name}`,
    );
  assert.equal(first.files.size, 132, '127 originals, current output and one retained runtime');
  const reformatted = await compileFieldKitProduction(production, {
    ...options,
    config: { ...config, tabWidth: 3 },
  });
  assert.notDeepEqual(reformatted.files.get('runtime.json'), first.files.get('runtime.json'));
  assert.deepEqual(
    reformatted.files.get(`runtime.${pin.sha256}.json`),
    original,
    'current formatter changes never rewrite retained runtime bytes',
  );
  await verifyPresentationOutput(reformatted.files);
  assert.deepEqual(production.document, before, 'all immutable records including 54–58 remain');
  assert.equal(production.assets.size, payloads.size);
  for (const [hash, blob] of production.assets)
    assert.equal(sha(await blob.arrayBuffer()), payloads.get(hash), `unchanged payload ${hash}`);
});
