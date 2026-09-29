import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { FORMATS, validateAssetRevision } from '../presentation/model.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
function png(width = 1152, height = 576) {
  // A small compressed, valid-CRC solid test image created only in memory.
  // This is not production artwork or a claim of native browser decoding.
  const chunk = (type, body) => {
    const bytes = Buffer.concat([Buffer.from(type), body]);
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(body.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, bytes, tail]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((width * 4 + 1) * height))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const bytes = png();
function fixture({ procedural = false, collection = null } = {}) {
  const pack = structuredClone(COOP_STARTER_PACK),
    level = pack.levels[0];
  const asset = validateAssetRevision({
    format: FORMATS.asset,
    id: 'team-picture-fixture',
    revision: 1,
    kind: 'image',
    description: 'Injected in-memory test image only.',
    provenance: {
      creator: 'Test fixture',
      source: 'Owned synthetic test data',
      license: 'CC0',
      prompt: '',
      parent: null,
    },
    file: { sha256: sha(bytes), bytes: bytes.length, mime: 'image/png', width: 1152, height: 576 },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 1152, height: 576 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
    quality: { stage: 'reviewed', evidence: ['Test-only injected metadata; no art admission.'] },
  });
  const row = {
    packId: pack.id,
    packRevision: pack.revision,
    packSha256: sha(canonicalJSON(pack)),
    levelId: level.id,
    levelRevision: level.revision,
    levelSha256: sha(canonicalJSON(level)),
    themeId: 'fpv',
    themeRevision: 1,
    collection,
    picture: procedural
      ? null
      : {
          slot: 'picture.team-fixture',
          assetId: asset.id,
          assetRevision: asset.revision,
          ...asset.file,
        },
  };
  const snapshot = {
    resolved: {
      theme: { id: 'fpv', revision: 1 },
      collection,
      assets: { 'picture.team-fixture': asset },
    },
  };
  const request = { pack, levelId: level.id, themeId: 'fpv', attemptId: 'attempt-1' };
  let currentSnapshot = snapshot,
    reads = 0,
    decodes = 0,
    releases = 0;
  const image = { width: 1152, height: 576 };
  const readPicture = async (slot, options) => {
    assert.equal(slot, row.picture.slot);
    assert.equal(options.snapshot, snapshot);
    assert.ok(options.signal instanceof AbortSignal);
    reads++;
    return { asset, blob: new Blob([bytes], { type: 'image/png' }) };
  };
  const decodeImage = async () => {
    decodes++;
    return { image, release: () => releases++ };
  };
  const create = (overrides = {}) =>
    createCoopPresentation({
      bindings: [row],
      getSnapshot: () => currentSnapshot,
      readPicture,
      decodeImage,
      ...overrides,
    });
  return {
    pack,
    asset,
    row,
    snapshot,
    request,
    image,
    create,
    readPicture,
    decodeImage,
    setSnapshot: (value) => (currentSnapshot = value),
    counts: () => ({ reads, decodes, releases }),
  };
}

test('exact injected pack/theme/asset and original bytes prepare once; Retry and confirm preserve the same decoded image', async () => {
  const f = fixture(),
    lease = f.create(),
    before = canonicalJSON(f.pack),
    statuses = [];
  const chosen = await lease.select({ ...f.request, onStatus: (status) => statuses.push(status) });
  assert.equal(chosen.image, f.image);
  assert.equal(chosen.snapshot, f.snapshot);
  assert.deepEqual(chosen.choice, { ...f.row, kind: 'image' });
  assert.ok(Object.isFrozen(chosen) && Object.isFrozen(chosen.choice.picture));
  assert.equal(chosen.fit, 'contain');
  assert.equal(chosen.sampling, 'nearest');
  assert.equal(await lease.select(f.request), chosen);
  assert.equal(lease.confirm(f.request), chosen);
  assert.equal(canonicalJSON(f.pack), before);
  assert.deepEqual(f.counts(), { reads: 1, decodes: 1, releases: 0 });
  assert.equal(statuses.at(-1).status, 'ready');
  lease.dispose();
  lease.dispose();
  assert.equal(f.counts().releases, 1);
  assert.equal(lease.current(), null);
  assert.throws(() => lease.confirm(f.request), /not ready/);
});

test('explicit procedural registration has no picture IO; absent required binding never silently falls back', async () => {
  const f = fixture({ procedural: true }),
    lease = f.create();
  const choice = await lease.select(f.request);
  assert.equal(choice.image, null);
  assert.equal(choice.choice.kind, 'procedural');
  assert.deepEqual(f.counts(), { reads: 0, decodes: 0, releases: 0 });
  await assert.rejects(
    f.create({ bindings: [] }).select(f.request),
    /No exact Team picture binding/,
  );
});

test('same IDs and revisions do not let changed level or other pack content borrow built-in picture approval', async () => {
  const f = fixture();
  for (const mutate of [
    (pack) => {
      pack.levels[0].name = 'Changed authored arena';
    },
    (pack) => {
      pack.levels[1].name = 'Changed other arena in pack';
    },
    (pack) => {
      pack.name = 'Changed pack';
    },
  ]) {
    const pack = structuredClone(f.pack);
    mutate(pack);
    await assert.rejects(
      f.create().select({ ...f.request, pack }),
      /No exact Team picture binding/,
    );
  }
  assert.equal(f.counts().reads, 0);
});

test('old strict game format rejects added image fields; binding tables reject URLs, duplicates and unbounded images', async () => {
  const f = fixture(),
    pack = structuredClone(f.pack);
  pack.levels[0].picture = 'https://untrusted.invalid/image.png';
  await assert.rejects(f.create().select({ ...f.request, pack }), /Invalid Team pack/);
  for (const row of [
    { ...f.row, url: 'https://untrusted.invalid/image.png' },
    { ...f.row, picture: { ...f.row.picture, slot: 'https://untrusted.invalid/image.png' } },
    { ...f.row, picture: { ...f.row.picture, bytes: 5 * 1024 * 1024 } },
    { ...f.row, picture: { ...f.row.picture, width: 768 } },
  ])
    assert.throws(() => f.create({ bindings: [row] }), /supported|1152/);
  assert.throws(() => f.create({ bindings: [f.row, f.row] }), /Duplicate/);
  assert.throws(() => f.create({ readPicture: null }), /injected/);
});

test('snapshot theme and collection revisions are exact and no unavailable snapshot is silently adopted', async () => {
  const f = fixture({ collection: { id: 'team-alternative', revision: 2 } });
  for (const snapshot of [
    null,
    { resolved: { ...f.snapshot.resolved, theme: { id: 'fpv', revision: 2 } } },
    { resolved: { ...f.snapshot.resolved, collection: null } },
  ]) {
    f.setSnapshot(snapshot);
    await assert.rejects(f.create().select(f.request), /snapshot|No exact/);
  }
  assert.equal(f.counts().reads, 0);
});

test('wrong selected asset revision, source-only quality or crop refuses before a reader is called', async () => {
  for (const mutate of [
    (asset) => {
      asset.revision = 2;
    },
    (asset) => {
      asset.quality.stage = 'source';
    },
    (asset) => {
      asset.geometry.frame.width = 576;
    },
  ]) {
    const f = fixture(),
      altered = structuredClone(f.asset);
    mutate(altered);
    f.snapshot.resolved.assets['picture.team-fixture'] = altered;
    await assert.rejects(f.create().select(f.request), /exact reviewed picture/);
    assert.equal(f.counts().reads, 0);
  }
});

test('wrong returned asset, corrupted original or decode failure visibly fails without accepting or falling back', async () => {
  const f = fixture();
  const changedAsset = structuredClone(f.asset);
  changedAsset.description = 'Different metadata';
  const corrupt = Buffer.from(bytes);
  corrupt[corrupt.length - 1] ^= 1;
  for (const reader of [
    async () => ({ asset: changedAsset, blob: new Blob([bytes], { type: 'image/png' }) }),
    async () => ({ asset: f.asset, blob: new Blob([corrupt], { type: 'image/png' }) }),
  ]) {
    const statuses = [],
      lease = f.create({ readPicture: reader });
    await assert.rejects(
      lease.select({ ...f.request, onStatus: (status) => statuses.push(status) }),
      /different asset|hash/,
    );
    assert.equal(lease.current(), null);
    assert.equal(statuses.at(-1).status, 'error');
  }
  const lease = f.create({
    decodeImage: async () => {
      throw new Error('native decode refused');
    },
  });
  await assert.rejects(lease.select(f.request), /native decode refused/);
  assert.equal(lease.current(), null);
});

test('decoded dimensions must agree and a failed decode result releases its owned image', async () => {
  const f = fixture();
  let releases = 0;
  const lease = f.create({
    decodeImage: async () => ({ image: { width: 768, height: 576 }, release: () => releases++ }),
  });
  await assert.rejects(lease.select(f.request), /Decoded Team picture dimensions/);
  assert.equal(releases, 1);
  assert.equal(lease.current(), null);
});

test('pack and binding metadata are captured before an injected status callback can mutate them', async () => {
  const f = fixture(),
    lease = f.create();
  let changed = false;
  const chosen = await lease.select({
    ...f.request,
    onStatus() {
      if (changed) return;
      changed = true;
      f.pack.name = 'Changed after request';
      f.row.picture.sha256 = '0'.repeat(64);
    },
  });
  assert.equal(chosen.choice.picture.sha256, sha(bytes));
  assert.throws(() => lease.confirm(f.request), /not ready/);
});

test('Retry cannot switch identity after failed acquisition; a new attempt may select the new snapshot', async () => {
  const f = fixture();
  let fail = true;
  const lease = f.create({
    readPicture: async (...args) => {
      if (fail) throw new Error('temporary read failure');
      assert.equal(args[1].snapshot, nextSnapshot);
      return { asset: f.asset, blob: new Blob([bytes], { type: 'image/png' }) };
    },
  });
  await assert.rejects(lease.select(f.request), /temporary/);
  fail = false;
  const nextSnapshot = { ...f.snapshot, resolved: structuredClone(f.snapshot.resolved) };
  f.setSnapshot(nextSnapshot);
  await assert.rejects(lease.select(f.request), /presentation changed/);
  const selected = await lease.select({ ...f.request, attemptId: 'attempt-2' });
  assert.equal(selected.snapshot, nextSnapshot);
});

test('Cancel then Retry owns a new pending decode; a late old result only releases its own image', async () => {
  const f = fixture(),
    entered = [deferred(), deferred()],
    completion = [deferred(), deferred()];
  let calls = 0;
  const releases = [0, 0];
  const lease = f.create({
    decodeImage: async () => {
      const n = calls++;
      entered[n].resolve();
      return completion[n].promise;
    },
  });
  const old = lease.select(f.request),
    oldRefusal = assert.rejects(old, { name: 'AbortError' });
  await entered[0].promise;
  lease.cancel();
  const retried = lease.select(f.request);
  await entered[1].promise;
  const latestImage = { width: 1152, height: 576 };
  completion[1].resolve({ image: latestImage, release: () => releases[1]++ });
  assert.equal((await retried).image, latestImage);
  completion[0].resolve({ image: { width: 1152, height: 576 }, release: () => releases[0]++ });
  await oldRefusal;
  assert.equal(lease.current().image, latestImage);
  assert.deepEqual(releases, [1, 0]);
  lease.dispose();
  assert.deepEqual(releases, [1, 1]);
});

test('new attempt replacement is atomic and failed replacement preserves the previous decoded lease', async () => {
  const f = fixture();
  let fail = false;
  const lease = f.create({
    readPicture: async (...args) => {
      if (fail) throw new Error('unavailable');
      return f.readPicture(...args);
    },
  });
  const first = await lease.select(f.request);
  fail = true;
  await assert.rejects(lease.select({ ...f.request, attemptId: 'attempt-2' }), /unavailable/);
  assert.equal(lease.current(), first);
  assert.equal(f.counts().releases, 0);
  fail = false;
  await lease.select({ ...f.request, attemptId: 'attempt-2' });
  assert.equal(f.counts().releases, 1);
  lease.dispose();
  assert.equal(f.counts().releases, 2);
});

test('dispose while decoding rejects late completion and releases it exactly once', async () => {
  const f = fixture(),
    entered = deferred(),
    completion = deferred();
  let releases = 0;
  const lease = f.create({
    decodeImage: async () => {
      entered.resolve();
      return completion.promise;
    },
  });
  const preparing = lease.select(f.request),
    refusal = assert.rejects(preparing, { name: 'AbortError' });
  await entered.promise;
  lease.dispose();
  completion.resolve({ image: f.image, release: () => releases++ });
  await refusal;
  lease.dispose();
  assert.equal(releases, 1);
  assert.equal(lease.current(), null);
  await assert.rejects(lease.select(f.request), /closed/);
});

test('reentrant status selection cannot let the previous operation adopt or leak a picture', async () => {
  const f = fixture(),
    lease = f.create();
  let newer;
  const old = lease.select({
    ...f.request,
    onStatus() {
      if (!newer) newer = lease.select({ ...f.request, attemptId: 'attempt-2' });
    },
  });
  await assert.rejects(old, { name: 'AbortError' });
  const latest = await newer;
  assert.equal(lease.current(), latest);
  assert.equal(lease.confirm({ ...f.request, attemptId: 'attempt-2' }), latest);
  assert.deepEqual(f.counts(), { reads: 1, decodes: 1, releases: 0 });
});

test('confirm rejects an interrupted gesture and mutable snapshot drift without reselecting or reading', async () => {
  const f = fixture(),
    lease = f.create();
  await lease.select(f.request);
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => lease.confirm({ ...f.request, signal: controller.signal }), {
    name: 'AbortError',
  });
  f.snapshot.resolved.assets['picture.team-fixture'] = {
    ...f.asset,
    description: 'Drifted after preparation',
  };
  assert.throws(() => lease.confirm(f.request), /binding changed/);
  assert.equal(f.counts().reads, 1);
});

test('a ready-status cancellation preserves the prior working lease and releases only the new candidate', async () => {
  const f = fixture(),
    lease = f.create();
  const first = await lease.select(f.request);
  await assert.rejects(
    lease.select({
      ...f.request,
      attemptId: 'attempt-2',
      onStatus(status) {
        if (status.status === 'ready') lease.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(lease.current(), first);
  assert.deepEqual(f.counts(), { reads: 2, decodes: 2, releases: 1 });
  lease.dispose();
  assert.equal(f.counts().releases, 2);
});

test('ready-status selection cannot release the prior picture before the newest candidate validates', async () => {
  const f = fixture(),
    thirdEntered = deferred(),
    thirdDecode = deferred();
  let decodes = 0,
    newer;
  const releases = [0, 0, 0];
  const lease = f.create({
    decodeImage: async () => {
      const n = decodes++;
      if (n === 2) {
        thirdEntered.resolve();
        await thirdDecode.promise;
      }
      return { image: { width: 1152, height: 576 }, release: () => releases[n]++ };
    },
  });
  const first = await lease.select(f.request);
  const second = lease.select({
    ...f.request,
    attemptId: 'attempt-2',
    onStatus(status) {
      if (status.status === 'ready') newer = lease.select({ ...f.request, attemptId: 'attempt-3' });
    },
  });
  await assert.rejects(second, { name: 'AbortError' });
  await thirdEntered.promise;
  assert.equal(lease.current(), first);
  assert.deepEqual(releases, [0, 1, 0]);
  thirdDecode.resolve();
  const latest = await newer;
  assert.equal(lease.current(), latest);
  assert.deepEqual(releases, [1, 1, 0]);
  lease.dispose();
  assert.deepEqual(releases, [1, 1, 1]);
});

for (const action of ['cancel', 'dispose'])
  test(`a ready-time snapshot reader cannot ${action} and then let the candidate adopt`, async () => {
    const f = fixture();
    let armed = false;
    const lease = f.create({
      getSnapshot() {
        if (armed) {
          armed = false;
          lease[action]();
        }
        return f.snapshot;
      },
    });
    const first = await lease.select(f.request);
    await assert.rejects(
      lease.select({
        ...f.request,
        attemptId: 'attempt-2',
        onStatus(status) {
          if (status.status === 'ready') armed = true;
        },
      }),
      { name: 'AbortError' },
    );
    assert.equal(lease.current(), action === 'dispose' ? null : first);
    assert.equal(f.counts().releases, action === 'dispose' ? 2 : 1);
    lease.dispose();
    assert.equal(
      f.counts().releases,
      2,
      'Every accepted/candidate image is released exactly once.',
    );
  });

test('an initial snapshot callback cannot cancel the request before pending ownership exists and still start reading', async () => {
  const f = fixture();
  const lease = f.create({
    getSnapshot() {
      lease.cancel();
      return f.snapshot;
    },
  });
  await assert.rejects(lease.select(f.request), { name: 'AbortError' });
  assert.deepEqual(f.counts(), { reads: 0, decodes: 0, releases: 0 });
  assert.equal(lease.current(), null);
});

test('confirm rechecks gesture cancellation after its injected snapshot reader returns', async () => {
  const f = fixture(),
    controller = new AbortController();
  let armed = false;
  const lease = f.create({
    getSnapshot() {
      if (armed) controller.abort();
      return f.snapshot;
    },
  });
  const current = await lease.select(f.request);
  armed = true;
  assert.throws(() => lease.confirm({ ...f.request, signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.equal(lease.current(), current);
  assert.equal(f.counts().reads, 1);
});

test('previous-image cleanup can dispose the resolver without returning a released candidate', async () => {
  const f = fixture();
  let decodes = 0;
  const releases = [0, 0];
  const lease = f.create({
    decodeImage: async () => {
      const n = decodes++;
      return {
        image: { width: 1152, height: 576 },
        release() {
          releases[n]++;
          if (n === 0) lease.dispose();
        },
      };
    },
  });
  await lease.select(f.request);
  await assert.rejects(lease.select({ ...f.request, attemptId: 'attempt-2' }), {
    name: 'AbortError',
  });
  assert.equal(lease.current(), null);
  assert.deepEqual(releases, [1, 1]);
  lease.dispose();
  assert.deepEqual(releases, [1, 1]);
});

test('a throwing previous-image cleanup does not undo a successfully adopted picture', async () => {
  const f = fixture();
  let decodes = 0;
  const releases = [0, 0];
  const lease = f.create({
    decodeImage: async () => {
      const n = decodes++;
      return {
        image: { width: 1152, height: 576 },
        release() {
          releases[n]++;
          if (n === 0) throw new Error('cleanup notification refused');
        },
      };
    },
  });
  await lease.select(f.request);
  const second = await lease.select({ ...f.request, attemptId: 'attempt-2' });
  assert.equal(lease.current(), second);
  assert.deepEqual(releases, [1, 0]);
  lease.dispose();
  assert.deepEqual(releases, [1, 1]);
});

test('matching metadata hashes still require the actual PNG header dimensions', async () => {
  const f = fixture(),
    wrong = png(768, 576),
    asset = structuredClone(f.asset),
    row = structuredClone(f.row);
  asset.file.sha256 = row.picture.sha256 = sha(wrong);
  asset.file.bytes = row.picture.bytes = wrong.length;
  f.snapshot.resolved.assets['picture.team-fixture'] = asset;
  const lease = f.create({
    bindings: [row],
    readPicture: async () => ({ asset, blob: new Blob([wrong], { type: 'image/png' }) }),
  });
  await assert.rejects(lease.select(f.request), /original dimensions disagree/);
  assert.equal(f.counts().decodes, 0);
  assert.equal(lease.current(), null);
});

test('pre-aborted requests and invalid native blob type do not acquire decoded resources', async () => {
  const f = fixture(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(f.create().select({ ...f.request, signal: controller.signal }), {
    name: 'AbortError',
  });
  const lease = f.create({
    readPicture: async () => ({ asset: f.asset, blob: new Blob([bytes], { type: 'image/jpeg' }) }),
  });
  await assert.rejects(lease.select(f.request), /original bytes/);
  assert.equal(f.counts().decodes, 0);
});
