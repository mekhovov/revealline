import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createMediaPreparation } from '../ui/media-preparation.mjs';
import { createDemoLibrary } from '../demo-library.mjs';
import { createMasteryAwards } from '../mastery-awards.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay } from '../replay.mjs';
import { dataIdentity } from '../data-json.mjs';
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
