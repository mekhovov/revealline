import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import {
  readCoopPresentationEnvelope,
  disposeCoopPresentationEnvelope,
} from '../coop/presentation-envelope.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import {
  COOP_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
} from '../couch/coop-picture-bindings.mjs';
import { FORMATS, validateAssetRevision } from '../presentation/model.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};
function png(mark) {
  // Complete synthetic PNGs, generated only in memory. Both qualification and
  // resolver decoders are modeled; this is not native or production-art proof.
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
  const header = Buffer.alloc(13),
    pixels = Buffer.alloc((1152 * 4 + 1) * 576);
  header.writeUInt32BE(1152);
  header.writeUInt32BE(576, 4);
  header[8] = 8;
  header[9] = 6;
  pixels[1] = mark;
  pixels[4] = 255;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(pixels)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const defaultPictures = [png(12), png(210)];
const defaultTheme = { id: 'fpv', revision: 32, collection: null };
async function localSource(
  t,
  {
    pack = COOP_STARTER_PACK,
    pictures = defaultPictures,
    theme = defaultTheme,
    attribution = 'Synthetic local-art test fixture',
  } = {},
) {
  pack = structuredClone(pack);
  const bodies = new Map(pictures.map((bytes) => [sha(bytes), bytes]));
  const assets = [...bodies]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hash, bytes]) => ({
      sha256: hash,
      bytes: bytes.length,
      mime: 'image/png',
      width: 1152,
      height: 576,
      provenance: { kind: 'user-supplied', attribution, source: 'In-memory fixture' },
    }));
  const manifest = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'local.resolver-test',
      revision: 1,
      theme: structuredClone(theme),
      levels: pack.levels.map((level, index) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: sha(canonicalJSON(level)),
        pictureSha256: sha(pictures[index % pictures.length]),
      })),
      assets,
    },
  };
  const encoded = Buffer.from(JSON.stringify(manifest));
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(encoded.length, 8);
  const owner = await readCoopPresentationEnvelope(
    new Blob([header, encoded, ...assets.map((asset) => bodies.get(asset.sha256))]),
    {
      decodeImage: async () => ({
        image: { naturalWidth: 1152, naturalHeight: 576 },
        release() {},
      }),
    },
  );
  t.after(() => disposeCoopPresentationEnvelope(owner));
  return owner;
}
function context(t, owner, { theme = defaultTheme, assets = {} } = {}) {
  const snapshot = {
    resolved: {
      theme: { id: theme.id, revision: theme.revision },
      collection: structuredClone(theme.collection),
      assets,
    },
  };
  let current = snapshot,
    compiledReads = 0;
  const decodes = [],
    releases = [];
  const decodeImage = async (blob) => {
    const hash = sha(new Uint8Array(await Blob.prototype.arrayBuffer.call(blob)));
    const index = decodes.length;
    const image = { naturalWidth: 1152, naturalHeight: 576, hash, index };
    decodes.push(image);
    return { image, release: () => releases.push(index) };
  };
  const create = (options = {}) => {
    const lease = createCoopPresentation({
      bindings: COOP_PICTURE_BINDINGS,
      historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
      getSnapshot: () => current,
      readPicture: async () => {
        compiledReads++;
        throw new Error('Local artwork must not read a compiled picture');
      },
      decodeImage,
      ...options,
    });
    t.after(() => lease.dispose());
    return lease;
  };
  return {
    snapshot,
    create,
    decodeImage,
    decodes,
    releases,
    get compiledReads() {
      return compiledReads;
    },
    setSnapshot(value) {
      current = value;
    },
    request: {
      pack: structuredClone(owner.pack),
      levelId: owner.pack.levels[0].id,
      themeId: theme.id,
      attemptId: 'local-attempt-1',
      artworkSource: owner,
    },
  };
}
function localPack() {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'local-unregistered-pack';
  return pack;
}

for (const kind of ['registered starter', 'historical import']) {
  test(`${kind}: retained local artwork uses its own pixels with the existing shared snapshot`, async (t) => {
    const owner = await localSource(t, {
      pack: kind === 'registered starter' ? COOP_STARTER_PACK : localPack(),
    });
    const f = context(t, owner),
      lease = f.create();
    const chosen = await lease.select(f.request);
    assert.equal(chosen.snapshot, f.snapshot);
    assert.equal(chosen.choice.sourceKind, 'local-import');
    assert.deepEqual(chosen.choice.presentationReceipt, owner.receipt);
    assert.equal(chosen.choice.packId, owner.pack.id);
    assert.equal(chosen.choice.packSha256, owner.receipt.packSha256);
    assert.equal(chosen.choice.levelId, owner.pack.levels[0].id);
    assert.equal(chosen.choice.levelRevision, owner.pack.levels[0].revision);
    assert.equal(chosen.choice.picture.sha256, sha(defaultPictures[0]));
    assert.equal(chosen.image.hash, sha(defaultPictures[0]));
    assert.equal(chosen.fit, 'contain');
    assert.equal(chosen.sampling, 'nearest');
    assert.equal(Object.hasOwn(chosen.choice.picture, 'slot'), false);
    assert.equal(Object.hasOwn(chosen.choice.picture, 'quality'), false);
    assert.equal(
      Object.keys(f.snapshot.resolved.assets).length,
      0,
      'local import cannot mutate the release registry',
    );
    assert.equal(f.compiledReads, 0);
    assert.equal(lease.confirm(f.request), chosen);
    assert.equal(
      await lease.select(f.request),
      chosen,
      'Retry retains the same accepted decoded image',
    );
    assert.equal(f.decodes.length, 1);
    assert.deepEqual(f.releases, []);
    lease.dispose();
    lease.dispose();
    assert.deepEqual(f.releases, [0]);
  });
}

test('the next retained level resolves its own picture with the same source receipt', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner);
  const firstLease = f.create(),
    nextLease = f.create();
  const first = await firstLease.select(f.request);
  const nextRequest = {
    ...f.request,
    levelId: owner.pack.levels[1].id,
    attemptId: 'local-attempt-2',
  };
  const next = await nextLease.select(nextRequest);
  assert.equal(first.image.hash, sha(defaultPictures[0]));
  assert.equal(next.image.hash, sha(defaultPictures[1]));
  assert.notEqual(first.image.hash, next.image.hash);
  assert.deepEqual(next.choice.presentationReceipt, first.choice.presentationReceipt);
  assert.equal(
    firstLease.confirm(f.request),
    first,
    'candidate preparation does not retire the preceding result',
  );
  assert.deepEqual(f.releases, []);
  nextLease.dispose();
  assert.deepEqual(f.releases, [1]);
  assert.equal(firstLease.confirm(f.request), first);
  assert.equal(f.compiledReads, 0);
});

for (const change of ['pixels', 'metadata']) {
  test(`same gameplay and presentation IDs cannot replace accepted ${change} on Retry`, async (t) => {
    const owner = await localSource(t);
    const replacement = await localSource(
      t,
      change === 'pixels'
        ? { pictures: [png(73), png(74)] }
        : { attribution: 'Different local provenance' },
    );
    assert.deepEqual(owner.pack, replacement.pack);
    assert.deepEqual(owner.receipt.presentation, replacement.receipt.presentation);
    assert.notEqual(owner.receipt.manifestSha256, replacement.receipt.manifestSha256);
    const f = context(t, owner),
      lease = f.create();
    const accepted = await lease.select(f.request);
    await assert.rejects(lease.select({ ...f.request, artworkSource: replacement }));
    assert.throws(() => lease.confirm({ ...f.request, artworkSource: replacement }));
    assert.equal(lease.confirm(f.request), accepted);
    assert.equal(lease.current(), accepted);
    assert.equal(f.decodes.length, 1);
    assert.deepEqual(f.releases, []);
    assert.equal(f.compiledReads, 0);
  });
}

test('an explicit new attempt can use changed local pixels without changing gameplay identity', async (t) => {
  const first = await localSource(t),
    second = await localSource(t, { pictures: [png(91), png(92)] });
  const a = context(t, first),
    b = context(t, second);
  const oldLease = a.create(),
    newLease = b.create();
  const old = await oldLease.select(a.request);
  const fresh = await newLease.select({ ...b.request, attemptId: 'local-replacement' });
  assert.equal(old.choice.packSha256, fresh.choice.packSha256);
  assert.notEqual(old.image.hash, fresh.image.hash);
  assert.equal(oldLease.confirm(a.request), old);
  assert.equal(a.compiledReads + b.compiledReads, 0);
});

test('request gameplay must be exactly the opaque owner pack, including other levels', async (t) => {
  const owner = await localSource(t, { pack: localPack() }),
    f = context(t, owner),
    lease = f.create();
  const changed = structuredClone(f.request.pack);
  changed.levels[1].name = 'A different authored second level';
  await assert.rejects(lease.select({ ...f.request, pack: changed }));
  assert.equal(f.decodes.length, 0);
  assert.equal(f.compiledReads, 0);
});

for (const change of ['selected level', 'other level', 'pack revision']) {
  test(`reserved starter namespace rejects changed ${change} rather than falling through to generic art`, async (t) => {
    const pack = structuredClone(COOP_STARTER_PACK);
    if (change === 'pack revision') pack.revision++;
    else pack.levels[change === 'selected level' ? 0 : 1].name += ' changed';
    const owner = await localSource(t, { pack }),
      f = context(t, owner),
      lease = f.create();
    await assert.rejects(lease.select(f.request));
    assert.equal(f.decodes.length, 0);
    assert.equal(f.compiledReads, 0);
  });
}

test('an additional registered namespace uses its code-owned full-pack identity', async (t) => {
  const pack = localPack();
  pack.id = 'registered-community-pack';
  const owner = await localSource(t, { pack });
  const rows = COOP_PICTURE_BINDINGS.map((row) => ({
    ...structuredClone(row),
    packId: pack.id,
    packRevision: pack.revision,
    packSha256: sha(canonicalJSON(pack)),
  }));
  const f = context(t, owner),
    lease = f.create({ bindings: rows });
  assert.equal((await lease.select(f.request)).choice.sourceKind, 'local-import');
  const changedPack = structuredClone(pack);
  changedPack.levels[1].name += ' changed';
  const changedOwner = await localSource(t, { pack: changedPack });
  const changed = context(t, changedOwner),
    refused = changed.create({ bindings: rows });
  await assert.rejects(refused.select(changed.request));
  assert.equal(changed.decodes.length, 0);
  assert.equal(f.compiledReads + changed.compiledReads, 0);
});

test('nonregistered imports require an explicit compatible generic policy', async (t) => {
  const owner = await localSource(t, { pack: localPack() }),
    f = context(t, owner);
  const lease = f.create({ historicalImportPolicy: null });
  await assert.rejects(lease.select(f.request));
  assert.equal(f.decodes.length, 0);
  assert.equal(f.compiledReads, 0);
});

test('registered exact content can use local art without requiring the generic policy', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner);
  const lease = f.create({ historicalImportPolicy: null });
  const chosen = await lease.select(f.request);
  assert.equal(chosen.choice.sourceKind, 'local-import');
  assert.equal(f.compiledReads, 0);
});

for (const [name, theme] of [
  ['theme ID', { id: 'retro', revision: 32, collection: null }],
  ['theme revision', { id: 'fpv', revision: 33, collection: null }],
  ['collection', { id: 'fpv', revision: 32, collection: { id: 'ornamental', revision: 1 } }],
]) {
  test(`local receipt must match the prepared ${name}`, async (t) => {
    const owner = await localSource(t),
      f = context(t, owner, { theme }),
      lease = f.create();
    await assert.rejects(lease.select(f.request));
    assert.equal(f.decodes.length, 0);
    assert.equal(f.compiledReads, 0);
  });
}

test('matching local and page metadata do not qualify an unregistered collection', async (t) => {
  const theme = { id: 'fpv', revision: 32, collection: { id: 'unqualified', revision: 1 } };
  const owner = await localSource(t, { theme }),
    f = context(t, owner, { theme }),
    lease = f.create();
  await assert.rejects(lease.select(f.request));
  assert.equal(f.decodes.length, 0);
  assert.equal(f.compiledReads, 0);
});

test('an exact registered theme/collection association permits the corresponding local receipt', async (t) => {
  const theme = { id: 'fpv', revision: 32, collection: { id: 'qualified-fixture', revision: 1 } };
  const owner = await localSource(t, { theme }),
    f = context(t, owner, { theme });
  const rows = COOP_PICTURE_BINDINGS.map((row) => ({
    ...structuredClone(row),
    collection: theme.collection,
  }));
  const lease = f.create({ bindings: rows, historicalImportPolicy: null });
  const chosen = await lease.select(f.request);
  assert.deepEqual(chosen.choice.presentationReceipt.theme, theme);
  assert.equal(f.compiledReads, 0);
});

test('typed legacy revisions and 100-character level IDs remain exact local picture identities', async (t) => {
  const pack = localPack();
  pack.levels[0].id = `Field ${'x'.repeat(94)}`;
  pack.levels[0].revision = '2';
  const owner = await localSource(t, { pack }),
    f = context(t, owner),
    lease = f.create();
  const chosen = await lease.select(f.request);
  assert.equal(chosen.choice.levelId.length, 100);
  assert.equal(chosen.choice.levelRevision, '2');
  assert.equal(chosen.image.hash, sha(defaultPictures[0]));
  const changed = structuredClone(f.request.pack);
  changed.levels[0].revision = 2;
  assert.throws(() => lease.confirm({ ...f.request, pack: changed }));
  assert.equal(lease.confirm(f.request), chosen);
});

for (const kind of ['copied owner', 'copied receipt', 'disposed owner']) {
  test(`${kind} cannot supply local source authority`, async (t) => {
    const owner = await localSource(t),
      f = context(t, owner),
      lease = f.create();
    let source = owner;
    if (kind === 'copied owner') source = { ...owner };
    if (kind === 'copied receipt') source = structuredClone(owner);
    if (kind === 'disposed owner') disposeCoopPresentationEnvelope(owner);
    await assert.rejects(lease.select({ ...f.request, artworkSource: source }));
    assert.equal(f.decodes.length, 0);
    assert.equal(f.compiledReads, 0);
  });
}

test('retiring the source invalidates future confirmation but leaves decoder cleanup with its lease', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner),
    lease = f.create();
  await lease.select(f.request);
  disposeCoopPresentationEnvelope(owner);
  assert.throws(() => lease.confirm(f.request));
  await assert.rejects(lease.select(f.request));
  assert.deepEqual(f.releases, []);
  lease.dispose();
  assert.deepEqual(f.releases, [0]);
});

test('shared snapshot changes cannot silently re-theme a retained local attempt', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner),
    lease = f.create();
  const accepted = await lease.select(f.request);
  f.setSnapshot({ ...f.snapshot, resolved: structuredClone(f.snapshot.resolved) });
  assert.throws(() => lease.confirm(f.request));
  await assert.rejects(lease.select(f.request));
  assert.equal(lease.current(), accepted);
  assert.equal(f.decodes.length, 1);
  assert.equal(f.compiledReads, 0);
});

test('late cancelled decode releases only its candidate after an explicit Retry has succeeded', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner);
  const entered = deferred(),
    late = deferred(),
    controller = new AbortController();
  const released = [];
  let calls = 0;
  const lease = f.create({
    async decodeImage() {
      const index = calls++;
      if (index === 0) {
        entered.resolve();
        await late.promise;
      }
      return {
        image: { naturalWidth: 1152, naturalHeight: 576, index },
        release: () => released.push(index),
      };
    },
  });
  const first = lease.select({ ...f.request, signal: controller.signal });
  await entered.promise;
  controller.abort();
  const retry = await lease.select(f.request);
  assert.equal(retry.image.index, 1);
  late.resolve();
  await assert.rejects(first, { name: 'AbortError' });
  assert.equal(lease.current(), retry);
  assert.equal(lease.confirm(f.request), retry);
  assert.deepEqual(released, [0]);
  lease.dispose();
  assert.deepEqual(released, [0, 1]);
  assert.equal(f.compiledReads, 0);
});

test('source retirement during decode rejects late adoption and releases the decoded candidate', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner),
    entered = deferred(),
    late = deferred();
  let releases = 0;
  const lease = f.create({
    decodeImage: async () => {
      entered.resolve();
      await late.promise;
      return { image: { naturalWidth: 1152, naturalHeight: 576 }, release: () => releases++ };
    },
  });
  const waiting = lease.select(f.request);
  await entered.promise;
  disposeCoopPresentationEnvelope(owner);
  late.resolve();
  await assert.rejects(waiting);
  assert.equal(lease.current(), null);
  assert.equal(releases, 1);
  lease.dispose();
  assert.equal(releases, 1);
  assert.equal(f.compiledReads, 0);
});

test('candidate decode failure preserves the separately accepted result and permits explicit retry', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner),
    oldLease = f.create();
  const accepted = await oldLease.select(f.request);
  let fail = true;
  const candidate = f.create({
    decodeImage: async (blob) => {
      if (fail) throw new Error('Modeled local decode failure');
      return f.decodeImage(blob);
    },
  });
  const request = { ...f.request, levelId: owner.pack.levels[1].id, attemptId: 'next-candidate' };
  await assert.rejects(candidate.select(request), /Modeled local decode failure/);
  assert.equal(candidate.current(), null);
  assert.equal(oldLease.confirm(f.request), accepted);
  assert.deepEqual(f.releases, []);
  fail = false;
  const recovered = await candidate.select(request);
  assert.equal(recovered.image.hash, sha(defaultPictures[1]));
  assert.equal(oldLease.confirm(f.request), accepted);
  assert.equal(f.compiledReads, 0);
});

test('ready callback cancellation releases local pixels instead of publishing a binding', async (t) => {
  const owner = await localSource(t),
    f = context(t, owner),
    lease = f.create();
  await assert.rejects(
    lease.select({
      ...f.request,
      onStatus(status) {
        if (status.status === 'ready') lease.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(lease.current(), null);
  assert.deepEqual(f.releases, [0]);
  assert.equal(f.compiledReads, 0);
});

test('a request without a local owner retains the exact compiled reader and reviewed-asset path', async (t) => {
  const owner = await localSource(t),
    imageBytes = defaultPictures[0];
  const asset = validateAssetRevision({
    format: FORMATS.asset,
    id: 'picture.compiled-fixture',
    revision: 1,
    kind: 'image',
    description: 'Injected compiled-reader regression fixture, not production approval.',
    provenance: {
      creator: 'Test',
      source: 'Synthetic memory',
      license: 'CC0',
      prompt: '',
      parent: null,
    },
    file: {
      sha256: sha(imageBytes),
      bytes: imageBytes.length,
      mime: 'image/png',
      width: 1152,
      height: 576,
    },
    recipe: null,
    geometry: {
      frame: { x: 0, y: 0, width: 1152, height: 576 },
      pivot: { x: 0.5, y: 0.5 },
      occupiedBounds: null,
      rotorAnchors: [],
      nineSlice: null,
    },
    quality: { stage: 'reviewed', evidence: ['Injected fixture only.'] },
  });
  const slot = 'scene.reveal.wide';
  const row = {
    ...structuredClone(COOP_PICTURE_BINDINGS[0]),
    picture: {
      slot,
      assetId: asset.id,
      assetRevision: asset.revision,
      ...asset.file,
    },
  };
  const f = context(t, owner, { assets: { [slot]: asset } });
  let reads = 0;
  const lease = f.create({
    bindings: [row],
    readPicture: async (requested, options) => {
      reads++;
      assert.equal(requested, slot);
      assert.equal(options.snapshot, f.snapshot);
      return { asset, blob: new Blob([imageBytes], { type: 'image/png' }) };
    },
  });
  const request = { ...f.request };
  delete request.artworkSource;
  const chosen = await lease.select(request);
  assert.equal(reads, 1);
  assert.equal(chosen.choice.picture.slot, slot);
  assert.notEqual(chosen.choice.sourceKind, 'local-import');
  assert.equal(chosen.image.hash, sha(imageBytes));
  assert.equal(await lease.select(request), chosen);
  assert.equal(reads, 1);
  assert.equal(lease.confirm(request), chosen);
});

test('equal receipt bytes do not let a second opaque owner replace the retained attempt owner', async (t) => {
  const first = await localSource(t),
    second = await localSource(t);
  assert.notEqual(first, second);
  assert.deepEqual(first.receipt, second.receipt);
  const f = context(t, first),
    lease = f.create();
  const accepted = await lease.select(f.request);
  const secondRequest = { ...f.request, artworkSource: second };
  await assert.rejects(lease.select(secondRequest));
  assert.throws(() => lease.confirm(secondRequest));
  assert.equal(lease.confirm(f.request), accepted);
  assert.equal(f.decodes.length, 1);
  assert.deepEqual(f.releases, []);
  const freshRequest = { ...secondRequest, attemptId: 'deliberate-second-owner-attempt' };
  const fresh = await lease.select(freshRequest);
  assert.notEqual(fresh, accepted);
  assert.deepEqual(f.releases, [0]);
  disposeCoopPresentationEnvelope(first);
  assert.equal(lease.confirm(freshRequest), fresh);
  assert.equal(await lease.select(freshRequest), fresh);
  assert.equal(f.decodes.length, 2);
  assert.equal(f.compiledReads, 0);
  lease.dispose();
  assert.deepEqual(f.releases, [0, 1]);
});
