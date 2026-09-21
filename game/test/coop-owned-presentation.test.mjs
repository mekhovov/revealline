import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import {
  readCoopPresentationEnvelope,
  exportCoopPresentationEnvelope,
  disposeCoopPresentationEnvelope,
} from '../coop/presentation-envelope.mjs';
import { createOwnedCoopPresentation } from '../couch/coop-owned-presentation.mjs';
import {
  RETAINED_FPV38_PRESENTATION,
  RETAINED_FPV38_IMPORT_POLICY,
  RETAINED_FPV38_PICTURE_BINDINGS,
} from '../couch/coop-retained-presentation.mjs';

const clone = structuredClone;
const sha = (value) => createHash('sha256').update(value).digest('hex');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const currentRuntimeBytes = await readFile(
  new URL('../presentation/compiled/runtime.json', import.meta.url),
);
const runtimeBytes =
  sha(currentRuntimeBytes) === RETAINED_FPV38_PRESENTATION.sha256
    ? currentRuntimeBytes
    : await readFile(
        new URL(
          `../presentation/compiled/runtime.${RETAINED_FPV38_PRESENTATION.sha256}.json`,
          import.meta.url,
        ),
      );
const manifest = JSON.parse(runtimeBytes);
const original = manifest.resolved.assets['scene.reveal.wide'];
const imageBytes = await readFile(
  new URL(`../presentation/compiled/assets/${original.file.sha256}.png`, import.meta.url),
);
const blob = new Blob([imageBytes], { type: 'image/png' });
const modeledDecode = async () => ({
  image: { naturalWidth: 1152, naturalHeight: 576 },
  release() {},
});
async function envelope(pack, theme = { id: 'fpv', revision: 38, collection: null }) {
  const file = {
    ...original.file,
    provenance: {
      kind: 'user-supplied',
      attribution: 'Existing fixture original',
      source: 'Local immutable release fixture',
    },
  };
  const value = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'owned.team-test',
      revision: 1,
      theme,
      levels: pack.levels.map((level) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: sha(canonicalJSON(level)),
        pictureSha256: original.file.sha256,
      })),
      assets: [file],
    },
  };
  const bytes = Buffer.from(JSON.stringify(value));
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n');
  header.writeUInt32BE(bytes.length, 8);
  const input = new Blob([header, bytes, imageBytes], {
    type: 'application/vnd.revealline.team-presentation',
  });
  return {
    owner: await readCoopPresentationEnvelope(input, { decodeImage: modeledDecode }),
    input,
  };
}
async function fixture({
  pageRevision = 39,
  theme,
  createHostOverride,
  decodeOverride,
  onClose,
  borrowedApply,
  onSnapshot,
} = {}) {
  const pack = clone(COOP_STARTER_PACK);
  pack.id = 'local-owned-fixture';
  const imported = await envelope(pack, theme);
  const oldSnapshot = { ...clone(manifest), manifestSha256: sha(runtimeBytes) };
  const pageSnapshot = clone(oldSnapshot);
  pageSnapshot.source.revision = pageRevision;
  pageSnapshot.resolved.theme.revision = pageRevision;
  if (pageRevision !== 38) pageSnapshot.manifestSha256 = '9'.repeat(64);
  let page = pageSnapshot,
    hosts = 0,
    hostCloses = 0,
    decodes = 0,
    pictureReleases = 0,
    audioReads = 0,
    applies = 0,
    cleanups = 0;
  const decodedImages = [];
  const decodeImage = async (...args) => {
    decodes++;
    const result = decodeOverride ? await decodeOverride(...args) : await modeledDecode();
    decodedImages.push(result.image);
    return {
      image: result.image,
      release() {
        pictureReleases++;
        result.release();
      },
    };
  };
  const createHost = (association) => {
    hosts++;
    assert.deepEqual(association, RETAINED_FPV38_PRESENTATION);
    if (createHostOverride) return createHostOverride(association);
    let snapshot = null;
    return {
      current: () => snapshot,
      async load(options) {
        assert.equal(options.expectedManifestSha256, sha(runtimeBytes));
        snapshot = oldSnapshot;
        return snapshot;
      },
      close() {
        hostCloses++;
        onClose?.();
      },
      async readPicture() {
        return { asset: original, blob };
      },
      async readAudio(slot) {
        audioReads++;
        return { slot, snapshot };
      },
      apply() {
        applies++;
        return () => cleanups++;
      },
    };
  };
  const policy = clone(RETAINED_FPV38_IMPORT_POLICY);
  policy.themeRevision = pageRevision;
  const owner = createOwnedCoopPresentation({
    bindings: RETAINED_FPV38_PICTURE_BINDINGS.map((row) => ({
      ...row,
      themeRevision: pageRevision,
    })),
    historicalImportPolicy: policy,
    getSnapshot: () => {
      onSnapshot?.();
      return page;
    },
    readPicture: async () => ({ asset: original, blob }),
    readAudio: async (slot, options) => {
      audioReads++;
      return { slot, snapshot: options.snapshot };
    },
    decodeImage,
    createHost,
    apply: borrowedApply,
  });
  const request = {
    pack,
    levelId: pack.levels[0].id,
    themeId: 'fpv',
    attemptId: 'owned-1',
    artworkSource: imported.owner,
  };
  return {
    owner,
    request,
    policy,
    imported,
    pageSnapshot,
    oldSnapshot,
    decodedImages,
    setPage: (value) => (page = value),
    counts: () => ({ hosts, hostCloses, decodes, pictureReleases, audioReads, applies, cleanups }),
  };
}
const counts = (f, expected) => {
  for (const [key, value] of Object.entries(expected)) assert.equal(f.counts()[key], value, key);
};
const close = (f) => {
  f.owner.dispose();
  disposeCoopPresentationEnvelope(f.imported.owner);
};

test('known legacy association is the exact shipped runtime, independent of next defaults', () => {
  assert.equal(sha(runtimeBytes), RETAINED_FPV38_PRESENTATION.sha256);
  assert.deepEqual(manifest.source, RETAINED_FPV38_PRESENTATION.source);
  assert.deepEqual(
    { id: manifest.resolved.theme.id, revision: manifest.resolved.theme.revision },
    RETAINED_FPV38_PRESENTATION.theme,
  );
  assert.equal(manifest.resolved.collection, null);
  assert.ok(Object.isFrozen(RETAINED_FPV38_PICTURE_BINDINGS));
});

test('matching current immutable legacy snapshot is borrowed; Retry/confirm share image and do not close page', async () => {
  const f = await fixture({ pageRevision: 38 });
  const result = await f.owner.select(f.request);
  assert.equal(result.snapshot, f.pageSnapshot);
  assert.equal(f.owner.snapshot(), result.snapshot);
  assert.equal(await f.owner.select(f.request), result);
  assert.equal(f.owner.confirm(f.request), result);
  const cleanup = f.owner.apply({});
  cleanup();
  cleanup();
  assert.equal((await f.owner.readAudio('audio.capture')).snapshot, f.pageSnapshot);
  counts(f, { hosts: 0, decodes: 1, pictureReleases: 0 });
  f.owner.cancel();
  assert.equal(f.owner.confirm(f.request), result);
  close(f);
  f.owner.dispose();
  counts(f, { hostCloses: 0, pictureReleases: 1 });
  assert.equal(f.owner.current(), null);
  assert.equal(f.owner.snapshot(), null);
});

test('fpv38 envelope under newer default owns exact retained theme + original picture without editing receipt', async () => {
  const f = await fixture();
  const receipt = canonicalJSON(f.imported.owner.receipt),
    bytes = Buffer.from(await f.imported.input.arrayBuffer());
  const result = await f.owner.select(f.request);
  assert.equal(result.snapshot, f.oldSnapshot);
  assert.notEqual(result.snapshot, f.pageSnapshot);
  assert.equal(result.choice.themeRevision, 38);
  assert.equal(result.choice.presentationReceipt, f.imported.owner.receipt);
  assert.equal(await f.owner.select(f.request), result);
  const cleanup = f.owner.apply({});
  cleanup();
  cleanup();
  const second = f.owner.apply({});
  assert.equal((await f.owner.readAudio('audio.capture')).snapshot, f.oldSnapshot);
  assert.equal(canonicalJSON(f.imported.owner.receipt), receipt);
  assert.deepEqual(
    Buffer.from(await exportCoopPresentationEnvelope(f.imported.owner).arrayBuffer()),
    bytes,
  );
  close(f);
  second();
  counts(f, { hosts: 1, hostCloses: 1, decodes: 1, pictureReleases: 1, applies: 2, cleanups: 2 });
});

test('fresh non-envelope attempt uses new page snapshot and matching default picture policy', async () => {
  const f = await fixture();
  const request = { ...f.request, artworkSource: null };
  const result = await f.owner.select(request);
  assert.equal(result.snapshot, f.pageSnapshot);
  assert.equal(result.choice.themeRevision, 39);
  counts(f, { hosts: 0, decodes: 1 });
  close(f);
});

test('foreign receipt and unauthenticated owner fail before any theme transport or decoder', async () => {
  const f = await fixture({ theme: { id: 'fpv', revision: 37, collection: null } });
  await assert.rejects(f.owner.select(f.request), /No trusted exact retained/);
  await assert.rejects(
    f.owner.select({
      ...f.request,
      attemptId: 'foreign-owner',
      artworkSource: clone(f.imported.owner),
    }),
    /artwork source is unavailable/i,
  );
  counts(f, { hosts: 0, decodes: 0 });
  close(f);
});

test('wrong legacy source/hash never borrows; missing retained manifest fails without fallback', async () => {
  let closes = 0;
  const f = await fixture({
    pageRevision: 38,
    createHostOverride: () => ({
      current: () => null,
      async load() {
        throw Error('Exact manifest is missing');
      },
      close() {
        closes++;
      },
    }),
  });
  f.pageSnapshot.manifestSha256 = 'b'.repeat(64);
  await assert.rejects(f.owner.select(f.request), /Exact manifest is missing/);
  assert.equal(f.owner.current(), null);
  assert.equal(closes, 1);
  counts(f, { hosts: 1, decodes: 0 });
  close(f);
});

test('retained transport cannot substitute the latest manifest or wrong source revision', async () => {
  let closes = 0;
  const f = await fixture({
    createHostOverride: () => ({
      current: () => null,
      async load() {
        return f.pageSnapshot;
      },
      close() {
        closes++;
      },
    }),
  });
  await assert.rejects(f.owner.select(f.request), /manifest|identity|different|match/i);
  assert.equal(closes, 1);
  counts(f, { decodes: 0 });
  close(f);
});

test('failed preparation keeps previous picture, theme and exact confirmation usable', async () => {
  const f = await fixture();
  const old = await f.owner.select(f.request);
  const changed = clone(f.request.pack);
  changed.levels[1].name += ' changed';
  await assert.rejects(
    f.owner.select({ ...f.request, pack: changed, attemptId: 'wrong-pack' }),
    /different exact pack/,
  );
  assert.equal(f.owner.current(), old);
  assert.equal(f.owner.confirm(f.request), old);
  await assert.rejects(
    f.owner.select({ ...f.request, levelId: changed.levels[1].id }),
    /Retry must retain/,
  );
  counts(f, { hosts: 1, hostCloses: 0, pictureReleases: 0 });
  close(f);
});

test('failed later picture decode releases staged theme and retains accepted owner', async () => {
  let calls = 0;
  const f = await fixture({
    decodeOverride: async () => {
      if (++calls === 2) throw Error('decode blocked');
      return modeledDecode();
    },
  });
  const old = await f.owner.select(f.request);
  await assert.rejects(
    f.owner.select({ ...f.request, attemptId: 'next', levelId: f.request.pack.levels[1].id }),
    /decode blocked/,
  );
  assert.equal(f.owner.confirm(f.request), old);
  counts(f, { hosts: 2, hostCloses: 1, pictureReleases: 0 });
  close(f);
  counts(f, { hostCloses: 2, pictureReleases: 1 });
});

test('cancelled late theme load closes once and leaves previous borrowed attempt usable', async () => {
  const gate = deferred();
  let started = deferred(),
    closes = 0;
  const f = await fixture({
    createHostOverride: () => ({
      current: () => null,
      async load() {
        started.resolve();
        await gate.promise;
        return f.oldSnapshot;
      },
      close() {
        closes++;
      },
    }),
  });
  const first = { ...f.request, artworkSource: null },
    old = await f.owner.select(first);
  const pending = f.owner.select({ ...f.request, attemptId: 'retained-late' });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  f.owner.cancel();
  assert.equal(f.owner.confirm(first), old);
  gate.resolve();
  await rejected;
  assert.equal(closes, 1);
  assert.equal(f.owner.current(), old);
  counts(f, { decodes: 1, pictureReleases: 0 });
  close(f);
});

test('stale late decoder releases its picture and theme once while newer selection wins', async () => {
  const gate = deferred(),
    started = deferred();
  let calls = 0;
  const f = await fixture({
    decodeOverride: async () => {
      if (++calls === 1) {
        started.resolve();
        await gate.promise;
      }
      return modeledDecode();
    },
  });
  const pending = f.owner.select(f.request),
    rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  const next = { ...f.request, attemptId: 'next', levelId: f.request.pack.levels[1].id };
  const current = await f.owner.select(next);
  gate.resolve();
  await rejected;
  assert.equal(f.owner.confirm(next), current);
  counts(f, { hosts: 2, hostCloses: 1, pictureReleases: 1 });
  close(f);
  counts(f, { hostCloses: 2, pictureReleases: 2 });
});

test('signal after adopted readiness does not close retained owner; dispose during decode owns late cleanup', async () => {
  const controller = new AbortController();
  const f = await fixture();
  const current = await f.owner.select({ ...f.request, signal: controller.signal });
  controller.abort();
  assert.equal(f.owner.confirm(f.request), current);
  counts(f, { hostCloses: 0, pictureReleases: 0 });
  close(f);
  const gate = deferred(),
    started = deferred();
  const g = await fixture({
    decodeOverride: async () => {
      started.resolve();
      await gate.promise;
      return modeledDecode();
    },
  });
  const pending = g.owner.select(g.request),
    rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  g.owner.dispose();
  gate.resolve();
  await rejected;
  counts(g, { hostCloses: 1, pictureReleases: 1 });
  assert.equal(g.owner.current(), null);
  close(g);
});

test('ready callback cancellation cannot publish the staged result or replace accepted owner', async () => {
  const f = await fixture();
  const first = { ...f.request, artworkSource: null },
    current = await f.owner.select(first);
  await assert.rejects(
    f.owner.select({
      ...f.request,
      attemptId: 'ready-cancel',
      onStatus(status) {
        if (status.status === 'ready') f.owner.cancel();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(f.owner.confirm(first), current);
  counts(f, { hostCloses: 1, pictureReleases: 1 });
  close(f);
});

test('snapshot replacement rejects borrowed confirmation; exact retained reader remains independent', async () => {
  const f = await fixture({ pageRevision: 38 });
  await f.owner.select(f.request);
  f.setPage(clone(f.pageSnapshot));
  assert.throws(() => f.owner.confirm(f.request), /changed/);
  close(f);
  const g = await fixture();
  const chosen = await g.owner.select(g.request);
  g.setPage(null);
  assert.equal(g.owner.confirm(g.request), chosen);
  close(g);
});

test('request copies precede async preparation; changed same attempt cannot reuse a retained picture', async () => {
  const f = await fixture();
  const pending = f.owner.select(f.request);
  f.request.pack.levels[0].name = 'changed outside';
  const chosen = await pending;
  assert.equal(chosen.choice.packSha256, f.imported.owner.receipt.packSha256);
  await assert.rejects(f.owner.select(f.request), /different exact pack/);
  close(f);
});

test('same pending request shares operation; successful successor retires previous exact owners once', async () => {
  const gate = deferred(),
    started = deferred();
  let calls = 0;
  const f = await fixture({
    decodeOverride: async () => {
      if (++calls === 2) {
        started.resolve();
        await gate.promise;
      }
      return modeledDecode();
    },
  });
  const old = await f.owner.select(f.request);
  const next = { ...f.request, attemptId: 'successor', levelId: f.request.pack.levels[1].id };
  const pending = f.owner.select(next);
  assert.equal(f.owner.select(next), pending);
  await started.promise;
  assert.equal(f.owner.current(), old);
  assert.equal(f.owner.confirm(f.request), old);
  gate.resolve();
  const chosen = await pending;
  assert.notEqual(chosen, old);
  counts(f, { hosts: 2, hostCloses: 1, pictureReleases: 1 });
  assert.equal(f.owner.confirm(next), chosen);
  close(f);
  counts(f, { hostCloses: 2, pictureReleases: 2 });
});

test('configuration is captured at wrapper creation and borrowed apply cleanup retires once', async () => {
  let cleanups = 0,
    calls = 0;
  const f = await fixture({
    borrowedApply() {
      calls++;
      return () => cleanups++;
    },
  });
  f.policy.themeRevision = 999;
  const request = { ...f.request, artworkSource: null };
  const current = await f.owner.select(request);
  assert.equal(current.choice.themeRevision, 39);
  const cleanup = f.owner.apply({});
  close(f);
  cleanup();
  assert.equal(calls, 1);
  assert.equal(cleanups, 1);
});

test('unsupported collection and missing page readiness never create a retained host', async () => {
  const f = await fixture({
    theme: { id: 'fpv', revision: 38, collection: { id: 'foreign', revision: 1 } },
  });
  await assert.rejects(f.owner.select(f.request), /No trusted exact retained/);
  counts(f, { hosts: 0, decodes: 0 });
  close(f);
  const g = await fixture();
  g.setPage(null);
  await assert.rejects(g.owner.select(g.request), /No prepared Team theme/);
  counts(g, { hosts: 0, decodes: 0 });
  close(g);
});

test('reserved starter pack import retains exact historical rows without allowing same-ID gameplay replacement', async () => {
  const f = await fixture();
  const source = await envelope(clone(COOP_STARTER_PACK));
  const request = { ...f.request, pack: source.owner.pack, artworkSource: source.owner };
  const ready = await f.owner.select(request);
  assert.equal(ready.choice.packSha256, RETAINED_FPV38_PICTURE_BINDINGS[0].packSha256);
  const modified = clone(COOP_STARTER_PACK);
  modified.levels[1].name += ' changed';
  const other = await envelope(modified);
  await assert.rejects(
    f.owner.select({
      ...request,
      attemptId: 'changed-starter',
      pack: other.owner.pack,
      artworkSource: other.owner,
    }),
    /reserved Team pack identity/,
  );
  assert.equal(f.owner.confirm(request), ready);
  close(f);
  disposeCoopPresentationEnvelope(source.owner);
  disposeCoopPresentationEnvelope(other.owner);
});

test('Retry cleanup reentry cannot return an accepted binding disposed by staged-theme cleanup', async () => {
  const gate = deferred(),
    started = deferred();
  let calls = 0;
  const f = await fixture({
    onClose() {
      f.owner.dispose();
    },
    decodeOverride: async () => {
      if (++calls === 2) {
        started.resolve();
        await gate.promise;
      }
      return modeledDecode();
    },
  });
  const first = { ...f.request, artworkSource: null };
  await f.owner.select(first);
  const pending = f.owner.select({ ...f.request, attemptId: 'pending' });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await started.promise;
  await assert.rejects(f.owner.select(first), { name: 'AbortError' });
  gate.resolve();
  await rejected;
  assert.equal(f.owner.current(), null);
  counts(f, { hostCloses: 1, pictureReleases: 2 });
  close(f);
});

test('borrowed snapshot-reader disposal reentry aborts confirm/apply/audio before owner access', async () => {
  for (const method of ['confirm', 'apply', 'readAudio']) {
    let armed = false;
    const f = await fixture({
      pageRevision: 38,
      onSnapshot() {
        if (armed) f.owner.dispose();
      },
    });
    await f.owner.select(f.request);
    armed = true;
    assert.throws(
      () =>
        f.owner[method](
          method === 'confirm' ? f.request : method === 'apply' ? {} : 'audio.capture',
        ),
      { name: 'AbortError' },
    );
    assert.equal(f.owner.current(), null);
    counts(f, { audioReads: 0, applies: 0, pictureReleases: 1 });
    close(f);
  }
});
