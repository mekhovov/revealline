import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  acceptedJourneyMission,
  acceptedClassicMission,
} from '../mission-library/accepted-played-mission.mjs';
import { playedLevelHref } from '../mission-library/played-level-link.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { journeyLibrarySource } from '../mission-library/journey-source.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { campaignKey } from '../library.mjs';
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url)));
const index = await json('../content/mission-library-index.json');
const baseEntry = {
  campaign: {
    ...(await json('../content/campaign.json')),
    classRecipes: await json('../content/classes.json'),
  },
};
test('accepted Journey sharing preserves the exact registry identity without constructing other modes', () => {
  const mission = {
    id: 'first',
    levelId: 'first',
    source: 'included',
    packId: 'a',
    campaignId: 'b',
    name: 'First',
    campaignTitle: 'Route',
    levelIndex: 0,
    modes: ['solo'],
    hook: 'A route',
  };
  for (const editionId of ['opening', 'authored']) {
    const library = createMissionLibrary([
      journeyLibrarySource({
        editionId,
        edition: editionId,
        catalog: { missions: [mission] },
        launch: () => true,
      }),
    ]);
    const accepted = acceptedJourneyMission(mission, editionId);
    assert.equal(accepted.id, library.missions[0].id);
    assert.equal(
      playedLevelHref(accepted, { baseURL: 'https://game.invalid/game/' }),
      playedLevelHref(library.missions[0], { baseURL: 'https://game.invalid/game/' }),
    );
  }
});
test('accepted Base Classic sharing matches indexed registry and rejects changed or ambiguous identity', async () => {
  const library = createMissionLibrary(
    classicLibrarySources(index, { availability: () => ({ state: 'ready' }), launch: () => true }),
  );
  const entry = { ...baseEntry, baseCampaignKey: campaignKey(baseEntry.campaign) };
  const level = entry.campaign.levels[0];
  const accepted = await acceptedClassicMission({
    index,
    entry,
    level,
    baseEntry,
    packs: { packs: [] },
  });
  assert.ok(accepted);
  assert.equal(library.find(accepted.id).runtimeId, level.id);
  assert.match(
    playedLevelHref(accepted, { baseURL: 'https://game.invalid/game/' }),
    /library-mission=/,
  );
  assert.equal(
    await acceptedClassicMission({
      index,
      entry: { ...entry, baseCampaignKey: 'different' },
      level,
      baseEntry,
      packs: { packs: [] },
    }),
    null,
  );
  const duplicate = { ...index, missions: [...index.missions, ...index.missions] };
  assert.equal(
    await acceptedClassicMission({
      index: duplicate,
      entry,
      level,
      baseEntry,
      packs: { packs: [] },
    }),
    null,
  );
  assert.equal(
    await acceptedClassicMission({
      index,
      entry: { ...entry, sourcePackId: 'local-import' },
      level,
      baseEntry,
      packs: { packs: [] },
    }),
    null,
  );
});
