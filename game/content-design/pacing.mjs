import { requireAuthoring as required } from './authoring-error.mjs';
import { boundedJSON, exactKeys, stableId } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { resolveContentJourney } from './journey.mjs';
import { freezeDesign } from './catalogs.mjs';

/** Advisory authored ratings, in the same pack/campaign order as gameplay.
 * No automatic retuning, inferred human difficulty, publication or awards.
 * Optional finales are excluded only by explicit campaign selection, not names. */
export function inspectContentPacing(source, options = {}) {
  const selection = boundedJSON(options, { maxBytes: 16384, maxNodes: 256, maxDepth: 3 });
  exactKeys(selection, ['packIds', 'mode', 'excludedCampaignIds'], 'pacing selection');
  const project = compileContentProject(source);
  const excluded = selection.excludedCampaignIds ?? [];
  required(
    Array.isArray(excluded) &&
      new Set(excluded).size === excluded.length &&
      excluded.every(
        (id) => stableId(id) && project.campaigns.some((campaign) => campaign.id === id),
      ),
    'Exclude unique existing campaign IDs.',
    'errors:studio.pacing.exclusions',
  );
  const journey = resolveContentJourney(project, {
    ...(selection.packIds ? { packIds: selection.packIds } : {}),
    mode: selection.mode ?? 'solo',
  });
  const facets = [
    'planning',
    'execution',
    'threatDensity',
    'timePressure',
    'mechanicLoad',
    'coordination',
  ];
  const rows = [],
    diagnostics = [];
  // Exact authored lesson labels only: actor names are not implicit aliases for
  // lessons, and a practice/combination declaration cannot invent an introduction.
  const declaredLessons = new Set(project.missions.flatMap((mission) => mission.design.introduces));
  const introduced = new Set(),
    practiced = new Set();
  let previous = null;
  for (const campaign of journey.campaigns) {
    if (excluded.includes(campaign.campaignId)) continue;
    for (const manifest of campaign.manifests) {
      const mission = project.missions.find((entry) => entry.id === manifest.missionId);
      const identity = {
        packId: campaign.packId,
        campaignId: campaign.campaignId,
        missionId: mission.id,
      };
      const rating = mission.design.difficulty;
      const change = previous
        ? Object.fromEntries(
            ['band', ...facets].map((facet) => [facet, rating[facet] - previous.rating[facet]]),
          )
        : null;
      const warnings = [];
      const unintroducedPractice = mission.design.practices.filter(
        (lesson) =>
          declaredLessons.has(lesson) &&
          !introduced.has(lesson) &&
          !mission.design.introduces.includes(lesson),
      );
      const unintroducedCombination = mission.design.combines.filter(
        (lesson) => declaredLessons.has(lesson) && !introduced.has(lesson),
      );
      const unpracticedCombination = mission.design.combines.filter(
        (lesson) => declaredLessons.has(lesson) && introduced.has(lesson) && !practiced.has(lesson),
      );
      for (const [code, lessons, explanation] of [
        [
          'practice-before-selected-introduction',
          unintroducedPractice,
          'Practice has no earlier or same-mission declared introduction',
        ],
        [
          'combination-before-selected-introduction',
          unintroducedCombination,
          'Combination has no earlier declared introduction',
        ],
        [
          'combination-before-selected-practice',
          unpracticedCombination,
          'Combination has no earlier declared practice after introduction',
        ],
      ])
        if (lessons.length)
          warnings.push({
            severity: 'warning',
            code,
            lessons,
            message: `${explanation}: ${lessons.join(', ')}. Review the selected route and any assumed prior learning; declarations do not prove safe exposure or mastery.`,
          });
      if (change?.band < 0)
        warnings.push({
          severity: 'warning',
          code: 'challenge-band-regression',
          message: `Challenge band falls from ${previous.rating.band} to ${rating.band}. Review the intended change in tension; do not assume this is a defect.`,
        });
      if (change?.band > 1)
        warnings.push({
          severity: 'warning',
          code: 'challenge-band-jump',
          message: `Challenge band rises from ${previous.rating.band} to ${rating.band}. Review whether intermediate practice is missing from this selected sequence.`,
        });
      const jumps = facets.filter((facet) => change?.[facet] >= 3);
      if (jumps.length)
        warnings.push({
          severity: 'warning',
          code: 'large-authored-facet-increase',
          facets: jumps,
          message: `Authored ratings rise by at least three in ${jumps.join(', ')}. Review exposure and counterplay; ratings are not measured player difficulty.`,
        });
      const row = {
        ...identity,
        name: mission.name,
        rating,
        previous: previous?.identity ?? null,
        change,
        introduces: mission.design.introduces,
        practices: mission.design.practices,
        combines: mission.design.combines,
        authoredDurationSeconds: mission.design.durationSeconds,
        countdownSeconds: mission.timeLimitSeconds,
        gentleFailingCountdown: false,
        diagnostics: warnings,
      };
      rows.push(row);
      diagnostics.push(...warnings.map((item) => ({ ...identity, ...item })));
      // Only earlier occurrences count for a combination. Practice before a
      // missing introduction must not make a later combination appear prepared.
      for (const lesson of mission.design.introduces) introduced.add(lesson);
      for (const lesson of mission.design.practices)
        if (introduced.has(lesson)) practiced.add(lesson);
      previous = { identity, rating };
    }
  }
  const timed = rows.filter((row) => row.countdownSeconds > 0).length;
  const fraction = rows.length ? timed / rows.length : 0;
  if (rows.length && fraction >= 0.15)
    diagnostics.push({
      severity: 'warning',
      code: 'countdown-heavy-selection',
      message: `${timed} of ${rows.length} selected mission occurrences have a countdown. Core content should stay below 15%; explicitly exclude optional finales when assessing core content.`,
    });
  return freezeDesign({
    format: 'ContentPacingInspectionV1',
    projectId: project.source.id,
    mode: journey.mode,
    excludedCampaignIds: excluded,
    rows,
    diagnostics,
    timedMissionOccurrences: timed,
    timedFraction: fraction,
    qualification: 'authored-ratings-only-not-playtest-or-release-qualification',
    limitations: [
      'Uses gameplay selection, order, archive state and mode filtering; repeated memberships remain separate occurrences.',
      'An intentionally quieter mission may be useful. Warnings never change or reject source content.',
      'No observed duration, route risk, cleanup quality, reaction tolerance or human enjoyment is inferred.',
      'Learning-order diagnostics compare exact labels with explicit introductions anywhere in this project. Undeclared labels, actor/lesson aliases, actual encounters and learning outside the selected sequence are not inferred.',
    ],
  });
}
