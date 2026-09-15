import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, getSummary, CLASSES, FIXED_DT } from '../core/index.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint } from '../replay.mjs';
import { suspendSession, restoreSession } from '../sessions.mjs';
import { BACKUP_FORMAT, prepareBackup, exportBackup } from '../backup.mjs';
import { commitBackup } from '../backup-storage.mjs';
import { discoverProfileTransfers, prepareProfileTransfer } from '../profile-transfer.mjs';
import { resolveControllerBindings } from '../controller-bindings.mjs';
import { MASTERY_RECORD_VERSION, MasteryCapacityError } from '../mastery-records.mjs';
import {
  LIBRARY_VERSION,
  LIBRARY_LIMITS,
  LIBRARY_STORAGE_VERSION,
  emptyLibrary,
  importLibrary,
  exportLibrary,
  validateLibrary,
  recordLibraryCompletion,
  campaignKey,
  progressFor,
  withMasteryRecords,
  mergeLibraries,
  updatePreferences,
  loadLibrary,
  saveLibrary,
  libraryCapacity,
  LibraryCapacityError,
} from '../library.mjs';

const level = {
  version: 'xonix-level.v1',
  id: 'orchard',
  revision: '1',
  name: 'Orchard',
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
  id: 'mastery-library',
  revision: '1',
  title: 'Mastery library',
  levels: [level],
  classRecipes: structuredClone(CLASSES),
};
const options = { classId: 'fiber', classRecipes: campaign.classRecipes, turnPolicy: 'immediate' };
const run = createRun(level, options);
while (run.status === 'running') stepRun(run, { direction: 'down' }, FIXED_DT);
assert.equal(run.status, 'won');
const result = getSummary(run);
const ordinary = recordLibraryCompletion(emptyLibrary(), {
  campaign,
  result,
  runId: 'ordinary-clear',
  themeId: 'fpv',
  bodyId: 'fpv-body',
  completedAt: '2026-09-12T12:00:00.000Z',
});
const backupOptions = { campaigns: [campaign] };
function record(seed = 1) {
  const { ruleset, turnPolicy, classId, classRevision, loadoutHash, rosterHash, classHistory } =
    result;
  return {
    format: MASTERY_RECORD_VERSION,
    campaignKey: campaignKey(campaign),
    levelId: level.id,
    levelRevision: level.revision,
    levelIdentity: `level-v1-${dataIdentity(normalizedLevel(level))}`,
    definitionId: 'steady-signal',
    definitionRevision: '1',
    definitionHash: 'mastery-v1-1234567890abcdef',
    setup: {
      ruleset,
      seed,
      turnPolicy,
      classId,
      classRevision,
      loadoutHash,
      rosterHash,
      classHistory: structuredClone(classHistory),
    },
    runId: `qualifying-${seed}`,
    earnedAt: '2026-09-12T12:00:00.000Z',
  };
}
function legacyLibrary() {
  const value = structuredClone(ordinary);
  value.format = 'xonix-library.v1';
  delete value.masteries;
  return value;
}
function unchangedOrdinary(actual, expected) {
  for (const key of ['campaigns', 'gallery', 'scores'])
    assert.deepEqual(actual[key], expected[key], key);
}
function storage(initial = {}) {
  const map = new Map(Object.entries(initial)),
    writes = [];
  return {
    map,
    writes,
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      writes.push([key, value]);
      map.set(key, String(value));
    },
    removeItem: (key) => {
      writes.push([key, null]);
      map.delete(key);
    },
  };
}
function backup(library) {
  const active = createRun(level, options),
    recorder = createRecorder(level, options, 'mastery-library');
  for (let tick = 0; tick < 100; tick++) {
    stepRun(active, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  const session = suspendSession({
    run: active,
    recorder,
    campaignKey: campaignKey(campaign),
    runId: 'portable-flight',
    themeId: 'fpv',
    bodyId: 'fpv-body',
    savedAt: '2026-09-12T12:01:00.000Z',
  });
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url)),
  );
  return {
    format: BACKUP_FORMAT,
    library,
    packs: { format: 'xonix-pack-library.v1', packs: [pack] },
    session,
  };
}
function coordinator(prior) {
  const local = storage({
    profile: JSON.stringify(prior.library),
    session: JSON.stringify(prior.session),
  });
  const assets = new Map([['packs', JSON.stringify(prior.packs)]]);
  let failProfile = false;
  const api = {
    storage: local,
    profileKey: 'profile',
    packsKey: 'packs',
    sessionKey: 'session',
    journalKey: 'journal',
    readAsset: async (key) => structuredClone(assets.get(key) ?? null),
    writeAsset: async (key, value) => assets.set(key, structuredClone(value)),
    withLock: (task) => task(),
    commitProfile: (library, settings) =>
      failProfile
        ? { ok: false, warning: 'Injected profile write failure.' }
        : saveLibrary(local, 'profile', library, null, settings),
  };
  return {
    local,
    assets,
    api,
    fail: () => (failProfile = true),
    raw: () => ({
      profile: local.getItem('profile'),
      session: local.getItem('session'),
      packs: assets.get('packs'),
    }),
  };
}

test('v1 raw and storage envelopes migrate read-only into v2 with empty masteries', () => {
  const legacy = legacyLibrary();
  delete legacy.preferences.controllerBindings;
  const before = JSON.stringify(legacy);
  assert.equal(LIBRARY_VERSION, 'xonix-library.v2');
  assert.deepEqual(emptyLibrary().masteries, []);
  assert.deepEqual(validateLibrary(legacy), { valid: true, errors: [] });
  for (const raw of [
    before,
    JSON.stringify({
      format: LIBRARY_STORAGE_VERSION,
      generation: 'generation-old',
      library: legacy,
    }),
  ]) {
    const local = storage({ profile: raw }),
      loaded = loadLibrary(local, 'profile', backupOptions);
    assert.equal(loaded.warning, '');
    assert.equal(loaded.recovery, null);
    assert.equal(loaded.library.format, LIBRARY_VERSION);
    assert.deepEqual(loaded.library.masteries, []);
    assert.equal(loaded.library.preferences.controllerBindings, null);
    unchangedOrdinary(loaded.library, legacy);
    assert.deepEqual(progressFor(loaded.library, campaign), progressFor(ordinary, campaign));
    assert.deepEqual(local.writes, []);
    assert.equal(local.getItem('profile'), raw);
    assert.deepEqual(importLibrary(raw, backupOptions), loaded.library);
  }
  assert.equal(JSON.stringify(legacy), before);
});

test('v1 cannot smuggle mastery fields and v2 must supply a valid exact collection', () => {
  const absent = structuredClone(ordinary);
  delete absent.masteries;
  const badRecord = record();
  badRecord.qualified = true;
  const cases = [
    { ...legacyLibrary(), masteries: [] },
    { ...legacyLibrary(), mastery: [] },
    absent,
    { ...ordinary, masteries: null },
    { ...ordinary, masteries: {} },
    { ...ordinary, masteries: [badRecord] },
    { ...ordinary, masteries: [record(), record()] },
    { ...ordinary, format: 'xonix-library.v3' },
  ];
  for (const invalid of cases) {
    const before = JSON.stringify(invalid),
      local = storage({ profile: exportLibrary(ordinary) });
    assert.equal(validateLibrary(invalid).valid, false);
    assert.throws(() => importLibrary(invalid));
    assert.throws(() => exportLibrary(invalid));
    assert.equal(saveLibrary(local, 'profile', invalid, null, { mode: 'replace' }).ok, false);
    assert.equal(local.writes.length, 0);
    assert.equal(JSON.stringify(invalid), before);
  }
  let reads = 0;
  const accessor = structuredClone(ordinary);
  Object.defineProperty(accessor, 'masteries', {
    enumerable: true,
    get: () => {
      reads++;
      return [];
    },
  });
  assert.equal(validateLibrary(accessor).valid, false);
  assert.equal(reads, 0);
});

test('metadata helper preserves ordinary awards and owns every returned record', () => {
  const metadata = record(),
    before = structuredClone(ordinary),
    next = withMasteryRecords(ordinary, [metadata]);
  assert.deepEqual(next.masteries, [metadata]);
  unchangedOrdinary(next, ordinary);
  assert.deepEqual(next.preferences, ordinary.preferences);
  assert.deepEqual(ordinary, before);
  metadata.setup.classHistory[0].tick = 1;
  assert.equal(next.masteries[0].setup.classHistory[0].tick, 0);
  assert.deepEqual(importLibrary(exportLibrary(next)), next);
  const onlyMetadata = withMasteryRecords(emptyLibrary(), [record()]);
  assert.deepEqual(onlyMetadata.campaigns, {}, 'Structural metadata never issues ordinary awards.');
  assert.equal(onlyMetadata.gallery.length, 0);
  assert.equal(onlyMetadata.scores.length, 0);
  const capacity = libraryCapacity(next);
  assert.equal(capacity.masteries, 1);
  assert.equal(capacity.maxMasteries, 4096);
  assert.equal(JSON.parse(exportLibrary(legacyLibrary())).format, LIBRARY_VERSION);
});

test('library union is idempotent and retains earliest records and changed definitions separately', () => {
  const early = record(),
    late = { ...record(), earnedAt: '2026-09-13T12:00:00.000Z', runId: 'later' },
    revised = { ...record(), definitionHash: 'mastery-v1-fedcba0987654321' };
  const left = withMasteryRecords(ordinary, [late, record(2)]),
    right = withMasteryRecords(ordinary, [early, revised]);
  const a = mergeLibraries(left, right),
    b = mergeLibraries(right, left);
  assert.deepEqual(a.masteries, b.masteries);
  assert.deepEqual(mergeLibraries(a, a).masteries, a.masteries);
  assert.equal(a.masteries.length, 3);
  assert.ok(
    a.masteries.some((item) => item.runId === early.runId && item.earnedAt === early.earnedAt),
  );
  assert.equal(
    a.masteries.some((item) => item.runId === 'later'),
    false,
  );
  unchangedOrdinary(a, ordinary);
  assert.deepEqual(mergeLibraries(legacyLibrary(), a).masteries, a.masteries);
});

test('concurrent saves union seals while preserving whole controller preferences and replacement generations', () => {
  const local = storage({ profile: JSON.stringify(legacyLibrary()) });
  const a = loadLibrary(local, 'profile'),
    b = loadLibrary(local, 'profile');
  const bindings = resolveControllerBindings();
  bindings.flight.buttons.ability = 4;
  const first = updatePreferences(withMasteryRecords(a.library, [record()]), {
    controllerBindings: bindings,
  });
  const savedA = saveLibrary(local, 'profile', first, null, {
    baseline: a.library,
    generation: a.generation,
  });
  assert.equal(savedA.ok, true, savedA.warning);
  const savedB = saveLibrary(local, 'profile', withMasteryRecords(b.library, [record(2)]), null, {
    baseline: b.library,
    generation: b.generation,
  });
  assert.equal(savedB.ok, true, savedB.warning);
  assert.equal(savedB.library.masteries.length, 2);
  assert.deepEqual(savedB.library.preferences.controllerBindings, bindings);
  unchangedOrdinary(savedB.library, ordinary);
  const reset = saveLibrary(local, 'profile', importLibrary(legacyLibrary()), null, {
    mode: 'replace',
  });
  assert.equal(reset.ok, true);
  assert.equal(reset.library.masteries.length, 0);
  const bytes = local.getItem('profile');
  const stale = saveLibrary(local, 'profile', savedB.library, null, {
    baseline: savedB.library,
    generation: savedB.generation,
  });
  assert.equal(stale.ok, false);
  assert.equal(stale.conflict, true);
  assert.equal(local.getItem('profile'), bytes);
});

test('malformed or over-capacity metadata never changes the ordinary library or storage', () => {
  const invalid = record();
  invalid.setup.classHistory = Array.from({ length: 129 }, (_, tick) => ({
    ...result.classHistory[0],
    tick,
    classId: tick % 2 ? 'scout' : 'fiber',
  }));
  const before = exportLibrary(ordinary);
  assert.throws(() => withMasteryRecords(ordinary, [invalid]), MasteryCapacityError);
  assert.equal(exportLibrary(ordinary), before);
  const local = storage({ profile: before });
  const saved = saveLibrary(local, 'profile', { ...ordinary, masteries: [invalid] }, null, {
    mode: 'replace',
  });
  assert.equal(saved.ok, false);
  assert.equal(saved.capacityError.code, 'mastery-capacity');
  assert.equal(local.writes.length, 0);
  assert.equal(local.getItem('profile'), before);
  const corrupt = JSON.stringify({ ...legacyLibrary(), masteries: [] });
  const damaged = storage({ profile: corrupt });
  assert.equal(loadLibrary(damaged, 'profile').recovery, corrupt);
  assert.equal(damaged.getItem('profile'), corrupt);
  assert.equal(damaged.writes.length, 0);
});

test('the whole library byte limit still applies when individually valid collections are combined', () => {
  const pictures = structuredClone(ordinary);
  pictures.gallery = Array.from({ length: 4096 }, (_, index) => {
    const themeId = `theme-${index}`;
    return {
      ...ordinary.gallery[0],
      themeId,
      key: `gallery-v1-${dataIdentity([campaignKey(campaign), level.id, themeId])}`,
    };
  });
  const old = importLibrary(pictures),
    before = exportLibrary(old),
    records = Array.from({ length: 4096 }, (_, index) => {
      const entry = record(index);
      return { ...entry, runId: entry.runId.padEnd(159, 'x') };
    }),
    seals = withMasteryRecords(emptyLibrary(), records);
  // Individually valid collections must exceed the actual encoded quota when combined.
  assert.ok(Buffer.byteLength(before, 'utf8') < LIBRARY_LIMITS.maxBytes);
  assert.ok(Buffer.byteLength(exportLibrary(seals), 'utf8') < LIBRARY_LIMITS.maxBytes);
  assert.ok(
    Buffer.byteLength(JSON.stringify({ ...old, masteries: seals.masteries }), 'utf8') >
      LIBRARY_LIMITS.maxBytes,
  );
  assert.equal(old.gallery.length, 4096);
  assert.equal(seals.masteries.length, 4096);
  assert.throws(() => withMasteryRecords(old, records), LibraryCapacityError);
  assert.throws(() => mergeLibraries(old, seals), LibraryCapacityError);
  assert.equal(exportLibrary(old), before);
  const local = storage({ profile: before });
  const attempt = saveLibrary(local, 'profile', seals);
  assert.equal(attempt.ok, false);
  assert.equal(attempt.capacityError.code, 'library-capacity');
  assert.equal(local.writes.length, 0);
  assert.equal(local.getItem('profile'), before);
});

test('full backups migrate old libraries and preserve v2 records, packs and live-cut checkpoints', async () => {
  for (const sourceLibrary of [legacyLibrary(), withMasteryRecords(ordinary, [record()])]) {
    const source = backup(sourceLibrary),
      before = JSON.stringify(source);
    const prepared = await prepareBackup(source, backupOptions);
    assert.equal(prepared.library.format, LIBRARY_VERSION);
    assert.equal(prepared.library.masteries.length, sourceLibrary.masteries?.length ?? 0);
    unchangedOrdinary(prepared.library, sourceLibrary);
    assert.deepEqual(prepared.session, source.session);
    const restored = await restoreSession(prepared.session, {
      campaign,
      campaignKey: campaignKey(campaign),
    });
    assert.deepEqual(authoritativeCheckpoint(restored.run), source.session.replay.checkpoint);
    const exported = await exportBackup(prepared, backupOptions);
    assert.equal(JSON.parse(exported).library.format, LIBRARY_VERSION);
    assert.deepEqual(await prepareBackup(exported, backupOptions), prepared);
    assert.equal(JSON.stringify(source), before);
  }
});

test('complete backup import and Undo replace seals through guarded generations; failed import restores exact old bytes', async () => {
  const old = backup(legacyLibrary()),
    incoming = await prepareBackup(
      backup(withMasteryRecords(ordinary, [record(), record(2)])),
      backupOptions,
    ),
    undo = await prepareBackup(old, backupOptions),
    h = coordinator(old);
  const imported = await commitBackup(incoming, h.api);
  assert.equal(imported.ok, true, imported.warning);
  assert.deepEqual(loadLibrary(h.local, 'profile').library, incoming.library);
  const undone = await commitBackup(undo, h.api);
  assert.equal(undone.ok, true, undone.warning);
  assert.deepEqual(loadLibrary(h.local, 'profile').library, undo.library);
  assert.notEqual(imported.profile.generation, undone.profile.generation);
  assert.equal(loadLibrary(h.local, 'profile').library.masteries.length, 0);
  assert.deepEqual(JSON.parse(h.raw().session), old.session);
  assert.deepEqual(JSON.parse(h.raw().packs), undo.packs);
  assert.equal(h.assets.get('journal'), null);
  const failing = coordinator(old),
    before = failing.raw();
  failing.fail();
  const rejected = await commitBackup(incoming, failing.api);
  assert.equal(rejected.ok, false);
  assert.equal(rejected.rolledBack, true);
  assert.deepEqual(failing.raw(), before, 'Rollback preserves original v1 profile bytes exactly.');
});

test('source-locked transfer migrates earlier v1 and carries v2 records without modifying source storage', async () => {
  for (const sourceLibrary of [legacyLibrary(), withMasteryRecords(ordinary, [record()])]) {
    const sourceBackup = backup(sourceLibrary),
      channel = 'release-v0.6.0',
      profileKey = `revealline.library.${channel}.v1`,
      source = storage({
        [profileKey]: JSON.stringify(sourceLibrary),
        [`revealline.suspended.${channel}.v1`]: JSON.stringify(sourceBackup.session),
      }),
      assets = new Map([[`revealline.packs.${channel}.v1`, JSON.stringify(sourceBackup.packs)]]),
      before = [...source.map],
      locks = [];
    const settings = {
      ...backupOptions,
      currentVersion: 'v0.7.0',
      storage: source,
      readAsset: async (key) => structuredClone(assets.get(key) ?? null),
      lockManager: {
        request: async (name, options, action) => {
          locks.push(name);
          assert.equal(options.ifAvailable, true);
          return action({ name });
        },
      },
    };
    const candidate = discoverProfileTransfers(settings)[0];
    const transferred = await prepareProfileTransfer(candidate.id, settings);
    assert.equal(transferred.prepared.library.format, LIBRARY_VERSION);
    assert.deepEqual(transferred.prepared.library.masteries, sourceLibrary.masteries ?? []);
    unchangedOrdinary(transferred.prepared.library, sourceLibrary);
    assert.deepEqual(transferred.prepared.session, sourceBackup.session);
    assert.deepEqual(locks, [candidate.writerKey, candidate.lockKey]);
    assert.deepEqual([...source.map], before);
    assert.deepEqual(source.writes, []);
  }
});
