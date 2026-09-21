import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { canonicalJSON } from '../data-json.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { validateCompiledPresentation } from '../presentation/host.mjs';
import { createCoopPresentation } from '../couch/coop-presentation.mjs';
import {
  COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
  COOP_PICTURE_BINDINGS,
} from '../couch/coop-picture-bindings.mjs';

const sha = (value) => createHash('sha256').update(value).digest('hex');
const compiled = validateCompiledPresentation(
  JSON.parse(await readFile(new URL('../presentation/compiled/runtime.json', import.meta.url))),
);
const approved = COOP_HISTORICAL_IMPORT_PICTURE_POLICY.picture;
const bytes = await readFile(
  new URL(`../presentation/compiled/${compiled.urls[approved.sha256]}`, import.meta.url),
);
const imported = JSON.parse(
  await readFile(new URL('./fixtures/coop-import-route.json', import.meta.url)),
).authoredPack;
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

// Real compiled metadata and original bytes; injected decoding is deliberately
// finite. These tests do not qualify native decoding or the visual composition.
function fixture() {
  const pack = structuredClone(imported);
  const snapshot = { resolved: structuredClone(compiled.resolved) };
  const asset = snapshot.resolved.assets[approved.slot];
  const request = { pack, levelId: pack.levels[0].id, themeId: 'fpv', attemptId: 'import-1' };
  const calls = { reads: [], images: [], releases: [] };
  let currentSnapshot = snapshot;
  const readPicture = async (slot, options) => {
    assert.equal(slot, approved.slot);
    assert.equal(options.snapshot, snapshot);
    assert.ok(options.signal instanceof AbortSignal);
    calls.reads.push({ slot, options });
    return { asset, blob: new Blob([bytes], { type: approved.mime }) };
  };
  const decodeImage = async () => {
    const image = { width: 1152, height: 576 };
    calls.images.push(image);
    return { image, release: () => calls.releases.push(image) };
  };
  return {
    pack,
    snapshot,
    asset,
    request,
    calls,
    readPicture,
    decodeImage,
    setSnapshot(value) {
      currentSnapshot = value;
    },
    create(overrides = {}) {
      return createCoopPresentation({
        bindings: COOP_PICTURE_BINDINGS,
        historicalImportPolicy: COOP_HISTORICAL_IMPORT_PICTURE_POLICY,
        getSnapshot: () => currentSnapshot,
        readPicture,
        decodeImage,
        ...overrides,
      });
    },
  };
}

test('the versioned historical policy names only the exact reviewed FPV wide scene', () => {
  assert.equal(
    COOP_HISTORICAL_IMPORT_PICTURE_POLICY.version,
    'revealline-team-historical-import-picture.v1',
  );
  assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICY.themeId, 'fpv');
  assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICY.themeRevision, 43);
  assert.equal(
    COOP_HISTORICAL_IMPORT_PICTURE_POLICY.themeRevision,
    compiled.resolved.theme.revision,
  );
  assert.equal(COOP_HISTORICAL_IMPORT_PICTURE_POLICY.collection, null);
  assert.deepEqual(approved, COOP_PICTURE_BINDINGS[0].picture);
  assert.ok(Object.isFrozen(COOP_HISTORICAL_IMPORT_PICTURE_POLICY));
  assert.ok(Object.isFrozen(approved));
  assert.equal(bytes.length, approved.bytes);
  assert.equal(sha(bytes), approved.sha256);
});

test('valid coverage and multi-core imports bind their complete content to the approved scene without changing it', async () => {
  const f = fixture();
  f.pack.levels[0].revision = 'community-v2';
  assert.equal(validateCoopPack(f.pack).valid, true);
  assert.equal(f.pack.levels[0].goal.cores.length, 2);
  assert.equal(f.pack.levels[0].strongholds.length, 3);
  assert.ok(f.pack.levels[1].goal.coverage > 0);
  const before = JSON.stringify(f.pack);
  for (const level of f.pack.levels) {
    const lease = f.create();
    const request = { ...f.request, levelId: level.id };
    const binding = await lease.select(request);
    assert.deepEqual(binding.choice, {
      packId: f.pack.id,
      packRevision: f.pack.revision,
      packSha256: sha(canonicalJSON(f.pack)),
      levelId: level.id,
      levelRevision: level.revision,
      levelSha256: sha(canonicalJSON(level)),
      themeId: 'fpv',
      themeRevision: 43,
      collection: null,
      picture: approved,
      kind: 'image',
    });
    assert.equal(binding.snapshot, f.snapshot);
    assert.equal(binding.image, f.calls.images.at(-1));
    assert.equal(binding.fit, 'contain');
    assert.equal(binding.sampling, 'nearest');
    assert.ok(Object.isFrozen(binding.choice) && Object.isFrozen(binding.choice.picture));
    assert.equal(await lease.select(request), binding);
    assert.equal(lease.confirm(request), binding);
    lease.dispose();
  }
  assert.equal(JSON.stringify(f.pack), before);
  assert.equal(f.calls.reads.length, 2);
  assert.equal(f.calls.images.length, 2);
  assert.deepEqual(f.calls.releases, f.calls.images);
});

test('historical revision values retain their original type and full pack ownership', async () => {
  const choices = [];
  for (const revision of [2, '2', 'r'.repeat(100), 1e20]) {
    const f = fixture();
    f.pack.levels[0].revision = revision;
    assert.equal(validateCoopPack(f.pack).valid, true);
    const lease = f.create();
    const first = await lease.select(f.request);
    choices.push(first.choice);
    assert.equal(first.choice.levelRevision, revision);
    const changed = structuredClone(f.pack);
    changed.levels[1].name = 'Another arena revised';
    await assert.rejects(lease.select({ ...f.request, pack: changed }), /Retry must retain/);
    assert.equal(lease.current(), first);
    const second = await lease.select({ ...f.request, pack: changed, attemptId: 'import-2' });
    assert.equal(second.choice.levelSha256, first.choice.levelSha256);
    assert.notEqual(second.choice.packSha256, first.choice.packSha256);
    lease.dispose();
  }
  assert.notEqual(choices[0].levelSha256, choices[1].levelSha256);
  assert.notEqual(choices[0].packSha256, choices[1].packSha256);
});

test('an exact binding table preserves historical string and integer level revisions without the generic policy', async () => {
  for (const revision of ['2', 1e20]) {
    const f = fixture();
    f.pack.levels[0].revision = revision;
    const row = {
      ...COOP_PICTURE_BINDINGS[0],
      packId: f.pack.id,
      packRevision: f.pack.revision,
      packSha256: sha(canonicalJSON(f.pack)),
      levelId: f.pack.levels[0].id,
      levelRevision: revision,
      levelSha256: sha(canonicalJSON(f.pack.levels[0])),
    };
    const lease = f.create({ bindings: [row], historicalImportPolicy: null });
    const ready = await lease.select(f.request);
    assert.deepEqual(ready.choice, { ...row, kind: 'image' });
    assert.equal(lease.confirm(f.request), ready);
    lease.dispose();
  }
});

test('the policy remains opt-in and malformed policy or historical input cannot introduce an image path', async () => {
  const f = fixture();
  for (const historicalImportPolicy of [undefined, null])
    await assert.rejects(
      f.create({ historicalImportPolicy }).select(f.request),
      /No exact Team picture binding/,
    );
  for (const mutate of [
    (policy) => {
      policy.version = 'unrecognized';
    },
    (policy) => {
      policy.picture = null;
    },
    (policy) => {
      policy.picture.slot = 'picture.fpv.adf5c9eea274ba7f';
    },
    (policy) => {
      policy.picture.width = 768;
    },
    (policy) => {
      policy.picture.url = 'https://untrusted.invalid/picture.png';
    },
    (policy) => {
      policy.collection = { id: 'unreviewed', revision: 1 };
    },
  ]) {
    const policy = structuredClone(COOP_HISTORICAL_IMPORT_PICTURE_POLICY);
    mutate(policy);
    assert.throws(() => f.create({ historicalImportPolicy: policy }));
  }
  for (const mutate of [
    (pack) => {
      pack.levels[0].revision = '';
    },
    (pack) => {
      pack.levels[0].revision = 'r'.repeat(101);
    },
    (pack) => {
      pack.levels[0].revision = 0;
    },
    (pack) => {
      pack.revision = '2';
    },
    (pack) => {
      pack.revision = 1000001;
    },
    (pack) => {
      pack.levels[0].picture = 'custom.png';
    },
    (pack) => {
      pack.presentation = {};
    },
  ]) {
    const pack = structuredClone(f.pack);
    mutate(pack);
    await assert.rejects(f.create().select({ ...f.request, pack }), /Invalid Team pack/);
  }
  assert.equal(f.calls.reads.length, 0);
});

test('the starter namespace stays strict even with no exact rows; known custom namespaces cannot borrow generic approval', async () => {
  const f = fixture();
  const starter = structuredClone(COOP_STARTER_PACK);
  const request = { ...f.request, pack: starter, levelId: starter.levels[0].id };
  const exact = f.create();
  assert.deepEqual((await exact.select(request)).choice, {
    ...COOP_PICTURE_BINDINGS[0],
    kind: 'image',
  });
  exact.dispose();
  for (const bindings of [[], COOP_PICTURE_BINDINGS]) {
    const changed = structuredClone(starter);
    changed.levels[1].name = 'Changed other starter arena';
    await assert.rejects(
      f.create({ bindings }).select({ ...request, pack: changed }),
      /No exact Team picture binding/,
    );
  }
  const customRow = {
    ...COOP_PICTURE_BINDINGS[0],
    packId: f.pack.id,
    packRevision: f.pack.revision,
    packSha256: sha(canonicalJSON(f.pack)),
    levelId: f.pack.levels[0].id,
    levelRevision: f.pack.levels[0].revision,
    levelSha256: sha(canonicalJSON(f.pack.levels[0])),
  };
  const known = f.create({ bindings: [customRow] });
  assert.deepEqual((await known.select(f.request)).choice, { ...customRow, kind: 'image' });
  known.dispose();
  for (const mutate of [
    (pack) => {
      pack.name = 'Known pack changed';
    },
    (pack) => {
      pack.levels[1].name = 'Known other arena changed';
    },
    (pack) => {
      pack.levels[0].revision = '2';
    },
  ]) {
    const pack = structuredClone(f.pack);
    mutate(pack);
    await assert.rejects(
      f.create({ bindings: [customRow] }).select({ ...f.request, pack }),
      /No exact Team picture binding/,
    );
  }
  assert.equal(f.calls.reads.length, 2);
});

test('missing, substituted, source-quality or cropped required scenery refuses before any original read', async () => {
  for (const mutate of [
    (resolved) => {
      delete resolved.assets[approved.slot];
    },
    (resolved) => {
      resolved.assets[approved.slot].id = 'different-reviewed-scene';
    },
    (resolved) => {
      resolved.assets[approved.slot].revision++;
    },
    (resolved) => {
      resolved.assets[approved.slot].file.sha256 = '0'.repeat(64);
    },
    (resolved) => {
      resolved.assets[approved.slot].quality.stage = 'source';
    },
    (resolved) => {
      resolved.assets[approved.slot].geometry.frame.width = 576;
    },
    (resolved) => {
      resolved.theme.revision++;
    },
    (resolved) => {
      resolved.theme.id = 'retro';
    },
    (resolved) => {
      resolved.collection = { id: 'other-collection', revision: 1 };
    },
  ]) {
    const f = fixture();
    mutate(f.snapshot.resolved);
    const lease = f.create();
    await assert.rejects(lease.select(f.request));
    assert.equal(lease.current(), null);
    assert.equal(f.calls.reads.length, 0);
    assert.equal(f.calls.images.length, 0);
  }
});

test('generic read, original hash and decode errors never become procedural and explicit Retry retains its captured row', async () => {
  for (const failure of ['read', 'hash', 'decode']) {
    const f = fixture();
    let fail = true;
    const statuses = [];
    const lease = f.create({
      readPicture: async (...args) => {
        if (fail && failure === 'read') throw new Error('Original unavailable');
        const original = await f.readPicture(...args);
        if (fail && failure === 'hash') {
          const corrupt = Buffer.from(bytes);
          corrupt[corrupt.length - 1] ^= 1;
          original.blob = new Blob([corrupt], { type: approved.mime });
        }
        return original;
      },
      decodeImage: async () => {
        if (fail && failure === 'decode') throw new Error('Decode refused');
        return f.decodeImage();
      },
    });
    await assert.rejects(
      lease.select({ ...f.request, onStatus: (status) => statuses.push(status) }),
    );
    assert.equal(lease.current(), null);
    assert.equal(statuses.at(-1).status, 'error');
    assert.throws(() => lease.confirm(f.request), /not ready/);
    fail = false;
    const ready = await lease.select(f.request);
    assert.equal(ready.choice.kind, 'image');
    assert.equal(ready.choice.packSha256, sha(canonicalJSON(f.pack)));
    assert.deepEqual(ready.choice.picture, approved);
    const reads = f.calls.reads.length;
    assert.equal(await lease.select(f.request), ready);
    assert.equal(lease.confirm(f.request), ready);
    assert.equal(f.calls.reads.length, reads);
    lease.dispose();
    assert.deepEqual(f.calls.releases, f.calls.images);
  }
});

test('a historical policy and authored pack are copied before callbacks can change their association', async () => {
  const f = fixture();
  const policy = structuredClone(COOP_HISTORICAL_IMPORT_PICTURE_POLICY);
  const expectedPack = sha(canonicalJSON(f.pack));
  const lease = f.create({ historicalImportPolicy: policy });
  let changed = false;
  const ready = await lease.select({
    ...f.request,
    onStatus() {
      if (changed) return;
      changed = true;
      policy.picture.sha256 = '0'.repeat(64);
      f.pack.name = 'Changed after request';
    },
  });
  assert.deepEqual(ready.choice.picture, approved);
  assert.equal(ready.choice.packSha256, expectedPack);
  assert.throws(() => lease.confirm(f.request), /not ready/);
  lease.dispose();
});

test('generic Cancel and Retry release a late decoded image once without changing the newer accepted image', async () => {
  const f = fixture();
  const entered = [deferred(), deferred()];
  const completion = [deferred(), deferred()];
  const released = [0, 0];
  let decodes = 0;
  const lease = f.create({
    decodeImage: async () => {
      const index = decodes++;
      entered[index].resolve();
      return completion[index].promise;
    },
  });
  const old = lease.select(f.request);
  const rejected = assert.rejects(old, { name: 'AbortError' });
  await entered[0].promise;
  lease.cancel();
  const retry = lease.select(f.request);
  await entered[1].promise;
  const image = { width: 1152, height: 576 };
  completion[1].resolve({ image, release: () => released[1]++ });
  const current = await retry;
  completion[0].resolve({ image: { width: 1152, height: 576 }, release: () => released[0]++ });
  await rejected;
  assert.equal(lease.current(), current);
  assert.equal(lease.confirm(f.request).image, image);
  assert.deepEqual(released, [1, 0]);
  lease.dispose();
  lease.dispose();
  assert.deepEqual(released, [1, 1]);
});

test('failed generic replacement and snapshot drift preserve the old image and require a deliberate new attempt', async () => {
  const f = fixture();
  let fail = false;
  const lease = f.create({
    readPicture: (...args) => {
      if (fail) throw new Error('Replacement unavailable');
      return f.readPicture(...args);
    },
  });
  const first = await lease.select(f.request);
  fail = true;
  const next = { ...f.request, levelId: f.pack.levels[1].id, attemptId: 'import-2' };
  await assert.rejects(lease.select(next), /Replacement unavailable/);
  assert.equal(lease.current(), first);
  assert.equal(f.calls.releases.length, 0);
  f.setSnapshot({ resolved: structuredClone(f.snapshot.resolved) });
  await assert.rejects(lease.select(next), /presentation changed/);
  assert.equal(lease.current(), first);
  f.setSnapshot(f.snapshot);
  fail = false;
  const second = await lease.select({ ...next, attemptId: 'import-3' });
  assert.equal(second.choice.levelId, f.pack.levels[1].id);
  assert.deepEqual(f.calls.releases, [first.image]);
  lease.dispose();
  assert.deepEqual(f.calls.releases, [first.image, second.image]);
});
