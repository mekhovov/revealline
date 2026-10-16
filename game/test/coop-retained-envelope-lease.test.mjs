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
import { COOP_RETAINED_PRESENTATIONS } from '../couch/coop-retained-presentation.mjs';
import {
  COOP_SUPPORTED_PICTURE_BINDINGS,
  COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
} from '../couch/coop-picture-bindings.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => (resolve = done));
  return { promise, resolve };
};
const page = JSON.parse(
  await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url)),
);

// Reconstructed historical envelopes use published exact manifests and original
// PNGs. Native decoding and public/offline play remain separate qualification.
async function fixture(t, revision = 38, overrides = {}) {
  const association = COOP_RETAINED_PRESENTATIONS.find((row) => row.theme.revision === revision);
  const rawRuntime = await readFile(
    new URL(`../presentation/compiled/runtime.${association.sha256}.json`, import.meta.url),
  );
  const snapshot = { ...JSON.parse(rawRuntime), manifestSha256: hash(rawRuntime) };
  const picture = association.bindings[0].picture;
  const bytes = await readFile(
    new URL(`../presentation/compiled/${snapshot.urls[picture.sha256]}`, import.meta.url),
  );
  const pack = structuredClone(COOP_STARTER_PACK);
  const manifest = {
    format: 'revealline-team-presentation-envelope.v1',
    pack,
    packSha256: hash(canonicalJSON(pack)),
    presentation: {
      id: 'reconstructed-historical-team',
      revision: 1,
      theme: overrides.theme ?? { ...association.theme, collection: null },
      levels: pack.levels.map((level) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: hash(canonicalJSON(level)),
        pictureSha256: picture.sha256,
      })),
      assets: [
        {
          sha256: picture.sha256,
          bytes: bytes.length,
          mime: 'image/png',
          width: 1152,
          height: 576,
          provenance: {
            kind: 'user-supplied',
            attribution: 'Original Reveal Line art; reconstructed compatibility fixture',
            source: revision === 38 ? 'v0.77.0' : 'v0.78.0',
          },
        },
      ],
    },
  };
  const encoded = Buffer.from(JSON.stringify(manifest));
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n');
  header.writeUInt32BE(encoded.length, 8);
  const original = new Blob([header, encoded, bytes]);
  const decodeImage = async () => ({
    image: { naturalWidth: 1152, naturalHeight: 576 },
    release() {},
  });
  const source = await readCoopPresentationEnvelope(original, { decodeImage });
  t.after(() => disposeCoopPresentationEnvelope(source));
  const calls = { loads: 0, closes: 0, pictures: 0, releases: 0, audio: 0 };
  const request = {
    pack,
    artworkSource: source,
    levelId: pack.levels[0].id,
    themeId: 'fpv',
    attemptId: 'old-team-attempt',
  };
  const create = (options = {}) => {
    const lease = createOwnedCoopPresentation({
      artworkSource: source,
      bindings: COOP_SUPPORTED_PICTURE_BINDINGS,
      historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICIES,
      getSnapshot: () => page,
      readPicture() {
        throw new Error('An envelope must use its owned image.');
      },
      decodeImage: async () => {
        calls.pictures++;
        return {
          image: { naturalWidth: 1152, naturalHeight: 576 },
          release: () => calls.releases++,
        };
      },
      createHost(pin) {
        assert.equal(pin, association);
        return {
          async load(options) {
            calls.loads++;
            assert.equal(options.expectedManifestSha256, association.sha256);
            await overrides.load?.(options);
            return overrides.snapshot ?? snapshot;
          },
          readAudio(slot, options) {
            calls.audio++;
            assert.equal(options.snapshot, snapshot);
            return { slot, blob: new Blob() };
          },
          close: () => calls.closes++,
        };
      },
      ...options,
    });
    t.after(() => lease.dispose());
    return lease;
  };
  return { association, snapshot, bytes, source, original, request, pack, calls, create };
}

for (const revision of [38, 50]) {
  test(`fpv${revision} imports its exact published theme and keeps picture/owner through Retry and Next`, async (t) => {
    const f = await fixture(t, revision);
    const lease = f.create();
    const ready = await lease.select(f.request);
    assert.equal(ready.snapshot, f.snapshot);
    assert.equal(ready.choice.themeRevision, revision);
    assert.equal(ready.choice.picture.sha256, hash(f.bytes));
    assert.equal(lease.confirm(f.request), ready);
    assert.equal(await lease.select(f.request), ready);
    assert.equal(f.calls.loads, 1);
    const next = { ...f.request, levelId: f.pack.levels[1].id, attemptId: 'next-team-attempt' };
    const successor = await lease.select(next);
    assert.equal(successor.snapshot, f.snapshot);
    assert.equal(lease.confirm(next), successor);
    assert.equal(f.calls.loads, 2);
    assert.deepEqual(
      await exportCoopPresentationEnvelope(f.source).arrayBuffer(),
      await f.original.arrayBuffer(),
    );
    assert.equal(lease.readAudio('audio.capture', { snapshot: f.snapshot }).slot, 'audio.capture');
    assert.throws(
      () => lease.readAudio('audio.capture', { snapshot: page }),
      /presentation changed|new attempt/i,
    );
    lease.dispose();
    lease.dispose();
    assert.equal(f.calls.closes, 2);
    assert.equal(f.calls.releases, 2);
  });
}

test('historical manifest substitution cannot publish a prepared image', async (t) => {
  const f = await fixture(t, 50, { snapshot: { ...page, manifestSha256: '0'.repeat(64) } });
  const lease = f.create();
  await assert.rejects(lease.select(f.request), /prepared Team theme/);
  assert.equal(lease.current(), null);
  assert.equal(f.calls.pictures, 0);
  assert.equal(f.calls.closes, 1);
});

test('cancelled late acquisition retires its host and permits a deliberate new preparation', async (t) => {
  const wait = deferred();
  const entered = deferred();
  let delayed = true;
  const f = await fixture(t, 38, {
    load: async () => {
      entered.resolve();
      if (delayed) await wait.promise;
    },
  });
  const lease = f.create();
  const pending = lease.select(f.request);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  lease.cancel();
  delayed = false;
  const replacement = lease.select({ ...f.request, attemptId: 'replacement' });
  wait.resolve();
  await rejected;
  const ready = await replacement;
  assert.equal(lease.current(), ready);
  assert.equal(f.calls.closes, 1);
  lease.dispose();
  assert.equal(f.calls.closes, 2);
});

test('signal cancellation after readiness does not retire the accepted picture or theme', async (t) => {
  const f = await fixture(t);
  const lease = f.create();
  const controller = new AbortController();
  const ready = await lease.select({ ...f.request, signal: controller.signal });
  controller.abort();
  assert.equal(lease.confirm(f.request), ready);
  assert.equal(f.calls.closes, 0);
});

test('forged owner, mutated request and disposed source cannot reuse retained resources', async (t) => {
  const f = await fixture(t);
  const lease = f.create();
  const ready = await lease.select(f.request);
  await assert.rejects(
    lease.select({ ...f.request, artworkSource: { ...f.source } }),
    /exact accepted pack/,
  );
  const changed = structuredClone(f.pack);
  changed.name = 'Changed same-id pack';
  await assert.rejects(lease.select({ ...f.request, pack: changed }), /different exact pack/);
  assert.equal(lease.confirm(f.request), ready);
  disposeCoopPresentationEnvelope(f.source);
  assert.throws(() => lease.confirm(f.request), /unavailable|released/);
  assert.throws(
    () => lease.readAudio('audio.capture', { snapshot: f.snapshot }),
    /unavailable|released/,
  );
});

test('ready callback disposal cannot return an orphaned retained snapshot', async (t) => {
  const f = await fixture(t);
  const lease = f.create();
  await assert.rejects(
    lease.select({
      ...f.request,
      onStatus(status) {
        if (status.status === 'ready') lease.dispose();
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(lease.current(), null);
  assert.equal(f.calls.closes, 1);
  assert.equal(f.calls.releases, 1);
});

test('failed successor leaves the old exact picture, confirmation and audio available', async (t) => {
  let fail = false;
  const f = await fixture(t, 50, {
    load: async () => {
      if (fail) throw new Error('Historical runtime temporarily unavailable');
    },
  });
  const lease = f.create();
  const first = await lease.select(f.request);
  fail = true;
  await assert.rejects(
    lease.select({ ...f.request, levelId: f.pack.levels[1].id, attemptId: 'failed-next' }),
    /temporarily unavailable/,
  );
  assert.equal(lease.current(), first);
  assert.equal(lease.confirm(f.request), first);
  assert.equal(lease.readAudio('audio.capture', { snapshot: f.snapshot }).slot, 'audio.capture');
  assert.equal(f.calls.releases, 0);
  assert.equal(f.calls.closes, 1);
});

test('same pending request keeps its original abort owner instead of borrowing later callers', async (t) => {
  const entered = deferred();
  const wait = deferred();
  const f = await fixture(t, 38, {
    load: async () => {
      entered.resolve();
      await wait.promise;
    },
  });
  const lease = f.create();
  const owner = new AbortController();
  const observer = new AbortController();
  const pending = lease.select({ ...f.request, signal: owner.signal });
  await entered.promise;
  const joined = lease.select({ ...f.request, signal: observer.signal });
  assert.equal(joined, pending);
  observer.abort();
  wait.resolve();
  const ready = await pending;
  assert.equal(lease.confirm(f.request), ready);
  assert.equal(f.calls.loads, 1);
  assert.equal(f.calls.closes, 0);
});

test('ordinary current-theme envelopes keep the page host without acquiring a historical runtime', async (t) => {
  const f = await fixture(t, 38, {
    theme: { id: page.resolved.theme.id, revision: page.resolved.theme.revision, collection: null },
  });
  const lease = f.create();
  const ready = await lease.select(f.request);
  assert.equal(ready.snapshot, page);
  assert.equal(f.calls.loads, 0);
  assert.equal(lease.readAudio, undefined);
});

test('an ambiguous later numeric lineage is not authorized by the historical association', async (t) => {
  const f = await fixture(t, 38, { theme: { id: 'fpv', revision: 101, collection: null } });
  const lease = f.create();
  await assert.rejects(lease.select(f.request), /exact accepted pack and prepared theme/);
  assert.equal(f.calls.loads, 0);
  assert.equal(lease.current(), null);
});
