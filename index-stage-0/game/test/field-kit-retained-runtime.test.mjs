import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle, exportThemeBundle } from '../presentation/bundle.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { validateThemeBundle } from '../presentation/model.mjs';
import { inspectPresentationDependencies } from '../presentation/dependencies.mjs';
import {
  FIELD_KIT_RETAINED_RUNTIME as pin,
  FIELD_KIT_RETAINED_RUNTIME_58 as pin58,
  FIELD_KIT_RETAINED_RUNTIME_60 as pin60,
  readFieldKitRetainedOutput,
} from '../../scripts/field-kit-retained-runtime.mjs';
import { compileFieldKitProduction } from '../../scripts/produce-field-kit-theme.mjs';
import { verifyPresentationOutput } from '../../scripts/write-presentation.mjs';

const read = (relative) => fs.readFile(new URL(`../../${relative}`, import.meta.url));
const sha = (bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex');
// Fixed outputs independently encoded from the authored equipment renderer.
// Never derive this expected set from the current ledger or its payload map.
const TEAM_EQUIPMENT_PAYLOADS = [
  {
    slot: 'team.anchor.available',
    sha256: '88e541375c56d4627b80cf6921ca64ed12d5b77d43dcae256177b8577250d9b3',
    bytes: 181,
  },
  {
    slot: 'team.anchor.captured',
    sha256: 'a66511c77322beea458be918f6eb35f1ca6acc9f980afa44bc4756162896f466',
    bytes: 195,
  },
  {
    slot: 'team.core.shielded',
    sha256: '009d14748f943002091255caebd32e4df1c886569575f512ab0d55d7a3ff637a',
    bytes: 389,
  },
  {
    slot: 'team.core.exposed',
    sha256: '6abc4a68192b4d517b22690c43126de34a1c403caf4a24ec57aa8b2ff68f079a',
    bytes: 395,
  },
  {
    slot: 'team.core.secured',
    sha256: '28e58f70c759b20798fac07e6f9d1b336e936ee23beea26bb4be30fd5528311d',
    bytes: 366,
  },
];

async function authenticateCanonicalOriginals(production) {
  const oracle = JSON.parse(await read('game/test/fixtures/production-main-reconciliation.json'));
  const checkpoint = oracle.canonical;
  assert.equal(checkpoint.revision, 57);
  const source = {
    format: 'revealline-theme-bundle.v1',
    id: 'field-kit',
    revision: 57,
    selection: {
      base: { id: 'base', revision: 1 },
      collection: null,
      theme: { id: 'fpv', revision: 57 },
    },
  };
  for (const group of ['slots', 'assets', 'themes', 'collections']) {
    const expected = oracle.shared[group] ?? checkpoint[group];
    source[group] = production.document[group].slice(0, expected.count);
    assert.equal(source[group].length, expected.count, `canonical57 ${group} count`);
    assert.equal(sha(canonicalJSON(source[group])), expected.sha256, `canonical57 ${group} hash`);
  }
  const document = validateThemeBundle(source);
  const assets = new Map(),
    originals = new Map();
  for (const asset of document.assets) {
    if (!asset.file || assets.has(asset.file.sha256)) continue;
    const blob = production.assets.get(asset.file.sha256);
    assert.ok(blob, `canonical original ${asset.file.sha256}`);
    assert.equal(blob.size, asset.file.bytes, `canonical original bytes ${asset.file.sha256}`);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(sha(bytes), asset.file.sha256, `canonical original hash ${asset.file.sha256}`);
    assets.set(asset.file.sha256, blob);
    originals.set(asset.file.sha256, bytes);
  }
  assert.equal(originals.size, 127, 'independently authenticated original payload count');
  const bundle = Buffer.from(await (await exportThemeBundle(document, assets)).arrayBuffer());
  assert.equal(bundle.length, checkpoint.bytes);
  assert.equal(sha(bundle), checkpoint.sha256, 'complete canonical57 bundle');
  return originals;
}

async function assertExactPayloadSet(assets, originals) {
  assert.equal(originals.size, 127);
  assert.equal(TEAM_EQUIPMENT_PAYLOADS.length, 5);
  const expected = new Map([...originals].map(([hash, bytes]) => [hash, bytes.length]));
  for (const item of TEAM_EQUIPMENT_PAYLOADS) {
    assert.equal(expected.has(item.sha256), false, `distinct equipment hash ${item.slot}`);
    expected.set(item.sha256, item.bytes);
  }
  assert.equal(expected.size, 132);
  assert.deepEqual(
    [...assets.keys()].sort(),
    [...expected.keys()].sort(),
    'exact payload identities',
  );
  const observed = new Map();
  for (const [hash, size] of expected) {
    const blob = assets.get(hash);
    assert.equal(blob.size, size, `payload bytes ${hash}`);
    const bytes = Buffer.from(await blob.arrayBuffer());
    const actual = sha(bytes);
    assert.equal(actual, hash, `payload hash ${hash}`);
    if (originals.has(hash))
      assert.deepEqual(bytes, originals.get(hash), `preserved original ${hash}`);
    observed.set(hash, actual);
  }
  return observed;
}

let fixturePromise;
function fixture() {
  return (fixturePromise ??= (async () => {
    const original = await read(pin.path);
    const production = await importThemeBundle(
      new Blob([await read('authoring/library/fpv-field-kit/production.rltheme')]),
      { decodeImage: null },
    );
    const inventory = await inspectPresentationDependencies(original);
    const originals = await authenticateCanonicalOriginals(production);
    return { original, production, inventory, originals };
  })());
}

test('retained production input has three code-owned original paths and validates raw bytes', async () => {
  const { original, production } = await fixture();
  const reads = [];
  const files = await readFieldKitRetainedOutput({
    assets: production.assets,
    read: async (path) => {
      reads.push(path);
      return read(path);
    },
  });
  assert.deepEqual(reads, [pin.path, pin58.path, pin60.path]);
  assert.equal(pin.commit, 'b810521a53af7be145acb8dedce0a01a747339cf');
  assert.equal(pin.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(sha(files.get('runtime.json')), pin60.sha256);
  assert.deepEqual(files.get('runtime.json'), await read(pin60.path));
  assert.deepEqual(files.get(`runtime.${pin.sha256}.json`), original);
  assert.equal(pin58.commit, '6842203fbf24db198da21759e23d5c5c64d499dd');
  assert.equal(pin58.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(pin58.bytes, 979746);
  assert.equal(pin58.sha256, 'ae9949a7c8c8a24775e68317e5825e9b4b2e5ae1dfb9bcffdd749a5adc4cce54');
  assert.deepEqual(files.get(`runtime.${pin58.sha256}.json`), await read(pin58.path));
  assert.equal(pin60.commit, 'bc8b7565f2c4277145b4763d76d928c45e024f1c');
  assert.equal(pin60.sha256, '38a3c4cc207ee9b136d1cada405f74385c44f3a4a20bc21d91e09c4fc386e39f');
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

test('production regeneration retains raw runtime54,58 and60 and originals without changing current output or history', async () => {
  const { original, production, inventory, originals } = await fixture();
  const before = structuredClone(production.document);
  const payloads = await assertExactPayloadSet(production.assets, originals);
  for (const revision of [54, 55, 56, 57, 58, 59, 60])
    assert(before.themes.some((theme) => theme.id === 'fpv' && theme.revision === revision));
  const config = JSON.parse(await read('.prettierrc.json'));
  const reads = [];
  const options = {
    config,
    read: async (path) => {
      reads.push(path);
      assert.ok(
        [pin.path, pin58.path, pin60.path].includes(path),
        'no incidental compiled-output history read',
      );
      return read(path);
    },
  };
  const first = await compileFieldKitProduction(production, options);
  const second = await compileFieldKitProduction(production, options);
  assert.deepEqual(reads, [pin.path, pin58.path, pin60.path, pin.path, pin58.path, pin60.path]);
  assert.deepEqual([...first.files], [...second.files], 'repeat generation is byte-identical');
  await verifyPresentationOutput(first.files);
  assert.deepEqual(first.files.get(`runtime.${pin.sha256}.json`), original);
  assert.deepEqual(first.files.get(`runtime.${pin58.sha256}.json`), await read(pin58.path));
  assert.deepEqual(first.files.get(`runtime.${pin60.sha256}.json`), await read(pin60.path));
  for (const file of inventory.files)
    assert.equal(sha(first.files.get(file.path)), file.sha256, file.path);
  for (const name of ['runtime.json', 'studio.json', 'theme.css'])
    assert.deepEqual(
      first.files.get(name),
      await read(`game/presentation/compiled/${name}`),
      `retention does not change current ${name}`,
    );
  assert.equal(
    first.files.size,
    139,
    '127 originals, five exact equipment payloads, current output and three retained runtimes',
  );
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
  assert.deepEqual(reformatted.files.get(`runtime.${pin58.sha256}.json`), await read(pin58.path));
  assert.deepEqual(reformatted.files.get(`runtime.${pin60.sha256}.json`), await read(pin60.path));
  await verifyPresentationOutput(reformatted.files);
  assert.deepEqual(production.document, before, 'all immutable records including 54–58 remain');
  assert.equal(production.assets.size, payloads.size);
  for (const [hash, blob] of production.assets)
    assert.equal(sha(await blob.arrayBuffer()), payloads.get(hash), `unchanged payload ${hash}`);
});

test('the authenticated exact payload set rejects missing, substituted, extra and corrupt originals or equipment', async () => {
  const { production, originals } = await fixture();
  await assertExactPayloadSet(production.assets, originals);
  const originalHash = originals.keys().next().value;
  const equipmentHash = TEAM_EQUIPMENT_PAYLOADS[0].sha256;
  const unknownHash = '0'.repeat(64);
  assert.equal(production.assets.has(unknownHash), false);
  for (const hash of [originalHash, equipmentHash]) {
    const missing = new Map(production.assets);
    missing.delete(hash);
    await assert.rejects(assertExactPayloadSet(missing, originals), /exact payload identities/);
    const bytes = Buffer.from(await production.assets.get(hash).arrayBuffer());
    const corrupt = Buffer.from(bytes);
    corrupt[0] ^= 1;
    const substitutedBytes = new Map(production.assets);
    substitutedBytes.set(hash, new Blob([corrupt]));
    await assert.rejects(assertExactPayloadSet(substitutedBytes, originals), /payload hash/);
    const truncated = new Map(production.assets);
    truncated.set(hash, new Blob([bytes.subarray(1)]));
    await assert.rejects(assertExactPayloadSet(truncated, originals), /payload bytes/);
  }
  const extra = new Map(production.assets);
  extra.set(unknownHash, production.assets.get(equipmentHash));
  await assert.rejects(assertExactPayloadSet(extra, originals), /exact payload identities/);
  const sameCountSubstitution = new Map(extra);
  sameCountSubstitution.delete(equipmentHash);
  assert.equal(sameCountSubstitution.size, production.assets.size);
  await assert.rejects(
    assertExactPayloadSet(sameCountSubstitution, originals),
    /exact payload identities/,
  );
  const rewrittenHistory = structuredClone(production.document);
  rewrittenHistory.assets[0].description += ' changed';
  await assert.rejects(
    authenticateCanonicalOriginals({ ...production, document: rewrittenHistory }),
    /canonical57 assets hash/,
  );
});

test('explicit60 rejects changed raw bytes and missing or corrupt Team-only payloads', async () => {
  const { production } = await fixture();
  const original = await read(pin60.path);
  for (const body of [Buffer.from(original), original.subarray(1)]) {
    if (body.length === original.length) body[10] ^= 1;
    await assert.rejects(
      readFieldKitRetainedOutput({
        assets: production.assets,
        read: (path) => (path === pin60.path ? body : read(path)),
      }),
      /runtime input hash differs|runtime byte count differs/,
    );
  }
  const hash = TEAM_EQUIPMENT_PAYLOADS[0].sha256;
  const missing = new Map(production.assets);
  missing.delete(hash);
  await assert.rejects(
    readFieldKitRetainedOutput({ assets: missing, read }),
    /dependency is unavailable/,
  );
  const corrupt = new Map(production.assets);
  const body = Buffer.from(await corrupt.get(hash).arrayBuffer());
  body[0] ^= 1;
  corrupt.set(hash, new Blob([body]));
  await assert.rejects(
    readFieldKitRetainedOutput({ assets: corrupt, read }),
    /dependency hash differs/,
  );
});

test('accepted58 is byte-exact, dependency-complete and fails closed without losing other history', async () => {
  const { production } = await fixture();
  const original58 = await read(pin58.path);
  assert.equal(original58.length, 979746);
  assert.equal(sha(original58), pin58.sha256);
  const files = await readFieldKitRetainedOutput({ assets: production.assets, read });
  assert.deepEqual(files.get(`runtime.${pin58.sha256}.json`), original58);
  await verifyPresentationOutput(files);
  for (const body of [Buffer.from(original58), original58.subarray(1)]) {
    if (body.length === original58.length) body[10] ^= 1;
    await assert.rejects(
      readFieldKitRetainedOutput({
        assets: production.assets,
        read: (path) => (path === pin58.path ? body : read(path)),
      }),
      /runtime input hash differs|runtime byte count differs/,
    );
  }
  assert.deepEqual(files.get(`runtime.${pin.sha256}.json`), await read(pin.path));
  assert.deepEqual(files.get('runtime.json'), await read(pin60.path));
});
