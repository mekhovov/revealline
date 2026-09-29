import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COMPANY_MISSIONS } from '../company-campaigns/catalog.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamCulturalSpecialistV2OriginalCandidates } from '../content-design/team-cultural-specialist-v2-originals.mjs';
import { DEFAULT_JOURNEY_ROUTES } from '../content-design/default-entry.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import {
  OFFICIAL_LEVEL_COUNT,
  canonicalCompanyLevelKey,
  canonicalMissionLevelKey,
  officialLevelNumber,
} from '../level-numbering.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';

const classic = JSON.parse(
  readFileSync(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
).missions;
const route = await loadAuthoredJourneyRoute(DEFAULT_JOURNEY_ROUTES.solo);
const journey = createContentExecutionCatalog(route.source).journey().missions;
const teamSource = createTeamCulturalSpecialistV2OriginalCandidates();
const team = createCandidateTeamHost(teamSource, {
  corePackIds: teamSource.packs.map((pack) => pack.id),
}).catalog.missions;

test('every first-party level has one permanent unique number', () => {
  const journeyRows = [...journey, ...team].map((mission) => ({
    key: canonicalMissionLevelKey(mission),
    number: officialLevelNumber(canonicalMissionLevelKey(mission)),
  }));
  const teamArenaRows = COOP_STARTER_PACK.levels.map((level) => ({
    key: canonicalMissionLevelKey({
      packId: COOP_STARTER_PACK.id,
      campaignId: COOP_STARTER_PACK.id,
      levelId: level.id,
    }),
    number: officialLevelNumber(
      canonicalMissionLevelKey({
        packId: COOP_STARTER_PACK.id,
        campaignId: COOP_STARTER_PACK.id,
        levelId: level.id,
      }),
    ),
  }));
  const classicRows = classic.map((row) => ({
    key: canonicalMissionLevelKey(row),
    number: officialLevelNumber(canonicalMissionLevelKey(row)),
  }));
  const companyRows = COMPANY_MISSIONS.map((mission) => ({
    key: canonicalCompanyLevelKey({
      campaignId: mission.campaignId,
      missionId: mission.id,
    }),
    number: officialLevelNumber(
      canonicalCompanyLevelKey({
        campaignId: mission.campaignId,
        missionId: mission.id,
      }),
    ),
  }));
  const rows = [...journeyRows, ...teamArenaRows, ...classicRows, ...companyRows];
  assert.equal(rows.length, OFFICIAL_LEVEL_COUNT);
  assert(rows.every(({ key, number }) => key && Number.isSafeInteger(number) && number > 0));
  assert.equal(new Set(rows.map(({ key }) => key)).size, rows.length);
  assert.equal(new Set(rows.map(({ number }) => number)).size, rows.length);
  assert.deepEqual(
    rows.map(({ number }) => number).sort((a, b) => a - b),
    Array.from({ length: OFFICIAL_LEVEL_COUNT }, (_, index) => index + 1),
  );
});

test('rules variants share a number while custom identities stay outside the registry', () => {
  const authored = classic[0];
  const currentRules = canonicalMissionLevelKey({ ...authored, levelRevision: 'current-rules' });
  const originalRules = canonicalMissionLevelKey({ ...authored, levelRevision: 'original-rules' });
  assert.equal(currentRules, originalRules);
  assert.equal(officialLevelNumber(currentRules), officialLevelNumber(originalRules));
  assert.equal(
    officialLevelNumber(
      canonicalMissionLevelKey({
        campaignId: 'my-campaign',
        levelId: 'my-level',
      }),
    ),
    null,
  );
});

test('mission search accepts a visible global level number with or without #', () => {
  const canonicalLevelKey = canonicalMissionLevelKey(classic[0]);
  const globalLevelNumber = officialLevelNumber(canonicalLevelKey);
  const entry = {
    id: 'runtime-level',
    campaignKey: 'campaign',
    campaignTitle: 'First campaign',
    name: 'Remember me',
    levelIndex: 0,
    modes: ['solo'],
    tags: ['Classic'],
  };
  const library = createMissionLibrary([
    {
      id: 'numbered-source',
      editionId: 'edition',
      edition: 'Edition',
      collection: 'Classic',
      entries: [entry],
      describe: (value) => ({
        ...value,
        canonicalLevelKey,
        globalLevelNumber,
      }),
      availability: () => ({ state: 'ready' }),
      launch: () => {},
    },
  ]);
  assert.deepEqual(library.search(`#${globalLevelNumber}`), library.missions);
  assert.deepEqual(library.search(String(globalLevelNumber)), library.missions);
});
