import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { createCoopPresentationImport } from '../couch/coop-import-source.mjs';
import {
  COOP_PRESENTATION_FORMAT,
  COOP_PRESENTATION_MIME,
  exportCoopPresentationEnvelope,
  readCoopPresentationPicture,
  disposeCoopPresentationEnvelope,
} from '../coop/presentation-envelope.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const busy = /previous Team artwork import is still finishing/;
const unavailable = /unavailable or has been released/;
const wrongOwner = /current fully prepared Team artwork candidate/;
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => (resolve = yes));
  return { promise, resolve };
};

function png() {
  // Complete in-memory PNG; qualification decoding is explicitly modeled below.
  // This fixture construction mirrors the independently owned reader tests.
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
  header.writeUInt32BE(1152);
  header.writeUInt32BE(576, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.alloc((1152 * 4 + 1) * 576))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const pictureBytes = png();
function fixture(revision = 1) {
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'local-import-owner-test';
  const pictureSha256 = sha(pictureBytes);
  const manifest = {
    format: COOP_PRESENTATION_FORMAT,
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'local.owner-test',
      revision,
      theme: { id: 'fpv', revision: 32, collection: null },
      levels: pack.levels.map((level) => ({
        levelId: level.id,
        levelRevision: level.revision,
        levelSha256: sha(canonicalJSON(level)),
        pictureSha256,
      })),
      assets: [
        {
          sha256: pictureSha256,
          bytes: pictureBytes.length,
          mime: 'image/png',
          width: 1152,
          height: 576,
          provenance: {
            kind: 'user-supplied',
            attribution: 'Synthetic ownership fixture',
            source: 'Memory',
          },
        },
      ],
    },
  };
  // Noncanonical whitespace makes exact original preservation meaningful.
  const body = Buffer.from(` \n${JSON.stringify(manifest, null, 2)}\n `);
  const header = Buffer.alloc(12);
  header.write('RLTEAM1\n', 'ascii');
  header.writeUInt32BE(body.length, 8);
  return new Blob([header, body, pictureBytes], { type: COOP_PRESENTATION_MIME });
}

function decoder(hook) {
  const calls = [],
    releases = [];
  const decodeImage = async (blob, options) => {
    const index = calls.length;
    calls.push({ blob, options });
    assert.ok(blob instanceof Blob);
    assert.equal(blob.type, 'image/png');
    assert.equal(options.signal, undefined, 'qualification decode is not abandoned on user abort');
    await hook?.(index);
    return {
      image: { naturalWidth: 1152, naturalHeight: 576 },
      release() {
        assert.ok(!releases.includes(index), 'each acquired decode lease releases exactly once');
        releases.push(index);
      },
    };
  };
  return { decodeImage, calls, releases };
}
const bytes = async (blob) => new Uint8Array(await Blob.prototype.arrayBuffer.call(blob));
const assertDead = (owner) => {
  assert.throws(() => exportCoopPresentationEnvelope(owner), unavailable);
  assert.throws(() => readCoopPresentationPicture(owner, owner.pack.levels[0]), unavailable);
};

test('preparation stages an opaque candidate; explicit commit preserves exact originals', async (t) => {
  const d = decoder(),
    manager = createCoopPresentationImport(d),
    source = fixture();
  t.after(() => manager.dispose());
  assert.ok(Object.isFrozen(manager));
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), false);
  assert.throws(() => manager.exportCurrent(), unavailable);
  const owner = await manager.prepare(source);
  assert.ok(Object.isFrozen(owner));
  assert.ok(Object.isFrozen(owner.receipt));
  assert.equal(manager.pending(), false);
  assert.equal(manager.current(), null, 'ready is not accepted');
  assert.equal(manager.commit(owner), owner);
  assert.equal(manager.current(), owner);
  assert.deepEqual(await bytes(manager.exportCurrent()), await bytes(source));
  for (const level of owner.pack.levels)
    assert.deepEqual(
      await bytes(readCoopPresentationPicture(owner, level).blob),
      new Uint8Array(pictureBytes),
    );
  assert.throws(
    () => manager.commit(owner),
    wrongOwner,
    'repeat commit rejects without retiring current',
  );
  assert.equal(manager.current(), owner);
  assert.deepEqual(await bytes(manager.exportCurrent()), await bytes(source));
  assert.deepEqual(d.releases, [0]);
});

test('replacement invalidates only superseded candidates and commits accepted ownership atomically', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture(1)));
  const stale = await manager.prepare(fixture(2));
  const next = await manager.prepare(fixture(3));
  assertDead(stale);
  assert.throws(() => manager.commit(stale), wrongOwner);
  assert.equal(manager.current(), accepted);
  assert.equal(exportCoopPresentationEnvelope(accepted), manager.exportCurrent());
  manager.commit(next);
  assertDead(accepted);
  assert.equal(manager.current(), next);
  const discarded = await manager.prepare(fixture(4));
  await assert.rejects(
    manager.prepare(new Blob(['invalid envelope'])),
    /Unsupported Team artwork file/,
  );
  assertDead(discarded);
  assert.equal(manager.current(), next);
  assert.equal(manager.pending(), false);
  assert.equal(manager.cancel(), false);
});

test('forged and foreign owners cannot consume a valid ready candidate', async (t) => {
  const first = createCoopPresentationImport(decoder()),
    second = createCoopPresentationImport(decoder());
  t.after(() => {
    first.dispose();
    second.dispose();
  });
  const own = await first.prepare(fixture()),
    foreign = await second.prepare(fixture());
  assert.throws(() => first.commit({ ...own }), wrongOwner);
  assert.throws(() => first.commit(foreign), wrongOwner);
  assert.equal(first.current(), null);
  assert.equal(second.current(), null);
  first.commit(own);
  second.commit(foreign);
  assert.equal(first.current(), own);
  assert.equal(second.current(), foreign);
});

test('cancel retains accepted state and Busy ownership until a held decoder settles', async (t) => {
  const entered = deferred(),
    finish = deferred();
  const d = decoder(async (index) => {
    if (index === 1) {
      entered.resolve();
      await finish.promise;
    }
  });
  const manager = createCoopPresentationImport(d);
  t.after(() => {
    finish.resolve();
    manager.dispose();
  });
  const accepted = manager.commit(await manager.prepare(fixture()));
  const pending = manager.prepare(fixture(2));
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  assert.equal(manager.pending(), true);
  assert.equal(manager.cancel(), true);
  assert.equal(manager.cancel(), false);
  assert.equal(manager.pending(), true);
  let extraProgress = 0;
  for (let i = 0; i < 3; i++)
    await assert.rejects(manager.prepare(fixture(3), { onProgress: () => extraProgress++ }), busy);
  assert.equal(extraProgress, 0);
  assert.equal(d.calls.length, 2);
  assert.deepEqual(d.releases, [0]);
  assert.equal(manager.current(), accepted);
  assert.equal(manager.exportCurrent(), exportCoopPresentationEnvelope(accepted));
  finish.resolve();
  await rejected;
  assert.equal(manager.pending(), false);
  assert.deepEqual(d.releases, [0, 1]);
  const replacement = await manager.prepare(fixture(4));
  manager.commit(replacement);
  assert.equal(manager.current(), replacement);
  assertDead(accepted);
  assert.deepEqual(d.releases, [0, 1, 2]);
});

test('external abort retains Busy until decoding releases and does not publish a candidate', async (t) => {
  const entered = deferred(),
    finish = deferred(),
    controller = new AbortController();
  const d = decoder(async () => {
    entered.resolve();
    await finish.promise;
  });
  const manager = createCoopPresentationImport(d);
  t.after(() => {
    finish.resolve();
    manager.dispose();
  });
  const pending = manager.prepare(fixture(), { signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  controller.abort();
  assert.equal(manager.pending(), true);
  await assert.rejects(manager.prepare(fixture()), busy);
  assert.deepEqual(d.releases, []);
  finish.resolve();
  await rejected;
  assert.deepEqual(d.releases, [0]);
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), false);
  assert.equal(manager.cancel(), false);
});

test('abort after readiness rejects commit, while an already-aborted replacement preserves readiness', async (t) => {
  const manager = createCoopPresentationImport(decoder()),
    controller = new AbortController();
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  const candidate = await manager.prepare(fixture(2), { signal: controller.signal });
  const early = new AbortController();
  early.abort();
  await assert.rejects(manager.prepare(fixture(3), { signal: early.signal }), {
    name: 'AbortError',
  });
  assert.ok(exportCoopPresentationEnvelope(candidate));
  controller.abort();
  assert.throws(() => manager.commit(candidate), { name: 'AbortError' });
  assertDead(candidate);
  assert.equal(manager.current(), accepted);
  assert.ok(manager.exportCurrent());
  assert.equal(manager.cancel(), false);
});

test('manifest status reentry cannot replace the pending operation or commit the old accepted owner', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  let reentry,
    stages = [];
  const ready = await manager.prepare(fixture(2), {
    onProgress(progress) {
      stages.push(progress.stage);
      assert.equal(manager.pending(), true);
      assert.equal(manager.current(), accepted);
      if (progress.stage === 'manifest') {
        reentry = assert.rejects(manager.prepare(fixture(3)), busy);
        assert.throws(() => manager.commit(accepted), wrongOwner);
      }
    },
  });
  await reentry;
  assert.deepEqual(stages, ['manifest', 'checking-picture', 'ready']);
  assert.equal(manager.current(), accepted);
  manager.commit(ready);
  assert.equal(manager.current(), ready);
});

for (const action of ['cancel', 'dispose']) {
  test(`ready callback ${action} cannot publish or resurrect the completed candidate`, async (t) => {
    const manager = createCoopPresentationImport(decoder());
    t.after(() => manager.dispose());
    const accepted = manager.commit(await manager.prepare(fixture()));
    let nested;
    await assert.rejects(
      manager.prepare(fixture(2), {
        onProgress({ stage }) {
          if (stage !== 'ready') return;
          assert.equal(manager[action](), true);
          assert.equal(manager.pending(), true);
          nested = assert.rejects(
            manager.prepare(fixture(3)),
            action === 'cancel' ? busy : /closed/,
          );
        },
      }),
      { name: 'AbortError' },
    );
    await nested;
    assert.equal(manager.pending(), false);
    if (action === 'cancel') {
      assert.equal(manager.current(), accepted);
      assert.ok(manager.exportCurrent());
      manager.commit(await manager.prepare(fixture(4)));
      assertDead(accepted);
    } else {
      assert.equal(manager.current(), null);
      assertDead(accepted);
      await assert.rejects(manager.prepare(fixture(4)), /closed/);
    }
  });
}

test('decoder release callback reentry cannot start another import before cancellation settles', async (t) => {
  let manager,
    nested,
    releases = 0;
  manager = createCoopPresentationImport({
    async decodeImage() {
      return {
        image: { naturalWidth: 1152, naturalHeight: 576 },
        release() {
          releases++;
          assert.equal(manager.pending(), true);
          assert.equal(manager.cancel(), true);
          nested = assert.rejects(manager.prepare(fixture(2)), busy);
        },
      };
    },
  });
  t.after(() => manager.dispose());
  await assert.rejects(manager.prepare(fixture()), { name: 'AbortError' });
  await nested;
  assert.equal(releases, 1);
  assert.equal(manager.pending(), false);
  assert.equal(manager.current(), null);
});

test('decoder and final progress callback failures preserve accepted state and unlock replacement', async (t) => {
  const failure = new Error('Intentional decoder failure');
  let failDecode = false;
  const d = decoder(() => {
    if (failDecode) throw failure;
  });
  const manager = createCoopPresentationImport(d);
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  failDecode = true;
  await assert.rejects(manager.prepare(fixture(2)), (error) => error === failure);
  assert.equal(manager.current(), accepted);
  assert.equal(manager.pending(), false);
  assert.deepEqual(d.releases, [0], 'a failed decoder supplied no releasable handle');
  failDecode = false;
  const callbackFailure = new Error('Intentional ready callback failure');
  await assert.rejects(
    manager.prepare(fixture(3), {
      onProgress({ stage }) {
        if (stage === 'ready') throw callbackFailure;
      },
    }),
    (error) => error === callbackFailure,
  );
  assert.equal(manager.current(), accepted);
  assert.equal(manager.pending(), false);
  assert.deepEqual(d.releases, [0, 2]);
  manager.commit(await manager.prepare(fixture(4)));
  assertDead(accepted);
  assert.deepEqual(d.releases, [0, 2, 3]);
});

test('dispose invalidates accepted ownership immediately and late decoding cannot resurrect it', async (t) => {
  const entered = deferred(),
    finish = deferred();
  const d = decoder(async (index) => {
    if (index === 1) {
      entered.resolve();
      await finish.promise;
    }
  });
  const manager = createCoopPresentationImport(d);
  t.after(() => {
    finish.resolve();
    manager.dispose();
  });
  const accepted = manager.commit(await manager.prepare(fixture()));
  const pending = manager.prepare(fixture(2));
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  await entered.promise;
  assert.equal(manager.dispose(), true);
  assert.equal(manager.dispose(), false);
  assert.equal(manager.cancel(), false);
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), true);
  assertDead(accepted);
  assert.throws(() => manager.exportCurrent(), unavailable);
  assert.throws(() => manager.commit(accepted), /closed/);
  await assert.rejects(manager.prepare(fixture(3)), /closed/);
  finish.resolve();
  await rejected;
  assert.equal(manager.pending(), false);
  assert.equal(manager.current(), null);
  assert.deepEqual(d.releases, [0, 1]);
});

test('host-disposed ready ownership cannot replace accepted state and can be discarded safely', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  const candidate = await manager.prepare(fixture(2));
  assert.equal(disposeCoopPresentationEnvelope(candidate), true);
  assert.equal(disposeCoopPresentationEnvelope(candidate), false);
  assert.throws(() => manager.commit(candidate), unavailable);
  assert.equal(manager.current(), accepted);
  assert.ok(manager.exportCurrent());
  assert.equal(manager.cancel(), true);
  assert.equal(manager.cancel(), false);
  manager.commit(await manager.prepare(fixture(3)));
  assertDead(accepted);
});

test('cancel disposes a ready candidate without changing or disposing accepted originals', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  const original = manager.exportCurrent();
  const candidate = await manager.prepare(fixture(2));
  assert.equal(manager.pending(), false);
  assert.equal(manager.cancel(), true);
  assert.equal(manager.cancel(), false);
  assertDead(candidate);
  assert.throws(() => manager.commit(candidate), wrongOwner);
  assert.equal(manager.current(), accepted);
  assert.equal(manager.exportCurrent(), original);
  manager.commit(await manager.prepare(fixture(3)));
  assertDead(accepted);
});

test('cancellation queued by ready status fences the owner returned by the reader', async (t) => {
  const d = decoder(),
    manager = createCoopPresentationImport(d);
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  let cancelledAtBoundary = false;
  await assert.rejects(
    manager.prepare(fixture(2), {
      onProgress({ stage }) {
        if (stage === 'ready')
          queueMicrotask(() => {
            assert.equal(manager.pending(), true);
            cancelledAtBoundary = manager.cancel();
          });
      },
    }),
    { name: 'AbortError' },
  );
  assert.equal(cancelledAtBoundary, true);
  assert.equal(manager.current(), accepted);
  assert.equal(manager.pending(), false);
  assert.deepEqual(d.releases, [0, 1]);
  assert.ok(manager.exportCurrent());
});
