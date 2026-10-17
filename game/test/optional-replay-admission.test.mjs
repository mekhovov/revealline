import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { getEventListeners } from 'node:events';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { createDemoLibrary } from '../demo-library.mjs';
import { createMasteryAwards } from '../mastery-awards.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  createOwnedRecorder,
  recordInput,
  recordRelease,
  exportReplay,
} from '../replay.mjs';
import { dataIdentity } from '../data-json.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createJourneyMasteryProofStore } from '../mastery-journey-proofs.mjs';
import { STEADY_SIGNAL } from '../mastery.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';
const read = async (p) => JSON.parse(await readFile(new URL('../../' + p, import.meta.url)));
const demo = await read('game/demo-data/first-signal-left.replay.json');
const campaign = await read('game/content/campaign.json');
campaign.classRecipes = await read('game/content/classes.json');
const compatibility = await read('game/test/fixtures/compatibility-v060.json');
const reference = compatibility.campaigns.find((x) => x.id === 'homeward-skies');
const pack = await read(reference.path);
const masteryCampaign = { ...pack.campaigns[0], classRecipes: pack.classRecipes };
const entry = compatibility.cases.find(
  (x) =>
    x.campaignId === masteryCampaign.id &&
    x.level.id === 'homeward-01' &&
    x.options.classId === 'fiber',
);
const attempt = () => ({
  replay: structuredClone({
    version: compatibility.contracts.replayVersion,
    build: compatibility.contracts.build,
    ruleset: compatibility.contracts.ruleset,
    level: entry.level,
    options: { ...entry.options, classRecipes: compatibility.roster.recipes },
    segments: entry.segments,
    ticks: entry.ticks,
    releaseAfter: entry.releaseAfter,
    summary: entry.summary,
    checkpoint: entry.checkpoint,
  }),
  campaign: structuredClone(masteryCampaign),
  definition: structuredClone(STEADY_SIGNAL),
  runId: 'admitted-mastery',
  earnedAt: '2026-09-12T12:00:00.000Z',
});
const delay = () => new Promise((r) => setTimeout(r, 1));
async function until(fn) {
  const end = Date.now() + 2000;
  while (!fn() && Date.now() < end) await delay();
  assert(fn(), 'bounded owner state missing');
}
function owner(t) {
  const media = createMediaPreparation();
  let chunks = 0;
  t.after(() => media.close());
  return {
    media,
    get chunks() {
      return chunks;
    },
    scheduleChunk: (work, { signal }) =>
      media.run(
        'main',
        () => {
          chunks++;
          work();
          if (chunks === 1) media.setPhase('playing');
        },
        { signal },
      ),
  };
}
function storage() {
  let value = null,
    writes = 0;
  return {
    read: async () => structuredClone(value),
    update: async (fn) => {
      value = fn(structuredClone(value));
      writes++;
      return structuredClone(value);
    },
    get writes() {
      return writes;
    },
  };
}
test('Demo automatic retention waits through play, preserves snapshot and saves once on Pause', async (t) => {
  const f = owner(t),
    store = storage(),
    lib = createDemoLibrary({ storage: store, enabled: true, scheduleChunk: f.scheduleChunk });
  t.after(() => lib.dispose());
  const input = structuredClone(demo),
    before = structuredClone(input);
  const pending = lib.keep(input, { entry: { campaign }, practice: false });
  await until(() => f.media.snapshot().queued === 1);
  input.level.name = 'late mutation';
  assert.equal(f.chunks, 1);
  assert.equal(store.writes, 0);
  for (let i = 0; i < 4; i++) await delay();
  assert.equal(f.chunks, 1);
  f.media.setPhase('paused');
  assert.equal((await pending).saved, true);
  assert.equal(store.writes, 1);
  assert.deepEqual(JSON.parse((await store.read()).items[0].replayText), before);
});
for (const stop of ['disable', 'dispose', 'abort'])
  test(`Demo ${stop} cannot resume an obsolete queued verifier or write`, async (t) => {
    const f = owner(t),
      store = storage(),
      lib = createDemoLibrary({ storage: store, enabled: true, scheduleChunk: f.scheduleChunk }),
      controller = new AbortController();
    t.after(() => lib.dispose());
    const pending = lib.keep(demo, {
      entry: { campaign },
      practice: false,
      signal: controller.signal,
    });
    const settled = pending.catch((e) => e);
    await until(() => f.media.snapshot().queued === 1);
    if (stop === 'disable') lib.setEnabled(false);
    else if (stop === 'dispose') lib.dispose();
    else controller.abort();
    f.media.setPhase('paused');
    assert.equal((await settled).name, 'AbortError');
    assert.equal(store.writes, 0);
    assert.equal(f.media.snapshot().queued, 0);
  });
test('legacy mastery preserves snapshot and original durable award after active-play admission', async (t) => {
  const f = owner(t),
    saved = [],
    input = attempt(),
    expected = verifiedMasteryRecord(await verifyMasteryRun(structuredClone(input)));
  const awards = createMasteryAwards({
    getGeneration: () => 1,
    commit: (record) => {
      saved.push(record);
      return true;
    },
    scheduleChunk: f.scheduleChunk,
  });
  t.after(() => awards.cancelAll());
  const pending = awards.submit(input, { eligible: true });
  await until(() => f.media.snapshot().queued === 1);
  input.replay.segments[0].input.direction = 'up';
  input.campaign.levels[0].name = 'mutated';
  input.definition.all[1].minCells = 100;
  for (let i = 0; i < 4; i++) await delay();
  assert.equal(f.chunks, 1);
  assert.equal(saved.length, 0);
  f.media.setPhase('paused');
  assert.equal((await pending).status, 'earned');
  assert.deepEqual(saved, [expected]);
  assert.equal(f.media.snapshot().queued, 0);
});
test('legacy mastery cancellation aborts queued chunks and never commits after Pause', async (t) => {
  const f = owner(t),
    saved = [],
    awards = createMasteryAwards({
      getGeneration: () => 1,
      commit: (r) => {
        saved.push(r);
        return true;
      },
      scheduleChunk: f.scheduleChunk,
    });
  const pending = awards.submit(attempt(), { eligible: true });
  await until(() => f.media.snapshot().queued === 1);
  awards.cancelAll();
  assert.equal((await pending).status, 'cancelled');
  f.media.setPhase('paused');
  await delay();
  assert.equal(f.chunks, 1);
  assert.equal(saved.length, 0);
  assert.equal(f.media.snapshot().queued, 0);
});

function authoredFixture() {
  const level = {
      version: 'xonix-level.v4',
      id: 'mastery-classic-fixture',
      name: 'Proof fixture',
      revision: '1',
      width: 72,
      height: 36,
      encounter: null,
      classic: { version: 'classic.v1', terrain: [], powerups: [] },
      spawn: { x: 60.5, y: 0.5 },
      goal: { coverage: 0.1 },
      enemies: [{ id: 'seed', type: 'bouncer', x: 20.5, y: 18.5, vx: 0, vy: 0 }],
      rules: { lives: 3, respawnSeconds: 0.1, graceSeconds: 0 },
    },
    options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    run = createRun(level, options),
    recorder = createRecorder(level, options);
  for (let tick = 0; tick < 700 && run.status === 'running'; tick++) {
    stepRun(run, { direction: 'down' }, FIXED_DT);
    recordInput(recorder, { direction: 'down' });
  }
  assert.equal(run.status, 'won');
  const clear = {
    missionId: run.levelId,
    runId: 'authored-no-loss',
    difficulty: 'standard',
    gameplayId: dataIdentity({ ruleset: run.ruleset, level: run.level, classes: run.classRecipes }),
  };
  return {
    requirement: { id: 'journey-no-loss-win', revision: '1', missionId: run.levelId },
    clear,
    replay: exportReplay(recorder, run),
    bindings: [
      {
        missionId: run.levelId,
        bindings: [{ difficulty: 'standard', gameplayId: clear.gameplayId }],
      },
    ],
  };
}
for (const mode of ['prove', 'hydrate', 'cancel'])
  test(`authored mastery ${mode} uses the same chunk owner without losing durable proof`, async (t) => {
    const input = authoredFixture(),
      values = new Map(),
      config = {
        editionId: 'admitted-authored',
        requirements: [input.requirement],
        bindings: input.bindings,
        acceptClear: () => true,
        storage: {
          getItem: (key) => values.get(key) ?? null,
          setItem: (key, value) => values.set(key, value),
        },
      };
    if (mode === 'hydrate') {
      const initial = createJourneyMasteryProofStore(config);
      assert.equal(initial.saveVerified(await initial.prove(input)), true);
    }
    const before = new Map(values),
      f = owner(t),
      store = createJourneyMasteryProofStore({ ...config, scheduleChunk: f.scheduleChunk }),
      controller = new AbortController();
    let done = false;
    const pending = (
      mode === 'hydrate'
        ? store.hydrate({ signal: controller.signal })
        : store.prove({ ...input, signal: controller.signal })
    ).then(
      (value) => {
        done = true;
        return value;
      },
      (error) => {
        done = true;
        throw error;
      },
    );
    const settled = pending.catch((error) => error);
    await until(() => f.media.snapshot().queued === 1);
    for (let i = 0; i < 4; i++) await delay();
    assert.equal(done, false);
    assert.equal(f.chunks, 1);
    assert.deepEqual(values, before);
    assert.equal(store.rewardEvidence().mastery.length, 0);
    if (mode === 'cancel') {
      controller.abort();
      assert.equal((await settled).name, 'AbortError');
      f.media.setPhase('paused');
      await delay();
      assert.deepEqual(values, before);
      assert.equal(store.rewardEvidence().mastery.length, 0);
    } else {
      f.media.setPhase('paused');
      const result = await pending;
      if (mode === 'prove') assert.equal(store.saveVerified(result), true);
      assert.equal(store.rewardEvidence().mastery.length, 1);
      assert.equal(store.rewardEvidence().mastery[0].runId, input.clear.runId);
      assert.equal(store.rewardEvidence().durableMastery.length, 1);
    }
    assert.equal(f.media.snapshot().queued, 0);
  });

const demoEntryCatalog = createExecutionCatalog([{ campaign }]);
const ownedDemoEntry = demoEntryCatalog.entries.find((entry) => entry.difficulty === 'standard');
const ownsDemoEntry = (entry) => demoEntryCatalog.find(entry?.executionKey) === entry;
function ownedDemo() {
  const run = createRun(demo.level, demo.options),
    recorder = createOwnedRecorder(demo.level, demo.options, demo.build);
  for (const segment of demo.segments) {
    assert.equal(segment.releaseBefore, false, 'Fixture needs no release boundary.');
    for (let i = 0; i < segment.ticks; i++) {
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  }
  if (demo.releaseAfter) recordRelease(recorder);
  assert.deepEqual(exportReplay(recorder, run), demo);
  return { run, recorder };
}
test('owned Demo retention admits the complete optional pipeline and keeps exact bytes', async (t) => {
  const f = ownedDemo(),
    media = createMediaPreparation(),
    store = storage();
  t.after(() => media.close());
  media.setPhase('playing');
  let stages = 0,
    hashesWhilePlaying = 0,
    serializationsWhilePlaying = 0;
  const asUintN = BigInt.asUintN,
    stringify = JSON.stringify;
  t.mock.method(BigInt, 'asUintN', (...args) => {
    if (media.snapshot().phase === 'playing') hashesWhilePlaying++;
    return asUintN(...args);
  });
  t.mock.method(JSON, 'stringify', (...args) => {
    if (
      media.snapshot().phase === 'playing' &&
      (args[0]?.segments || args[0]?.format === 'revealline-local-demos.v1')
    )
      serializationsWhilePlaying++;
    return stringify(...args);
  });
  const library = createDemoLibrary({
    ownsEntry: ownsDemoEntry,
    storage: store,
    enabled: true,
    canRunOptionalWork: () => !['playing', 'suspended'].includes(media.snapshot().phase),
    scheduleChunk: (work, options) =>
      media.run(
        'main',
        () => {
          stages++;
          return work();
        },
        options,
      ),
  });
  t.after(() => library.dispose());
  const pending = library.keepRecording(f.recorder, f.run, {
    entry: ownedDemoEntry,
    practice: false,
  });
  await until(() => media.snapshot().queued === 1);
  assert.equal(stages, 0);
  assert.equal(hashesWhilePlaying, 0);
  assert.equal(serializationsWhilePlaying, 0);
  assert.equal(store.writes, 0);
  media.setPhase('paused');
  assert.equal((await pending).saved, true);
  assert(stages > 3, 'export, prefix, verification and serialization all use the existing owner');
  assert.deepEqual(JSON.parse((await store.read()).items[0].replayText), demo);
});
for (const stop of ['disable', 'clear', 'dispose', 'abort'])
  test(`owned Demo ${stop} retires a queued export before verification or publication`, async (t) => {
    const f = ownedDemo(),
      media = createMediaPreparation(),
      store = storage(),
      controller = new AbortController();
    t.after(() => media.close());
    media.setPhase('playing');
    const library = createDemoLibrary({
      ownsEntry: ownsDemoEntry,
      storage: store,
      enabled: true,
      scheduleChunk: (work, options) => media.run('main', work, options),
    });
    t.after(() => library.dispose());
    const pending = library.keepRecording(f.recorder, f.run, {
      entry: ownedDemoEntry,
      practice: false,
      signal: controller.signal,
    });
    const rejected = assert.rejects(pending, { name: 'AbortError' });
    await until(() => media.snapshot().queued === 1);
    if (stop === 'disable') library.setEnabled(false);
    else if (stop === 'clear') await library.clear();
    else if (stop === 'dispose') library.dispose();
    else controller.abort();
    const writes = store.writes;
    await rejected;
    assert.equal(media.snapshot().phase, 'playing');
    assert.equal(
      media.snapshot().queued,
      0,
      'generation cancellation releases queued snapshots immediately',
    );
    assert.equal(getEventListeners(controller.signal, 'abort').length, 0);
    media.setPhase('paused');
    assert.equal(store.writes, writes);
  });
test('owned Demo disabled/practice admission never reads the supplied recording; manual stays opt-in independent', async () => {
  const store = storage(),
    library = createDemoLibrary({ ownsEntry: ownsDemoEntry, storage: store });
  const unusable = new Proxy(
    {},
    {
      get() {
        throw new Error('must not read disabled source');
      },
    },
  );
  assert.equal(
    (await library.keepRecording(unusable, unusable, { practice: false })).reason,
    'disabled',
  );
  assert.equal(
    (await library.keepRecording(unusable, unusable, { manual: true, practice: true })).reason,
    'practice',
  );
  const f = ownedDemo();
  assert.equal(
    (
      await library.keepRecording(f.recorder, f.run, {
        manual: true,
        practice: false,
        entry: ownedDemoEntry,
      })
    ).saved,
    true,
  );
  assert.equal(library.enabled, false);
  library.dispose();
});

test('owned Demo captures entry, manual and signal options before its queued export', async (t) => {
  const f = ownedDemo(),
    media = createMediaPreparation(),
    store = storage(),
    controller = new AbortController();
  t.after(() => media.close());
  media.setPhase('playing');
  const library = createDemoLibrary({
    storage: store,
    ownsEntry: ownsDemoEntry,
    scheduleChunk: (work, options) => media.run('main', work, options),
  });
  t.after(() => library.dispose());
  const options = {
    entry: ownedDemoEntry,
    practice: false,
    manual: true,
    signal: controller.signal,
  };
  const pending = library.keepRecording(f.recorder, f.run, options);
  await until(() => media.snapshot().queued === 1);
  options.entry = { campaign: { ...campaign, id: 'replacement-owner' } };
  options.manual = false;
  options.signal = AbortSignal.abort();
  options.practice = true;
  media.setPhase('paused');
  assert.equal(
    (await pending).saved,
    true,
    'captured manual permission and original signal survive options mutation',
  );
  assert.equal((await store.read()).items[0].descriptor.campaignKey, ownedDemoEntry.executionKey);
  assert.equal(library.enabled, false);
});
test('public and unowned Demo keep retain invocation descriptor despite in-place entry mutation', async (t) => {
  for (const mode of ['public', 'unowned']) {
    const f = ownedDemo(),
      media = createMediaPreparation(),
      store = storage(),
      entry = structuredClone(ownedDemoEntry);
    t.after(() => media.close());
    media.setPhase('playing');
    const library = createDemoLibrary({
      storage: store,
      enabled: true,
      ownsEntry: ownsDemoEntry,
      scheduleChunk: (work, options) => media.run('main', work, options),
    });
    t.after(() => library.dispose());
    const pending =
      mode === 'public'
        ? library.keep(demo, { entry, practice: false })
        : library.keepRecording(f.recorder, f.run, { entry, practice: false });
    await until(() => media.snapshot().queued === 1);
    entry.campaign.id = 'late-compatible-owner';
    media.setPhase('paused');
    assert.deepEqual(await pending, { saved: false, reason: 'incompatible' });
    assert.equal(store.writes, 0);
  }
});
