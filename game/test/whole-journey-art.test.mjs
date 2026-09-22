import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createWholeJourneyCandidates,
  WHOLE_JOURNEY_CHAPTERS,
  WHOLE_JOURNEY_CORE_PACK_IDS,
  WHOLE_JOURNEY_REMIX_PACK_IDS,
} from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createContentExecutionCatalog } from '../content-design/execution.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { JOURNEY_ART_CANDIDATES } from '../content-design/journey-art.mjs';

const source = createWholeJourneyCandidates({ artwork: true });
const combined = compileContentProject(source);
const standalone = await Promise.all(
  WHOLE_JOURNEY_CHAPTERS.map(async ({ id }) => {
    const module = await import(`../content-design/${id}-candidates.mjs`);
    const create =
      module[
        id === 'horizon'
          ? 'createOpeningCandidates'
          : `create${id[0].toUpperCase()}${id.slice(1)}Candidates`
      ];
    return create({ artwork: true });
  }),
);

test('all83 Solo candidate missions own one original pin through one shared registry', () => {
  assert.equal(source.missions.length, 83);
  assert.equal(source.assets.length, 83);
  assert.equal(new Set(source.assets.map((a) => a.sha256)).size, 83);
  assert.equal(source.id, 'whole-journey-original-review');
  assert.deepEqual(
    source.packs.map((p) => p.id),
    [...WHOLE_JOURNEY_CORE_PACK_IDS, ...WHOLE_JOURNEY_REMIX_PACK_IDS],
  );
  for (const asset of source.assets) {
    assert.deepEqual(
      asset,
      JOURNEY_ART_CANDIDATES.find((a) => a.id === asset.id),
    );
    assert.equal(
      source.missions.filter((m) => m.presentation.backgroundAssetId === asset.id).length,
      1,
    );
    assert.equal(asset.review, 'candidate');
  }
  assert.equal(createWholeJourneyCandidates().assets.length, 0);
  const edited = createWholeJourneyCandidates({ artwork: true });
  edited.assets[0].alt = 'Changed locally';
  edited.missions[0].presentation.backgroundAssetId = null;
  assert.deepEqual(createWholeJourneyCandidates({ artwork: true }), source);
  assert.equal(createAuthoredJourneyRoute('whole-journey-original-review'), null);
  assert.deepEqual(createAuthoredJourneyRoute('authored').corePackIds, [
    'journey-opening',
    'journey-border',
  ]);
});

for (const mode of ['solo', 'versus'])
  test(`all249 pictured ${mode} manifests and executions match standalone picture editions`, () => {
    const catalog = createContentExecutionCatalog(source, { mode });
    let count = 0;
    for (const chapter of standalone) {
      const previous = compileContentProject(chapter);
      const previousCatalog = createContentExecutionCatalog(chapter, { mode });
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        for (const mission of chapter.missions) {
          const actual = resolveMission(combined, mission.id, { mode, difficulty });
          assert.deepEqual(actual, resolveMission(previous, mission.id, { mode, difficulty }));
          assert(actual.background);
          assert.equal(actual.officialProgressEligible, false);
          count++;
        }
        for (const pack of chapter.packs)
          for (const campaignId of pack.campaignIds) {
            const a = catalog.select(pack.id, campaignId, difficulty);
            const b = previousCatalog.select(pack.id, campaignId, difficulty);
            assert.deepEqual(a.campaign, b.campaign);
            assert.equal(a.executionKey, b.executionKey);
            assert.equal(a.baseCampaignKey, b.baseCampaignKey);
          }
      }
    }
    assert.equal(count, 249);
  });

test('picture composition preserves physics while explicitly retaining Signal theme edition differences', () => {
  const grey = compileContentProject(createWholeJourneyCandidates());
  let count = 0;
  for (const mission of source.missions)
    for (const mode of ['solo', 'versus'])
      for (const difficulty of ['gentle', 'standard', 'expert']) {
        const a = resolveMission(combined, mission.id, { mode, difficulty });
        const b = resolveMission(grey, mission.id, { mode, difficulty });
        assert.equal(a.simulationIdentity, b.simulationIdentity);
        count++;
      }
  assert.equal(count, 498);
  const signal = standalone[2];
  assert(signal.missions.every((m) => m.presentation.themeId === 'signal-gardens'));
  assert(signal.missions.every((m) => m.revision === 'greybox-2'));
  assert(
    grey.missions
      .filter((m) => signal.missions.some((s) => s.id === m.id))
      .every((m) => m.revision === 'greybox-1'),
  );
});
