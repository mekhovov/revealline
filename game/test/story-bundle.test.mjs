import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  createManagedMediaStore,
  MANAGED_MEDIA_DATABASE,
  MANAGED_MEDIA_LIMITS,
} from '../managed-media-store.mjs';
import { createStillMediaStore } from '../media-store.mjs';
import { createStoryMediaStore } from '../story-media-store.mjs';
import { createStoredStillIdentityCatalog } from '../media-storage-record.mjs';
import {
  exportStoryBundle,
  inspectStoryBundle,
  importStoryBundle,
  isImportedStoryBundle,
  prepareStoryBundleRestore,
  commitStoryBundleRestore,
  cancelStoryBundleRestore,
  STORY_BUNDLE_LIMITS,
} from '../story-bundle.mjs';
import {
  exportMediaBundle,
  importMediaBundle,
  prepareMediaBundleRestore,
  commitMediaBundleRestore,
} from '../media-bundle.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { snapshotPictureChoice } from '../presentation-pins.mjs';
import {
  createStoryFixture,
  inspectionEnvironment,
  videoBytes,
} from './helpers/victory-story-fixture.mjs';
import { fixture, memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { pngBytes, deferred } from './helpers/media-fixtures.mjs';

const run = promisify(execFile),
  f = createStoryFixture(),
  audio = await fixture(),
  decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 }),
  bytes = async (blob) => Buffer.from(await blob.arrayBuffer()),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const secondBytes = Buffer.concat([videoBytes, Buffer.from([0, 0, 0, 8, 102, 114, 101, 101])]),
  second = {
    ...f.descriptor,
    id: 'second-story',
    source: { ...f.descriptor.source, sha256: sha(secondBytes), bytes: secondBytes.length },
  },
  document = {
    format: 'revealline-story-storage.v1',
    stories: [f.descriptor, second],
    originals: [f.descriptor.source.sha256, second.source.sha256],
  },
  assets = [
    { sha256: f.descriptor.source.sha256, blob: f.blob },
    { sha256: second.source.sha256, blob: new Blob([secondBytes]) },
  ];
const inspection = () => inspectionEnvironment().options;
async function setup({ withPoster = true, ...options } = {}) {
  const memory = memoryIndexedDB(),
    manager = createManagedMediaStore({
      indexedDB: memory.indexedDB,
      storyMedia: true,
      ...options,
    }),
    still = createStillMediaStore({ managedStore: manager, decodeImage }),
    store = createStoryMediaStore({ managedStore: manager, decodeImage });
  await manager.commitDomain('audio', audio.prepared, { expectedGeneration: 0 });
  if (withPoster)
    await still.commit(
      await still.prepare(f.library, [{ sha256: f.pin.sha256, blob: new Blob([pngBytes()]) }], {
        executionCatalog: f.catalog,
      }),
      { expectedGeneration: 0 },
    );
  return {
    memory,
    manager,
    still,
    store,
    async close() {
      await store.close();
      manager.close();
    },
  };
}
async function sourceBundle() {
  const s = await setup(),
    review = await s.store.stageRestore({ document, assets }, inspection());
  await s.store.commit(review);
  const meta = await s.still.readMetadata(),
    inventory = await s.store.exportInventory(),
    bundle = await exportStoryBundle(inventory.document, inventory.assets, {
      still: meta.document,
    });
  return { ...s, bundle, meta };
}
async function mutateManifest(blob, mutate, { tail, extra = Buffer.alloc(0) } = {}) {
  const b = await bytes(blob),
    length = b.readUInt32BE(8),
    manifest = JSON.parse(b.subarray(12, 12 + length).toString());
  mutate(manifest);
  const text = Buffer.from(JSON.stringify(manifest)),
    header = Buffer.from(b.subarray(0, 12));
  header.writeUInt32BE(text.length, 8);
  return new Blob([header, text, tail ?? b.subarray(12 + length), extra]);
}
async function records(memory) {
  const out = {};
  for (const [name, rows] of memory.contents())
    if (!['reservations', 'managedState'].includes(name)) {
      out[name] = [];
      for (const [key, value] of rows)
        out[name].push([key, value instanceof Blob ? sha(await bytes(value)) : value]);
    }
  return out;
}

test('binary originals roundtrip into a fresh v4 store only after exact paired still recovery', async () => {
  const source = await sourceBundle(),
    target = await setup({ withPoster: false }),
    checked = await inspectStoryBundle(source.bundle);
  assert.equal(isImportedStoryBundle(checked), false);
  const imported = await importStoryBundle(source.bundle, inspection());
  assert.equal(isImportedStoryBundle(imported), true);
  await assert.rejects(
    prepareStoryBundleRestore(checked, { store: target.store, ...inspection() }),
    /Import and decode/,
  );
  await assert.rejects(
    prepareStoryBundleRestore({ ...imported }, { store: target.store, ...inspection() }),
    /Import and decode/,
  );
  await assert.rejects(
    prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
    /historical poster/,
  );
  assert.equal((await target.store.readMetadata()).generation, 0);
  const originals = await source.still.read(),
    stillBundle = await exportMediaBundle(originals.document, originals.assets, { decodeImage }),
    decodedStill = await importMediaBundle(stillBundle, { decodeImage });
  await commitMediaBundleRestore(
    await prepareMediaBundleRestore(decodedStill, { store: target.still, decodeImage }),
  );
  const review = await prepareStoryBundleRestore(imported, {
    store: target.store,
    ...inspection(),
  });
  assert.equal((await target.store.readMetadata()).generation, 0);
  assert.equal((await target.manager.usage()).reservations, 1);
  const saved = await commitStoryBundleRestore(review);
  assert.equal(saved.generation, 1);
  assert.equal(saved.document.stories.length, 2);
  for (const desc of document.stories) {
    const prepared = await target.store.acquire(
      { id: desc.id, revision: desc.revision, picturePin: desc.picturePin },
      inspection(),
    );
    assert.equal(sha(await bytes(prepared.original)), desc.source.sha256);
  }
  const again = await target.store.exportInventory(),
    poster = await target.still.readMetadata();
  assert.deepEqual(
    await bytes(await exportStoryBundle(again.document, again.assets, { still: poster.document })),
    await bytes(source.bundle),
  );
  const soundtrack = await target.manager.readDomain('audio');
  assert.deepEqual(await bytes(soundtrack.assets[0].blob), await bytes(audio.blob));
  await source.close();
  await target.close();
});

test('export ordering is deterministic; complete byte inspector does not certify false codec facts', async () => {
  const source = await sourceBundle(),
    inventory = await source.store.exportInventory(),
    a = await exportStoryBundle(inventory.document, [...inventory.assets].reverse(), {
      still: source.meta.document,
    });
  assert.deepEqual(await bytes(a), await bytes(source.bundle));
  const wrong = await mutateManifest(a, (m) => {
    m.document.stories[0].source.width = 320;
  });
  const checked = await inspectStoryBundle(wrong);
  assert.equal(isImportedStoryBundle(checked), false);
  await assert.rejects(importStoryBundle(wrong, inspection()), /width/);
  await source.close();
});

test('truncated, trailing, duplicate/unordered, wrong-length/hash and unsupported versions reject without storage', async () => {
  const source = await sourceBundle(),
    b = await bytes(source.bundle);
  for (const bad of [
    new Blob([b.subarray(0, 11)]),
    new Blob([b.subarray(0, b.length - 1)]),
    new Blob([b, Buffer.from([0])]),
    await mutateManifest(source.bundle, (m) => m.assets.reverse()),
    await mutateManifest(source.bundle, (m) => m.assets.push(m.assets[0])),
    await mutateManifest(source.bundle, (m) => m.assets[0].bytes--),
    await mutateManifest(source.bundle, (m) => (m.format = 'future')),
    await mutateManifest(source.bundle, (m) => (m.document.format = 'future')),
    await mutateManifest(source.bundle, (m) => (m.assets[0].sha256 = '0'.repeat(64))),
    await mutateManifest(source.bundle, (m) => (m.document.stories[0].segment.endSeconds = 99)),
  ])
    await assert.rejects(inspectStoryBundle(bad));
  const changed = Buffer.from(b);
  changed[changed.length - 1] ^= 1;
  await assert.rejects(inspectStoryBundle(new Blob([changed])), /hash\/byte/);
  const header = Buffer.from(b.subarray(0, 12));
  header.writeUInt32BE(STORY_BUNDLE_LIMITS.manifestBytes + 1, 8);
  await assert.rejects(inspectStoryBundle(new Blob([header])), /manifest length/);
  const invalid = Buffer.from(b);
  invalid[12] = 255;
  await assert.rejects(inspectStoryBundle(new Blob([invalid])), /encoded data|encoding/i);
  await source.close();
});

test('native file/source budgets and export ownership reject aliases/getters/missing extras before transfer', async () => {
  const source = await sourceBundle(),
    huge = new Blob(Array(257).fill(new Blob([new Uint8Array(1024 * 1024)])));
  await assert.rejects(inspectStoryBundle(huge), /bounded file size/);
  await assert.rejects(
    inspectStoryBundle({
      size: 100,
      slice() {
        throw new Error('not native');
      },
    }),
  );
  const hugeSource = await mutateManifest(
    source.bundle,
    (m) => (m.assets[0].bytes = 64 * 1024 * 1024 + 1),
  );
  await assert.rejects(inspectStoryBundle(hugeSource), /Invalid/);
  const inventory = await source.store.exportInventory();
  await assert.rejects(
    exportStoryBundle(inventory.document, inventory.assets.slice(1), {
      still: source.meta.document,
    }),
    /every available/,
  );
  let accessed = 0;
  const bad = [
    {
      sha256: assets[0].sha256,
      get blob() {
        accessed++;
        return f.blob;
      },
    },
  ];
  await assert.rejects(
    exportStoryBundle(inventory.document, bad, { still: source.meta.document }),
    /own hash/,
  );
  assert.equal(accessed, 0);
  const extra = [...inventory.assets, { sha256: 'a'.repeat(64), blob: new Blob(['extra']) }];
  await assert.rejects(
    exportStoryBundle(inventory.document, extra, { still: source.meta.document }),
    /Unknown\/duplicate/,
  );
  await source.close();
});

test('unsupported legacy bundle magic and serialized imports cannot be restored as stories', async () => {
  const source = await sourceBundle(),
    audioBundle = await exportSoundtrackBundle(audio.library, audio.assets);
  await assert.rejects(inspectStoryBundle(audioBundle), /Unsupported story/);
  const still = await source.still.read(),
    mediaBundle = await exportMediaBundle(still.document, still.assets, { decodeImage });
  await assert.rejects(inspectStoryBundle(mediaBundle), /Unsupported story/);
  const imported = await importStoryBundle(source.bundle, inspection());
  await assert.rejects(
    prepareStoryBundleRestore(JSON.parse(JSON.stringify(imported)), {
      store: source.store,
      ...inspection(),
    }),
    /Import and decode/,
  );
  await source.close();
});

test('restore unions local availability and history; missing incoming references never detach current originals', async () => {
  const source = await sourceBundle(),
    target = await setup(),
    local = { ...f.descriptor, id: 'local-story' };
  await target.store.commit(
    await target.store.stage({ descriptor: local, blob: f.blob }, inspection()),
  );
  const detached = { ...document, originals: [] },
    bundle = await exportStoryBundle(detached, [], { still: source.meta.document }),
    imported = await importStoryBundle(bundle, inspection()),
    review = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() });
  await commitStoryBundleRestore(review);
  const saved = await target.store.readMetadata();
  assert.equal(saved.document.stories.length, 3);
  assert.deepEqual(saved.document.originals, [f.descriptor.source.sha256]);
  const full = await importStoryBundle(source.bundle, inspection());
  await commitStoryBundleRestore(
    await prepareStoryBundleRestore(full, { store: target.store, ...inspection() }),
  );
  assert.equal((await target.store.readMetadata()).document.originals.length, 2);
  await source.close();
  await target.close();
});

test('same revision collision refuses complete restore without partial second-story install', async () => {
  const source = await sourceBundle(),
    target = await setup();
  await target.store.commit(
    await target.store.stage(
      {
        descriptor: { ...f.descriptor, segment: { startSeconds: 1, endSeconds: 4 } },
        blob: f.blob,
      },
      inspection(),
    ),
  );
  const before = await records(target.memory),
    imported = await importStoryBundle(source.bundle, inspection());
  await assert.rejects(
    prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
    /immutable revision/,
  );
  assert.deepEqual(await records(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 0);
  await source.close();
  await target.close();
});

test('cancellation, stale review and copied review do not commit or steal another lease', async () => {
  const source = await sourceBundle(),
    target = await setup(),
    imported = await importStoryBundle(source.bundle, inspection()),
    review = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() });
  await assert.rejects(commitStoryBundleRestore({ ...review }), /Review this story/);
  const other = await target.manager.reserve({
    domain: 'audio',
    expectedGeneration: 1,
    maxNewBytes: 100,
  });
  assert.equal(await cancelStoryBundleRestore(review), true);
  assert.equal((await target.manager.usage()).reservations, 1);
  await target.manager.release(other);
  const a = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
    b = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() });
  await commitStoryBundleRestore(a);
  await assert.rejects(commitStoryBundleRestore(b), /changed in another/);
  const c = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
    signal = new AbortController();
  signal.abort();
  await assert.rejects(commitStoryBundleRestore(c, { signal: signal.signal }), {
    name: 'AbortError',
  });
  assert.equal((await target.manager.usage()).reservations, 0);
  assert.equal((await target.store.readMetadata()).generation, 1);
  await source.close();
  await target.close();
});

test('bulk native decode failure/timeout or cancellation releases staging and keeps all prior domains', async () => {
  const source = await sourceBundle(),
    target = await setup(),
    imported = await importStoryBundle(source.bundle, inspection()),
    before = await records(target.memory);
  const env = inspectionEnvironment({ automatic: false }),
    entered = deferred(),
    controller = new AbortController();
  const pending = prepareStoryBundleRestore(imported, {
    store: target.store,
    ...env.options,
    createVideo() {
      const v = env.options.createVideo();
      entered.resolve();
      return v;
    },
    signal: controller.signal,
  });
  await entered.promise;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(env.urls.size, 0);
  const timed = inspectionEnvironment({ automatic: false });
  await assert.rejects(
    prepareStoryBundleRestore(imported, { store: target.store, ...timed.options, timeoutMs: 10 }),
    /timed out/,
  );
  const wrong = inspectionEnvironment({ facts: { durationSeconds: 5 } });
  await assert.rejects(
    prepareStoryBundleRestore(imported, { store: target.store, ...wrong.options }),
    /duration/,
  );
  assert.deepEqual(await records(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 0);
  await source.close();
  await target.close();
});

test('shared quota refusal and write abort roll back all imported stories and original bytes', async () => {
  const source = await sourceBundle();
  let quota = null;
  const target = await setup({ estimate: async () => quota }),
    imported = await importStoryBundle(source.bundle, inspection()),
    before = await records(target.memory),
    review = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() });
  quota = { quota: 0, usage: 0 };
  await assert.rejects(commitStoryBundleRestore(review), /reported storage/);
  assert.deepEqual(await records(target.memory), before);
  quota = null;
  const next = await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() });
  target.memory.onAnyPut = ({ name, tx }) => {
    if (name === 'storyRecords') tx.abort();
  };
  await assert.rejects(commitStoryBundleRestore(next), /transaction failed/);
  target.memory.onAnyPut = null;
  assert.deepEqual(await records(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 0);
  await source.close();
  await target.close();
});

test('caller changes after export awaits cannot replace snapshotted descriptor or original', async () => {
  const source = await sourceBundle(),
    doc = structuredClone(document),
    table = [...assets],
    pending = exportStoryBundle(doc, table, { still: source.meta.document });
  doc.stories[0].segment.startSeconds = 0;
  table[0] = { sha256: assets[0].sha256, blob: new Blob(['fake']) };
  const bundle = await pending,
    checked = await inspectStoryBundle(bundle);
  assert.equal(checked.document.stories[0].segment.startSeconds, 2);
  assert.equal(
    sha(await bytes(checked.assets.find((a) => a.sha256 === assets[0].sha256).blob)),
    assets[0].sha256,
  );
  assert.equal(
    createStoredStillIdentityCatalog(checked.still).has(snapshotPictureChoice(f.pin).identity),
    true,
  );
  await source.close();
});

test('CLI inspects exact file bytes without codec or database claims and rejects malformed usage/files', async () => {
  const source = await sourceBundle(),
    dir = await mkdtemp(join(tmpdir(), 'rlstory-cli-'));
  try {
    const path = join(dir, 'owned.rlstory');
    await writeFile(path, await bytes(source.bundle));
    const before = await readFile(path),
      { stdout } = await run(process.execPath, ['scripts/story-bundle.mjs', 'inspect', path], {
        cwd: new URL('../../', import.meta.url),
      }),
      report = JSON.parse(stdout);
    assert.equal(report.status, 'METADATA_AND_ORIGINAL_BYTES_PASS');
    assert.equal(report.codec, 'NOT_TESTED');
    assert.equal(report.sha256, sha(before));
    assert.equal(report.availableOriginals, 2);
    assert.deepEqual(await readFile(path), before);
    await assert.rejects(
      run(process.execPath, ['scripts/story-bundle.mjs', 'import', path], {
        cwd: new URL('../../', import.meta.url),
      }),
      /Usage/,
    );
    await assert.rejects(
      run(process.execPath, ['scripts/story-bundle.mjs', 'inspect', dir], {
        cwd: new URL('../../', import.meta.url),
      }),
      /ordinary .rlstory/,
    );
    if (process.platform !== 'win32') {
      const fifo = join(dir, 'not-a-file');
      await run('mkfifo', [fifo]);
      await assert.rejects(
        run(process.execPath, ['scripts/story-bundle.mjs', 'inspect', fifo], {
          cwd: new URL('../../', import.meta.url),
          timeout: 2000,
        }),
        /ordinary .rlstory/,
      );
    }
    await writeFile(path, 'broken');
    await assert.rejects(
      run(process.execPath, ['scripts/story-bundle.mjs', 'inspect', path], {
        cwd: new URL('../../', import.meta.url),
      }),
      /ordinary .rlstory/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
    await source.close();
  }
});

async function mutateBlob(memory, hash, blob) {
  const db = await new Promise((resolve, reject) => {
    const r = memory.indexedDB.open(MANAGED_MEDIA_DATABASE, 4);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const t = db.transaction(['mediaBlobs'], 'readwrite');
      t.oncomplete = resolve;
      t.onabort = () => reject(t.error);
      const rows = t.objectStore('mediaBlobs');
      if (blob === null) rows.delete(hash);
      else rows.put(blob, hash);
    });
  } finally {
    db.close();
  }
}

test('missing actual retained poster rejects before video inspection; complete video restore repairs missing/corrupt available bytes', async () => {
  const source = await sourceBundle(),
    target = await setup(),
    imported = await importStoryBundle(source.bundle, inspection());
  await mutateBlob(target.memory, f.pin.sha256, null);
  const env = inspectionEnvironment();
  await assert.rejects(
    prepareStoryBundleRestore(imported, { store: target.store, ...env.options }),
    /picture original is missing/,
  );
  assert.equal(env.videos.length, 0);
  assert.equal((await target.manager.usage()).reservations, 0);
  await mutateBlob(target.memory, f.pin.sha256, new Blob([pngBytes()]));
  await commitStoryBundleRestore(
    await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
  );
  await mutateBlob(target.memory, f.descriptor.source.sha256, null);
  await mutateBlob(target.memory, second.source.sha256, new Blob(['corrupt']));
  await assert.rejects(target.store.exportInventory(), /missing/);
  await commitStoryBundleRestore(
    await prepareStoryBundleRestore(imported, { store: target.store, ...inspection() }),
  );
  const repaired = await target.store.exportInventory();
  assert.equal(repaired.assets.length, 2);
  for (const a of repaired.assets) assert.equal(sha(await bytes(a.blob)), a.sha256);
  await source.close();
  await target.close();
});

test('second-source codec failure and expired complete review leave no partial imported history', async () => {
  let now = 1000;
  const source = await sourceBundle(),
    target = await setup({ now: () => now }),
    imported = await importStoryBundle(source.bundle, inspection()),
    before = await records(target.memory),
    env = inspectionEnvironment();
  let count = 0;
  await assert.rejects(
    prepareStoryBundleRestore(imported, {
      store: target.store,
      ...env.options,
      createVideo() {
        const selected =
          ++count === 2 ? inspectionEnvironment({ facts: { width: 320 } }).options : env.options;
        return selected.createVideo();
      },
    }),
    /width/,
  );
  assert.equal(count, 2);
  assert.equal(env.urls.size, 0);
  assert.deepEqual(await records(target.memory), before);
  assert.equal((await target.manager.usage()).reservations, 0);
  const review = await prepareStoryBundleRestore(imported, {
    store: target.store,
    ...inspection(),
  });
  now += MANAGED_MEDIA_LIMITS.leaseMs + 1;
  await assert.rejects(commitStoryBundleRestore(review), /expired/);
  assert.equal((await target.store.readMetadata()).generation, 0);
  assert.equal((await target.manager.usage()).reservations, 0);
  await source.close();
  await target.close();
});

test('empty inventory stays explicit and unsupported retained owner or changed poster pins cannot become restore authority', async () => {
  const source = await sourceBundle(),
    empty = { format: 'revealline-story-storage.v1', stories: [], originals: [] },
    bundle = await exportStoryBundle(empty, [], { still: source.meta.document });
  const checked = await importStoryBundle(bundle, inspection());
  assert.equal(checked.document.stories.length, 0);
  assert.equal(checked.assets.length, 0);
  for (const change of [
    (m) => (m.still.owners = []),
    (m) => (m.document.stories[0].picturePin.sha256 = 'b'.repeat(64)),
    (m) => m.document.stories[0].picturePin.presentationRevision++,
  ])
    await assert.rejects(inspectStoryBundle(await mutateManifest(source.bundle, change)));
  await source.close();
});
