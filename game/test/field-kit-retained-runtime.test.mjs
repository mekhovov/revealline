import test from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
// Preserve exact deep strict equality without formatting megabytes of differing bytes.
function boundedBytesEqual(actual, expected, message) {
  if (isDeepStrictEqual(actual, expected)) return;
  const label = (value) => {
    if (value instanceof Uint8Array)
      return (
        value.constructor.name +
        '(' +
        value.byteLength +
        ' bytes, sha256=' +
        createHash('sha256').update(value).digest('hex') +
        ')'
      );
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    return typeof value;
  };
  assert.ok(
    false,
    (message ?? 'Deep strict byte mismatch.') +
      ' Actual: ' +
      label(actual) +
      '; expected: ' +
      label(expected) +
      '.',
  );
}
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { inspectPresentationDependencies } from '../presentation/dependencies.mjs';
import {
  FIELD_KIT_RETAINED_RUNTIME as pin,
  FIELD_KIT_RETAINED_RUNTIME_38 as pin38,
  FIELD_KIT_RETAINED_RUNTIME_50 as pin50,
  FIELD_KIT_RETAINED_RUNTIME_58 as pin58,
  FIELD_KIT_RETAINED_RUNTIME_60 as pin60,
  FIELD_KIT_RETAINED_RUNTIME_62 as pin62,
  FIELD_KIT_RETAINED_DISCOVERY101 as pinDiscovery101,
  FIELD_KIT_RETAINED_DISCOVERY102 as pinDiscovery102,
  FIELD_KIT_RETAINED_DISCOVERY103 as pinDiscovery103,
  FIELD_KIT_RETAINED_MAIN101 as pinMain101,
  FIELD_KIT_RETAINED_RADIO_PREDECESSOR102 as pinRadio102,
  FIELD_KIT_RETAINED_NATIVE_PREDECESSOR103 as pinNative103,
  FIELD_KIT_RETAINED_CANONICAL104 as pinCanonical104,
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

// Independent frozen payload inventory from the pre-migration authoring bundle.
// Metadata successors are different files; the shared images/audio/fonts stay exact.
async function authenticateCanonicalOriginals(production) {
  const oracle = JSON.parse(await read('game/test/fixtures/shared-presentation-payloads.json'));
  assert.equal(
    sha(canonicalJSON(production.document.assets.slice(0, oracle.retainedAssets.count))),
    oracle.retainedAssets.sha256,
    'retained assets hash',
  );
  assert.equal(oracle.payloads.length, 132);
  const equipment = new Set(TEAM_EQUIPMENT_PAYLOADS.map((item) => item.sha256));
  const originals = new Map();
  for (const file of oracle.payloads) {
    const blob = production.assets.get(file.sha256);
    assert.ok(blob, `shared payload ${file.sha256}`);
    assert.equal(blob.size, file.bytes);
    const bytes = Buffer.from(await blob.arrayBuffer());
    assert.equal(sha(bytes), file.sha256);
    if (!equipment.has(file.sha256)) originals.set(file.sha256, bytes);
  }
  assert.equal(originals.size, 127);
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

test('retained production inputs preserve thirteen exact paths across independent lineages', async () => {
  const { original, production } = await fixture();
  const reads = [];
  const files = await readFieldKitRetainedOutput({
    assets: production.assets,
    read: async (path) => {
      reads.push(path);
      return read(path);
    },
  });
  assert.deepEqual(reads, [
    pin38.path,
    pin50.path,
    pin.path,
    pin58.path,
    pin60.path,
    pin62.path,
    pinDiscovery101.path,
    pinDiscovery102.path,
    pinDiscovery103.path,
    pinMain101.path,
    pinRadio102.path,
    pinNative103.path,
    pinCanonical104.path,
  ]);
  // Exact successor bytes, with original source commits retained as provenance.
  // Numeric revisions never substitute for authenticated manifest identities.
  for (const [item, commit, bytes, sha256] of [
    [
      pin38,
      '432110b51c570b838cdae390790b67dfa76f0785',
      808787,
      'e4d16e7b206f50023a1f67249c9be63f9968975071cf16ea0802891ca122e3b3',
    ],
    [
      pin50,
      'e9434d03feb30bf8767051b2832a4ab987b2fa41',
      818280,
      '666e68e92f7472368ed915fdf434dff25958553121bc504c8a9b71724386bcae',
    ],
    [
      pinNative103,
      '1b99d2ea791074ff79f6be9b8176594b0733874f',
      1075486,
      '7acb0bb2793781d0d5bbb774eeda05f38bfa30dcf71dc6a600a652bb7718f589',
    ],
    [
      pinCanonical104,
      'c5e22bc860e9021d42ce326761d0f4decba3fc40',
      1089502,
      '087e920b6c20d5f8adb64b4824a954c998799a18becd5dbe1030fd007de69ce8',
    ],
  ]) {
    assert.equal(item.predecessorCommit, commit);
    assert.equal(item.originalPath, 'game/presentation/compiled/runtime.json');
    assert.equal(item.bytes, bytes);
    assert.equal(item.sha256, sha256);
    const original = await read(item.path);
    assert.equal(original.length, bytes);
    assert.equal(sha(original), sha256);
    boundedBytesEqual(
      files.get(item === pinCanonical104 ? 'runtime.json' : `runtime.${sha256}.json`),
      original,
    );
  }
  boundedBytesEqual(files.get(`runtime.${pinRadio102.sha256}.json`), await read(pinRadio102.path));
  assert.equal(pin.predecessorCommit, 'b810521a53af7be145acb8dedce0a01a747339cf');
  assert.equal(pin.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(sha(files.get('runtime.json')), pinCanonical104.sha256);
  assert.deepEqual(files.get('runtime.json'), await read(pinCanonical104.path));
  assert.deepEqual(files.get(`runtime.${pinMain101.sha256}.json`), await read(pinMain101.path));
  assert.equal(pinRadio102.predecessorCommit, '280321ca77eef81d1bce9de8c23247548ae9dd03');
  assert.equal(pinRadio102.bytes, 1073942);
  assert.equal(
    pinRadio102.sha256,
    '649a6f8b94cac1fd2f81e05c5647e0e85e16cd7858c592ae5bdbdc85481b384f',
  );
  assert.deepEqual(files.get(`runtime.${pin.sha256}.json`), original);
  assert.equal(pin58.predecessorCommit, '6842203fbf24db198da21759e23d5c5c64d499dd');
  assert.equal(pin58.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(pin58.bytes, 820068);
  assert.equal(pin58.sha256, 'b3a79b85a00b8bc8b70a12fcc7aedfe6667ea8d3da64ea4baab85fb28b52e12c');
  assert.deepEqual(files.get(`runtime.${pin58.sha256}.json`), await read(pin58.path));
  assert.equal(pin60.predecessorCommit, 'bc8b7565f2c4277145b4763d76d928c45e024f1c');
  assert.equal(pin60.sha256, '3d1cfb93d141f08b1f9cee06a3a528e10aab688634a36eed665a7d4e7e912b9b');
  assert.deepEqual(files.get(`runtime.${pin60.sha256}.json`), await read(pin60.path));
  assert.equal(pin62.predecessorCommit, '2e64c130d219dfece5134ba9119b85a5bf34904d');
  assert.equal(pin62.originalPath, 'game/presentation/compiled/runtime.json');
  assert.equal(pin62.bytes, 921950);
  assert.equal(pin62.sha256, 'af2d1d398ca56ec365899940d27f790c2b406d385461e89a1dc8fcbbcede6972');
  await verifyPresentationOutput(files);
  const corrupt = Buffer.from(original);
  corrupt[10] ^= 1;
  await assert.rejects(
    readFieldKitRetainedOutput({
      assets: production.assets,
      read: (path) => (path === pin.path ? corrupt : read(path)),
    }),
    /runtime input hash differs/,
  );
  await assert.rejects(
    readFieldKitRetainedOutput({
      assets: production.assets,
      read: (path) => (path === pin.path ? original.subarray(1) : read(path)),
    }),
    /runtime byte count differs/,
  );
});

test('retained runtime refuses missing and corrupt lazy dependency originals', async () => {
  const { production, inventory } = await fixture();
  const file = inventory.files[0];
  assert(file);
  const missing = new Map(production.assets);
  missing.delete(file.sha256);
  await assert.rejects(
    readFieldKitRetainedOutput({ read, assets: missing }),
    /dependency is unavailable/,
  );
  const corrupt = new Map(production.assets);
  const bytes = Buffer.from(await corrupt.get(file.sha256).arrayBuffer());
  bytes[0] ^= 1;
  corrupt.set(file.sha256, new Blob([bytes]));
  await assert.rejects(
    readFieldKitRetainedOutput({ read, assets: corrupt }),
    /dependency hash differs/,
  );
});

test('production regeneration retains all thirteen raw runtime inputs and originals without changing current output or history', async () => {
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
        [
          pin38.path,
          pin50.path,
          pin.path,
          pin58.path,
          pin60.path,
          pin62.path,
          pinDiscovery101.path,
          pinDiscovery102.path,
          pinDiscovery103.path,
          pinMain101.path,
          pinRadio102.path,
          pinNative103.path,
          pinCanonical104.path,
        ].includes(path),
        'no incidental compiled-output history read',
      );
      return read(path);
    },
  };
  const first = await compileFieldKitProduction(production, options);
  const second = await compileFieldKitProduction(production, options);
  assert.deepEqual(reads, [
    ...[
      pin38.path,
      pin50.path,
      pin.path,
      pin58.path,
      pin60.path,
      pin62.path,
      pinDiscovery101.path,
      pinDiscovery102.path,
      pinDiscovery103.path,
      pinMain101.path,
      pinRadio102.path,
      pinNative103.path,
      pinCanonical104.path,
    ],
    ...[
      pin38.path,
      pin50.path,
      pin.path,
      pin58.path,
      pin60.path,
      pin62.path,
      pinDiscovery101.path,
      pinDiscovery102.path,
      pinDiscovery103.path,
      pinMain101.path,
      pinRadio102.path,
      pinNative103.path,
      pinCanonical104.path,
    ],
  ]);
  assert.deepEqual([...first.files], [...second.files], 'repeat generation is byte-identical');
  await verifyPresentationOutput(first.files);
  assert.deepEqual(first.files.get(`runtime.${pin.sha256}.json`), original);
  assert.deepEqual(first.files.get(`runtime.${pin58.sha256}.json`), await read(pin58.path));
  assert.deepEqual(first.files.get(`runtime.${pin60.sha256}.json`), await read(pin60.path));
  assert.deepEqual(first.files.get(`runtime.${pin62.sha256}.json`), await read(pin62.path));
  assert.deepEqual(
    first.files.get(`runtime.${pin62.sha256}.json`),
    await read(`game/presentation/compiled/runtime.${pin62.sha256}.json`),
    'published retained62 alias matches its immutable authoring input',
  );
  assert.deepEqual(
    first.files.get('manifest.json'),
    await read('game/presentation/compiled/manifest.json'),
    'compiled ownership includes the complete retained output',
  );
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
    149,
    '127 originals, five exact equipment payloads, current output and thirteen retained runtimes',
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
  assert.deepEqual(reformatted.files.get(`runtime.${pin62.sha256}.json`), await read(pin62.path));
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
    /retained assets hash/,
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
  assert.equal(original58.length, 820068);
  assert.equal(sha(original58), pin58.sha256);
  const files = await readFieldKitRetainedOutput({ assets: production.assets, read });
  boundedBytesEqual(files.get(`runtime.${pin58.sha256}.json`), original58);
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
  boundedBytesEqual(files.get(`runtime.${pin.sha256}.json`), await read(pin.path));
  boundedBytesEqual(files.get(`runtime.${pin60.sha256}.json`), await read(pin60.path));
  boundedBytesEqual(files.get('runtime.json'), await read(pinCanonical104.path));
});

test('explicit62 preserves all lazy dependencies and rejects changed original manifest bytes', async () => {
  const { production } = await fixture();
  const original = await read(pin62.path);
  const inventory = await inspectPresentationDependencies(original, {
    retainedManifestSha256: pin62.sha256,
  });
  const files = await readFieldKitRetainedOutput({ assets: production.assets, read });
  assert.equal(inventory.source.revision, 62);
  assert.equal(inventory.theme.revision, 62);
  assert.equal(inventory.collection, null);
  for (const file of inventory.files) {
    assert.equal(files.get(file.path)?.length, file.bytes, file.path);
    assert.equal(sha(files.get(file.path)), file.sha256, file.path);
  }
  for (const body of [Buffer.from(original), original.subarray(1)]) {
    if (body.length === original.length) body[10] ^= 1;
    await assert.rejects(
      readFieldKitRetainedOutput({
        assets: production.assets,
        read: (path) => (path === pin62.path ? body : read(path)),
      }),
      /runtime input hash differs|runtime byte count differs/,
    );
  }
});

test('colliding preview and canonical revision101 retain different exact manifest authorities', async () => {
  const { production } = await fixture();
  const files = await readFieldKitRetainedOutput({ assets: production.assets, read });
  const pins = [
    pinDiscovery101,
    pinDiscovery102,
    pinDiscovery103,
    pinMain101,
    pinRadio102,
    pinNative103,
    pinCanonical104,
  ];
  const identities = [];
  for (const item of pins) {
    const original = await read(item.path);
    assert.equal(original.length, item.bytes);
    assert.equal(sha(original), item.sha256);
    const retained = files.get(
      item === pinCanonical104 ? 'runtime.json' : `runtime.${item.sha256}.json`,
    );
    boundedBytesEqual(retained, original);
    const inventory = await inspectPresentationDependencies(retained, {
      retainedManifestSha256: item.sha256,
    });
    identities.push(inventory.theme.revision);
    for (const file of inventory.files) {
      assert.equal(files.get(file.path)?.length, file.bytes);
      assert.equal(sha(files.get(file.path)), file.sha256);
    }
    const corrupt = Buffer.from(original);
    corrupt[10] ^= 1;
    await assert.rejects(
      readFieldKitRetainedOutput({
        assets: production.assets,
        read: (path) => (path === item.path ? corrupt : read(path)),
      }),
      /runtime input hash differs/,
    );
  }
  assert.deepEqual(identities, [101, 102, 103, 101, 102, 103, 104]);
  assert.notEqual(pinDiscovery101.sha256, pinMain101.sha256);
  assert.notEqual(pinDiscovery102.sha256, pinRadio102.sha256);
  await verifyPresentationOutput(files);
});
