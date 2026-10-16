import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import {
  COOP_SUPPORTED_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
} from '../couch/coop-picture-bindings.mjs';

const publishedHash = '7e8db95cec2eaab6b031e12bb44e036173611539393d44bbdfc50ff784d098b8',
  previewHash = 'ca5f264f6a62c10a4e51c6a0296866edbb340f6db75118d8aa11f92a8c9a9f93';
const retained = new Map();
for (const hash of [publishedHash, previewHash]) {
  const bytes = await readFile(
    new URL(`../../authoring/library/fpv-field-kit/retained/runtime.${hash}.json`, import.meta.url),
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), hash);
  const runtime = validateCompiledPresentation(JSON.parse(bytes));
  assert.equal(runtime.resolved.theme.revision, 101);
  retained.set(hash, runtime);
}
const imported = JSON.parse(
  await readFile(new URL('./fixtures/coop-import-route.json', import.meta.url)),
).authoredPack;
const original = new Map();
for (const slot of ['scene.reveal.wide', 'picture.fpv.adf5c9eea274ba7f']) {
  const asset = retained.get(publishedHash).resolved.assets[slot];
  const bytes = await readFile(
    new URL(`../presentation/compiled/assets/${asset.file.sha256}.png`, import.meta.url),
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.file.sha256);
  original.set(asset.file.sha256, new Blob([bytes], { type: asset.file.mime }));
}
function fixture({
  hash = publishedHash,
  pack = COOP_STARTER_PACK,
  levelId = pack.levels[0].id,
  onRead = () => {},
  onDecode = () => {},
  bindings = COOP_SUPPORTED_PICTURE_BINDINGS,
  policies = COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
} = {}) {
  const snapshot = { resolved: structuredClone(retained.get(hash).resolved), manifestSha256: hash },
    calls = { reads: 0, decodes: 0, releases: 0 },
    request = { pack, levelId, themeId: 'fpv', attemptId: 'manifest-lineage-test' };
  const presentation = createCoopPresentation({
    bindings,
    historicalImportPolicy: policies,
    getSnapshot: () => snapshot,
    async readPicture(slot, { snapshot: exact }) {
      calls.reads++;
      assert.equal(exact, snapshot);
      const asset = snapshot.resolved.assets[slot],
        blob = original.get(asset.file.sha256);
      assert(blob, 'Only the two already reviewed originals are read.');
      await onRead(snapshot);
      return { asset, blob };
    },
    async decodeImage() {
      calls.decodes++;
      await onDecode(snapshot);
      // A modeled decoder lease, not physical-browser image evidence.
      return { image: { width: 1152, height: 576 }, release: () => calls.releases++ };
    },
  });
  return { snapshot, calls, request, presentation };
}

for (const [pack, levelId] of [
  [COOP_STARTER_PACK, 'first-connection'],
  [COOP_STARTER_PACK, 'relay-yard'],
  [imported, imported.levels[0].id],
]) {
  test(`published101 manifest admits its exact ${pack.id}/${levelId} association`, async (t) => {
    const f = fixture({ pack, levelId });
    t.after(() => f.presentation.dispose());
    const accepted = await f.presentation.select(f.request);
    assert.equal(accepted.choice.manifestSha256, publishedHash);
    assert.equal(f.presentation.confirm(f.request), accepted);
    assert.deepEqual(f.calls, { reads: 1, decodes: 1, releases: 0 });
  });
}

test('same-number source-stage101 and missing, malformed or unknown hashes never read a picture', async () => {
  for (const pack of [COOP_STARTER_PACK, imported]) {
    const preview = fixture({ hash: previewHash, pack });
    await assert.rejects(preview.presentation.select(preview.request), /No exact Team picture/);
    assert.deepEqual(preview.calls, { reads: 0, decodes: 0, releases: 0 });
    preview.presentation.dispose();
    for (const hash of [undefined, null, '', 101, 'a'.repeat(64), publishedHash.toUpperCase()]) {
      const f = fixture({ pack });
      if (hash === undefined) delete f.snapshot.manifestSha256;
      else f.snapshot.manifestSha256 = hash;
      await assert.rejects(f.presentation.select(f.request), /No exact Team picture/);
      assert.deepEqual(f.calls, { reads: 0, decodes: 0, releases: 0 });
      f.presentation.dispose();
    }
  }
});

for (const stage of ['read', 'decode'])
  test(`a manifest mutation during ${stage} cannot adopt the pending picture`, async () => {
    const f = fixture({
      [stage === 'read' ? 'onRead' : 'onDecode']: (snapshot) => {
        snapshot.manifestSha256 = previewHash;
      },
    });
    await assert.rejects(f.presentation.select(f.request), /identity changed/);
    assert.equal(f.presentation.current(), null);
    assert.equal(f.calls.reads, 1);
    assert.equal(f.calls.decodes, stage === 'decode' ? 1 : 0);
    assert.equal(f.calls.releases, stage === 'decode' ? 1 : 0);
    f.presentation.dispose();
    assert.equal(f.calls.releases, stage === 'decode' ? 1 : 0, 'A rejected lease releases once.');
  });

test('changing only the exact manifest after acceptance invalidates Start and Retry', async () => {
  const f = fixture();
  await f.presentation.select(f.request);
  f.snapshot.manifestSha256 = previewHash;
  assert.throws(() => f.presentation.confirm(f.request), /identity changed/);
  await assert.rejects(f.presentation.select(f.request), /identity changed/);
  assert.equal(f.calls.reads, 1);
  f.presentation.dispose();
  assert.equal(f.calls.releases, 1);
});

test('manifest-qualified policy schema rejects bad hashes and unknown fields at construction', () => {
  const binding = COOP_SUPPORTED_PICTURE_BINDINGS.find((row) => row.themeRevision === 101),
    policy = COOP_HISTORICAL_IMPORT_PICTURE_POLICIES.find((row) => row.themeRevision === 101);
  for (const patch of [
    { manifestSha256: null },
    { manifestSha256: 'a' },
    { manifestSha256: publishedHash.toUpperCase() },
    { manifestSha: publishedHash },
  ]) {
    assert.throws(() => fixture({ bindings: [{ ...binding, ...patch }] }));
    assert.throws(() => fixture({ policies: [{ ...policy, ...patch }] }));
  }
});
