import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateCreatorProject } from '../creator/templates.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import {
  prepareCreatorBundle,
  approveCreatorBundle,
  exportCreatorBundle,
  importCreatorBundle,
  creatorArtworkLoader,
} from '../creator/bundle.mjs';
import {
  createCreatorStore,
  reviewCreatorInstallation,
  installPreparedCreatorBundle,
  loadInstalledCreatorBundle,
  installedCreatorManifests,
} from '../creator/installed.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { prepareManagedMediaBytes } from '../managed-media-store.mjs';
import { verifiedPreviewBackground } from '../content-design/assets.mjs';
import { createCreatorRuntime } from '../creator/runtime.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import {
  prepareCreatorSource,
  exportCreatorSource,
  importCreatorSource,
  createCreatorDraftBackend,
} from '../creator/drafts.mjs';
import { installedCreatorLibrarySources } from '../mission-library/creator-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
async function fixture(name = 'My picture') {
  const generated = generateCreatorProject({ id: 'my-picture', name, seed: 8 });
  const project = structuredClone(generated.project);
  const blob = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'An original fixture picture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  return {
    content: {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: {
        creator: 'Test creator',
        picture: 'Original fixture',
        license: 'Permission to share granted by test author',
      },
    },
    assets: [{ sha256, blob }],
  };
}
async function prepared(name) {
  const f = await fixture(name);
  return prepareCreatorBundle(f.content, f.assets, { decodeImage });
}
test('portable roundtrip preserves exact edition and editable source, excluding unrelated media and themes', async () => {
  const f = await fixture();
  f.assets.push({ sha256: 'a'.repeat(64), blob: new Blob(['private original']) });
  const pack = await prepareCreatorBundle(f.content, f.assets, { decodeImage });
  assert.equal(pack.assets.length, 1);
  assert.equal(pack.manifest.content.themes.length, 1);
  const file = exportCreatorBundle(pack, approveCreatorBundle(pack));
  assert.equal(file.size, pack.bytes);
  const restored = await importCreatorBundle(file, { decodeImage });
  assert.equal(restored.editionId, pack.editionId);
  assert.deepEqual(restored.manifest, pack.manifest);
  assert.deepEqual(restored.manifest.content.compatibility, {
    format: 'revealline-creator-runtime.v2',
    modes: ['solo', 'versus'],
    gameplayPolicy: 'compiled-preset-v1',
  });
  assert.deepEqual(restored.manifest.content.project.missions[0].modes, ['solo', 'versus']);
  assert.equal((await file.text()).includes('private original'), false);
  const media = await creatorArtworkLoader(restored)(restored.manifest.content.project.assets[0]);
  assert.match(
    verifiedPreviewBackground(restored.manifest.content.project.assets[0], media).dataUrl,
    /^data:image\/png/,
  );
});
test('retained creator-layouts.v2 packages keep the Solo runtime.v1 transfer contract', async () => {
  const f = await fixture('Retained Solo edition');
  f.content.project.missions[0].modes = ['solo'];
  f.content.project.missions[0].actors = [];
  f.content.project.missions[0].design.counterplay =
    'There are no enemies in this verified creator template.';
  f.content.project.missions[0].design.difficulty.threatDensity = 0;
  f.content.provenance = {
    ...f.content.provenance,
    templateVersion: 'creator-layouts.v2',
  };
  const pack = await prepareCreatorBundle(f.content, f.assets, { decodeImage });
  assert.deepEqual(pack.manifest.content.compatibility, {
    format: 'revealline-creator-runtime.v1',
    modes: ['solo'],
    gameplayPolicy: 'compiled-preset-v1',
  });
  const restored = await importCreatorBundle(
    exportCreatorBundle(pack, approveCreatorBundle(pack)),
    { decodeImage },
  );
  assert.equal(restored.editionId, pack.editionId);
  assert.deepEqual(restored.manifest.content.project.missions[0].modes, ['solo']);
});
test('stale/forged approvals, corrupt payloads, trailing bytes and altered evidence fail closed', async () => {
  const pack = await prepared();
  const approval = approveCreatorBundle(pack);
  assert.throws(() => exportCreatorBundle({ ...pack }, approval), /stale/);
  assert.throws(() => exportCreatorBundle(pack, { editionId: pack.editionId }), /stale/);
  const other = await prepared('Changed title');
  assert.throws(() => exportCreatorBundle(other, approval), /stale/);
  const file = exportCreatorBundle(pack, approval);
  await assert.rejects(importCreatorBundle(new Blob([file, 'extra']), { decodeImage }), /trailing/);
  const corrupt = new Uint8Array(await file.arrayBuffer());
  corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(
    importCreatorBundle(new Blob([corrupt]), { decodeImage }),
    /picture bytes|PNG/,
  );
  const data = new Uint8Array(await file.arrayBuffer());
  const length = new DataView(data.buffer).getUint32(8, false);
  const manifest = JSON.parse(new TextDecoder().decode(data.slice(12, 12 + length)));
  manifest.evidence[0].seed++;
  const encoded = new TextEncoder().encode(JSON.stringify(manifest));
  const header = data.slice(0, 12);
  new DataView(header.buffer).setUint32(8, encoded.length, false);
  await assert.rejects(
    importCreatorBundle(new Blob([header, encoded, file.slice(12 + length)]), { decodeImage }),
    /evidence/,
  );
});
test('installation atomically retains unrelated managed bytes and exact immutable editions across reopening', async () => {
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const original = new Blob(['unrelated media']);
  const hash = await creatorSHA256(await original.arrayBuffer());
  const existing = await prepareManagedMediaBytes(
    { format: 'revealline-managed-bytes.v1', items: [{ id: 'existing', sha256: hash }] },
    [{ sha256: hash, blob: original }],
  );
  await store.commitDomain('media', existing, { expectedGeneration: 0 });
  const first = await prepared();
  const approval = approveCreatorBundle(first);
  const review = await reviewCreatorInstallation(store, first, approval);
  assert.ok(review.stagingBytes > first.assets[0].blob.size);
  await installPreparedCreatorBundle(store, first, approval, review, { decodeImage });
  assert.equal(await (await store.readSelectedBlob(hash)).text(), 'unrelated media');
  const next = await prepared('New immutable edition');
  const nextApproval = approveCreatorBundle(next);
  await installPreparedCreatorBundle(
    store,
    next,
    nextApproval,
    await reviewCreatorInstallation(store, next, nextApproval),
    { decodeImage },
  );
  store.close();
  const reopened = createCreatorStore({ indexedDB: memory.indexedDB });
  assert.equal((await installedCreatorManifests(reopened)).length, 2);
  assert.equal(
    (await loadInstalledCreatorBundle(reopened, first.editionId, { decodeImage })).editionId,
    first.editionId,
  );
  assert.equal(
    (await loadInstalledCreatorBundle(reopened, next.editionId, { decodeImage })).editionId,
    next.editionId,
  );
  reopened.close();
});
test('cancelled and stale store reviews cannot publish an installed index', async () => {
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const pack = await prepared();
  const approval = approveCreatorBundle(pack);
  const stale = await reviewCreatorInstallation(store, pack, approval);
  const active = await reviewCreatorInstallation(store, pack, approval);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    installPreparedCreatorBundle(store, pack, approval, active, {
      signal: controller.signal,
      decodeImage,
    }),
    { name: 'AbortError' },
  );
  assert.equal((await installedCreatorManifests(store)).length, 0);
  await installPreparedCreatorBundle(store, pack, approval, active, { decodeImage });
  await assert.rejects(
    installPreparedCreatorBundle(store, pack, approval, stale, { decodeImage }),
    /another tab/,
  );
  assert.equal((await installedCreatorManifests(store)).length, 1);
  store.close();
});

test('an interrupted creator installation rolls back its index and remains exportable for retry', async () => {
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const pack = await prepared();
  const approval = approveCreatorBundle(pack);
  const file = exportCreatorBundle(pack, approval);
  const review = await reviewCreatorInstallation(store, pack, approval);
  memory.failAnyPutAt = 2;
  await assert.rejects(
    installPreparedCreatorBundle(store, pack, approval, review, { decodeImage }),
  );
  memory.failAnyPutAt = null;
  store.close();
  const reopened = createCreatorStore({ indexedDB: memory.indexedDB });
  assert.deepEqual(await installedCreatorManifests(reopened), []);
  assert.equal((await reopened.readDomainMetadata('media')).generation, 0);
  assert.deepEqual(
    await exportCreatorBundle(pack, approval).arrayBuffer(),
    await file.arrayBuffer(),
  );
  await installPreparedCreatorBundle(
    reopened,
    pack,
    approval,
    await reviewCreatorInstallation(reopened, pack, approval),
    { decodeImage },
  );
  assert.equal((await installedCreatorManifests(reopened))[0].editionId, pack.editionId);
  reopened.close();
});

test('installed Custom attempts restore through the shared verifier and award only a completed exact edition', async () => {
  const pack = await prepared();
  const decode = async (dataUrl) => {
    const image = new PNGImage();
    image.src = dataUrl;
    await image.decode();
    return image;
  };
  const player = createCreatorRuntime(pack, { decodeImage: decode });
  const attempt = await player.start();
  assert.equal(attempt.officialProgressEligible, false);
  for (let i = 0; i < 30; i++) player.step({ direction: 'down' });
  await assert.rejects(player.completion(), /legal win/);
  const saved = player.suspend();
  const player2 = createCreatorRuntime(pack, { decodeImage: decode });
  const restored = await player2.restore(saved);
  assert.equal(restored.run.tick, attempt.run.tick);
  assert.equal(player2.runId(), player.runId());
  for (let i = 0; i < 2400 && restored.run.status !== 'won'; i++)
    player2.step({ direction: 'down' });
  const receipt = await player2.completion();
  assert.equal(receipt.missionId, 'picture-1');
  assert.ok(receipt.gameplayId.startsWith(pack.editionId));
  const changed = await prepared('Second edition');
  const player3 = createCreatorRuntime(changed, { decodeImage: decode });
  await assert.rejects(player3.restore(saved), /different installed edition/);
  player.dispose();
  player2.dispose();
  player3.dispose();
});

test('source checkpoints retain private originals separately, roundtrip actual files and reject concurrent head overwrites', async () => {
  const f = await fixture();
  const original = new Blob(['private original bytes and source metadata']);
  const hash = await creatorSHA256(await original.arrayBuffer());
  const source = await prepareCreatorSource(
    {
      draftId: 'source-draft',
      content: f.content,
      editing: { fit: 'contain' },
      originalSha256: hash,
    },
    [...f.assets, { sha256: hash, blob: original }],
  );
  const restored = await importCreatorSource(exportCreatorSource(source));
  assert.deepEqual(restored.document, source.document);
  assert.equal(
    await restored.assets.find((a) => a.sha256 === hash).blob.text(),
    await original.text(),
  );
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const backend = createCreatorDraftBackend(store);
  await backend.save(restored, null);
  const head = await backend.read('source-draft');
  assert.equal(head.revision, 1);
  assert.deepEqual(head.source.document, source.document);
  await assert.rejects(backend.save(source, null), /newer draft/);
  const invalid = structuredClone(f.content);
  invalid.project.missions[0].coverage = 0;
  const changed = await prepareCreatorSource(
    { draftId: 'source-draft', content: invalid, editing: { fit: 'contain' } },
    f.assets,
  );
  await backend.save(changed, 1); // Uncompilable gameplay can still be recovered as a draft.
  assert.equal((await backend.read('source-draft')).revision, 2);
  for (const key of ['packs', 'campaigns', 'missions', 'assets']) {
    const malformed = structuredClone(f.content);
    malformed.project[key] = [];
    await assert.rejects(
      prepareCreatorSource(
        { draftId: 'source-draft', content: malformed, editing: { fit: 'contain' } },
        f.assets,
      ),
      /one pack, campaign, mission and picture/,
    );
  }
  store.close();
});

test('installed project sources remain Custom and do not require decoding media while browsing', async () => {
  const memory = memoryIndexedDB();
  const store = createCreatorStore({ indexedDB: memory.indexedDB });
  const pack = await prepared('Official Journey'); // A label grants no official eligibility.
  const approval = approveCreatorBundle(pack);
  await installPreparedCreatorBundle(
    store,
    pack,
    approval,
    await reviewCreatorInstallation(store, pack, approval),
    { decodeImage },
  );
  const sources = await installedCreatorLibrarySources({ store, launch: () => {} });
  const library = createMissionLibrary(sources);
  const rows = library.search('', { collection: 'Custom', mode: 'solo' });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].editionId, pack.editionId);
  assert.equal(library.search('', { collection: 'Journey', mode: 'solo' }).length, 0);
  store.close();
});
