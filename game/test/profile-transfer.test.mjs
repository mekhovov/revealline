import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRun, stepRun, getSummary, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import {
  emptyLibrary,
  recordLibraryCompletion,
  campaignKey,
  exportLibrary,
  LIBRARY_STORAGE_VERSION,
  LIBRARY_LIMITS,
} from '../library.mjs';
import { PACK_LIMITS } from '../packs.mjs';
import { suspendSession, restoreSession, SESSION_STORAGE_BYTES } from '../sessions.mjs';
import { isPreparedBackup, prepareBackup, exportBackup } from '../backup.mjs';
import { canonicalJSON } from '../data-json.mjs';
import { inspectImageDataUrl } from '../content.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import {
  discoverProfileTransfers,
  prepareProfileTransfer,
  transferFingerprint,
  TRANSFER_LIMITS,
} from '../profile-transfer.mjs';

const channel = 'release-v0.3.0';
const currentVersion = 'v0.3.1';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const level = {
  version: 'xonix-level.v1',
  id: 'transfer-level',
  revision: '1',
  name: 'Transfer flight',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'anchor', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'transfer-campaign',
  revision: '1',
  title: 'Transfer campaign',
  classRecipes: structuredClone(CLASSES),
  levels: [level],
};
class Locks {
  held = new Set();
  calls = [];
  async request(key, options, callback) {
    this.calls.push({ key, options });
    if (this.held.has(key)) return callback(null);
    this.held.add(key);
    try {
      return await callback({ name: key, mode: 'exclusive' });
    } finally {
      this.held.delete(key);
    }
  }
}
function fixture(id = channel) {
  const profileKey = `revealline.library.${id}.v1`;
  const map = new Map([[profileKey, exportLibrary(emptyLibrary())]]);
  const assets = new Map();
  const reads = [];
  const storage = {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => {
      reads.push(key);
      return map.has(key) ? map.get(key) : null;
    },
    setItem() {
      assert.fail('Transfer must not write source storage.');
    },
    removeItem() {
      assert.fail('Transfer must not remove source storage.');
    },
  };
  const options = {
    currentVersion,
    storage,
    readAsset: async (key) => {
      reads.push(key);
      return assets.has(key) ? assets.get(key) : null;
    },
    lockManager: new Locks(),
    campaigns: [campaign],
    decodeImage,
  };
  const source = discoverProfileTransfers(options)[0];
  return { id, source, map, assets, reads, options };
}
function flight(source = campaign) {
  const options = {
    classId: 'scout',
    classRecipes: source.classRecipes,
    turnPolicy: 'grid-center',
  };
  const run = createRun(source.levels[0], options);
  const recorder = createRecorder(source.levels[0], options, 'transfer-test');
  for (let i = 0; i < 100; i++) {
    stepRun(run, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  return {
    run,
    session: suspendSession({
      run,
      recorder,
      campaignKey: campaignKey(source),
      themeId: 'fpv',
      bodyId: 'fpv-body',
      runId: 'transfer-flight',
      savedAt: '2026-09-12T12:00:00.000Z',
    }),
  };
}
function wonLibrary(sourcePackId = null) {
  const run = createRun(level);
  while (run.status === 'running') stepRun(run, { direction: 'down' }, FIXED_DT);
  assert.equal(run.status, 'won');
  return recordLibraryCompletion(emptyLibrary(), {
    campaign,
    result: getSummary(run),
    runId: 'transfer-clear',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    sourcePackId,
    completedAt: '2026-09-12T11:00:00.000Z',
  });
}
function expansion() {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  pack.visualOverrides.background = { dataUrl: png, name: 'original.png' };
  return { format: 'xonix-pack-library.v1', packs: [pack] };
}
const turn = () => new Promise((resolve) => setTimeout(resolve, 0));

test('discovery recognizes earlier canonical versions, sorts numerically and keeps exact channel aliases', () => {
  const f = fixture();
  for (const id of [
    'release-0.3.0',
    'release-v0.2.1',
    'release',
    'release-v0.3.1',
    'release-v0.4.0',
    'release-v0.2.0',
    'release-00.2.1',
    'release-v0.2.1-beta',
    'dev',
    'motion-lab',
  ])
    f.map.set(`revealline.library.${id}.v1`, 'unverified');
  f.map.set(`${f.source.profileKey}.backup-lock`, 'not a profile');
  const sources = discoverProfileTransfers(f.options);
  assert.deepEqual(
    new Set(sources.map((s) => s.id)),
    new Set(['release-v0.3.0', 'release-0.3.0', 'release-v0.2.1', 'release']),
  );
  assert.equal(sources.at(-1).version, 'v0.2.0');
  assert.equal(sources.at(-1).legacy, true);
  assert.equal(f.reads.length, 0, 'Discovery must not load unbounded values or claim validation.');
  assert.ok(Object.isFrozen(sources) && sources.every(Object.isFrozen));
  for (const source of sources) {
    assert.equal(source.writerKey, `${source.profileKey}.writer`);
    assert.equal(source.lockKey, `${source.profileKey}.backup-lock`);
    assert.equal(source.journalKey, `${source.profileKey}.backup-journal`);
  }
  const newer = fixture();
  newer.map.set('revealline.library.release-v0.10.0.v1', 'unverified');
  assert.equal(
    discoverProfileTransfers({ ...newer.options, currentVersion: '1.0.0' })[0].version,
    'v0.10.0',
  );
});

test('discovery is bounded and unavailable storage never becomes an empty successful list', () => {
  const f = fixture();
  for (const currentVersion of ['', 'dev', 'v01.2.3', '0.3.1-rc', null])
    assert.throws(
      () => discoverProfileTransfers({ ...f.options, currentVersion }),
      /stable current/,
    );
  assert.throws(() => discoverProfileTransfers({ currentVersion }), /discovery is unavailable/);
  assert.throws(
    () => discoverProfileTransfers({ currentVersion, storage: { length: 4097, key() {} } }),
    /too many keys/,
  );
  assert.throws(
    () =>
      discoverProfileTransfers({
        currentVersion,
        storage: {
          length: 1,
          key() {
            throw Error('denied');
          },
        },
      }),
    /denied/,
  );
  for (let i = 0; i < TRANSFER_LIMITS.candidates + 1; i++)
    f.map.set(`revealline.library.release-v0.2.${i + 1}.v1`, 'x');
  assert.throws(() => discoverProfileTransfers(f.options), /Too many earlier/);
});

test('verified profile, pack image and live cut transfer without any source mutation', async () => {
  const f = fixture();
  const library = wonLibrary();
  const { session, run } = flight();
  f.map.set(
    f.source.profileKey,
    JSON.stringify({ format: LIBRARY_STORAGE_VERSION, generation: 'generation-source', library }),
  );
  f.map.set(f.source.sessionKey, JSON.stringify(session));
  f.assets.set(f.source.packsKey, JSON.stringify(expansion()));
  const before = structuredClone({ map: f.map, assets: f.assets });
  const result = await prepareProfileTransfer(f.id, f.options);
  assert.ok(isPreparedBackup(result.prepared));
  assert.deepEqual(result.prepared.library, library);
  assert.equal(result.prepared.packs.packs[0].visualOverrides.background.dataUrl, png);
  assert.deepEqual(result.preview, {
    version: 'v0.3.0',
    campaigns: 1,
    completedLevels: 1,
    pictures: 1,
    scores: 1,
    packs: 1,
    hasSession: true,
    missingOptional: { packs: false, session: false },
    missingPackIds: [],
  });
  const restored = await restoreSession(result.prepared.session, {
    campaign,
    campaignKey: campaignKey(campaign),
  });
  assert.deepEqual(authoritativeCheckpoint(restored.run), authoritativeCheckpoint(run));
  assert.ok((await exportBackup(result.prepared, f.options)).includes(png));
  assert.deepEqual({ map: f.map, assets: f.assets }, before);
  assert.deepEqual(
    f.options.lockManager.calls.map((x) => x.key),
    [f.source.writerKey, f.source.lockKey],
  );
  assert.ok(
    f.options.lockManager.calls.every(
      (x) => x.options.mode === 'exclusive' && x.options.ifAvailable,
    ),
  );
  assert.equal(f.options.lockManager.held.size, 0);
});

test('only explicit null optional slots mean absence, while removed pack metadata stays visible', async () => {
  const f = fixture();
  f.map.set(f.source.profileKey, exportLibrary(wonLibrary('removed-originals')));
  const result = await prepareProfileTransfer(f.id, f.options);
  assert.equal(result.preview.packs, 0);
  assert.equal(result.preview.pictures, 1);
  assert.equal(result.preview.hasSession, false);
  assert.deepEqual(result.preview.missingOptional, { packs: true, session: true });
  assert.deepEqual(result.preview.missingPackIds, ['removed-originals']);
  assert.equal(result.prepared.library.gallery[0].sourcePackId, 'removed-originals');
});

test('legacy v0.2.0 uses its actual release keys and migrates only supported optional preferences', async () => {
  const f = fixture('release');
  const old = emptyLibrary();
  delete old.preferences.tapSteering;
  delete old.preferences.keyboardBindings;
  f.map.set(f.source.profileKey, JSON.stringify(old));
  const result = await prepareProfileTransfer(f.id, f.options);
  assert.equal(result.source.version, 'v0.2.0');
  assert.equal(result.source.profileKey, 'revealline.library.release.v1');
  assert.equal(result.prepared.library.preferences.tapSteering, null);
  assert.equal(result.prepared.library.preferences.keyboardBindings, null);
});

test('an actual existing source writer lease prevents transfer and does not get stolen', async () => {
  const f = fixture();
  const lease = await claimProfileWriter(f.options.lockManager, f.source.writerKey);
  await assert.rejects(prepareProfileTransfer(f.id, f.options), /Close its other game tabs/);
  assert.equal(lease.writable, true);
  assert.equal(f.reads.length, 0);
  lease.release();
  await turn();
  assert.ok(isPreparedBackup((await prepareProfileTransfer(f.id, f.options)).prepared));
});

test('busy coordinator or stale/corrupt recovery markers block copy without recovery or fallback', async () => {
  for (const mutation of [
    (f) => f.options.lockManager.held.add(f.source.lockKey),
    (f) => f.map.set(f.source.lockKey, 'old-token'),
    (f) => f.map.set(f.source.lockKey, undefined),
    (f) => f.assets.set(f.source.journalKey, { format: 'broken-journal' }),
    (f) => f.assets.set(f.source.journalKey, ''),
    (f) => f.assets.set(f.source.journalKey, undefined),
  ]) {
    const f = fixture();
    mutation(f);
    const before = structuredClone({ map: f.map, assets: f.assets });
    await assert.rejects(prepareProfileTransfer(f.id, f.options), /busy|unfinished|journal/);
    assert.deepEqual({ map: f.map, assets: f.assets }, before);
    assert.equal(f.options.lockManager.held.has(f.source.writerKey), false);
    assert.equal(f.reads.includes(f.source.profileKey), false);
  }
});

test('missing, corrupt or oversized profile/pack/session data never transfers as empty success', async () => {
  const mutations = [
    (f) => f.map.delete(f.source.profileKey),
    (f) => f.map.set(f.source.profileKey, undefined),
    (f) => f.map.set(f.source.profileKey, ''),
    (f) => f.map.set(f.source.profileKey, 'null'),
    (f) => f.map.set(f.source.profileKey, JSON.stringify({ ...emptyLibrary(), format: 'future' })),
    (f) => f.map.set(f.source.profileKey, 'x'.repeat(LIBRARY_LIMITS.maxBytes + 4097)),
    (f) => f.assets.set(f.source.packsKey, undefined),
    (f) => f.assets.set(f.source.packsKey, ''),
    (f) => f.assets.set(f.source.packsKey, 'null'),
    (f) => f.assets.set(f.source.packsKey, 'x'.repeat(PACK_LIMITS.libraryBytes + 1)),
    (f) => f.map.set(f.source.sessionKey, undefined),
    (f) => f.map.set(f.source.sessionKey, 'null'),
    (f) => f.map.set(f.source.sessionKey, '{}'),
    (f) => f.map.set(f.source.sessionKey, 'x'.repeat(SESSION_STORAGE_BYTES + 1)),
  ];
  for (const mutation of mutations) {
    const f = fixture();
    mutation(f);
    await assert.rejects(prepareProfileTransfer(f.id, f.options));
    assert.equal(f.options.lockManager.held.size, 0);
  }
});

test('storage exceptions and unavailable locks reject without reads from a substitute source', async () => {
  for (const key of ['journalKey', 'packsKey', 'profileKey', 'sessionKey']) {
    const f = fixture();
    const original = f.options.readAsset;
    if (key === 'journalKey' || key === 'packsKey')
      f.options.readAsset = async (name) => {
        if (name === f.source[key]) throw Error('source read failed');
        return original(name);
      };
    else {
      const read = f.options.storage.getItem;
      f.options.storage.getItem = (name) => {
        if (name === f.source[key]) throw Error('source read failed');
        return read(name);
      };
    }
    await assert.rejects(prepareProfileTransfer(f.id, f.options), /source read failed/);
    assert.equal(f.options.lockManager.held.size, 0);
  }
  for (const lockManager of [
    null,
    {},
    {
      request() {
        throw Error('lock denied');
      },
    },
  ]) {
    const f = fixture();
    await assert.rejects(
      prepareProfileTransfer(f.id, { ...f.options, lockManager }),
      /Web Locks|lock denied/,
    );
    assert.equal(f.reads.length, 0);
  }
  const f = fixture();
  for (const id of ['dev', '__proto__', 'release-v0.3.1', 'release-v1.0.0', { id: channel }])
    await assert.rejects(prepareProfileTransfer(id, f.options), /recognized earlier/);
  assert.equal(f.reads.length, 0);
});

test('prototype pollution and accessors are rejected without invoking user data', async () => {
  const f = fixture();
  f.assets.set(
    f.source.packsKey,
    '{"format":"xonix-pack-library.v1","packs":[],"__proto__":{"polluted":true}}',
  );
  await assert.rejects(prepareProfileTransfer(f.id, f.options), /Forbidden JSON key/);
  assert.equal({}.polluted, undefined);
  let called = 0;
  const malicious = { format: 'xonix-pack-library.v1', packs: [] };
  Object.defineProperty(malicious, 'extra', {
    enumerable: true,
    get() {
      called++;
      return [];
    },
  });
  f.assets.set(f.source.packsKey, malicious);
  await assert.rejects(prepareProfileTransfer(f.id, f.options), /accessors/);
  assert.equal(called, 0);
});

test('a mismatching replay checkpoint or a missing required campaign rejects the whole snapshot', async () => {
  const f = fixture();
  const { session } = flight();
  f.map.set(f.source.sessionKey, JSON.stringify(session));
  await assert.rejects(
    prepareProfileTransfer(f.id, { ...f.options, campaigns: [] }),
    /matching included/,
  );
  session.replay.checkpoint.sections.player = '0000000000000000';
  f.map.set(f.source.sessionKey, JSON.stringify(session));
  await assert.rejects(
    prepareProfileTransfer(f.id, f.options),
    /verification failed|Checkpoint root/,
  );
  assert.equal(f.options.lockManager.held.size, 0);
});

test('source locks remain held through image verification and release on cancellation', async () => {
  const f = fixture();
  f.assets.set(f.source.packsKey, expansion());
  const controller = new AbortController();
  let entered;
  const decoding = new Promise((resolve) => {
    entered = resolve;
  });
  f.options.decodeImage = async () => {
    entered();
    return new Promise(() => {});
  };
  const pending = prepareProfileTransfer(f.id, { ...f.options, signal: controller.signal });
  await decoding;
  assert.deepEqual(f.options.lockManager.held, new Set([f.source.writerKey, f.source.lockKey]));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await turn();
  assert.equal(f.options.lockManager.held.size, 0);
});

test('a deadline releases source locks even when a read never settles, and late reads cannot adopt', async () => {
  const f = fixture();
  let finish;
  f.options.readAsset = () =>
    new Promise((resolve) => {
      finish = resolve;
    });
  await assert.rejects(prepareProfileTransfer(f.id, { ...f.options, timeoutMs: 10 }), {
    name: 'TimeoutError',
  });
  await turn();
  assert.equal(f.options.lockManager.held.size, 0);
  finish(null);
  await turn();
  assert.equal(
    f.reads.length,
    1,
    'Only the backup token was read before the timed-out journal read.',
  );
});

test('pre-cancellation and invalid deadlines never touch source storage', async () => {
  const f = fixture();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(prepareProfileTransfer(f.id, { ...f.options, signal: controller.signal }), {
    name: 'AbortError',
  });
  for (const timeoutMs of [0, -1, Infinity, 0.5, TRANSFER_LIMITS.maxTimeoutMs + 1])
    await assert.rejects(
      prepareProfileTransfer(f.id, { ...f.options, timeoutMs }),
      /timeout is invalid/,
    );
  assert.equal(f.options.lockManager.calls.length, 0);
  assert.equal(f.reads.length, 0);
});

test('fingerprints use canonical complete content and a real SHA-256 digest', async () => {
  const f = fixture();
  f.assets.set(f.source.packsKey, JSON.stringify(expansion()));
  const reviewed = await prepareProfileTransfer(f.id, f.options);
  const expected = `sha256-${createHash('sha256').update(canonicalJSON(reviewed.prepared)).digest('hex')}`;
  assert.equal(reviewed.fingerprint, expected);
  const injected = await transferFingerprint(reviewed.prepared, {
    digest: (bytes) => {
      assert.ok(bytes instanceof Uint8Array);
      return createHash('sha256').update(bytes).digest();
    },
  });
  assert.equal(injected, expected);
  assert.equal(await transferFingerprint(reviewed.prepared), expected);
  assert.match(expected, /^sha256-[0-9a-f]{64}$/);
});

test('storage generation and JSON key ordering do not make an unchanged review stale', async () => {
  const f = fixture();
  const reviewed = await prepareProfileTransfer(f.id, f.options);
  const reverseKeys = (value) =>
    value === null || typeof value !== 'object'
      ? value
      : Array.isArray(value)
        ? value.map(reverseKeys)
        : Object.fromEntries(
            Object.entries(value)
              .reverse()
              .map(([key, child]) => [key, reverseKeys(child)]),
          );
  f.map.set(
    f.source.profileKey,
    JSON.stringify(
      {
        format: LIBRARY_STORAGE_VERSION,
        generation: 'generation-new-storage-only',
        library: reverseKeys(emptyLibrary()),
      },
      null,
      2,
    ),
  );
  f.assets.set(f.source.packsKey, { packs: [], format: 'xonix-pack-library.v1' });
  const refreshed = await prepareProfileTransfer(f.id, f.options);
  assert.equal(refreshed.fingerprint, reviewed.fingerprint);
  assert.notDeepEqual(refreshed.preview.missingOptional, reviewed.preview.missingOptional);
  const alias = fixture('release-0.3.0');
  const aliasResult = await prepareProfileTransfer(alias.id, alias.options);
  assert.equal(aliasResult.fingerprint, reviewed.fingerprint);
  assert.notEqual(
    aliasResult.source.id,
    reviewed.source.id,
    'UI must also compare the selected source ID.',
  );
});

test('changed preferences, progress, image payload and suspended metadata each invalidate review', async () => {
  const f = fixture();
  const initial = await prepareProfileTransfer(f.id, f.options);
  const preferences = emptyLibrary();
  preferences.preferences.musicVolume = 0.12;
  f.map.set(f.source.profileKey, JSON.stringify(preferences));
  const preferenceChange = await prepareProfileTransfer(f.id, f.options);
  assert.notEqual(preferenceChange.fingerprint, initial.fingerprint);
  f.map.set(f.source.profileKey, exportLibrary(wonLibrary()));
  const awarded = await prepareProfileTransfer(f.id, f.options);
  assert.notEqual(awarded.fingerprint, preferenceChange.fingerprint);
  const packs = expansion();
  f.assets.set(f.source.packsKey, packs);
  const illustrated = await prepareProfileTransfer(f.id, f.options);
  const original = Buffer.from(png.split(',')[1], 'base64');
  // Different embedded bytes with an identical PNG header. The injected decoder
  // supplies dimensions; this tests fingerprint coverage, not image decoding.
  original[45] ^= 1;
  packs.packs[0].visualOverrides.background.dataUrl = `data:image/png;base64,${original.toString('base64')}`;
  const changedImage = await prepareProfileTransfer(f.id, f.options);
  assert.notEqual(changedImage.fingerprint, illustrated.fingerprint);
  const { session } = flight();
  f.map.set(f.source.sessionKey, JSON.stringify(session));
  const saved = await prepareProfileTransfer(f.id, f.options);
  assert.notEqual(saved.fingerprint, changedImage.fingerprint);
  session.savedAt = '2026-09-12T12:01:00.000Z';
  f.map.set(f.source.sessionKey, JSON.stringify(session));
  assert.notEqual((await prepareProfileTransfer(f.id, f.options)).fingerprint, saved.fingerprint);
  assert.equal(illustrated.prepared.packs.packs[0].visualOverrides.background.dataUrl, png);
});

test('fingerprints require prepared data and exactly 32 digest bytes', async () => {
  await assert.rejects(
    transferFingerprint({ library: emptyLibrary(), packs: {}, session: null }),
    /prepared/,
  );
  const prepared = await prepareBackup({
    format: 'xonix-backup.v1',
    library: emptyLibrary(),
    packs: { format: 'xonix-pack-library.v1', packs: [] },
    session: null,
  });
  for (const result of [null, 'a'.repeat(64), new Uint8Array(31), new ArrayBuffer(33)])
    await assert.rejects(transferFingerprint(prepared, { digest: () => result }), /exactly 32/);
  await assert.rejects(transferFingerprint(prepared, { digest: null }), /digest function/);
});

test('fingerprinting stays under the source locks and cancellation releases a pending digest', async () => {
  const f = fixture();
  const controller = new AbortController();
  let entered;
  const hashing = new Promise((resolve) => {
    entered = resolve;
  });
  const pending = prepareProfileTransfer(f.id, {
    ...f.options,
    signal: controller.signal,
    digest: () => {
      entered();
      return new Promise(() => {});
    },
  });
  await hashing;
  assert.deepEqual(f.options.lockManager.held, new Set([f.source.writerKey, f.source.lockKey]));
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  await turn();
  assert.equal(f.options.lockManager.held.size, 0);
});

test('the authored Homeward pack fits transfer budgets and hashes its full image payload', async (t) => {
  const bytes = readFileSync(new URL('../content/packs/homeward-skies.json', import.meta.url));
  assert.ok(bytes.length <= PACK_LIMITS.maxBytes);
  const f = fixture();
  f.assets.set(
    f.source.packsKey,
    JSON.stringify({
      format: 'xonix-pack-library.v1',
      packs: [JSON.parse(bytes)],
    }),
  );
  // This Node timing measures bounded data preparation/canonical hashing only.
  // Real sequential image decoding and browser/device performance are separate.
  f.options.decodeImage = async (dataUrl) => {
    const header = inspectImageDataUrl(dataUrl);
    assert.equal(header.valid, true);
    return { naturalWidth: header.width, naturalHeight: header.height };
  };
  const start = performance.now();
  const ready = await prepareProfileTransfer(f.id, f.options);
  const transferMs = performance.now() - start;
  const hashingStart = performance.now();
  assert.equal(await transferFingerprint(ready.prepared), ready.fingerprint);
  const hashMs = performance.now() - hashingStart;
  const canonical = canonicalJSON(ready.prepared);
  assert.equal(ready.fingerprint, `sha256-${createHash('sha256').update(canonical).digest('hex')}`);
  assert.equal(ready.prepared.packs.packs[0].levelVisuals.length, 3);
  assert.equal(f.options.lockManager.held.size, 0);
  t.diagnostic(
    JSON.stringify({
      packBytes: bytes.length,
      canonicalBytes: Buffer.byteLength(canonical),
      transferMs: Math.round(transferMs),
      hashMs: Math.round(hashMs),
      fingerprint: ready.fingerprint,
      imageDecoder: 'header-only test adapter',
    }),
  );
});
