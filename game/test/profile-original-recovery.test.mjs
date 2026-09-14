import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createProfileChannelReader } from '../profile-channel-reader.mjs';
import { recoveryChannel } from '../profile-channel.mjs';
import { emptyLibrary, exportLibrary } from '../library.mjs';
import { prepareStoredStillMedia } from '../media-storage-record.mjs';
import { profileAssetFixture } from './helpers/profile-channel-idb.mjs';
import { recoveryMediaFixture } from './helpers/recovery-media-idb.mjs';
import { pngBytes, mediaFixture, libraryRecord, deferred } from './helpers/media-fixtures.mjs';

const channelId = 'release-v0.39.0';
const dimensions = () => ({ naturalWidth: 1, naturalHeight: 1 });
const sha = (value) => createHash('sha256').update(value).digest('hex');
const blobBytes = async (blob) => Buffer.from(await blob.arrayBuffer());

// Only the tiny fixture setup writes its private model. The exposed production
// reader receives readonly transactions, exact native Blobs and cooperative locks.
async function fixture(t, options = {}) {
  const content = mediaFixture();
  const bytes = options.bytes ?? pngBytes();
  const library = libraryRecord(content.identity);
  Object.assign(library.assets[0], {
    sha256: sha(bytes),
    bytes: bytes.length,
    ...(options.asset ?? {}),
  });
  const prepared = await prepareStoredStillMedia(
    library,
    [{ sha256: sha(bytes), blob: new Blob([bytes]) }],
    {
      executionCatalog: content.catalog,
      decodeImage: async () => options.dimensions ?? dimensions(),
    },
  );
  const document = structuredClone(prepared.library);
  options.mutateDocument?.(document);
  const rows = {
    mediaRecords: [['library', { generation: 2, library: document }]],
    mediaBlobs: options.missingSelected ? [] : [[sha(bytes), new Blob([bytes])]],
    managedState: [
      ['ledger', { format: 'revealline-managed-state.v1', revision: 3, usedBytes: 10000 }],
    ],
  };
  options.mutateRows?.(rows, document);
  const channel = recoveryChannel(options.channelId ?? channelId, 'v0.40.0');
  const map = new Map([
    [channel.profileKey, exportLibrary(emptyLibrary())],
    [channel.sessionKey, '{malformed saved flight; keep exact'],
  ]);
  const media = await recoveryMediaFixture(rows);
  const profiles = await profileAssetFixture(options.assets ?? []);
  const locks = {
    held: new Set(),
    calls: [],
    async request(key, opts, callback) {
      this.calls.push({ key, opts });
      if (this.held.has(key)) return callback(null);
      this.held.add(key);
      try {
        return await callback({ name: key });
      } finally {
        this.held.delete(key);
      }
    },
  };
  const decode = {
    calls: 0,
    run: options.decode ?? (async () => options.dimensions ?? dimensions()),
  };
  const storage = {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem() {
      assert.fail('Selected recovery cannot write profiles.');
    },
    removeItem() {
      assert.fail('Selected recovery cannot delete profiles.');
    },
  };
  const reader = createProfileChannelReader({
    storage,
    indexedDB: {
      open(name, ...args) {
        return (name === 'revealline-assets-v1' ? profiles : media).indexedDB.open(name, ...args);
      },
    },
    lockManager: locks,
    currentVersion: 'v0.40.0',
    ...(options.timeoutMs ? { timeoutMs: options.timeoutMs } : {}),
    recoveryCatalogs: options.catalogs ?? [
      {
        channelId: channel.id,
        registeredEntries: options.registeredEntries ?? [],
        knownDescriptors: [],
      },
    ],
    decodeStillImage: async (...args) => {
      decode.calls++;
      assert.deepEqual(locks.held, new Set([channel.writerKey, channel.lockKey]));
      return decode.run(...args);
    },
  });
  t.after(() => reader.close());
  const selected = (await reader.discover()).channels.find((item) => item.id === channel.id);
  const review = await reader.review(selected);
  const noWrites = () => {
    assert.deepEqual(media.model.allPuts, []);
    assert.deepEqual(profiles.model.allPuts, []);
    assert(media.opens.every((open) => open.requestedVersion === undefined));
    assert(profiles.opens.every((open) => open.requestedVersion === undefined));
    assert.equal(locks.held.size, 0);
  };
  return {
    reader,
    review,
    channel: selected,
    map,
    media,
    profiles,
    locks,
    decode,
    document,
    bytes,
    noWrites,
  };
}

async function choose(f) {
  const selection = await f.reader.reviewOriginals(f.review);
  assert.equal(selection.originals.length, f.document.library.assets.length);
  return { selection, choice: selection.originals[0] };
}

test('selected PNG file and identity report preserve exact bytes, raw strings and read-only scope', async (t) => {
  const f = await fixture(t);
  const originalMap = new Map(f.map);
  const { selection, choice } = await choose(f);
  assert.equal(selection.channel.id, channelId);
  assert.equal(selection.scope, 'selected-originals-metadata');
  assert.equal(selection.earnedReceiptAuthority, false);
  assert(Object.isFrozen(selection.originals));
  assert(Object.isFrozen(choice));
  assert.deepEqual(choice.asset, f.document.library.assets[0]);
  assert.deepEqual(choice.references, f.document.library.presentations);
  assert.equal(choice.availability, 'available-unverified');
  assert.equal(choice.verified, false);
  assert.equal(f.decode.calls, 0);
  const verified = await f.reader.verifyOriginal(choice);
  assert(Object.isFrozen(verified));
  assert.equal(verified.verified, true);
  assert.equal(verified.restoreAuthority, false);
  assert.equal(f.decode.calls, 1);
  const image = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  assert.equal(image.component, 'original-file');
  assert.equal(image.fullBackup, false);
  assert.equal(image.blob.type, 'image/png');
  assert.match(image.filename, /\.png$/);
  assert.deepEqual(await blobBytes(image.blob), f.bytes);
  const reportFile = await f.reader.exportOriginalComponent(verified, {
    component: 'identity-report',
  });
  assert.equal(reportFile.component, 'identity-report');
  assert.equal(reportFile.fullBackup, false);
  assert(reportFile.blob.size <= 256 * 1024);
  const report = JSON.parse(await reportFile.blob.text());
  assert.equal(report.fullBackup, false);
  assert.equal(report.format, 'revealline-selected-original-report.v1');
  assert.equal(report.channel.id, channelId);
  assert.equal(report.profileFingerprint, selection.profileFingerprint);
  assert.equal(report.sharedFingerprint, selection.sharedFingerprint);
  assert.equal(report.earnedReceiptAuthority, false);
  assert.equal(report.restoreAuthority, false);
  assert.deepEqual(report.asset, f.document.library.assets[0]);
  assert.equal(
    f.decode.calls,
    3,
    'Every explicit component preparation verifies a fresh original.',
  );
  const raw = JSON.parse(await (await f.reader.exportStoredData(f.review)).blob.text());
  assert.equal(raw.raw.session.value, originalMap.get(f.channel.sessionKey));
  assert.deepEqual(f.map, originalMap);
  f.noWrites();
});

test('controlled JPEG header/decode boundary derives the component MIME and extension from bytes', async (t) => {
  // This is the existing finite header fixture with an injected decoder, not a
  // claim that a native JPEG decoder accepts a complete production original.
  const bytes = Buffer.from([255, 216, 255, 192, 0, 11, 8, 0, 1, 0, 2, 1, 1, 17, 0, 255, 217]);
  const f = await fixture(t, {
    bytes,
    asset: { mime: 'image/jpeg', width: 2 },
    dimensions: { naturalWidth: 2, naturalHeight: 1 },
  });
  const { choice } = await choose(f);
  const verified = await f.reader.verifyOriginal(choice);
  const exported = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  assert.equal(exported.blob.type, 'image/jpeg');
  assert.match(exported.filename, /\.jpe?g$/);
  assert.deepEqual(await blobBytes(exported.blob), bytes);
  f.noWrites();
});

test('an unavailable selected original refuses verification while exact raw diagnostics remain usable', async (t) => {
  for (const options of [
    { missingSelected: true },
    {
      mutateRows: (rows) => {
        rows.mediaBlobs[0][1] = new Blob(['short']);
      },
    },
  ]) {
    const f = await fixture(t, options);
    const { choice } = await choose(f);
    assert.equal(choice.availability, options.missingSelected ? 'missing' : 'length-mismatch');
    await assert.rejects(f.reader.verifyOriginal(choice), /absent|missing|length|unavailable/i);
    assert.equal(f.decode.calls, 0);
    await assert.rejects(f.reader.captureRecoverySnapshot(f.review), /absent|length/);
    assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
    f.noWrites();
  }
});

test('unrelated missing rich and legacy originals do not confer full-snapshot authority', async (t) => {
  const f = await fixture(t, {
    mutateDocument(document) {
      document.library.assets.push({
        ...structuredClone(document.library.assets[0]),
        id: 'unrelated',
        sha256: 'b'.repeat(64),
      });
      document.legacy.items.push({ id: 'retained-generic', sha256: 'c'.repeat(64) });
    },
  });
  const { choice } = await choose(f);
  const verified = await f.reader.verifyOriginal(choice);
  const exported = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  assert.deepEqual(await blobBytes(exported.blob), f.bytes);
  assert.equal(exported.fullBackup, false);
  await assert.rejects(f.reader.captureRecoverySnapshot(f.review), /absent/);
  f.noWrites();
});

test('selected metadata must match the actual hash, MIME and dimensions and require a successful decoder', async (t) => {
  const sameSize = pngBytes();
  sameSize[45] ^= 1;
  for (const options of [
    {
      mutateRows: (rows) => {
        rows.mediaBlobs[0][1] = new Blob([sameSize]);
      },
    },
    {
      mutateDocument: (document) => {
        document.library.assets[0].mime = 'image/jpeg';
      },
    },
    {
      mutateDocument: (document) => {
        document.library.assets[0].width = 2;
      },
    },
    { decode: async () => ({ naturalWidth: 2, naturalHeight: 1 }) },
    {
      decode: async () => {
        throw new Error('decoder refused');
      },
    },
  ]) {
    const f = await fixture(t, options);
    const { choice } = await choose(f);
    await assert.rejects(f.reader.verifyOriginal(choice), /differs|match|decode|hash|original/i);
    f.noWrites();
  }
});

test('malformed provenance and unknown presentation ownership refuse before decoding', async (t) => {
  for (const mutateDocument of [
    (document) => {
      document.library.assets[0].provenance.kind = 'unverified';
    },
    (document) => {
      document.library.presentations[0].identity.levelId = 'foreign-map';
    },
  ]) {
    const f = await fixture(t, { mutateDocument });
    await assert.rejects(f.reader.reviewOriginals(f.review), /provenance|identity|catalog/);
    assert.equal(f.decode.calls, 0);
    assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
    f.noWrites();
  }
});

test('archived stored owners validate a selected picture without adding executable or earned authority', async (t) => {
  const f = await fixture(t);
  const { selection, choice } = await choose(f);
  const snapshot = await f.reader.captureRecoverySnapshot(f.review);
  assert.equal(snapshot.executionEntries, 0);
  assert.equal(snapshot.externalChapters, 0);
  const verified = await f.reader.verifyOriginal(choice);
  const exported = await f.reader.exportOriginalComponent(verified, {
    component: 'identity-report',
  });
  const report = JSON.parse(await exported.blob.text());
  assert.equal(report.earnedReceiptAuthority, false);
  assert.equal(report.restoreAuthority, false);
  assert.equal(selection.fullBackup, false);
  f.noWrites();
});

test('valid bounded presentation history can export its original while an oversized identity report refuses', async (t) => {
  const f = await fixture(t, {
    mutateDocument(document) {
      const first = document.library.presentations[0];
      document.library.presentations = Array.from({ length: 128 }, (_, index) => ({
        ...structuredClone(first),
        revision: index + 1,
        description: 'Bounded historical description. '.repeat(64),
      }));
    },
  });
  assert(f.document.library.presentations.length <= 256);
  assert(Buffer.byteLength(JSON.stringify(f.document)) < 2 * 1024 * 1024);
  const { choice } = await choose(f);
  assert.equal(choice.references.length, 128);
  const verified = await f.reader.verifyOriginal(choice);
  assert(Buffer.byteLength(JSON.stringify(verified, null, 2)) > 256 * 1024);
  const original = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  assert.deepEqual(await blobBytes(original.blob), f.bytes);
  await assert.rejects(
    f.reader.exportOriginalComponent(verified, { component: 'identity-report' }),
    /report.*bound/,
  );
  f.noWrites();
});

test('exact aliases and pending journals refuse selected recovery before shared storage opens', async (t) => {
  for (const options of [
    { catalogs: [{ channelId: 'release-0.39.0', registeredEntries: [], knownDescriptors: [] }] },
    { assets: [[recoveryChannel(channelId, 'v0.40.0').externalJournalKey, { pending: true }]] },
  ]) {
    const f = await fixture(t, options);
    await assert.rejects(f.reader.reviewOriginals(f.review), /registered recovery catalog|Pending/);
    assert.deepEqual(f.media.opens, []);
    assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
    f.noWrites();
  }
});

test('copied and foreign choices or verified handles cannot authorize component export', async (t) => {
  const f = await fixture(t);
  const g = await fixture(t);
  const { choice } = await choose(f);
  for (const forged of [{ ...choice }, structuredClone(choice), {}])
    await assert.rejects(f.reader.verifyOriginal(forged), /owned|choice|select/i);
  await assert.rejects(g.reader.verifyOriginal(choice), /owned|choice|select/i);
  const verified = await f.reader.verifyOriginal(choice);
  await assert.rejects(
    f.reader.exportOriginalComponent({ ...verified }, { component: 'original-file' }),
    /owned|verified|verify/i,
  );
  await assert.rejects(
    g.reader.exportOriginalComponent(verified, { component: 'original-file' }),
    /owned|verified|verify/i,
  );
  f.noWrites();
  g.noWrites();
});

test('unknown component names cannot silently become full backups or original downloads', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  const verified = await f.reader.verifyOriginal(choice);
  for (const component of [undefined, null, 'full-backup', 'media-bundle', '../original-file'])
    await assert.rejects(f.reader.exportOriginalComponent(verified, { component }), /component/i);
  assert.equal(f.decode.calls, 1);
  f.noWrites();
});

test('caller key/hash/filename/decoder overrides and accessor options cannot acquire trusted authority', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  let invoked = 0;
  for (const options of [
    { key: 'other-original' },
    { sha256: '0'.repeat(64) },
    {
      decodeStillImage: () => {
        invoked++;
        return dimensions();
      },
    },
    Object.defineProperty({}, 'signal', {
      enumerable: true,
      get() {
        invoked++;
        return undefined;
      },
    }),
  ])
    await assert.rejects(f.reader.verifyOriginal(choice, options));
  assert.equal(invoked, 0);
  assert.equal(f.decode.calls, 0);
  const verified = await f.reader.verifyOriginal(choice);
  await assert.rejects(
    f.reader.exportOriginalComponent(verified, {
      component: 'original-file',
      filename: '../invented.png',
    }),
  );
  assert.equal(f.decode.calls, 1);
  f.noWrites();
});

test('a new originals review and a replacement verification invalidate older owned handles', async (t) => {
  const f = await fixture(t);
  const first = await choose(f);
  const oldVerified = await f.reader.verifyOriginal(first.choice);
  const second = await choose(f);
  await assert.rejects(f.reader.verifyOriginal(first.choice), /owned|choice|select/i);
  await assert.rejects(
    f.reader.exportOriginalComponent(oldVerified, { component: 'original-file' }),
    /owned|verified|verify/i,
  );
  const replaced = await f.reader.verifyOriginal(second.choice);
  const current = await f.reader.verifyOriginal(second.choice);
  await assert.rejects(
    f.reader.exportOriginalComponent(replaced, { component: 'original-file' }),
    /owned|verified|verify/i,
  );
  assert.deepEqual(
    await blobBytes(
      (await f.reader.exportOriginalComponent(current, { component: 'original-file' })).blob,
    ),
    f.bytes,
  );
  f.noWrites();
});

test('profile pointer drift after selection invalidates it without rewriting the changed string', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  f.map.set(f.channel.sessionKey, '{a new exact raw value');
  await assert.rejects(f.reader.verifyOriginal(choice), /changed/);
  assert.equal(f.map.get(f.channel.sessionKey), '{a new exact raw value');
  assert.equal(f.decode.calls, 0);
  f.noWrites();
});

test('a shared revision change with unchanged byte count invalidates the selected proof', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  await f.media.seed({
    managedState: [
      ['ledger', { format: 'revealline-managed-state.v1', revision: 4, usedBytes: 10000 }],
    ],
  });
  f.media.model.allPuts.length = 0;
  await assert.rejects(f.reader.verifyOriginal(choice), /changed/);
  assert.equal(f.decode.calls, 0);
  f.noWrites();
});

test('media generation drift during decoding refuses even when the asset and ledger are unchanged', async (t) => {
  const entered = deferred(),
    gate = deferred();
  const f = await fixture(t, {
    decode: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  const { choice } = await choose(f);
  const operation = f.reader.verifyOriginal(choice);
  const rejected = assert.rejects(operation, /changed/);
  await entered.promise;
  await f.media.seed({ mediaRecords: [['library', { generation: 3, library: f.document }]] });
  f.media.model.allPuts.length = 0;
  gate.resolve(dimensions());
  await rejected;
  f.noWrites();
});

test('same-key same-length body replacement after verification refuses the next explicit export', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  const verified = await f.reader.verifyOriginal(choice);
  const changed = Buffer.from(f.bytes);
  changed[45] ^= 1;
  await f.media.seed({ mediaBlobs: [[sha(f.bytes), new Blob([changed])]] });
  f.media.model.allPuts.length = 0;
  await assert.rejects(
    f.reader.exportOriginalComponent(verified, { component: 'original-file' }),
    /differs|hash|original/i,
  );
  assert.equal(
    f.decode.calls,
    2,
    'An unchanged key, size and ledger cannot substitute for fresh byte verification.',
  );
  f.noWrites();
});

test('profile drift during selected decode prevents publication of a verified handle', async (t) => {
  const entered = deferred(),
    gate = deferred();
  const f = await fixture(t, {
    decode: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  const { choice } = await choose(f);
  const operation = f.reader.verifyOriginal(choice);
  const rejected = assert.rejects(operation, /changed/);
  await entered.promise;
  f.map.set(f.channel.profileKey, '{changed while decoding');
  gate.resolve(dimensions());
  await rejected;
  assert.equal(f.map.get(f.channel.profileKey), '{changed while decoding');
  f.noWrites();
});

for (const kind of ['cancel', 'close'])
  test(`${kind} during selected decode settles promptly and cannot publish a late handle`, async (t) => {
    const entered = deferred(),
      gate = deferred(),
      controller = new AbortController();
    const f = await fixture(t, {
      decode: () => {
        entered.resolve();
        return gate.promise;
      },
    });
    const { choice } = await choose(f);
    const operation = f.reader.verifyOriginal(choice, { signal: controller.signal });
    const rejected = assert.rejects(operation, { name: 'AbortError' });
    await entered.promise;
    if (kind === 'close') await f.reader.close();
    else controller.abort();
    await rejected;
    gate.resolve(dimensions());
    await new Promise((resolve) => setImmediate(resolve));
    f.noWrites();
    if (kind === 'close') await assert.rejects(f.reader.verifyOriginal(choice), /closed/);
    else assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
  });

test('cancelling fresh export decoding produces no component and preserves an earlier immutable file', async (t) => {
  const f = await fixture(t);
  const { choice } = await choose(f);
  const verified = await f.reader.verifyOriginal(choice);
  const first = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  const entered = deferred(),
    gate = deferred(),
    controller = new AbortController();
  f.decode.run = () => {
    entered.resolve();
    return gate.promise;
  };
  const pending = f.reader.exportOriginalComponent(verified, {
    component: 'identity-report',
    signal: controller.signal,
  });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  controller.abort();
  await rejected;
  gate.resolve(dimensions());
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(await blobBytes(first.blob), f.bytes);
  f.noWrites();
});

test('selected decode timeout refuses the operation and consumes a late decoder rejection', async (t) => {
  const entered = deferred(),
    gate = deferred();
  const f = await fixture(t, {
    timeoutMs: 1000,
    decode: () => {
      entered.resolve();
      return gate.promise;
    },
  });
  const { choice } = await choose(f);
  const operation = f.reader.verifyOriginal(choice);
  const rejected = assert.rejects(operation, { name: 'TimeoutError' });
  await entered.promise;
  await rejected;
  gate.reject(new Error('late controlled decoder rejection'));
  await new Promise((resolve) => setImmediate(resolve));
  f.noWrites();
  assert((await f.reader.exportStoredData(f.review)).blob.size > 0);
});

test('an exact registered campaign validates the same picture without changing its stored owner', async (t) => {
  const content = mediaFixture();
  const f = await fixture(t, {
    registeredEntries: [{ campaign: content.campaign, themes: [{ id: 'fpv' }] }],
  });
  const { selection, choice } = await choose(f);
  assert.equal(selection.executionEntries, 2);
  assert.equal(selection.externalChapters, 0);
  assert.deepEqual(choice.references, f.document.library.presentations);
  const verified = await f.reader.verifyOriginal(choice);
  const image = await f.reader.exportOriginalComponent(verified, { component: 'original-file' });
  assert.deepEqual(await blobBytes(image.blob), f.bytes);
  assert.equal(verified.earnedReceiptAuthority, false);
  f.noWrites();
});
