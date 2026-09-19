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
} from '../coop/presentation-envelope.mjs';

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const busy = /previous Team artwork import is still finishing/;
const unavailable = /unavailable or has been released/;
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
  pack.id = 'local-import-retire-test';
  const pictureSha256 = sha(pictureBytes);
  const manifest = {
    format: COOP_PRESENTATION_FORMAT,
    pack,
    packSha256: sha(canonicalJSON(pack)),
    presentation: {
      id: 'local.retire-test',
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
            attribution: 'Synthetic retirement fixture',
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
const assertDead = (owner) => {
  assert.throws(() => exportCoopPresentationEnvelope(owner), unavailable);
  assert.throws(() => readCoopPresentationPicture(owner, owner.pack.levels[0]), unavailable);
};

test('retire rejects null, forged and foreign owners without touching accepted originals', async (t) => {
  const manager = createCoopPresentationImport(decoder()),
    other = createCoopPresentationImport(decoder());
  t.after(() => {
    manager.dispose();
    other.dispose();
  });
  const accepted = manager.commit(await manager.prepare(fixture())),
    foreign = other.commit(await other.prepare(fixture())),
    original = manager.exportCurrent();
  for (const owner of [undefined, null, {}, { ...accepted }, foreign]) {
    assert.equal(manager.retire(owner), false);
    assert.equal(manager.current(), accepted);
    assert.equal(manager.exportCurrent(), original);
    assert.equal(other.current(), foreign);
    assert.ok(other.exportCurrent());
  }
});

test('retiring the accepted owner clears current ownership and makes its original unavailable', async (t) => {
  const d = decoder(),
    manager = createCoopPresentationImport(d);
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  assert.equal(manager.retire(accepted), true);
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), false);
  assertDead(accepted);
  assert.throws(() => manager.exportCurrent(), unavailable);
  assert.equal(manager.retire(accepted), false);
  assert.equal(manager.cancel(), false);
  assert.deepEqual(d.releases, [0], 'retirement cannot release the validation image twice');
});

test('retirement keeps a held validation owned, uncancelled and able to commit when ready', async (t) => {
  const entered = deferred(),
    finish = deferred();
  const d = decoder(async (index) => {
    if (index === 1) {
      entered.resolve();
      await finish.promise;
    }
  });
  const manager = createCoopPresentationImport(d);
  let pending;
  t.after(async () => {
    finish.resolve();
    manager.dispose();
    await pending?.catch(() => {});
  });
  const accepted = manager.commit(await manager.prepare(fixture()));
  pending = manager.prepare(fixture(2));
  // Register the rejection handler before assertions so a regression or cleanup
  // cancellation cannot produce an unrelated unhandled rejection.
  void pending.catch(() => {});
  await entered.promise;
  assert.equal(manager.pending(), true);
  assert.equal(manager.retire(accepted), true);
  assertDead(accepted);
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), true, 'retirement does not abandon the validation slot');
  await assert.rejects(manager.prepare(fixture(3)), busy);
  assert.equal(d.calls.length, 2, 'another decoder cannot start while validation is held');
  assert.deepEqual(d.releases, [0]);
  finish.resolve();
  const replacement = await pending;
  assert.equal(manager.pending(), false);
  assert.equal(manager.current(), null, 'validation must still require explicit adoption');
  assert.equal(manager.commit(replacement), replacement);
  assert.equal(manager.current(), replacement);
  assert.ok(manager.exportCurrent());
  assert.deepEqual(d.releases, [0, 1]);
});

test('retiring accepted ownership preserves a ready replacement and rejects retiring that candidate', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture())),
    candidate = await manager.prepare(fixture(2)),
    replacementOriginal = exportCoopPresentationEnvelope(candidate);
  assert.equal(manager.retire(candidate), false, 'only accepted ownership can be retired');
  assert.equal(manager.current(), accepted);
  assert.equal(manager.retire(accepted), true);
  assertDead(accepted);
  assert.equal(exportCoopPresentationEnvelope(candidate), replacementOriginal);
  assert.equal(manager.commit(candidate), candidate);
  assert.equal(manager.exportCurrent(), replacementOriginal);
  assert.equal(manager.retire(accepted), false, 'a stale owner cannot retire its successor');
  assert.equal(manager.current(), candidate);
});

test('retirement during ready status preserves the new candidate through callback reentry', async (t) => {
  const manager = createCoopPresentationImport(decoder());
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture()));
  let retired = false;
  const candidate = await manager.prepare(fixture(2), {
    onProgress({ stage }) {
      if (stage !== 'ready') return;
      assert.equal(manager.pending(), true);
      retired = manager.retire(accepted);
      assert.equal(manager.current(), null);
      assert.equal(manager.pending(), true);
    },
  });
  assert.equal(retired, true);
  assertDead(accepted);
  assert.equal(manager.pending(), false);
  assert.equal(manager.commit(candidate), candidate);
  assert.ok(manager.exportCurrent());
});

test('disposed managers make repeated retirement a no-op without reviving ownership', async (t) => {
  const d = decoder(),
    manager = createCoopPresentationImport(d);
  t.after(() => manager.dispose());
  const accepted = manager.commit(await manager.prepare(fixture())),
    candidate = await manager.prepare(fixture(2));
  assert.equal(manager.dispose(), true);
  assertDead(accepted);
  assertDead(candidate);
  for (const owner of [accepted, candidate, null, undefined])
    assert.equal(manager.retire(owner), false);
  assert.equal(manager.dispose(), false);
  assert.equal(manager.current(), null);
  assert.equal(manager.pending(), false);
  assert.throws(() => manager.exportCurrent(), unavailable);
  assert.throws(() => manager.commit(candidate), /closed/);
  await assert.rejects(manager.prepare(fixture(3)), /closed/);
  assert.deepEqual(d.releases, [0, 1]);
});
