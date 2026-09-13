import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  MEDIA_BUNDLE_FORMAT,
  MEDIA_BUNDLE_LIMITS,
  exportMediaBundle,
  importMediaBundle,
  isImportedMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from '../media-bundle.mjs';
import { createManagedMediaStore, prepareManagedMediaBytes } from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createSoundtrackStore } from '../soundtrack-store.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import {
  prepareStoredStillMedia,
  validateStoredStillMedia,
  hydrateStoredStillMedia,
} from '../media-storage-record.mjs';
import { prepareStillAsset } from '../media-still.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import {
  mediaFixture,
  libraryRecord,
  presentationRecord,
  pngBytes,
  provenance,
  deferred,
} from './helpers/media-fixtures.mjs';
import { memoryIndexedDB, fixture } from './helpers/soundtrack-fixtures.mjs';

// Finite IndexedDB and injected image decoding; no browser/rendering claim.
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const sha = (value) => createHash('sha256').update(value).digest('hex');
const f = mediaFixture(true);
const preparedImage = await prepareStillAsset(
  new Blob([pngBytes()]),
  { id: 'picture-a', provenance: provenance() },
  { decodeImage },
);
const library = libraryRecord(f.identity);
library.assets = [preparedImage.asset];
const source = await prepareStoredStillMedia(
  library,
  [{ sha256: preparedImage.asset.sha256, blob: preparedImage.blob }],
  { executionCatalog: f.catalog, decodeImage },
);
const bundle = await exportMediaBundle(source.library, source.assets, { decodeImage });
const imported = await importMediaBundle(bundle, { decodeImage });

function setup(options = {}) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      richStillMedia: true,
      ...options,
    }),
    store = createStillMediaStore({ managedStore: manager, decodeImage });
  return { memory, manager, store };
}
async function parts(blob = bundle) {
  const data = await bytes(blob),
    length = data.readUInt32BE(8);
  return {
    manifest: JSON.parse(data.subarray(12, 12 + length).toString()),
    payload: data.subarray(12 + length),
  };
}
function rawBundle(manifest, payload = Buffer.alloc(0)) {
  const text = Buffer.from(JSON.stringify(manifest)),
    header = Buffer.alloc(12);
  header.write('RLMDB1\r\n');
  header.writeUInt32BE(text.length, 8);
  return new Blob([header, text, payload]);
}
async function savedContents(memory) {
  const out = {};
  for (const [name, rows] of memory.contents()) {
    if (name === 'managedState' || name === 'reservations') continue;
    out[name] = [];
    for (const [key, value] of rows)
      out[name].push([
        key,
        value instanceof Blob ? { bytes: value.size, sha256: sha(await bytes(value)) } : value,
      ]);
  }
  return out;
}
async function secondSource() {
  const original = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    'base64',
  );
  const picture = await prepareStillAsset(
    new Blob([original]),
    { id: 'picture-b', provenance: provenance() },
    { decodeImage },
  );
  const next = structuredClone(source.library.library);
  next.assets.push(picture.asset);
  next.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  next.assignments[0].revision = 2;
  return prepareStoredStillMedia(
    next,
    [...source.assets, { sha256: picture.asset.sha256, blob: picture.blob }],
    { previous: source.library, executionCatalog: f.catalog, decodeImage },
  );
}
const second = await secondSource();
const secondBundle = await importMediaBundle(
  await exportMediaBundle(second.library, second.assets, { decodeImage }),
  { decodeImage },
);

test('binary bundle retains exact metadata, owners and raw originals; canonical export is stable', async () => {
  assert.equal(MEDIA_BUNDLE_FORMAT, 'revealline-media-bundle.v1');
  assert.equal(MEDIA_BUNDLE_LIMITS.bytes, 256 * 1024 * 1024);
  assert.equal(MEDIA_BUNDLE_LIMITS.assets, 512);
  assert.equal(bundle.type, 'application/vnd.revealline.media');
  assert.equal(isImportedMediaBundle(imported), true);
  assert.equal(isImportedMediaBundle({ ...imported }), false);
  assert.deepEqual(imported.document, source.library);
  assert.deepEqual(await bytes(imported.assets[0].blob), pngBytes());
  assert.deepEqual(
    await bytes(await exportMediaBundle(imported.document, imported.assets, { decodeImage })),
    await bytes(bundle),
  );
  assert.ok(Object.isFrozen(imported.document.owners[0].campaign.classRecipes));
});

test('empty domain is a valid explicit inventory with no invented originals', async () => {
  const empty = hydrateStoredStillMedia({ format: 'revealline-managed-bytes.v1', items: [] });
  const result = await importMediaBundle(await exportMediaBundle(empty, [], { decodeImage }), {
    decodeImage,
  });
  assert.deepEqual(result.document, empty);
  assert.equal(result.assets.length, 0);
});

test('fresh restore hydrates removed-pack owners without installing content; restart keeps hashes', async () => {
  const { memory, store, manager } = setup();
  await store.read(); // Explicit opening may create schema; review must not write domain rows.
  const before = await savedContents(memory);
  const review = await prepareMediaBundleRestore(secondBundle, { store, decodeImage });
  assert.deepEqual(await savedContents(memory), before);
  assert.equal(review.expectedGeneration, 0);
  assert.equal(review.originals, 2);
  assert.equal((await commitMediaBundleRestore(review)).generation, 1);
  store.close();
  manager.close();
  const fresh = createStillMediaStore({ indexedDB: memory.indexedDB, decodeImage });
  const restored = await fresh.read();
  assert.deepEqual(restored.document, second.library);
  assert.equal(restored.assets.length, 2);
  assert.deepEqual(await bytes(await fresh.readBlob(source.assets[0].sha256)), pngBytes());
  const unassigned = structuredClone(restored.document.library);
  unassigned.assignments = [];
  const staged = await fresh.prepare(unassigned, restored.assets, {
    previous: restored.document,
    executionCatalog: createExecutionCatalog([]),
  });
  await fresh.commit(staged, { expectedGeneration: 1 });
  assert.equal((await fresh.read()).document.library.presentations.length, 2);
  fresh.close();
});

test('same-byte asset aliases deduplicate physical payload and retain both IDs', async () => {
  const doc = structuredClone(source.library);
  doc.library.assets.push({ ...doc.library.assets[0], id: 'duplicate-original' });
  const encoded = await exportMediaBundle(doc, source.assets, { decodeImage });
  const result = await importMediaBundle(encoded, { decodeImage });
  assert.equal((await parts(encoded)).manifest.assets.length, 1);
  assert.equal(result.document.library.assets.length, 2);
  assert.equal(result.assets.length, 1);
});

test('preserve mode retains destination assignment; explicit restore changes only assignment with history retained', async () => {
  const { store } = setup();
  await store.commit(source, { expectedGeneration: 0 });
  const preserve = await prepareMediaBundleRestore(secondBundle, { store, decodeImage });
  assert.equal(preserve.document.library.assignments[0].revision, 1);
  await commitMediaBundleRestore(preserve);
  const restore = await prepareMediaBundleRestore(secondBundle, {
    store,
    assignmentMode: 'restore',
    decodeImage,
  });
  assert.equal(restore.document.library.assignments[0].revision, 2);
  await commitMediaBundleRestore(restore);
  const undoAssignment = await prepareMediaBundleRestore(imported, {
    store,
    assignmentMode: 'restore',
    decodeImage,
  });
  await commitMediaBundleRestore(undoAssignment);
  const after = await store.read();
  assert.equal(after.document.library.assignments[0].revision, 1);
  assert.equal(after.document.library.presentations.length, 2);
  assert.equal(after.assets.length, 2);
});

test('corrupt headers, lengths, UTF-8, table order and trailing bytes fail before a decoder', async () => {
  const p = await parts();
  const invalid = [];
  const badMagic = await bytes(bundle);
  badMagic[0] = 0;
  invalid.push(new Blob([badMagic]));
  const longManifest = await bytes(bundle);
  longManifest.writeUInt32BE(MEDIA_BUNDLE_LIMITS.manifestBytes + 1, 8);
  invalid.push(new Blob([longManifest]));
  const badUtf8 = await bytes(bundle);
  badUtf8[12] = 255;
  invalid.push(new Blob([badUtf8]));
  invalid.push(bundle.slice(0, bundle.size - 1));
  invalid.push(new Blob([bundle, new Uint8Array([0])]));
  for (const mutate of [
    (m) => {
      m.extra = true;
    },
    (m) => {
      m.format = 'future';
    },
    (m) => {
      m.assets.push(m.assets[0]);
    },
    (m) => {
      m.assets[0].bytes = 0;
    },
    (m) => {
      m.assets[0].bytes = MEDIA_BUNDLE_LIMITS.sourceBytes + 1;
    },
    (m) => {
      m.assets[0].sha256 = 'x'.repeat(64);
    },
    (m) => {
      m.assets[0].path = '../unsafe';
    },
  ]) {
    const m = structuredClone(p.manifest);
    mutate(m);
    invalid.push(rawBundle(m, p.payload));
  }
  let calls = 0;
  for (const file of invalid)
    await assert.rejects(
      importMediaBundle(file, {
        decodeImage: async () => {
          calls++;
          return decodeImage();
        },
      }),
    );
  assert.equal(calls, 0);
  const ordered = await parts(
    await exportMediaBundle(second.library, second.assets, { decodeImage }),
  );
  ordered.manifest.assets.reverse();
  await assert.rejects(
    importMediaBundle(rawBundle(ordered.manifest, ordered.payload), { decodeImage }),
    /unordered/,
  );
});

test('every referenced original is mandatory; extras, corrupt bytes and false image facts fail', async () => {
  await assert.rejects(exportMediaBundle(source.library, [], { decodeImage }), /every referenced/);
  await assert.rejects(
    exportMediaBundle(
      source.library,
      [...source.assets, { sha256: 'a'.repeat(64), blob: new Blob(['x']) }],
      { decodeImage },
    ),
    /every referenced/,
  );
  const p = await parts();
  p.payload[p.payload.length - 1] ^= 1;
  await assert.rejects(
    importMediaBundle(rawBundle(p.manifest, p.payload), { decodeImage }),
    /metadata\/hash differs/,
  );
  const falseFact = await parts();
  falseFact.manifest.document.library.assets[0].width = 2;
  await assert.rejects(
    importMediaBundle(rawBundle(falseFact.manifest, falseFact.payload), { decodeImage }),
    /metadata\/hash differs/,
  );
  const missing = await parts();
  missing.manifest.assets = [];
  await assert.rejects(
    importMediaBundle(rawBundle(missing.manifest), { decodeImage }),
    /every referenced/,
  );
  await assert.rejects(
    importMediaBundle(bundle, {
      decodeImage: async () => {
        throw new Error('Actual decoder rejected image');
      },
    }),
    /Actual decoder/,
  );
});

test('strict full map/class/theme owners reject forged history before decoding', async () => {
  const p = await parts();
  let calls = 0;
  for (const mutate of [
    (d) => {
      d.owners[0].campaign.levels[0].enemies[0].vx = 3;
    },
    (d) => {
      d.owners[0].campaign.classRecipes[0].revision = 'forged';
    },
    (d) => {
      delete d.owners[0].campaign.classRecipes;
    },
    (d) => {
      delete d.owners[0].campaign.levels[0].rules;
    },
    (d) => {
      d.owners[0].themeIds = ['retro'];
    },
    (d) => {
      d.owners.push(d.owners[0]);
    },
    (d) => {
      d.owners = Array(105).fill(d.owners[0]);
    },
    (d) => {
      d.library.presentations[0].story = {};
    },
  ]) {
    const m = structuredClone(p.manifest);
    mutate(m.document);
    await assert.rejects(
      importMediaBundle(rawBundle(m, p.payload), {
        decodeImage: async () => {
          calls++;
          return decodeImage();
        },
      }),
    );
  }
  assert.equal(calls, 0);
});

test('source Blob properties and metadata mutation cannot change an in-flight export/import', async () => {
  const doc = structuredClone(source.library),
    gate = deferred(),
    entered = deferred();
  const pending = exportMediaBundle(doc, source.assets, {
    decodeImage: async () => {
      entered.resolve();
      await gate.promise;
      return decodeImage();
    },
  });
  await entered.promise;
  doc.library.assets[0].provenance.credit = 'late mutation';
  doc.owners.length = 0;
  gate.resolve();
  const exact = await pending;
  let touched = 0;
  Object.defineProperty(exact, 'size', {
    get() {
      touched++;
      throw new Error('untrusted size');
    },
  });
  exact.slice = () => {
    touched++;
    throw new Error('untrusted slice');
  };
  const result = await importMediaBundle(exact, { decodeImage });
  assert.equal(touched, 0);
  assert.deepEqual(result.document, source.library);
});

test('aborted import and delayed decode cancellation never publish a verified object', async () => {
  const before = new AbortController();
  before.abort();
  await assert.rejects(importMediaBundle(bundle, { signal: before.signal, decodeImage }), {
    name: 'AbortError',
  });
  const controller = new AbortController(),
    gate = deferred(),
    entered = deferred();
  const pending = importMediaBundle(bundle, {
    signal: controller.signal,
    decodeImage: async () => {
      entered.resolve();
      await gate.promise;
      return decodeImage();
    },
  });
  await entered.promise;
  controller.abort();
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('review cancellation is read-only and forged reviews/imports cannot commit', async () => {
  const { store, memory } = setup();
  await store.read();
  const before = await savedContents(memory);
  await assert.rejects(
    prepareMediaBundleRestore({ ...imported }, { store, decodeImage }),
    /Verify a still bundle/,
  );
  await assert.rejects(
    prepareMediaBundleRestore(imported, { store, assignmentMode: 'guess', decodeImage }),
    /restore mode/,
  );
  const gate = deferred(),
    entered = deferred(),
    controller = new AbortController();
  const pending = prepareMediaBundleRestore(imported, {
    store,
    signal: controller.signal,
    decodeImage: async () => {
      entered.resolve();
      await gate.promise;
      return decodeImage();
    },
  });
  await entered.promise;
  controller.abort();
  gate.resolve();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.deepEqual(await savedContents(memory), before);
  const review = await prepareMediaBundleRestore(imported, { store, decodeImage });
  await assert.rejects(commitMediaBundleRestore({ ...review }), /Prepare this still bundle/);
  assert.deepEqual(await savedContents(memory), before);
});

test('immutable asset/revision conflicts and missing earlier revisions refuse during review', async () => {
  const { store, memory } = setup();
  await store.commit(source, { expectedGeneration: 0 });
  const before = await savedContents(memory);
  for (const change of [
    (doc) => {
      doc.library.assets[0].provenance.credit = 'same ID, different author';
    },
    (doc) => {
      doc.library.presentations[0].description = 'same revision, different meaning';
    },
  ]) {
    const doc = structuredClone(source.library);
    change(doc);
    const conflict = await importMediaBundle(
      await exportMediaBundle(doc, source.assets, { decodeImage }),
      { decodeImage },
    );
    await assert.rejects(
      prepareMediaBundleRestore(conflict, { store, decodeImage }),
      /Conflicting immutable/,
    );
  }
  assert.deepEqual(await savedContents(memory), before);
  const other = setup(),
    latestOnly = structuredClone(second.library);
  latestOnly.library.presentations = [latestOnly.library.presentations[1]];
  const latest = await importMediaBundle(
    await exportMediaBundle(latestOnly, second.assets, { decodeImage }),
    { decodeImage },
  );
  await commitMediaBundleRestore(
    await prepareMediaBundleRestore(latest, { store: other.store, decodeImage }),
  );
  await assert.rejects(
    prepareMediaBundleRestore(imported, { store: other.store, decodeImage }),
    /revisions must increase/,
  );
});

test('a newer media writer invalidates the reviewed generation before any restore writes', async () => {
  const { memory, manager, store } = setup();
  const review = await prepareMediaBundleRestore(imported, { store, decodeImage });
  const rival = createStillMediaStore({
    managedStore: createManagedMediaStore({ indexedDB: memory.indexedDB, richStillMedia: true }),
    decodeImage,
  });
  await rival.commit(second, { expectedGeneration: 0 });
  const before = await savedContents(memory);
  await assert.rejects(commitMediaBundleRestore(review), /changed/);
  assert.deepEqual(await savedContents(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
});

test('reported quota refusal leaves prior originals/audio and generation intact', async () => {
  let refuse = false;
  const { manager, store, memory } = setup({
    estimate: async () => (refuse ? { quota: 0, usage: 0 } : null),
  });
  const audio = await fixture();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  await store.commit(source, { expectedGeneration: 0 });
  const review = await prepareMediaBundleRestore(secondBundle, {
    store,
    assignmentMode: 'restore',
    decodeImage,
  });
  const before = await savedContents(memory);
  refuse = true;
  await assert.rejects(commitMediaBundleRestore(review), /not enough reported/);
  assert.deepEqual(await savedContents(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
});

test('transaction abort rolls back staged originals; cancellation after commit remains success', async () => {
  const { store, memory, manager } = setup();
  await store.commit(source, { expectedGeneration: 0 });
  const review = await prepareMediaBundleRestore(secondBundle, {
    store,
    assignmentMode: 'restore',
    decodeImage,
  });
  const before = await savedContents(memory),
    controller = new AbortController();
  memory.onAnyPut = ({ name }) => {
    if (name === 'mediaRecords') controller.abort();
  };
  await assert.rejects(commitMediaBundleRestore(review, { signal: controller.signal }), {
    name: 'AbortError',
  });
  memory.onAnyPut = null;
  assert.deepEqual(await savedContents(memory), before);
  assert.equal((await manager.usage()).reservations, 0);
  const late = new AbortController();
  memory.afterAnyCommit = () => {
    if (memory.contents().get('mediaRecords').get('library')?.generation === 2) late.abort();
  };
  assert.equal((await commitMediaBundleRestore(review, { signal: late.signal })).generation, 2);
  await assert.rejects(commitMediaBundleRestore(review), /changed/);
});

test('valid restore preserves the exact separate .rlsound export and original MP3 bytes', async () => {
  const { store, manager } = setup(),
    audio = await fixture();
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  const soundtrack = createSoundtrackStore({ managedStore: manager }),
    before = await soundtrack.read();
  const oldExport = await exportSoundtrackBundle(before.library, before.assets);
  await commitMediaBundleRestore(
    await prepareMediaBundleRestore(secondBundle, { store, decodeImage }),
  );
  const after = await soundtrack.read();
  assert.deepEqual(after.library, before.library);
  assert.equal(after.generation, before.generation);
  assert.deepEqual(await bytes(after.assets[0].blob), await bytes(before.assets[0].blob));
  assert.deepEqual(
    await bytes(await exportSoundtrackBundle(after.library, after.assets)),
    await bytes(oldExport),
  );
});

test('retained generic originals round-trip into fresh and matching v2-history stores', async () => {
  const extra = new Blob(['generic source bytes, not an image']),
    hash = sha(await bytes(extra));
  const doc = structuredClone(source.library);
  doc.legacy.items = [{ id: 'old-source', sha256: hash }];
  const legacy = await importMediaBundle(
    await exportMediaBundle(doc, [...source.assets, { sha256: hash, blob: extra }], {
      decodeImage,
    }),
    { decodeImage },
  );
  assert.deepEqual(
    await bytes(legacy.assets.find((item) => item.sha256 === hash).blob),
    await bytes(extra),
  );
  for (const matching of [false, true]) {
    const target = setup();
    await target.store.read();
    if (matching) {
      const raw = await prepareManagedMediaBytes(
        { format: 'revealline-managed-bytes.v1', items: doc.legacy.items },
        [{ sha256: hash, blob: extra }],
      );
      await target.manager.commitDomain('media', raw, { expectedGeneration: 0 });
    }
    const before = await savedContents(target.memory);
    const review = await prepareMediaBundleRestore(legacy, { store: target.store, decodeImage });
    assert.deepEqual(await savedContents(target.memory), before);
    await commitMediaBundleRestore(review);
    assert.deepEqual((await target.store.read()).document.legacy, doc.legacy);
    assert.deepEqual(await bytes(await target.store.readBlob(hash)), await bytes(extra));
  }
});

test('valid unused owner records are retained exactly without granting installed contexts', async () => {
  const doc = structuredClone(source.library),
    unused = structuredClone(doc.owners[0]);
  unused.campaign.id = 'retained-unused-owner';
  doc.owners.push(unused);
  validateStoredStillMedia(doc);
  const incoming = await importMediaBundle(
    await exportMediaBundle(doc, source.assets, { decodeImage }),
    { decodeImage },
  );
  const { store } = setup();
  const review = await prepareMediaBundleRestore(incoming, { store, decodeImage });
  assert.deepEqual(review.document.owners, doc.owners);
  await commitMediaBundleRestore(review);
  assert.deepEqual((await store.read()).document.owners, doc.owners);
});
