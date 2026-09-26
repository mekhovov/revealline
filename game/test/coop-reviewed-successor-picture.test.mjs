import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { importThemeBundle } from '../presentation/bundle.mjs';
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
function snapshot(revision) {
  const document = structuredClone(bundle.document);
  document.selection.theme = { id: 'fpv', revision };
  return { resolved: structuredClone(resolvePresentation(document)) };
}
function fixture(
  revision = 90,
  pack = COOP_STARTER_PACK,
  levelId = 'first-connection',
  policy = COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
) {
  const current = snapshot(revision),
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

test('integrated90 retains complete58–89 picture and actor records and original bytes', async () => {
  const retained = [
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    82, 83, 84, 85, 86, 87, 88, 89,
  ];
  assert.equal(bundle.document.selection.theme.revision, 90);
  assert.deepEqual(
    COOP_SUPPORTED_PICTURE_BINDINGS.map((row) => row.themeRevision),
    [90, 90, ...retained.flatMap((revision) => [revision, revision])],
  );
  assert.deepEqual(
    COOP_RETAINED_PICTURE_BINDINGS,
    retained.flatMap((themeRevision) =>
      COOP_PICTURE_BINDINGS.map((row) => ({ ...row, themeRevision })),
    ),
  );
  assert.deepEqual(
    COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.map((row) => [
      row.themeId,
      row.themeRevision,
      row.collection,
    ]),
    [
      ['fpv', 90, null],
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
  const old = snapshot(58),
    current = snapshot(90);
  for (const slot of slots) {
    const asset = current.resolved.assets[slot];
    assert.deepEqual(asset, old.resolved.assets[slot], slot);
    for (const revision of retained)
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
  assert.ok(Object.isFrozen(COOP_SUPPORTED_PICTURE_BINDINGS));
  assert.ok(Object.isFrozen(COOP_HISTORICAL_IMPORT_PICTURE_POLICIES));
});

for (const revision of [
  58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
  82, 83, 84, 85, 86, 87, 88, 89,
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
          prepared.resolved = exact.resolved;
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

test('finite host authority rejects54,57,91, other themes and collections before reads', async () => {
  for (const pack of [COOP_STARTER_PACK, imported]) {
    for (const change of [
      (s) => {
        s.resolved.theme.revision = 54;
      },
      (s) => {
        s.resolved.theme.revision = 57;
      },
      (s) => {
        s.resolved.theme.revision = 91;
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

test('historical picture authority remains bounded to thirty-three exact distinct revisions', () => {
  const policies = [
    58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81,
    82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  ].map((themeRevision) => ({
    ...COOP_RETAINED_HISTORICAL_IMPORT_PICTURE_POLICY,
    themeRevision,
  }));
  assert.throws(() => fixture(90, imported, imported.levels[0].id, policies), /item budget/);
});
