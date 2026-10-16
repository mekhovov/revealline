import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { dataIdentity, canonicalJSON } from '../data-json.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import {
  createJourneyBackend,
  createJourneyProfileStore,
  emptyJourneyProfile,
  JOURNEY_PERFORMANCE_BACKUP_VERSION,
  JOURNEY_STARS_BACKUP_VERSION,
  JOURNEY_COMBINED_BACKUP_VERSION,
} from '../journey/profile.mjs';
import {
  verifyPerformanceRecord,
  performanceSummary,
  performanceComparison,
  selectPerformanceRecords,
} from '../journey/performance.mjs';
import { emptyJourneyStars } from '../journey/stars.mjs';
import { createSoloPerformanceBinding } from '../journey/performance-binding.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { journeyPerformanceText } from '../ui/journey-performance.mjs';

// Frozen profile readers/writers from the two branches that independently issued
// v4. Only the profile module is frozen; its relative imports use the current
// shared dependencies. No Git, network access, or test-time file writes are used.
async function historicalProfile(file, sha256) {
  const bytes = await readFile(new URL(`./fixtures/${file}`, import.meta.url));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  const source = bytes
    .toString()
    .replace(
      /from (['"])(\.\.?\/[^'"]+)\1/g,
      (_, _quote, relative) =>
        `from ${JSON.stringify(new URL(relative, new URL('../journey/profile.mjs', import.meta.url)).href)}`,
    );
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const oldStarsProfile = await historicalProfile(
  'journey-profile-v4-stars-321408a3c.mjs.txt',
  'b52be92340d496765659d32d827a41aac1c78230068025b20d582950c75df2b0',
);
const oldPerformanceProfile = await historicalProfile(
  'journey-profile-v4-performance-db4b2c8e.mjs.txt',
  'ef1cd43d45f2415574da3390dd4ac83a71bf44685d489cc4b42d79cf6c0a4820',
);

const missionId = 'candidate/workshop/route/one';
const authored = {
  version: 'xonix-level.v1',
  id: 'one',
  revision: '1',
  name: 'One',
  width: 48,
  height: 36,
  spawn: { x: 24.5, y: 0.5 },
  walls: [],
  enemies: [{ id: 'keeper', type: 'bouncer', x: 40.5, y: 25.5, vx: 0, vy: 0, radius: 0.3 }],
  objectives: [],
  supplies: [],
  goal: { coverage: 0.3 },
};
function flight(
  runId,
  { wait = 0, seed = 1, difficulty = 'standard', turnPolicy = 'immediate' } = {},
) {
  const level = applyGameplayTuning(authored, resolveGameplayTuning(difficulty));
  const options = { seed, turnPolicy, classId: 'scout' };
  const run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let i = 0; i < wait; i++) {
    const input = { direction: null };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  for (let i = 0; i < 1500 && run.status === 'running'; i++) {
    const input = { direction: 'down' };
    stepRun(run, input, FIXED_DT);
    recordInput(recorder, input);
  }
  assert.equal(run.status, 'won');
  return {
    mode: 'solo',
    missionId,
    runId,
    difficulty,
    gameplayId: dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
    replay: exportReplay(recorder, run),
  };
}
const clear = ({ replay: _replay, ...record }) => ({ type: 'complete', ...record });
function profile(record) {
  const p = emptyJourneyProfile();
  p.clears.solo[record.missionId] = {
    runId: record.runId,
    gameplayId: record.gameplayId,
    difficulty: record.difficulty,
  };
  return p;
}
function binding() {
  const mission = { id: missionId, levelId: 'one' },
    entry = { campaign: { levels: [authored] }, classRecipes: CLASSES };
  return createSoloPerformanceBinding({
    host: {
      catalog: { find: (id) => (id === missionId ? mission : null) },
      select: () => entry,
      owns: (value) => value === entry,
    },
  });
}
function fixture(disk = managedIndexedDB(), extra = {}) {
  const backend = createJourneyBackend({ ...disk, profileKey: 'journey-performance-test' });
  const store = createJourneyProfileStore({
    backend,
    acceptPerformanceBinding: binding(),
    ...extra,
  });
  return { disk, backend, store };
}
async function earn(f, record) {
  f.store.record(clear(record));
  await f.store.flush();
  return f.store.performance.capture(record);
}

test('actual replay comparisons preserve independent real-run records and exact setup partitioning', async () => {
  const slow = flight('slow', { wait: 360 }),
    fast = flight('fast'),
    slower = flight('slower', { wait: 480 });
  const checked = [];
  for (const raw of [slow, fast, slower])
    checked.push(
      await verifyPerformanceRecord(raw, { profile: profile(raw), acceptBinding: binding() }),
    );
  assert.equal(performanceComparison(checked[0], []), null);
  const comparison = performanceComparison(checked[1], [checked[0]]);
  assert.equal(comparison.fastest.runId, 'slow');
  assert.equal(comparison.scoreBest.runId, 'slow');
  assert(comparison.secondsFaster > 2.9);
  assert(performanceComparison(checked[2], checked.slice(0, 2)).secondsFaster < 0);
  assert(selectPerformanceRecords(checked).every((row) => ['fast', 'slow'].includes(row.runId)));
  for (const patch of [{ seed: 2 }, { turnPolicy: 'grid-center' }, { difficulty: 'gentle' }]) {
    const raw = flight('different', patch),
      row = await verifyPerformanceRecord(raw, { profile: profile(raw), acceptBinding: binding() });
    assert.equal(performanceComparison(row, checked), null);
  }
  assert.equal(
    performanceSummary({ ...checked[0] }),
    null,
    'Copied flags cannot authorize a verified recap.',
  );
});

test('ordinary Journey bytes and clear records stay unchanged until optional verified evidence is saved', async () => {
  const f = fixture();
  await f.store.load();
  const original = f.store.export();
  assert.equal(JSON.parse(original).format, 'revealline-journey-backup.v2');
  const one = flight('first');
  f.store.record(clear(one));
  await f.store.flush();
  const before = f.store.snapshot();
  assert.equal(await f.backend.readState().then((state) => state.performance), undefined);
  const result = await f.store.performance.capture(one);
  assert.equal(result.comparison, null);
  assert.equal(result.durable, true);
  assert.deepEqual(f.store.snapshot(), before);
  assert.deepEqual(await f.backend.read(), before);
  const exported = JSON.parse(f.store.export());
  assert.equal(exported.format, JOURNEY_COMBINED_BACKUP_VERSION);
  assert.equal(exported.performance.records[0].runId, 'first');
  assert.deepEqual(
    new Set(f.disk.allPuts.map(([, key]) => key)),
    new Set(['journey-performance-test', 'journey-performance-test:performance.v1']),
  );
  f.store.performance.dispose();
});

test('a later worse accepted win keeps the verified faster run after reload without fabricated historical bests', async () => {
  const f = fixture();
  await f.store.load();
  await earn(f, flight('best'));
  const result = await earn(f, flight('later', { wait: 360 }));
  assert(result.comparison.secondsFaster < 0);
  assert.equal(result.comparison.fastest.runId, 'best');
  assert.equal(f.store.snapshot().clears.solo[missionId].runId, 'later');
  const reloaded = fixture(f.disk);
  await reloaded.store.load();
  await waitFor(() => reloaded.store.performance.snapshot().records.length > 0);
  assert(
    reloaded.store.performance
      .snapshot()
      .records.some((row) => row.runId === 'best' && row.durable),
  );
  assert.equal(reloaded.store.snapshot().clears.solo[missionId].runId, 'later');
  f.store.performance.dispose();
  reloaded.store.performance.dispose();
});

test('async backup inspection rejects claimed numbers, wrong missions and cancelled replays before changing clears', async () => {
  const f = fixture();
  await f.store.load();
  await earn(f, flight('original'));
  const backup = JSON.parse(f.store.export());
  const target = fixture();
  await target.store.load();
  assert.throws(() => target.store.inspectBackup(backup), /asynchronously/);
  const bad = structuredClone(backup);
  bad.performance.records[0].replay.summary.score++;
  await assert.rejects(target.store.inspectBackupAsync(bad), /reconstruct/);
  const wrong = structuredClone(backup);
  wrong.performance.records[0].missionId = 'candidate/foreign/route/one';
  await assert.rejects(target.store.restoreAsync(wrong), /accepted Journey mission/);
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(target.store.inspectBackupAsync(backup, { signal: controller.signal }), {
    name: 'AbortError',
  });
  assert.deepEqual(target.store.snapshot(), emptyJourneyProfile());
  await target.store.restoreAsync(backup);
  assert.equal(target.store.performance.snapshot().records[0].runId, 'original');
  assert.equal(target.store.performance.snapshot().records[0].durable, true);
  f.store.performance.dispose();
  target.store.performance.dispose();
});

test('optional quota failure preserves the durable clear and cannot leak session-only evidence into an unrelated write', async () => {
  const f = fixture();
  await f.store.load();
  f.disk.onAnyPut = ({ key }) => {
    if (key.endsWith(':performance.v1')) throw new Error('Optional record quota');
  };
  const failed = await earn(f, flight('session-best'));
  assert.equal(failed.durable, false);
  assert.match(journeyPerformanceText(failed), /session only/);
  assert.doesNotMatch(journeyPerformanceText(failed), /unavailable/);
  assert.equal((await f.backend.read()).clears.solo[missionId].runId, 'session-best');
  assert.equal(f.store.status().durable, true);
  assert(f.store.performance.snapshot().records.every((row) => !row.durable));
  f.disk.onAnyPut = null;
  const slower = await earn(f, flight('later-durable', { wait: 600 }));
  assert.equal(slower.durable, true);
  const state = await f.backend.readState();
  assert(!state.performance.records.some((row) => row.runId === 'session-best'));
  assert(state.performance.records.some((row) => row.runId === 'later-durable'));
  f.store.performance.dispose();
});

test('corrupt optional persisted evidence neither invents a best nor blocks ordinary progress', async () => {
  const f = fixture();
  await f.store.load();
  await earn(f, flight('valid'));
  const before = await f.backend.readState(),
    corrupt = structuredClone(before.performance);
  corrupt.generation++;
  corrupt.records[0].replay.summary.score++;
  await f.backend.commitState([
    { type: 'performance', previous: canonicalJSON(before.performance), performance: corrupt },
  ]);
  const reloaded = fixture(f.disk);
  await reloaded.store.load();
  await waitFor(() => reloaded.store.performance.snapshot().error !== null);
  assert.deepEqual(reloaded.store.performance.snapshot().records, []);
  reloaded.store.record({ type: 'select', mode: 'solo', missionId });
  assert.equal(await reloaded.store.flush(), true);
  assert.equal((await reloaded.backend.read()).clears.solo[missionId].runId, 'valid');
  assert.deepEqual(
    (await reloaded.backend.readState()).performance,
    corrupt,
    'The corrupt original is not silently overwritten.',
  );
  const later = await earn(reloaded, flight('later-safe-clear'));
  assert.equal(later.durable, false);
  assert.equal((await reloaded.backend.read()).clears.solo[missionId].runId, 'later-safe-clear');
  assert.deepEqual(
    (await reloaded.backend.readState()).performance,
    corrupt,
    'A later verified win also leaves corrupt original evidence for recovery.',
  );
  f.store.performance.dispose();
  reloaded.store.performance.dispose();
});

test('asynchronous Restore applies its inspected owned backup rather than mutated caller data', async () => {
  const source = fixture();
  await source.store.load();
  const record = flight('inspected-original');
  await earnWithStars(source, record);
  const backup = JSON.parse(source.store.export());
  let reached, release;
  const waiting = new Promise((resolve) => {
    reached = resolve;
  });
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const admit = binding();
  const target = fixture(managedIndexedDB(), {
    acceptPerformanceBinding: async (...args) => {
      reached();
      await gate;
      return admit(...args);
    },
  });
  await target.store.load();
  const pending = target.store.restoreAsync(backup);
  await waiting;
  backup.profile.clears.solo[missionId].runId = 'mutated-after-inspection';
  backup.performance.records[0].replay.summary.score++;
  backup.stars.best.solo[missionId] = 0;
  release();
  await pending;
  assert.equal(target.store.snapshot().clears.solo[missionId].runId, 'inspected-original');
  assert.equal(target.store.bestStars('solo', missionId), starsFor(record));
  assert.equal(target.store.performance.snapshot().records[0].runId, 'inspected-original');
  assert.equal(target.store.performance.snapshot().records[0].durable, true);
  source.store.performance.dispose();
  target.store.performance.dispose();
});

test('temporarily unavailable historical ownership cannot erase otherwise valid earlier evidence', async () => {
  const source = fixture();
  await source.store.load();
  await earn(source, flight('historical'));
  const before = (await source.backend.readState()).performance;
  const admit = binding();
  const target = fixture(source.disk, {
    acceptPerformanceBinding: (record, ...rest) => {
      if (record.runId === 'historical')
        throw new Error('Registered historical source is unavailable');
      return admit(record, ...rest);
    },
  });
  await target.store.load();
  const result = await earn(target, flight('current'));
  assert.equal(result.durable, false);
  assert.equal((await target.backend.read()).clears.solo[missionId].runId, 'current');
  assert.deepEqual((await target.backend.readState()).performance, before);
  source.store.performance.dispose();
  target.store.performance.dispose();
});

test('backup restore reports partial durability when the lease is lost after ordinary clears commit', async () => {
  const donor = fixture();
  await donor.store.load();
  await earn(donor, flight('donor'));
  let writable = true;
  const disk = managedIndexedDB(),
    target = fixture(disk, { canWrite: () => writable });
  await target.store.load();
  disk.afterAnyCommit = () => {
    writable = false;
  };
  const result = await target.store.restoreAsync(JSON.parse(donor.store.export()));
  assert.equal(result.performance.durable, false);
  assert.equal(await target.store.flush(), true);
  assert.equal((await target.backend.read()).clears.solo[missionId].runId, 'donor');
  assert.equal((await target.backend.readState()).performance, undefined);
  assert(target.store.performance.snapshot().records.every((row) => !row.durable));
  donor.store.performance.dispose();
  target.store.performance.dispose();
});

test('compare-and-swap performance commits reject stale writers without changing the current best or clear', async () => {
  const f = fixture();
  await f.store.load();
  await earn(f, flight('one'));
  const first = await f.backend.readState(),
    next = structuredClone(first.performance);
  next.generation++;
  await f.backend.commitState([
    { type: 'performance', previous: canonicalJSON(first.performance), performance: next },
  ]);
  await assert.rejects(
    f.backend.commitState([
      { type: 'performance', previous: canonicalJSON(first.performance), performance: next },
    ]),
    /another tab/,
  );
  assert.equal((await f.backend.readState()).performance.generation, next.generation);
  assert.equal((await f.backend.read()).clears.solo[missionId].runId, 'one');
  f.store.performance.dispose();
});

test('hosts without the Solo verifier preserve optional evidence without displaying or rewriting it', async () => {
  const f = fixture();
  await f.store.load();
  await earn(f, flight('solo'));
  const original = JSON.parse(f.store.export()).performance;
  const readOnly = createJourneyProfileStore({ backend: f.backend });
  await readOnly.load();
  assert.equal(readOnly.performance.snapshot().supported, false);
  assert.deepEqual(readOnly.performance.snapshot().records, []);
  assert.deepEqual(JSON.parse(readOnly.export()).performance, original);
  readOnly.record({ type: 'select', mode: 'team', missionId: 'team-candidate' });
  assert.equal(await readOnly.flush(), true);
  assert.deepEqual((await f.backend.readState()).performance, original);
  readOnly.performance.dispose();
  f.store.performance.dispose();
});

test('a lost writer lease leaves optional comparisons and accepted clears session-only', async () => {
  const f = fixture(managedIndexedDB(), { canWrite: () => false });
  await f.store.load();
  const record = flight('unwritten');
  f.store.record({ ...clear(record), stars: starsFor(record) });
  assert.equal(await f.store.flush(), false);
  const result = await f.store.performance.capture(record);
  assert.equal(result.durable, false);
  assert.equal(f.store.snapshot().clears.solo[missionId].runId, 'unwritten');
  assert.equal(f.store.bestStars('solo', missionId), starsFor(record));
  assert.equal(JSON.parse(f.store.export()).format, JOURNEY_COMBINED_BACKUP_VERSION);
  assert.deepEqual((await f.backend.readState()).stars, emptyJourneyStars());
  assert(f.store.performance.snapshot().records.every((row) => !row.durable));
  assert.deepEqual(await f.backend.read(), emptyJourneyProfile());
  assert.deepEqual(f.disk.allPuts, []);
  f.store.performance.dispose();
});

test('optional save timeout cancels a delayed native transaction without a late durable write', async () => {
  const f = fixture(managedIndexedDB(), { operationTimeoutMs: 10 });
  await f.store.load();
  const original = f.backend.commitState;
  let signal;
  f.backend.commitState = async (events, options) => {
    if (events.some((event) => event.type === 'performance')) {
      signal = options.signal;
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    return original(events, options);
  };
  const result = await earn(f, flight('timed-out'));
  assert.equal(result.durable, false);
  assert.equal(result.saveUnconfirmed, true);
  assert.equal(signal.aborted, true);
  await new Promise((resolve) => setTimeout(resolve, 100));
  const state = await f.backend.readState();
  assert.equal(state.performance, undefined);
  assert.equal(state.profile.clears.solo[missionId].runId, 'timed-out');
  f.store.performance.dispose();
});

test('an adapter that ignores cancellation is reported unconfirmed instead of claiming its eventual write rolled back', async () => {
  const f = fixture(managedIndexedDB(), { operationTimeoutMs: 10 });
  await f.store.load();
  const original = f.backend.commitState;
  f.backend.commitState = async (events) => {
    if (events.some((event) => event.type === 'performance'))
      await new Promise((resolve) => setTimeout(resolve, 80));
    return original(events);
  };
  const result = await earn(f, flight('unknown-save'));
  assert.equal(result.saveUnconfirmed, true);
  assert.doesNotMatch(journeyPerformanceText(result), /session only/);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal((await f.backend.readState()).performance.records[0].runId, 'unknown-save');
  assert(f.store.performance.snapshot().records.every((row) => !row.durable));
  f.store.performance.dispose();
});

test('cancellation aborts an active optional transaction while preserving the ordinary clear', async () => {
  const f = fixture();
  await f.store.load();
  const record = flight('cancelled-write'),
    controller = new AbortController();
  f.store.record(clear(record));
  await f.store.flush();
  f.disk.onAnyPut = ({ key }) => {
    if (key.endsWith(':performance.v1')) controller.abort();
  };
  await assert.rejects(f.store.performance.capture(record, { signal: controller.signal }), {
    name: 'AbortError',
  });
  const state = await f.backend.readState();
  assert.equal(state.performance, undefined);
  assert.equal(state.profile.clears.solo[missionId].runId, 'cancelled-write');
  f.store.performance.dispose();
});

test('cyclic and non-JSON optional backend data cannot interrupt accepted clears', async () => {
  for (const corrupt of [
    new Date(),
    1n,
    (() => {
      const value = {};
      value.self = value;
      return value;
    })(),
  ]) {
    const f = fixture();
    const readState = f.backend.readState;
    f.backend.readState = async () => ({ ...(await readState()), performance: corrupt });
    await f.store.load();
    assert.equal(f.store.status().durable, true);
    f.store.record(clear(flight('survives')));
    assert.equal(await f.store.flush(), true);
    assert.equal((await f.backend.read()).clears.solo[missionId].runId, 'survives');
    assert.equal(f.store.performance.snapshot().records.length, 0);
    f.store.performance.dispose();
  }
});

const starsFor = (record) =>
  record.replay.summary.medal === 'gold' ? 3 : record.replay.summary.medal === 'silver' ? 2 : 1;
async function earnWithStars(f, record) {
  f.store.record({ ...clear(record), stars: starsFor(record) });
  assert.equal(await f.store.flush(), true);
  assert.equal((await f.store.performance.capture(record)).durable, true);
}

test('both issued v4 exact shapes import in either order and re-export unambiguous v5 evidence', async () => {
  const source = fixture(),
    record = flight('v4-donor');
  await source.store.load();
  await earnWithStars(source, record);
  const combined = JSON.parse(source.store.export());
  assert.equal(combined.format, JOURNEY_COMBINED_BACKUP_VERSION);
  assert.deepEqual(Object.keys(combined).sort(), [
    'format',
    'performance',
    'pictures',
    'profile',
    'profileKey',
    'stars',
  ]);
  const { performance: evidence, stars } = combined;
  const oldStarStore = oldStarsProfile.createJourneyProfileStore({
      backend: oldStarsProfile.createJourneyBackend({
        ...source.disk,
        profileKey: source.backend.profileKey,
      }),
    }),
    oldPerformanceStore = oldPerformanceProfile.createJourneyProfileStore({
      backend: oldPerformanceProfile.createJourneyBackend({
        ...source.disk,
        profileKey: source.backend.profileKey,
      }),
      acceptPerformanceBinding: binding(),
    });
  await oldStarStore.load();
  await oldPerformanceStore.load();
  await waitFor(() => oldPerformanceStore.performance.snapshot().records.length === 1);
  const oldStars = JSON.parse(oldStarStore.export()),
    oldPerformance = JSON.parse(oldPerformanceStore.export());
  assert.deepEqual(oldStars.stars, stars);
  assert.deepEqual(oldPerformance.performance.records, evidence.records);
  assert.equal(oldStars.format, 'revealline-journey-backup.v4');
  assert.equal(oldPerformance.format, 'revealline-journey-backup.v4');
  for (const order of [
    [oldStars, oldPerformance],
    [oldPerformance, oldStars],
  ]) {
    const target = fixture();
    await target.store.load();
    for (const backup of order) {
      const inspected = await target.store.inspectBackupAsync(backup);
      assert.deepEqual(inspected.backup, backup, 'The historical envelope shape remains exact.');
      if ('performance' in backup) await target.store.restoreAsync(backup);
      else target.store.restore(backup);
      assert.equal(await target.store.flush(), true);
    }
    assert.equal(target.store.bestStars('solo', missionId), starsFor(record));
    assert.deepEqual(target.store.snapshot(), source.store.snapshot());
    const exported = JSON.parse(target.store.export());
    assert.equal(exported.format, JOURNEY_COMBINED_BACKUP_VERSION);
    assert.deepEqual(exported.stars, stars);
    assert.deepEqual(exported.performance.records, evidence.records);
    const roundTrip = fixture();
    await roundTrip.store.load();
    await roundTrip.store.restoreAsync(exported);
    assert.equal(await roundTrip.store.flush(), true);
    const saved = await roundTrip.backend.readState();
    assert.deepEqual(saved.profile, target.store.snapshot());
    assert.deepEqual(saved.stars, stars);
    assert.deepEqual(saved.performance.records, evidence.records);
    target.store.performance.dispose();
    roundTrip.store.performance.dispose();
  }
  // Each older reader writes only its own known fields. A rollback must not
  // remove the other branch's already-earned metadata or verified replays.
  oldStarStore.record({ type: 'select', mode: 'solo', missionId });
  assert.equal(await oldStarStore.flush(), true);
  oldPerformanceStore.record({ type: 'select', mode: 'solo', missionId });
  assert.equal(await oldPerformanceStore.flush(), true);
  const afterOlderWrites = await source.backend.readState();
  assert.deepEqual(afterOlderWrites.stars, stars);
  assert.deepEqual(afterOlderWrites.performance.records, evidence.records);
  oldPerformanceStore.performance.dispose();
  source.store.performance.dispose();
});

test('ambiguous v4 shapes and malformed v5 sidecars cannot change accepted progress or stars', async () => {
  const source = fixture();
  await source.store.load();
  await earnWithStars(source, flight('shape-donor'));
  const combined = JSON.parse(source.store.export()),
    { stars: _stars, performance: _performance, ...base } = combined;
  const wrongReplay = structuredClone(combined);
  wrongReplay.performance.records[0].replay.summary.score++;
  const orphan = structuredClone(combined);
  orphan.stars.best.solo['missing-clear'] = 3;
  const invalid = [
    { ...combined, format: JOURNEY_STARS_BACKUP_VERSION },
    { ...base, format: JOURNEY_PERFORMANCE_BACKUP_VERSION },
    { ...base, performance: combined.performance },
    { ...combined, unexpected: true },
    { ...combined, stars: null },
    { ...combined, performance: null },
    wrongReplay,
    orphan,
  ];
  for (const backup of invalid) {
    const target = fixture();
    await target.store.load();
    await assert.rejects(target.store.restoreAsync(backup));
    assert.deepEqual(target.store.snapshot(), emptyJourneyProfile());
    assert.deepEqual(target.store.stars(), emptyJourneyStars());
    assert.deepEqual(target.store.performance.snapshot().records, []);
    assert.deepEqual(target.disk.allPuts, []);
    target.store.performance.dispose();
  }
  source.store.performance.dispose();
});

test('four-record transactions preserve both sidecars across cancellation, quota failure and retry', async () => {
  const f = fixture();
  await f.store.load();
  await earnWithStars(f, flight('before-transaction'));
  const before = await f.backend.readState(),
    nextRecord = flight('after-transaction', { wait: 100 }),
    afterPerformance = {
      ...before.performance,
      generation: before.performance.generation + 1,
      records: [nextRecord],
    },
    events = [
      { ...clear(nextRecord), stars: starsFor(nextRecord) },
      {
        type: 'performance',
        previous: canonicalJSON(before.performance),
        performance: afterPerformance,
      },
    ];
  assert.equal(before.stars.best.solo[missionId], starsFor(before.performance.records[0]));
  for (const failure of ['cancel', 'quota']) {
    const controller = new AbortController();
    f.disk.onAnyPut = ({ key }) => {
      if (key.endsWith(':stars.v1') && failure === 'cancel') controller.abort();
    };
    f.disk.failAnyPutAt = failure === 'quota' ? 3 : null;
    await assert.rejects(
      f.backend.commitState(events, { signal: controller.signal }),
      failure === 'cancel' ? { name: 'AbortError' } : /write failure/,
    );
    assert.deepEqual(
      await f.backend.readState(),
      before,
      'The clear, star metadata and performance evidence remain one atomic native transaction.',
    );
  }
  f.disk.onAnyPut = null;
  f.disk.failAnyPutAt = null;
  const accepted = await f.backend.commitState(events);
  assert.equal(accepted.profile.clears.solo[missionId].runId, nextRecord.runId);
  assert.deepEqual(accepted.performance, afterPerformance);
  assert.deepEqual(accepted.stars, before.stars);
  const reloaded = fixture(f.disk);
  await reloaded.store.load();
  await waitFor(() => reloaded.store.performance.snapshot().records.length === 1);
  assert.equal(reloaded.store.performance.snapshot().records[0].runId, nextRecord.runId);
  assert.equal(reloaded.store.bestStars('solo', missionId), before.stars.best.solo[missionId]);
  f.store.performance.dispose();
  reloaded.store.performance.dispose();
});
