import { freezeDesign } from './catalogs.mjs';
import { createFractureApexCulturalCompletionCandidates } from './fracture-apex-cultural-completion-candidates.mjs';
import { NEON_CULTURAL_ROUTES_SOURCES } from './neon-cultural-routes-candidates.mjs';
import { NEON_CULTURAL_ROUTES_FINALE_SOURCES } from './neon-cultural-routes-finale-candidates.mjs';

export const NEON_CULTURAL_COMPLETION_REVISION = 'neon-cultural-routes-3';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const NEON_CULTURAL_COMPLETION_SOURCES = freezeDesign({
  krolevetsWeaving: {
    ...NEON_CULTURAL_ROUTES_SOURCES.krolevetsWeaving,
    adaptationBoundary:
      'Original alternating wall bars extend the established folded return using broad and narrow spacing only. No rushnyk, rhomb, inscription, palette, meaning, object layout or source coordinates are copied.',
  },
  regionalRushnyky: {
    ...NEON_CULTURAL_ROUTES_SOURCES.regionalRushnyky,
    adaptationBoundary:
      'Original offset wall fields extend the established unequal end-frame idea using separated edge concentrations and an open centre only. No textile, regional pattern, ritual sign, palette, meaning or source coordinates are copied.',
  },
  ukrainianPysanka: {
    ...NEON_CULTURAL_ROUTES_FINALE_SOURCES.ukrainianPysanka,
    adaptationBoundary:
      'Four original open quadrant brackets borrow layered field separation and rotational balance only. No pysanka, symbol, wish, message, palette, ritual meaning or source coordinates are copied.',
  },
});

export const NEON_CULTURAL_COMPLETION_SELECTIONS = freezeDesign([
  {
    id: 'folded-corner',
    disposition: 'alternating-fold-wall-field',
    sourceIds: ['krolevetsWeaving'],
    approaches: ['inner-fold-first', 'outer-band-first'],
    pressurePoints: ['upper-lane', 'inner-fold', 'east-window', 'outer-band'],
  },
  {
    id: 'inside-out',
    disposition: 'offset-end-wall-frame',
    sourceIds: ['regionalRushnyky'],
    approaches: ['inner-mouth-first', 'outer-end-first'],
    pressurePoints: ['inner-mouth', 'centre-gap', 'upper-end', 'lower-end'],
  },
  {
    id: 'four-quarters',
    disposition: 'open-quadrant-brackets',
    sourceIds: ['ukrainianPysanka'],
    approaches: ['north-west-first', 'south-east-first'],
    pressurePoints: ['central-cross', 'north-west-gap', 'south-east-gap', 'frontier-turn'],
  },
]);

const revisions = Object.freeze({
  'folded-corner': {
    walls: [
      rect(8, 7, 8, 2),
      rect(30, 7, 7, 2),
      rect(49, 7, 8, 2),
      rect(8, 13, 7, 2),
      rect(46, 13, 8, 2),
      rect(9, 25, 8, 2),
      rect(55, 25, 7, 2),
      rect(15, 30, 10, 2),
      rect(48, 30, 9, 2),
    ],
    design: {
      routeDecision:
        'Close beside the short inner fold through the broad upper window, or traverse the alternating wall lanes and establish the longer outer band before the frontier returns?',
      lesson:
        'Krolevets weaving informs alternating broad and narrow spacing only. Walls shape the approach; the folded foundations remain the only authored return surfaces.',
      counterplay:
        'The inner window is quick but near the western keeper. The outer route uses a wider east gap, then depends on reading the frontier before the long return.',
      captureConsequence:
        'Inner-first play reshapes the compact western contour. Outer-first play creates a deep eastern return beyond the alternating wall field.',
      memorableMoment:
        'The same folded foundation reads as a short protected window or a long exposed woven lane, depending on the first departure.',
      mastery:
        'Close once through the upper window and once from the outer band without losing a life.',
      difficulty: {
        band: 4,
        planning: 5,
        execution: 5,
        threatDensity: 3,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'inside-out': {
    walls: [
      rect(9, 7, 10, 2),
      rect(53, 7, 10, 2),
      rect(12, 13, 8, 2),
      rect(52, 13, 8, 2),
      rect(12, 21, 8, 2),
      rect(52, 21, 8, 2),
      rect(20, 27, 8, 2),
      rect(44, 27, 8, 2),
      rect(32, 12, 3, 2),
      rect(37, 18, 3, 2),
    ],
    design: {
      routeDecision:
        'Close the compact inner mouth before the keeper crosses the centre gap, or leave the frame through an offset end and work back from the larger outside field?',
      lesson:
        'Regional rushnyk construction informs separated end fields and an open centre only. Walls and foundations remain visually and mechanically distinct.',
      counterplay:
        'The inner mouth offers the shortest exposure but shares space with the inside keeper. The outer end has a longer route and more room to read the lower approach.',
      captureConsequence:
        'An inner closure changes the frame contour immediately. An outer-end closure creates a broad return network before the smaller mouth is contested.',
      memorableMoment:
        'Two offset end fields make the inside and outside enemies demand opposite first reads without any hidden steering.',
      mastery: 'Close the inner mouth and one outer end in either order without losing a life.',
      difficulty: {
        band: 4,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'four-quarters': {
    walls: [
      rect(14, 5, 8, 2),
      rect(20, 7, 2, 5),
      rect(39, 5, 8, 2),
      rect(39, 7, 2, 5),
      rect(14, 28, 8, 2),
      rect(20, 24, 2, 4),
      rect(39, 28, 8, 2),
      rect(39, 24, 2, 4),
    ],
    design: {
      routeDecision:
        'Take the small north-west bracket while its keeper is beyond the opening, or cross the permanent centre and commit to the longer south-east bracket first?',
      lesson:
        'The Ukrainian pysanka record informs layered separation and rotational balance only. Open wall brackets change approach angles without changing quadrant retention rules.',
      counterplay:
        'Use the central cross to swap quadrants without cutting. Each bracket is safest after its keeper rebounds away from the open side.',
      captureConsequence:
        'A near bracket gives a modest safe contour; the opposite bracket offers more ground but leaves the frontier more time to reach the chosen return.',
      memorableMoment:
        'Four related but open brackets turn a symmetric cross into a sequence of readable, unequal exposure windows.',
      mastery:
        'Close opposite brackets before taking either remaining quadrant, without losing a life.',
      difficulty: {
        band: 4,
        planning: 6,
        execution: 5,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v28. Foundations, spawns, actor identities,
 * objectives, bonuses, art and gameplay policy remain exact. */
export function createNeonCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createFractureApexCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-neon-cultural-completion-original-review'
    : 'whole-neon-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Neon Ukrainian cultural completion';
  project.revision = NEON_CULTURAL_COMPLETION_REVISION;

  for (const selection of NEON_CULTURAL_COMPLETION_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: NEON_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: NEON_CULTURAL_COMPLETION_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = NEON_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = NEON_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
