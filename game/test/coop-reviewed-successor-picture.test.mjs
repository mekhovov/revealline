import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle } from '../presentation/bundle.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_RETAINED_PICTURE_BINDINGS,
  COOP_SUPPORTED_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
  COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
} from '../couch/coop-picture-bindings.mjs';
import { page } from './helpers/coop-host.mjs';

const publishedManifest = '7e8db95cec2eaab6b031e12bb44e036173611539393d44bbdfc50ff784d098b8';
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bundle = await importThemeBundle(
  new Blob([
    await readFile(
      new URL('../../authoring/library/fpv-field-kit/production.rltheme', import.meta.url),
    ),
  ]),
  { decodeImage: null },
);
const imported = JSON.parse(
  await readFile(new URL('./fixtures/coop-import-route.json', import.meta.url)),
).authoredPack;
const currentCompiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const currentSnapshot = () => ({ resolved: structuredClone(currentCompiled.resolved) });
const retainedSnapshots = new Map();
for (const [revision, manifestSha256] of [
  [101, publishedManifest],
  [102, '92f09d9eb867989438991f116ee8a192cee6ac8c2e3f286297aa184257c96f78'],
  [103, '813ce5598736109011290a38ce3bbf257375d1e45f496ba60237bf4725bc81ca'],
]) {
  const value = validateCompiledPresentation(
    JSON.parse(
      await readFile(
        new URL(
          `../../authoring/library/fpv-field-kit/retained/runtime.${manifestSha256}.json`,
          import.meta.url,
        ),
      ),
    ),
  );
  retainedSnapshots.set(revision, { resolved: value.resolved, manifestSha256 });
}
const resolvedSnapshots = new Map();
function snapshot(revision) {
  if (retainedSnapshots.has(revision)) return structuredClone(retainedSnapshots.get(revision));
  if (!resolvedSnapshots.has(revision)) {
    const document = structuredClone(bundle.document);
    document.selection.theme = { id: 'fpv', revision };
    resolvedSnapshots.set(revision, resolvePresentation(document));
  }
  // Resolve each immutable historical document once, but never share mutable
  // snapshots between lease attempts or the deliberate substitution negatives.
  return { resolved: structuredClone(resolvedSnapshots.get(revision)) };
}
function fixture(
  revision = 104,
  pack = COOP_STARTER_PACK,
  levelId = 'first-connection',
  policy = COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
  exactSnapshot = null,
) {
  const current = exactSnapshot ?? snapshot(revision),
    calls = { reads: 0, decodes: 0, releases: 0 };
  const request = {
    pack,
    levelId,
    themeId: 'fpv',
    attemptId: 'retained-picture-proof',
  };
  const presentation = createCoopPresentation({
    bindings: COOP_SUPPORTED_PICTURE_BINDINGS,
    historicalImportPolicy: policy,
    getSnapshot: () => current,
    async readPicture(slot, options) {
      calls.reads++;
      assert.equal(options.snapshot, current);
      const asset = current.resolved.assets[slot];
      return { asset, blob: bundle.assets.get(asset.file.sha256) };
    },
    async decodeImage(blob) {
      calls.decodes++;
      return {
        image: {
          width: 1152,
          height: 576,
          sha256: sha(Buffer.from(await blob.arrayBuffer())),
        },
        release: () => calls.releases++,
      };
    },
  });
  return { current, calls, request, presentation };
}

test('integrated104 retains complete58–97,99–103 and historical103 picture and actor records and original bytes', async () => {
  const retained = [
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103,
  ];
  assert.equal(bundle.document.selection.theme.revision, 104);
  assert.equal(currentCompiled.resolved.theme.revision, 104);
  assert.deepEqual(
    COOP_SUPPORTED_PICTURE_BINDINGS.map((row) => row.themeRevision),
    [104, 104, ...retained.flatMap((revision) => [revision, revision])],
  );
  assert.deepEqual(
    COOP_RETAINED_PICTURE_BINDINGS,
    retained.flatMap((themeRevision) =>
      COOP_PICTURE_BINDINGS.map((row) => ({
        ...row,
        themeRevision,
        ...(themeRevision === 101 ? { manifestSha256: publishedManifest } : {}),
      })),
    ),
  );
  assert.deepEqual(
    COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.map((row) => [
      row.themeId,
      row.themeRevision,
      row.collection,
    ]),
    [
      ['fpv', 104, null],
      ['fpv', 58, null],
      ['fpv', 59, null],
      ['fpv', 60, null],
      ['fpv', 61, null],
      ['fpv', 62, null],
      ['fpv', 63, null],
      ['fpv', 64, null],
      ['fpv', 65, null],
      ['fpv', 66, null],
      ['fpv', 67, null],
      ['fpv', 68, null],
      ['fpv', 69, null],
      ['fpv', 70, null],
      ['fpv', 71, null],
      ['fpv', 72, null],
      ['fpv', 73, null],
      ['fpv', 74, null],
      ['fpv', 75, null],
      ['fpv', 76, null],
      ['fpv', 77, null],
      ['fpv', 78, null],
      ['fpv', 79, null],
      ['fpv', 80, null],
      ['fpv', 81, null],
      ['fpv', 82, null],
      ['fpv', 83, null],
      ['fpv', 84, null],
      ['fpv', 85, null],
      ['fpv', 86, null],
      ['fpv', 87, null],
      ['fpv', 88, null],
      ['fpv', 89, null],
      ['fpv', 90, null],
      ['fpv', 91, null],
      ['fpv', 92, null],
      ['fpv', 93, null],
      ['fpv', 94, null],
      ['fpv', 95, null],
      ['fpv', 96, null],
      ['fpv', 97, null],
      ['fpv', 99, null],
      ['fpv', 100, null],
      ['fpv', 101, null],
      ['fpv', 102, null],
      ['fpv', 103, null],
    ],
  );
  const slots = [
    ...COOP_PICTURE_BINDINGS.map((row) => row.picture.slot),
    'player.scout.compact',
    'player.scout.detailed',
    'enemy.bouncer',
    'enemy.border-patrol',
    'enemy.relay-sentinel',
    'enemy.claimed-rover',
  ];
  assert.equal(slots.length, 8);
  // Keep the original complete-record comparison on the retained 58–91 lineage.
  // Current104 leases are exercised separately below; this does not relabel actor successors.
  const old = snapshot(58),
    current = snapshot(91);
  const isolated = snapshot(58);
  isolated.resolved.theme.revision = -1;
  assert.equal(snapshot(58).resolved.theme.revision, 58);
  for (const slot of slots) {
    const asset = current.resolved.assets[slot];
    assert.deepEqual(asset, old.resolved.assets[slot], slot);
    for (const revision of retained.filter((value) => value <= 91))
      assert.deepEqual(
        asset,
        snapshot(revision).resolved.assets[slot],
        `retained${revision} ${slot}`,
      );
    const bytes = Buffer.from(await bundle.assets.get(asset.file.sha256).arrayBuffer());
    assert.equal(sha(bytes), asset.file.sha256);
    assert.equal(bytes.length, asset.file.bytes);
    assert.deepEqual(
      bytes,
      await readFile(
        new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
      ),
    );
  }
  // Revision92 introduced separately reviewed actor successors; preserve those
  // complete records independently instead of relabelling the58–91 lineage.
  // Main94 and95 and preview96 retain their original UI/audio/effects histories.
  // Revisions97–104 add scoped audio/UI provenance, never relabelling actor records.
  for (const slot of slots) {
    const priorAsset = snapshot(92).resolved.assets[slot];
    assert.deepEqual(snapshot(93).resolved.assets[slot], priorAsset, 'retained92 ' + slot);
    assert.deepEqual(snapshot(94).resolved.assets[slot], priorAsset, 'retained94 ' + slot);
    assert.deepEqual(snapshot(95).resolved.assets[slot], priorAsset, 'retained95 ' + slot);
    assert.deepEqual(snapshot(96).resolved.assets[slot], priorAsset, 'retained96 ' + slot);
    assert.deepEqual(snapshot(97).resolved.assets[slot], priorAsset, 'retained97 ' + slot);
    assert.deepEqual(snapshot(98).resolved.assets[slot], priorAsset, 'unbound98 ' + slot);
    assert.deepEqual(snapshot(99).resolved.assets[slot], priorAsset, 'retained99 ' + slot);
    assert.deepEqual(snapshot(100).resolved.assets[slot], priorAsset, 'retained100 ' + slot);
    assert.deepEqual(snapshot(101).resolved.assets[slot], priorAsset, 'published101 ' + slot);
    assert.deepEqual(snapshot(103).resolved.assets[slot], priorAsset, 'retained103 ' + slot);
    assert.deepEqual(snapshot(102).resolved.assets[slot], priorAsset, 'retained102 ' + slot);
    assert.deepEqual(currentSnapshot().resolved.assets[slot], priorAsset, 'current104 ' + slot);
    const body = Buffer.from(await bundle.assets.get(priorAsset.file.sha256).arrayBuffer());
    assert.equal(body.length, priorAsset.file.bytes);
    assert.equal(sha(body), priorAsset.file.sha256);
    assert.deepEqual(
      body,
      await readFile(
        new URL(
          '../presentation/compiled/assets/' + priorAsset.file.sha256 + '.png',
          import.meta.url,
        ),
      ),
    );
  }
  assert.ok(Object.isFrozen(COOP_SUPPORTED_PICTURE_BINDINGS));
  assert.ok(Object.isFrozen(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES));
});

for (const revision of [
  58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 99, 100, 101, 102, 103,
]) {
  test(`exact${revision} built-in and historical-import attempts retain their own verified lease`, async () => {
    for (const [pack, levelId, picture] of [
      [COOP_STARTER_PACK, 'first-connection', COOP_PICTURE_BINDINGS[0].picture],
      [COOP_STARTER_PACK, 'relay-yard', COOP_PICTURE_BINDINGS[1].picture],
      [imported, imported.levels[0].id, COOP_PICTURE_BINDINGS[0].picture],
    ]) {
      const f = fixture(revision, pack, levelId);
      try {
        const binding = await f.presentation.select(f.request);
        assert.equal(binding.choice.themeRevision, revision);
        assert.equal(binding.choice.themeId, 'fpv');
        assert.equal(binding.choice.collection, null);
        assert.deepEqual(binding.choice.picture, picture);
        assert.equal(binding.image.sha256, picture.sha256);
        assert.equal(await f.presentation.select(f.request), binding);
        assert.equal(f.presentation.confirm(f.request), binding);
        assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
      } finally {
        f.presentation.dispose();
      }
      assert.equal(f.calls.releases, 1);
    }
  });

  test(`actual Team host prepares and explicitly starts pinned${revision} Relay Yard`, async (t) => {
    const exact = snapshot(revision);
    const f = await page(t, {
      capturePaint: true,
      beforeImport({ $ }) {
        $('coop-level').value = 'relay-yard';
        $('coop-level').emit('change');
      },
      presentation: {
        load({ snapshot: prepared }) {
          Object.assign(prepared, exact);
        },
      },
    });
    assert.equal(f.artwork.snapshot.resolved.theme.revision, revision);
    assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
    assert.equal(f.$('coop-menu').hidden, false);
    f.$('coop-start').click();
    const decodedPicture = f.artwork.calls.decodes[0];
    for (let frame = 0; frame < 3; frame++) {
      f.drawImages.length = 0;
      f.tick(1);
      assert.equal(f.drawImages[0], decodedPicture);
      assert.equal(f.drawImages[0].sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
      assert.equal(f.drawImages.filter((image) => image === decodedPicture).length, 1);
      assert.ok(f.drawImages.length > 1, 'Actors paint after the exact accepted picture');
    }
    assert.equal(f.$('coop-menu').hidden, true);
    assert.ok(
      f.artwork.calls.reads.every(
        (read) => read.options.snapshot.resolved.theme.revision === revision,
      ),
    );
  });
}

test('exact104 current built-in and historical-import attempts use the reviewed current lease', async () => {
  for (const [pack, levelId, picture] of [
    [COOP_STARTER_PACK, 'first-connection', COOP_PICTURE_BINDINGS[0].picture],
    [COOP_STARTER_PACK, 'relay-yard', COOP_PICTURE_BINDINGS[1].picture],
    [imported, imported.levels[0].id, COOP_PICTURE_BINDINGS[0].picture],
  ]) {
    const f = fixture(
      104,
      pack,
      levelId,
      COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
      currentSnapshot(),
    );
    try {
      const binding = await f.presentation.select(f.request);
      assert.equal(binding.choice.themeRevision, 104);
      assert.equal(binding.choice.themeId, 'fpv');
      assert.equal(binding.choice.collection, null);
      assert.deepEqual(binding.choice.picture, picture);
      assert.equal(binding.image.sha256, picture.sha256);
      assert.equal(await f.presentation.select(f.request), binding);
      assert.equal(f.presentation.confirm(f.request), binding);
      assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
    } finally {
      f.presentation.dispose();
    }
    assert.equal(f.calls.releases, 1);
  }
});

test('actual Team host prepares and explicitly starts current104 Relay Yard', async (t) => {
  const exact = currentSnapshot();
  const f = await page(t, {
    capturePaint: true,
    beforeImport({ $ }) {
      $('coop-level').value = 'relay-yard';
      $('coop-level').emit('change');
    },
    presentation: {
      load({ snapshot: prepared }) {
        Object.assign(prepared, exact);
      },
    },
  });
  assert.equal(f.artwork.snapshot.resolved.theme.revision, 104);
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  assert.equal(f.$('coop-menu').hidden, false);
  f.$('coop-start').click();
  const decodedPicture = f.artwork.calls.decodes[0];
  for (let frame = 0; frame < 3; frame++) {
    f.drawImages.length = 0;
    f.tick(1);
    assert.equal(f.drawImages[0], decodedPicture);
    assert.equal(f.drawImages[0].sha256, COOP_PICTURE_BINDINGS[1].picture.sha256);
    assert.equal(f.drawImages.filter((image) => image === decodedPicture).length, 1);
    assert.ok(f.drawImages.length > 1, 'Actors paint after the exact accepted picture');
  }
  assert.equal(f.$('coop-menu').hidden, true);
  assert.ok(
    f.artwork.calls.reads.every((read) => read.options.snapshot.resolved.theme.revision === 104),
  );
});

test('finite host authority rejects54,57,98, unqualified101,105, other themes and collections before reads', async () => {
  for (const pack of [COOP_STARTER_PACK, imported]) {
    for (const change of [
      (s) => {
        s.resolved.theme.revision = 54;
      },
      (s) => {
        s.resolved.theme.revision = 57;
      },
      (s) => {
        s.resolved.theme.revision = 98;
      },
      (s) => {
        s.resolved.theme.revision = 101;
      },
      (s) => {
        s.resolved.theme.revision = 105;
      },
      (s) => {
        s.resolved.theme.id = 'other';
      },
      (s) => {
        s.resolved.collection = { id: 'fpv', revision: 60 };
      },
      (s) => {
        s.resolved.collection = { id: 'fpv', revision: 59 };
      },
      (s) => {
        s.resolved.assets[COOP_PICTURE_BINDINGS[0].picture.slot].file.sha256 = '0'.repeat(64);
      },
    ]) {
      const f = fixture(60, pack, pack.levels[0].id);
      try {
        change(f.current);
        await assert.rejects(f.presentation.select(f.request));
        assert.deepEqual(f.calls, { reads: 0, decodes: 0, releases: 0 });
        assert.equal(f.presentation.current(), null);
      } finally {
        f.presentation.dispose();
      }
    }
  }
});

test('legacy singular policy retains exact59 support and malformed finite lists fail closed', async () => {
  const f = fixture(
    59,
    imported,
    imported.levels[0].id,
    COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
  );
  try {
    assert.equal((await f.presentation.select(f.request)).choice.themeRevision, 59);
  } finally {
    f.presentation.dispose();
  }
  for (const policies of [
    [null],
    [
      COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
      COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
    ],
    [...COOP_HISTORICAL_IMPORT_PICTURE_POLICIES, COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY],
  ]) {
    assert.throws(() => fixture(60, imported, imported.levels[0].id, policies));
  }
});

test('historical picture authority remains bounded to forty-six exact distinct revisions', () => {
  const policies = [
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104,
  ].map((themeRevision) => ({
    ...COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
    themeRevision,
  }));
  assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.length, 46);
  assert.equal(COOP_SUPPORTED_PICTURE_BINDINGS.length, 92);
  assert.equal(policies.length, 47);
  assert.throws(() => fixture(102, imported, imported.levels[0].id, policies), /item budget/);
});

test('native-menu104 preserves the distinct canonical103 runtime and all three picture leases', async () => {
  const manifestSha256 = '3663f75cfc922f63f99e2e57ac4fc82ce65a45e25af1624c29178c69f7f7af44';
  const bytes = await readFile(
    new URL(
      '../../authoring/library/fpv-field-kit/retained/runtime.' + manifestSha256 + '.json',
      import.meta.url,
    ),
  );
  assert.equal(bytes.length, 1250579);
  assert.equal(sha(bytes), manifestSha256);
  const canonical = validateCompiledPresentation(JSON.parse(bytes));
  assert.equal(canonical.resolved.theme.revision, 103);
  assert.notEqual(manifestSha256, retainedSnapshots.get(103).manifestSha256);
  for (const [pack, levelId, picture] of [
    [COOP_STARTER_PACK, 'first-connection', COOP_PICTURE_BINDINGS[0].picture],
    [COOP_STARTER_PACK, 'relay-yard', COOP_PICTURE_BINDINGS[1].picture],
    [imported, imported.levels[0].id, COOP_PICTURE_BINDINGS[0].picture],
  ]) {
    const exact = { resolved: structuredClone(canonical.resolved), manifestSha256 };
    const f = fixture(103, pack, levelId, COOP_HISTORICAL_IMPORT_PICTURE_POLICIES, exact);
    try {
      const binding = await f.presentation.select(f.request);
      assert.equal(binding.choice.themeRevision, 103);
      assert.deepEqual(binding.choice.picture, picture);
      assert.equal(binding.image.sha256, picture.sha256);
      assert.equal(await f.presentation.select(f.request), binding);
      assert.equal(f.presentation.confirm(f.request), binding);
      assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
    } finally {
      f.presentation.dispose();
    }
    assert.equal(f.calls.releases, 1);
  }
});
