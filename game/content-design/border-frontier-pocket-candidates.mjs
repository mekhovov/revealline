import { freezeDesign } from './catalogs.mjs';
import { BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES } from './border-signal-cultural-next-batch-candidates.mjs';
import { createBorderCulturalCompletionCandidates } from './border-cultural-completion-candidates.mjs';

export const BORDER_FRONTIER_POCKET_REVISION = 'border-frontier-pocket-routes-1';

export const BORDER_FRONTIER_POCKET_SOURCES = freezeDesign({
  bukovynaPysanka: BORDER_SIGNAL_CULTURAL_NEXT_BATCH_SOURCES.bukovynaPysanka,
  podilliaStarRushnyk: {
    institution: 'Ivan Honchar Museum',
    record: 'Embroidered rushnyk, collection number KN-22884',
    region: 'Vilshanka, Podillia',
    url: 'https://honchar.org.ua/collections/detail/1769',
    observedVocabulary: [
      'large multicoloured eight-point stars arranged symmetrically at the towel ends',
      'smaller stars and diamonds placed between the larger forms',
      'broken zigzag border documented by the catalogue',
    ],
    adaptationBoundary:
      'Original separated shoulder masses translate end-weighted scale contrast only; no rushnyk, star, diamond, border, stitch chart, palette, meaning or object coordinates are copied.',
  },
});

export const BORDER_FRONTIER_POCKET_SELECTIONS = freezeDesign([
  {
    id: 'turn-the-corner',
    disposition: 'bukovyna-pysanka-wave-dogleg-wall-field',
    sourceIds: ['bukovynaPysanka'],
    approaches: ['inner-wave-first', 'outer-shoulder-first'],
    pressurePoints: ['home-elbow', 'inner-wave', 'outer-shoulder', 'slow-detour'],
  },
  {
    id: 'return-pocket',
    disposition: 'podillia-star-interstitial-pocket-wall-field',
    sourceIds: ['podilliaStarRushnyk'],
    approaches: ['upper-mouth-first', 'lower-mouth-first'],
    pressurePoints: ['pocket-spine', 'upper-shoulder', 'lower-shoulder', 'freeze-detour'],
  },
]);

const rect = (x, y, w, h) => ({ x, y, w, h });
const revisions = Object.freeze({
  'turn-the-corner': {
    walls: [
      rect(7, 6, 9, 2),
      rect(7, 8, 2, 6),
      rect(49, 6, 10, 2),
      rect(57, 8, 2, 6),
      rect(31, 22, 8, 2),
      rect(37, 24, 2, 5),
      rect(49, 27, 10, 2),
      rect(49, 23, 2, 4),
    ],
    design: {
      routeDecision:
        'Take the short inner elbow while the moving frontier is leaving it, or wrap the longer outer shoulder for a larger first capture and a different later return?',
      lesson:
        'Bukovyna-pysanka-informed sectioning adds broad wave and dogleg wall masses while the established moving-frontier rule remains unchanged.',
      counterplay:
        'Read the frontier from the permanent L. The inner elbow is shorter; the outer shoulder is valuable only when the east keeper is moving away from its exposed line.',
      captureConsequence:
        'The inner closure keeps the frontier near the original elbow; the outer closure creates a farther return behind the lower dogleg and shifts its useful contour.',
      memorableMoment:
        'A single broad wave-like opening turns the same L-shaped foundation into a quick inside cut or a committed outside wrap.',
      mastery: 'Close once from each shoulder without collecting the optional slow bonus.',
      difficulty: {
        band: 3,
        planning: 4,
        execution: 3,
        threatDensity: 3,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
    },
  },
  'return-pocket': {
    walls: [
      rect(6, 7, 9, 2),
      rect(13, 9, 2, 5),
      rect(48, 7, 9, 2),
      rect(48, 9, 2, 5),
      rect(7, 27, 9, 2),
      rect(14, 23, 2, 4),
      rect(48, 27, 9, 2),
      rect(48, 23, 2, 4),
    ],
    design: {
      routeDecision:
        'Close the upper mouth before the mixed patrols converge, or stage on the lower band and leave a side opening for a longer outward return?',
      lesson:
        'Podillia-rushnyk-informed large and small separated wall masses make the pocket mouths unequal without changing perimeter or moving-frontier behavior.',
      counterplay:
        'Use the safe pocket spine to compare both patrol domains. The upper mouth gives the compact closure; the lower shoulder is safer only after the outside keeper turns away.',
      captureConsequence:
        'An upper closure creates a compact interior return; a lower closure preserves a longer outside lane behind the offset wall shoulder and changes the frontier path.',
      memorableMoment:
        'The pocket opens between unequal end-weighted masses, so the visually balanced board produces deliberately unbalanced route value.',
      mastery: 'Close from both mouths without collecting the optional freeze bonus.',
      difficulty: {
        band: 3,
        planning: 4,
        execution: 4,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v31. Only wall geometry and mission design notes
 * change; foundations, actors, objectives, bonuses, art and rules remain exact. */
export function createBorderFrontierPocketCandidates({ artwork = false } = {}) {
  const before = createBorderCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-border-frontier-pocket-original-review'
    : 'whole-border-frontier-pocket-greybox-review';
  project.name = 'Whole Journey · Border frontier and pocket completion';
  project.revision = BORDER_FRONTIER_POCKET_REVISION;

  for (const selection of BORDER_FRONTIER_POCKET_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: BORDER_FRONTIER_POCKET_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: BORDER_FRONTIER_POCKET_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        introduces: mission.design.introduces,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = BORDER_FRONTIER_POCKET_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = BORDER_FRONTIER_POCKET_REVISION;
  return structuredClone(project);
}
