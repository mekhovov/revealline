import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../core/index.mjs';
import {
  createRecorder,
  recordInput,
  recordRelease,
  exportReplay,
  verifyReplayAsync,
} from '../replay.mjs';
import {
  appearanceMilestones,
  unlockedBodies,
  newAppearanceBodies,
  achievements,
  canPlay,
} from '../progress.mjs';
import {
  campaignKey,
  emptyLibrary,
  progressFor,
  recordLibraryCompletion,
  exportLibrary,
  importLibrary,
  withMasteryRecords,
  loadLibrary,
  saveLibrary,
} from '../library.mjs';
import {
  preparePack,
  resolvePackCampaign,
  emptyPackLibrary,
  installPack,
  removePack,
} from '../packs.mjs';
import { prepareBackup, exportBackup, BACKUP_FORMAT } from '../backup.mjs';
import { verifyMasteryRun, verifiedMasteryRecord } from '../mastery-verification.mjs';
import { STEADY_SIGNAL } from '../mastery.mjs';

const copy = (value) => structuredClone(value);
const sha = (value) => createHash('sha256').update(value).digest('hex');
const read = (path) => readFile(new URL(path, import.meta.url));
const json = async (path) => JSON.parse(await read(path));
const homeProofBytes = await read('../replays/homeward-routes.json');
const workshopProofBytes = await read('../replays/expansion-routes.json');
const homeProof = JSON.parse(homeProofBytes);
const workshopProof = JSON.parse(workshopProofBytes);
const noImage = async () => {
  throw new Error('These integration inputs have no embedded artwork.');
};
const homeSource = await json('../content/packs/homeward-skies.json');
// Remove only dedicated presentation assets: maps, rosters and identities stay intact.
homeSource.visualOverrides = {};
homeSource.levelVisuals = [];
const home = (await preparePack(homeSource, { decodeImage: noImage })).pack;
const workshopSource = await json('../content/packs/equipment-workshop.json');
// This suite tests identity/rewards; actual illustrated transport has its own integration cases.
workshopSource.levelVisuals = [];
const workshop = (await preparePack(workshopSource, { decodeImage: noImage })).pack;
const packs = [home, workshop];
const campaigns = new Map(
  packs.map((pack) => [pack.id, resolvePackCampaign(pack, pack.campaigns[0].id).campaign]),
);
const STAMP = '2026-09-12T12:00:00.000Z';
const FIRST = ['fpv-racer', 'fixedwing-body', 'ukrainian-falcon', 'retro-vector', 'navi-auditor'];
const FINAL = ['fpv-night', 'delta-interceptor'];
const traces = new Map();
const completions = new Map();
const runId = (pack, policy, levelId) => `chapter-${pack.id}/${policy}/${levelId}`;
const keyFor = (pack, policy) => `${pack.id}/${policy}`;
function trace(pack, policy, level) {
  const route =
    pack === home
      ? homeProof.routes.find(
          (item) =>
            item.levelId === level.id && item.turnPolicy === policy && item.variant === 'specialty',
        )
      : workshopProof.routes.find(
          (item) =>
            item.packId === pack.id && item.levelId === level.id && item.turnPolicy === policy,
        );
  assert.ok(route);
  const options = {
    classId: route.classId,
    classRecipes: campaigns.get(pack.id).classRecipes,
    seed: route.seed,
    turnPolicy: policy,
  };
  const run = createRun(level, options),
    recorder = createRecorder(level, options, 'chapter-reward-integration');
  for (const segment of route.segments) {
    if (segment.releaseBefore) {
      releaseInputs(run);
      recordRelease(recorder);
    }
    for (let tick = 0; tick < segment.ticks; tick++) {
      stepRun(run, segment.input, FIXED_DT);
      recordInput(recorder, segment.input);
    }
  }
  const replay = exportReplay(recorder, run);
  assert.deepEqual(replay.summary, route.expected);
  if (pack === home) assert.deepEqual(replay.checkpoint, route.checkpoint);
  else {
    // Workshop reuses the old geometry with new map/display identities. Compare
    // its unchanged simulation sections with the archived matching input route.
    const original = homeProof.routes.find(
      (item) =>
        item.levelId === level.id.replace('workshop', 'homeward') &&
        item.turnPolicy === policy &&
        item.classId === 'interceptor',
    );
    for (const section of [
      'board',
      'player',
      'trail',
      'enemies',
      'objectives',
      'supplies',
      'ability',
      'clock',
      'continuation',
    ])
      assert.equal(replay.checkpoint.sections[section], original.checkpoint.sections[section]);
  }
  return replay;
}
function award(library, pack, policy, levelId, overrides = {}) {
  const campaign = campaigns.get(pack.id),
    level = campaign.levels.find((item) => item.id === levelId);
  return recordLibraryCompletion(library, {
    campaign,
    result: traces.get(runId(pack, policy, levelId)).summary,
    runId: runId(pack, policy, levelId),
    themeId: level.themeId ?? campaign.themeId,
    bodyId: 'fpv-body',
    sourcePackId: pack.id,
    completedAt: STAMP,
    ...overrides,
  });
}
for (const pack of packs)
  for (const policy of ['immediate', 'grid-center']) {
    const campaign = campaigns.get(pack.id),
      snapshots = [emptyLibrary()];
    for (const level of campaign.levels) {
      traces.set(runId(pack, policy, level.id), trace(pack, policy, level));
      snapshots.push(award(snapshots.at(-1), pack, policy, level.id));
    }
    completions.set(keyFor(pack, policy), snapshots);
  }
const states = (pack, policy = 'immediate') => completions.get(keyFor(pack, policy));
const finalTier = (library, campaign) =>
  appearanceMilestones(progressFor(library, campaign), campaign).find(
    (tier) => tier.id === 'chapter-explorer',
  );

test('chapter reward work preserves original route and campaign identity oracles', () => {
  assert.equal(
    sha(homeProofBytes),
    '63a77908b1ce98b480f9fd0431894e4f1d58ad56e4266ae0860206de564d8c1a',
  );
  assert.equal(
    sha(workshopProofBytes),
    '22886cf439f716db31333b3b6d9fae0478f8007aff734632badc7c2f38dc53c8',
  );
  assert.equal(campaignKey(campaigns.get(home.id)), 'homeward-skies/1/0d01f5687b3c38ff');
  assert.equal(campaignKey(campaigns.get(workshop.id)), 'equipment-workshop/1/3fc2cf073da368b4');
  // Produced by frozen v0.9 site core/library modules from these same three legal
  // routes, IDs and timestamp. Source: 315a4782a159f2274f7200e3470ec20c3859707b.
  // Ordinary tests use this fixed oracle, never archived code or Git at runtime.
  const owned = JSON.parse(exportLibrary(states(home)[3]));
  assert.equal(Object.hasOwn(owned.preferences, 'campaignDifficulty'), true);
  assert.equal(owned.preferences.campaignDifficulty, 'standard');
  delete owned.preferences.campaignDifficulty;
  assert.equal(Object.hasOwn(owned.preferences, 'controllerBoostMode'), true);
  assert.equal(owned.preferences.controllerBoostMode, 'hold');
  // Allow only these explicit preference additions; retain the exact old serialized oracle.
  delete owned.preferences.controllerBoostMode;
  const portable = JSON.stringify(owned);
  assert.equal(Buffer.byteLength(portable), 3830);
  assert.equal(sha(portable), '046288ac3e835b01d295b65b6a6c612f9ae0b9de916c45d0cebb0a229e240658');
});

for (const pack of packs)
  for (const policy of ['immediate', 'grid-center'])
    test(`${pack.id}/${policy}: three actual clears unlock the final cosmetic tier once`, async () => {
      const campaign = campaigns.get(pack.id),
        snapshots = states(pack, policy);
      for (let count = 0; count <= 3; count++) {
        const library = snapshots[count],
          before = exportLibrary(library),
          progress = progressFor(library, campaign),
          tier = finalTier(library, campaign);
        assert.equal(tier.target, 3);
        assert.equal(tier.count, count);
        assert.equal(tier.earned, count === 3);
        for (const body of FINAL)
          assert.equal(unlockedBodies(progress, campaign).has(body), count === 3);
        assert.equal(
          achievements(progress, campaign).find((a) => a.id === 'pathfinder').earned,
          count === 3,
        );
        assert.equal(
          library.masteries.length,
          0,
          'Ordinary completion never infers equipment seals.',
        );
        assert.equal(exportLibrary(library), before, 'Projection has no persistence side effects.');
        if (count) {
          assert.deepEqual(
            newAppearanceBodies(progressFor(snapshots[count - 1], campaign), progress, campaign),
            count === 1 ? FIRST : count === 3 ? FINAL : [],
          );
          const level = campaign.levels[count - 1];
          const checked = await verifyReplayAsync(traces.get(runId(pack, policy, level.id)));
          assert.equal(checked.match, true);
        }
      }
      const repeated = award(snapshots[3], pack, policy, campaign.levels[2].id);
      assert.equal(repeated, snapshots[3], 'The same run ID is idempotent.');
      assert.deepEqual(
        newAppearanceBodies(
          progressFor(snapshots[3], campaign),
          progressFor(repeated, campaign),
          campaign,
        ),
        [],
      );
    });

test('another steering variant is not a second map, and chapter eligibility stays local', () => {
  const campaign = campaigns.get(home.id),
    first = states(home)[1];
  const again = award(first, home, 'grid-center', campaign.levels[0].id);
  const repeatedMap = progressFor(again, campaign);
  assert.equal(Object.keys(repeatedMap.clears).length, 1);
  assert.equal(Object.keys(repeatedMap.clears[campaign.levels[0].id].variants).length, 2);
  assert.equal(finalTier(again, campaign).count, 1);
  assert.deepEqual(newAppearanceBodies(progressFor(first, campaign), repeatedMap, campaign), []);
  const full = states(home)[3],
    other = campaigns.get(workshop.id),
    combined = award(full, workshop, 'immediate', other.levels[0].id);
  assert.equal(finalTier(combined, campaign).earned, true);
  assert.equal(finalTier(combined, other).count, 1);
  assert.equal(finalTier(combined, other).earned, false);
});

test('an existing complete portable profile derives access without new records or a new transition', () => {
  const campaign = campaigns.get(home.id),
    serialized = exportLibrary(states(home)[3]),
    imported = importLibrary(serialized, { campaigns: [campaign] }),
    original = copy(imported),
    progress = progressFor(imported, campaign);
  assert.equal(imported.format, 'xonix-library.v2');
  assert.equal(progress.version, 'revealline-progress.v1');
  assert.equal(
    unlockedBodies(progress).has('fpv-night'),
    false,
    'The legacy one-argument policy remains four clears.',
  );
  assert.equal(unlockedBodies(progress, campaign).has('fpv-night'), true);
  assert.deepEqual(newAppearanceBodies(progress, copy(progress), campaign), []);
  assert.deepEqual(imported.masteries, []);
  assert.deepEqual(imported, original);
  assert.equal(exportLibrary(imported), serialized);
  // This delta helper is not an adoption-event gate. The UI must call it only
  // around eligible live completion, not from empty state to an imported profile.
});

test('ordinary Workshop routes remain unqualified despite granting chapter cosmetics', async () => {
  const campaign = campaigns.get(workshop.id);
  for (const level of campaign.levels) {
    const checked = await verifyMasteryRun({
      campaign,
      definition: workshop.masteries.find((goal) => goal.levelId === level.id),
      replay: traces.get(runId(workshop, 'immediate', level.id)),
      runId: `ordinary-${level.id}`,
      earnedAt: STAMP,
    });
    assert.equal(checked.qualified, false);
    assert.equal(verifiedMasteryRecord(checked), null);
  }
  assert.equal(finalTier(states(workshop)[3], campaign).earned, true);
  assert.deepEqual(states(workshop)[3].masteries, []);
});

test('mixed backup and pack removal/reinstall preserve clears and an independently verified seal', async () => {
  const campaign = campaigns.get(home.id),
    other = campaigns.get(workshop.id);
  let library = states(home)[3];
  for (const level of other.levels) library = award(library, workshop, 'immediate', level.id);
  const verified = await verifyMasteryRun({
    campaign,
    definition: STEADY_SIGNAL,
    replay: traces.get(runId(home, 'immediate', campaign.levels[0].id)),
    runId: 'chapter-independent-steady-seal',
    earnedAt: STAMP,
  });
  const record = verifiedMasteryRecord(verified);
  assert.ok(record);
  library = withMasteryRecords(library, [record]);
  const original = copy(library),
    mixed = installPack(installPack(emptyPackLibrary(), home), workshop);
  const restored = await prepareBackup(
    await exportBackup({ library, packs: mixed, session: null }, { decodeImage: noImage }),
    { decodeImage: noImage },
  );
  assert.deepEqual(restored.library, original);
  assert.deepEqual(
    restored.packs.packs.map((p) => p.format),
    ['xonix-pack.v1', 'xonix-pack.v2'],
  );
  const removed = await prepareBackup(
    { format: BACKUP_FORMAT, ...restored, packs: removePack(restored.packs, home.id) },
    { decodeImage: noImage },
  );
  assert.deepEqual(removed.library, original);
  const reinstalled = installPack(removed.packs, home),
    returning = resolvePackCampaign(
      reinstalled.packs.find((p) => p.id === home.id),
      campaign.id,
    ).campaign;
  assert.equal(finalTier(removed.library, returning).earned, true);
  assert.deepEqual(removed.library.masteries, [record]);
  assert.equal(removed.library.gallery.length, 6);
  assert.equal(removed.library.scores.length, 6);
  assert.deepEqual(library, original);
});

for (const policy of ['immediate', 'grid-center'])
  test(`an out-of-order Workshop win remains replayable after import and backup (${policy})`, async () => {
    const campaign = campaigns.get(workshop.id),
      second = campaign.levels[1],
      library = award(emptyLibrary(), workshop, policy, second.id),
      original = copy(library),
      progress = progressFor(library, campaign);
    assert.deepEqual(Object.keys(progress.clears), [second.id]);
    assert.equal(Object.hasOwn(progress.clears, campaign.levels[0].id), false);
    assert.equal(canPlay(progress, campaign, 1), true, 'An earned picture remains replayable.');
    assert.equal(library.gallery[0].levelId, second.id);
    assert.equal(finalTier(library, campaign).count, 1);
    assert.deepEqual(library.masteries, []);
    const imported = importLibrary(exportLibrary(library), { campaigns: [campaign] });
    assert.equal(canPlay(progressFor(imported, campaign), campaign, 1), true);
    const backup = await prepareBackup(
      await exportBackup(
        { library: imported, packs: installPack(emptyPackLibrary(), workshop), session: null },
        { decodeImage: noImage },
      ),
      { decodeImage: noImage },
    );
    const restoredCampaign = resolvePackCampaign(backup.packs.packs[0], campaign.id).campaign;
    assert.equal(canPlay(progressFor(backup.library, restoredCampaign), restoredCampaign, 1), true);
    assert.deepEqual(backup.library, original);
    // Owning map 3 alone must not broadly unlock uncleared map 2.
    const thirdOnly = award(emptyLibrary(), workshop, policy, campaign.levels[2].id),
      thirdProgress = progressFor(thirdOnly, campaign);
    assert.equal(canPlay(thirdProgress, campaign, 2), true);
    assert.equal(canPlay(thirdProgress, campaign, 1), false);
  });

test('practice completions cannot add clear-derived eligibility or stored rewards', () => {
  const campaign = campaigns.get(home.id);
  let library = emptyLibrary();
  const original = copy(library);
  for (const level of campaign.levels)
    library = award(library, home, 'immediate', level.id, { practice: true });
  assert.deepEqual(library, original);
  assert.equal(finalTier(library, campaign).count, 0);
  assert.equal(unlockedBodies(progressFor(library, campaign), campaign).has('fpv-night'), false);
  assert.deepEqual(
    newAppearanceBodies(progressFor(original, campaign), progressFor(library, campaign), campaign),
    [],
  );
});

test('a refused profile write keeps prior bytes while the new cosmetic remains exportable for the session', () => {
  const values = new Map();
  let fail = false;
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (fail) throw new Error('Injected storage refusal');
      values.set(key, String(value));
    },
    removeItem: (key) => values.delete(key),
  };
  const previous = states(home)[2],
    current = states(home)[3],
    campaign = campaigns.get(home.id);
  assert.equal(saveLibrary(storage, 'chapter-profile', previous).ok, true);
  const raw = storage.getItem('chapter-profile'),
    loaded = loadLibrary(storage, 'chapter-profile');
  fail = true;
  const result = saveLibrary(storage, 'chapter-profile', current, null, {
    mode: 'replace',
    baseline: loaded.library,
    generation: loaded.generation,
  });
  assert.equal(result.ok, false);
  assert.equal(typeof result.warning, 'string');
  assert.equal(storage.getItem('chapter-profile'), raw);
  assert.equal(finalTier(loadLibrary(storage, 'chapter-profile').library, campaign).earned, false);
  assert.equal(finalTier(importLibrary(exportLibrary(current)), campaign).earned, true);
  assert.deepEqual(current.masteries, []);
});
