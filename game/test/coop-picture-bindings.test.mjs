import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_SUPPORTED_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
} from '../couch/coop-picture-bindings.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const original = new Map();
for (const row of COOP_PICTURE_BINDINGS) {
  const file = compiled.urls[row.picture.sha256];
  assert.equal(file, `./assets/${row.picture.sha256}.png`);
  original.set(
    row.picture.slot,
    await readFile(new URL(`../presentation/compiled/${file}`, import.meta.url)),
  );
}

function fixture(index = 0, source = compiled, bindings = COOP_PICTURE_BINDINGS, policies) {
  const row = bindings.filter((item) => item.themeRevision === source.resolved.theme.revision)[
      index
    ],
    snapshot = { resolved: structuredClone(source.resolved) },
    request = {
      pack: structuredClone(COOP_STARTER_PACK),
      levelId: row.levelId,
      themeId: 'fpv',
      attemptId: 'team-binding-test',
    },
    calls = { reads: 0, decodes: 0, releases: 0 };
  let corrupt = false;
  const presentation = createCoopPresentation({
    bindings,
    historicalImportPolicy: policies,
    getSnapshot: () => snapshot,
    async readPicture(slot, options) {
      calls.reads++;
      assert.equal(slot, row.picture.slot);
      assert.equal(options.snapshot, snapshot);
      assert.equal(options.signal.aborted, false);
      const bytes = Buffer.from(original.get(slot));
      if (corrupt) bytes[bytes.length - 1] ^= 1;
      return {
        asset: snapshot.resolved.assets[slot],
        blob: new Blob([bytes], { type: row.picture.mime }),
      };
    },
    async decodeImage(blob, options) {
      calls.decodes++;
      assert.equal(options.signal.aborted, false);
      assert.equal(sha(Buffer.from(await blob.arrayBuffer())), row.picture.sha256);
      // Reader and header validation use real approved bytes. This finite decoder
      // models a release handle, not browser decoding or Team overlay approval.
      return {
        image: { width: 1152, height: 576 },
        release: () => calls.releases++,
      };
    },
  });
  return { row, snapshot, request, calls, presentation, corrupt: () => (corrupt = true) };
}

test('the closed two-row authority is immutable and matches the complete authored starter pack', () => {
  assert.equal(validateCoopPack(COOP_STARTER_PACK).valid, true);
  assert.equal(COOP_PICTURE_BINDINGS.length, 2);
  assert.equal(
    compiled.resolved.theme.revision,
    74,
    'Exact reviewed production metadata, never an unqualified latest alias',
  );
  assert.deepEqual(
    COOP_PICTURE_BINDINGS.map((row) => row.levelId),
    ['first-connection', 'relay-yard'],
  );
  assert.deepEqual(
    COOP_PICTURE_BINDINGS.map((row) => [row.picture.slot, row.picture.sha256]),
    [
      ['scene.reveal.wide', '53f1206a11a8791892f5c844c0641529acbc2c09c8d558676d0d801d72113850'],
      [
        'picture.fpv.adf5c9eea274ba7f',
        'd76f309d8385cd5d20fc2fff72b7f3abc19299cccdde767d76dd9f4a4960929d',
      ],
    ],
    'Only the approved Orchard and Foundry derivatives are admitted',
  );
  assert.equal(Object.isFrozen(COOP_PICTURE_BINDINGS), true);
  for (const row of COOP_PICTURE_BINDINGS) {
    const level = COOP_STARTER_PACK.levels.find((entry) => entry.id === row.levelId),
      asset = compiled.resolved.assets[row.picture.slot],
      bytes = original.get(row.picture.slot);
    assert.equal(row.packId, COOP_STARTER_PACK.id);
    assert.equal(row.packRevision, COOP_STARTER_PACK.revision);
    assert.equal(row.packSha256, sha(canonicalJSON(COOP_STARTER_PACK)));
    assert.equal(row.levelSha256, sha(canonicalJSON(level)));
    assert.equal(row.levelRevision, level.revision);
    assert.equal(row.themeId, compiled.resolved.theme.id);
    assert.equal(row.themeRevision, compiled.resolved.theme.revision);
    assert.equal(row.collection, null);
    assert.equal(compiled.resolved.collection, null);
    assert.equal(row.picture.assetId, asset.id);
    assert.equal(row.picture.assetRevision, asset.revision);
    assert.deepEqual(
      { ...row.picture, slot: undefined, assetId: undefined, assetRevision: undefined },
      { ...asset.file, slot: undefined, assetId: undefined, assetRevision: undefined },
    );
    assert.equal(bytes.length, row.picture.bytes);
    assert.equal(sha(bytes), row.picture.sha256);
    assert.deepEqual(asset.geometry.frame, { x: 0, y: 0, width: 1152, height: 576 });
    assert.throws(() => (row.picture.sha256 = '0'.repeat(64)), TypeError);
    assert.throws(() => (row.packRevision = 3), TypeError);
  }
  assert.throws(() => COOP_PICTURE_BINDINGS.push(COOP_PICTURE_BINDINGS[0]), TypeError);
});

test('current74 picture association preserves the exact58–73 closed bindings and policies', () => {
  const retained = [58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73];
  assert.deepEqual(
    [...new Set(COOP_SUPPORTED_PICTURE_BINDINGS.map((row) => row.themeRevision))].sort(),
    [...retained, 74],
  );
  assert.equal(COOP_SUPPORTED_PICTURE_BINDINGS.length, 34);
  for (const revision of retained) {
    const previous = COOP_SUPPORTED_PICTURE_BINDINGS.filter(
      (row) => row.themeRevision === revision,
    );
    assert.deepEqual(
      previous,
      COOP_PICTURE_BINDINGS.map((row) => ({ ...row, themeRevision: revision })),
    );
    assert(previous.every((row) => Object.isFrozen(row) && Object.isFrozen(row.picture)));
  }
  assert.deepEqual(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.map((row) => row.themeRevision).sort(), [
    ...retained,
    74,
  ]);
  const current = COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.find((row) => row.themeRevision === 74);
  for (const previous of COOP_HISTORICAL_IMPORT_PICTURE_POLICIES)
    assert.deepEqual(previous, { ...current, themeRevision: previous.themeRevision });
});

test('the original retained62 manifest still selects and verifies both unchanged pictures', async (t) => {
  const historical = validateCompiledPresentation(
    JSON.parse(
      await readFile(
        new URL(
          '../presentation/compiled/runtime.b4a7285520550e4cd04c7b9e80b4c6468c0a914faac77c05fa7f86a72c8a3c8f.json',
          import.meta.url,
        ),
      ),
    ),
  );
  assert.equal(historical.resolved.theme.revision, 62);
  for (const index of [0, 1]) {
    const f = fixture(
      index,
      historical,
      COOP_SUPPORTED_PICTURE_BINDINGS,
      COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
    );
    t.after(() => f.presentation.dispose());
    const binding = await f.presentation.select(f.request);
    assert.equal(binding.choice.themeRevision, 62);
    assert.equal(binding.choice.picture.sha256, COOP_PICTURE_BINDINGS[index].picture.sha256);
    assert.equal(f.presentation.confirm(f.request), binding);
    assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
  }
});

test('the complete real six-policy host configuration prepares both current starter pictures', async (t) => {
  for (const index of [0, 1]) {
    const f = fixture(
      index,
      compiled,
      COOP_SUPPORTED_PICTURE_BINDINGS,
      COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
    );
    t.after(() => f.presentation.dispose());
    const binding = await f.presentation.select(f.request);
    assert.equal(binding.choice.themeRevision, 74);
    assert.equal(binding.choice.picture.sha256, COOP_PICTURE_BINDINGS[index].picture.sha256);
    assert.equal(f.presentation.confirm(f.request), binding);
    assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
  }
});

test('historical policy capacity remains exactly seventeen and duplicate identities still fail', () => {
  const create = (historicalImportPolicy) =>
    createCoopPresentation({
      bindings: COOP_SUPPORTED_PICTURE_BINDINGS,
      historicalImportPolicy,
      getSnapshot: () => ({ resolved: compiled.resolved }),
      readPicture: () => {
        throw new Error('Invalid policy must not read assets.');
      },
      decodeImage: () => {
        throw new Error('Invalid policy must not decode assets.');
      },
    });
  assert.throws(
    () =>
      create([
        ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
        { ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES[0], themeRevision: 75 },
      ]),
    /array exceeds/,
  );
  assert.throws(
    () =>
      create([
        ...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.slice(0, 16),
        COOP_HISTORICAL_IMPORT_PICTURE_POLICIES[0],
      ]),
    /Duplicate Team historical picture identity/,
  );
});

for (const [index, name] of ['First Connection', 'Relay Yard'].entries()) {
  test(`${name} verifies its real approved PNG and returns a full-frame contain/nearest lease`, async (t) => {
    const f = fixture(index);
    t.after(() => f.presentation.dispose());
    const packBefore = canonicalJSON(f.request.pack);
    const binding = await f.presentation.select(f.request);
    assert.equal(binding.choice.kind, 'image');
    assert.equal(binding.snapshot, f.snapshot);
    assert.equal(binding.choice.picture.sha256, f.row.picture.sha256);
    assert.equal(binding.fit, 'contain');
    assert.equal(binding.sampling, 'nearest');
    assert.equal(f.presentation.confirm(f.request), binding);
    assert.equal(
      await f.presentation.select(f.request),
      binding,
      'Same-attempt Retry keeps the lease',
    );
    assert.equal(canonicalJSON(f.request.pack), packBefore);
    assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
    f.presentation.dispose();
    f.presentation.dispose();
    assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 1 });
  });
}

for (const [name, mutate] of [
  ['same-ID pack rename', (f) => (f.request.pack.name += ' imported')],
  ['same-ID selected level changed', (f) => (f.request.pack.levels[0].name += ' imported')],
  ['same-ID other level changed', (f) => (f.request.pack.levels[1].name += ' imported')],
  ['pack revision changed', (f) => f.request.pack.revision++],
  ['level revision changed', (f) => f.request.pack.levels[0].revision++],
  ['unknown pack ID', (f) => (f.request.pack.id = 'imported-starter')],
]) {
  test(`${name} has no picture authority before any reader or decoder`, async (t) => {
    const f = fixture();
    t.after(() => f.presentation.dispose());
    mutate(f);
    assert.equal(validateCoopPack(f.request.pack).valid, true, 'This is a valid changed import');
    await assert.rejects(f.presentation.select(f.request), /No exact Team picture binding/);
    assert.equal(f.presentation.current(), null);
    assert.deepEqual(f.calls, { reads: 0, decodes: 0, releases: 0 });
  });
}

for (const [name, mutate] of [
  ['theme revision', (s) => s.resolved.theme.revision++],
  ['older theme revision', (s) => s.resolved.theme.revision--],
  ['different collection', (s) => (s.resolved.collection = { id: 'imported', revision: 1 })],
  ['different theme', (s) => (s.resolved.theme.id = 'retro')],
  ['asset ID', (s, p) => (s.resolved.assets[p.slot].id = 'replacement-picture')],
  ['asset revision', (s, p) => s.resolved.assets[p.slot].revision++],
  ['asset hash', (s, p) => (s.resolved.assets[p.slot].file.sha256 = '0'.repeat(64))],
  ['asset bytes', (s, p) => s.resolved.assets[p.slot].file.bytes++],
  ['asset MIME', (s, p) => (s.resolved.assets[p.slot].file.mime = 'image/jpeg')],
  ['asset dimensions', (s, p) => s.resolved.assets[p.slot].file.width++],
  ['unreviewed asset', (s, p) => (s.resolved.assets[p.slot].quality.stage = 'produced')],
  ['cropped frame', (s, p) => s.resolved.assets[p.slot].geometry.frame.width--],
  ['missing allowed slot', (s, p) => delete s.resolved.assets[p.slot]],
]) {
  test(`${name} cannot substitute a broader FPV asset or procedural fallback`, async (t) => {
    const f = fixture();
    t.after(() => f.presentation.dispose());
    mutate(f.snapshot, f.row.picture);
    await assert.rejects(f.presentation.select(f.request));
    assert.equal(f.presentation.current(), null);
    assert.deepEqual(f.calls, { reads: 0, decodes: 0, releases: 0 });
  });
}

test('a same-length changed original is rejected before decode and never becomes procedural', async (t) => {
  const f = fixture();
  t.after(() => f.presentation.dispose());
  f.corrupt();
  await assert.rejects(f.presentation.select(f.request), /original hash or size mismatch/);
  assert.equal(f.presentation.current(), null);
  assert.deepEqual(f.calls, { reads: 1, decodes: 0, releases: 0 });
});
