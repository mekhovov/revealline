import test from 'node:test';
import assert from 'node:assert/strict';
import {
  journeyMissionDetails,
  authoredJourneyMissionTags,
} from '../mission-library/journey-presentation.mjs';
import { loadAuthoredJourneyRoute } from '../content-design/route-loader.mjs';

test('Journey details use actual band and preset without constructing geometry', () => {
  const manifest = {
    difficulty: 'expert',
    design: {
      difficulty: { band: 8 },
      routeDecision: 'Choose the shorter return.',
      mastery: 'Keep both relays.',
    },
    get level() {
      throw new Error('Must not construct a board.');
    },
  };
  assert.deepEqual(journeyMissionDetails(manifest), {
    challenge: 'Band 8/12 · Expert',
    route: 'Choose the shorter return.',
    mastery: 'Keep both relays.',
  });
  assert.equal(journeyMissionDetails(null), null);
  assert.throws(
    () => journeyMissionDetails({ design: manifest.design, difficulty: 'invented' }),
    /actual resolved/,
  );
});

test('current authored route has precisely12 Remix,4 Ukrainian and4 FPV tags by curated identities', async () => {
  const route = await loadAuthoredJourneyRoute('whole-spatial-v7');
  const counts = { Remix: 0, Ukrainian: 0, FPV: 0, Arcade: 0 };
  for (const pack of route.source.packs)
    for (const campaignId of pack.campaignIds) {
      const campaign = route.source.campaigns.find((item) => item.id === campaignId);
      for (const id of campaign.missionIds) {
        const tags = authoredJourneyMissionTags(
          { source: 'candidate', packId: pack.id, campaignId, levelId: id },
          { policyId: route.source.policyId },
        );
        for (const tag of tags) counts[tag]++;
      }
    }
  assert.deepEqual(counts, { Remix: 12, Ukrainian: 4, FPV: 4, Arcade: 91 });
  assert.deepEqual(
    authoredJourneyMissionTags(
      { source: 'custom', packId: 'workshop-routing-study', campaignId: 'workshop-routing' },
      { policyId: 'journey-arcade-v2' },
    ),
    [],
  );
});
