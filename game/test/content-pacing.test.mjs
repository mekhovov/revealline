import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { createBorderCandidates } from '../content-design/border-candidates.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { resolveContentJourney } from '../content-design/journey.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';

test('pacing inspection shares exact gameplay membership, order, mode and archive handling', () => {
  const source = createOpeningCandidates();
  for (const next of [
    createBorderCandidates(),
    createSignalCandidates(),
    createTeamOpeningCandidates(),
  ])
    for (const key of ['missions', 'maps', 'campaigns', 'packs']) source[key].push(...next[key]);
  const before = structuredClone(source);
  const project = compileContentProject(source);
  for (const mode of ['solo', 'versus', 'team']) {
    const journey = resolveContentJourney(project, { mode });
    const report = inspectContentPacing(project, { mode });
    assert.deepEqual(
      report.rows.map((row) => [row.packId, row.campaignId, row.missionId]),
      journey.campaigns.flatMap((campaign) =>
        campaign.manifests.map((manifest) => [
          campaign.packId,
          campaign.campaignId,
          manifest.missionId,
        ]),
      ),
    );
    assert.equal(report.timedFraction, 0);
    assert(Object.isFrozen(report.rows));
    assert.equal(
      report.qualification,
      'authored-ratings-only-not-playtest-or-release-qualification',
    );
  }
  assert.deepEqual(source, before);
  const firstCampaign = source.campaigns[0];
  firstCampaign.missionIds.reverse();
  source.missions.find((m) => m.id === firstCampaign.missionIds[0]).archived = true;
  source.campaigns[1].archived = true;
  const report = inspectContentPacing(source, { packIds: [source.packs[0].id] });
  const journey = resolveContentJourney(source, { packIds: [source.packs[0].id] });
  assert.deepEqual(
    report.rows.map((row) => row.missionId),
    journey.campaigns.flatMap((c) => c.manifests.map((m) => m.missionId)),
  );
});

test('advisory pacing retains deliberate regressions, source data and explicit optional exclusions', () => {
  const source = createOpeningCandidates();
  const campaign = source.campaigns.find((c) => c.missionIds.includes('long-way-home'));
  campaign.missionIds.reverse();
  const first = source.missions.find((m) => m.id === 'long-way-home');
  first.design.difficulty.execution = 8;
  first.timeLimitSeconds = 60;
  const before = structuredClone(source);
  const report = inspectContentPacing(source);
  assert(report.diagnostics.some((d) => d.code === 'challenge-band-regression'));
  assert(
    report.diagnostics.some(
      (d) => d.code === 'large-authored-facet-increase' && d.facets.includes('execution'),
    ),
  );
  assert.equal(report.timedMissionOccurrences, 1);
  assert.equal(report.timedFraction, 0.1);
  assert(!report.diagnostics.some((d) => d.code === 'countdown-heavy-selection'));
  source.missions[0].timeLimitSeconds = 30;
  assert(
    inspectContentPacing(source).diagnostics.some((d) => d.code === 'countdown-heavy-selection'),
  );
  const filtered = inspectContentPacing(source, { excludedCampaignIds: [campaign.id] });
  assert(filtered.rows.every((row) => row.campaignId !== campaign.id));
  assert.equal(filtered.rows[0].gentleFailingCountdown, false);
  source.missions[0].timeLimitSeconds = before.missions[0].timeLimitSeconds;
  assert.deepEqual(source, before);
  assert.throws(
    () => inspectContentPacing(source, { excludedCampaignIds: ['not-a-campaign'] }),
    /existing campaign/,
  );
  assert.throws(
    () => inspectContentPacing(source, { arbitrarySpeed: 999 }),
    /pacing selection.arbitrarySpeed is not supported/,
  );
});

test('countdown guidance is strictly below fifteen percent and large band steps remain advisory', () => {
  const source = createOpeningCandidates();
  const template = source.missions[0];
  source.missions = Array.from({ length: 20 }, (_, index) => ({
    ...structuredClone(template),
    id: `pacing-fixture-${index}`,
    timeLimitSeconds: index < 3 ? 60 : 0,
  }));
  source.campaigns = [{ ...source.campaigns[0], missionIds: source.missions.map((m) => m.id) }];
  source.packs = [{ ...source.packs[0], campaignIds: [source.campaigns[0].id] }];
  assert.equal(inspectContentPacing(source).timedFraction, 0.15);
  assert(
    inspectContentPacing(source).diagnostics.some((d) => d.code === 'countdown-heavy-selection'),
  );
  source.missions[2].timeLimitSeconds = 0;
  assert(
    !inspectContentPacing(source).diagnostics.some((d) => d.code === 'countdown-heavy-selection'),
  );
  const opening = createOpeningCandidates();
  const campaign = opening.campaigns[1];
  campaign.band = 3;
  for (const id of campaign.missionIds)
    opening.missions.find((m) => m.id === id).design.difficulty.band = 3;
  const report = inspectContentPacing(opening);
  assert(report.diagnostics.some((d) => d.code === 'challenge-band-jump'));
  assert.equal(
    report.rows.length,
    opening.missions.length,
    'Warnings do not remove playable candidates.',
  );
});
