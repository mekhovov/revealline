import { freezeDesign } from './catalogs.mjs';
import { createSignalCulturalRoutesCandidates } from './signal-cultural-routes-candidates.mjs';

export const NEON_CULTURAL_ROUTES_REVISION = 'neon-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const NEON_CULTURAL_ROUTES_SOURCES = freezeDesign({
  krolevetsWeaving: {
    institution: 'Museum Fund of Ukraine',
    record: 'Woven Krolevets rushnyk',
    region: 'Krolevets, Sumy region',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-tkaniy-kroleveckiy-33709',
    observedVocabulary: [
      'horizontal bands of unequal width',
      'geometric rhomb groups separated by open cloth',
      'red figured weaving on a white ground',
    ],
    adaptationBoundary:
      'An original folded return uses alternating broad and narrow route bands only. No rushnyk, rhomb, inscription, palette, meaning, object layout or source coordinates are copied.',
  },
  regionalRushnyky: {
    institution: 'Ivan Honchar Museum',
    record: 'Textile collection and regional rushnyky',
    region: 'Historic-ethnographic regions of Ukraine',
    url: 'https://old.honchar.org.ua/english/collection/',
    observedVocabulary: [
      'rectangular woven cloth with ornament concentrated at short edges',
      'regional variation in construction, technique and composition',
      'open cloth between separately composed end fields',
    ],
    adaptationBoundary:
      'An original offset frame translates separated end-field rhythm and an open centre only. No ritual sign, textile, regional pattern, meaning, palette or source coordinates are copied.',
  },
  opishnePaintedBowls: {
    institution: 'National Museum of Ukrainian Pottery in Opishne',
    record: 'Painted bowls',
    region: 'Opishne, Poltava region',
    url: 'https://opishne-museum.gov.ua/malovani-mysky/',
    observedVocabulary: [
      'decoration composed around the upper part of a formed vessel',
      'geometric and plant ornament used in painted arrangements',
      'rim, centre and surrounding field read as separate compositional zones',
    ],
    adaptationBoundary:
      'Three original interrupted contour frames translate unequal rim and centre spacing only. No bowl, plant, fish, bird, ornament, palette, meaning or source coordinates are copied or used as targets.',
  },
});

export const NEON_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'folded-corner',
    disposition: 'krolevets-alternating-folded-bands',
    sourceIds: ['krolevetsWeaving'],
    approaches: ['inner-fold-first', 'outer-band-first'],
    pressurePoints: ['upper-band', 'inner-fold', 'lower-shoulder', 'outer-band'],
  },
  {
    id: 'inside-out',
    disposition: 'regional-rushnyk-offset-end-frame',
    sourceIds: ['regionalRushnyky'],
    approaches: ['west-mouth-first', 'east-mouth-first'],
    pressurePoints: ['west-mouth', 'inner-field', 'east-mouth', 'outer-contour'],
  },
  {
    id: 'side-door-bays',
    disposition: 'opishne-three-interrupted-contours',
    sourceIds: ['opishnePaintedBowls'],
    approaches: ['near-rim-first', 'far-rim-first'],
    pressurePoints: ['near-rim', 'central-gap', 'lower-rim', 'far-rim'],
  },
]);

const revisions = Object.freeze({
  'folded-corner': {
    foundations: [
      rect(20, 9, 4, 13),
      rect(22, 19, 13, 4),
      rect(32, 16, 4, 12),
      rect(35, 25, 17, 3),
    ],
    design: {
      routeDecision:
        'Close beside the short inner fold, or follow the alternating bands to establish the longer outer shoulder before the frontier arrives?',
      lesson:
        'A stepped return can offer several landing lengths while the same moving-frontier rules remain predictable.',
      counterplay:
        'The inner fold is quick but close to the western keeper. The outer band is longer and becomes useful when the eastern keeper turns away from its shoulder.',
      captureConsequence:
        'Inner-first play reshapes the tight western contour; outer-first play creates a deeper eastern return for the following enclosure.',
      memorableMoment:
        'A Krolevets-weaving-informed alternation of broad and narrow bands turns one L into two visibly different return rhythms.',
      mastery: 'Use both the inner fold and outer band as closure surfaces without losing a life.',
    },
  },
  'inside-out': {
    foundations: [
      rect(27, 7, 18, 3),
      rect(27, 21, 18, 3),
      rect(27, 13, 3, 8),
      rect(42, 10, 3, 5),
      rect(42, 18, 3, 3),
    ],
    design: {
      routeDecision:
        'Close the broad western mouth near the inner keeper, or cross the upper end field and work from the smaller eastern mouth against the outer keeper?',
      lesson:
        'Offset openings keep the inner and outer fields connected until a deliberate closure; the visible frame alone never decides retention.',
      counterplay:
        'Use the western mouth only after the lower approach keeper leaves it. The eastern mouth is narrower but gives the frontier a longer recovery route.',
      captureConsequence:
        'Closing one mouth converts the frame into a different return network while the occupied side remains unclaimed.',
      memorableMoment:
        'A regional-rushnyk-informed pair of unequal end fields makes inside-versus-outside order readable without copying a ritual ornament.',
      mastery:
        'Close both offset mouths and connect the frame to the perimeter without losing a life.',
    },
  },
  'side-door-bays': {
    foundations: [
      rect(7, 7, 14, 3),
      rect(7, 10, 3, 8),
      rect(7, 18, 14, 3),
      rect(18, 10, 3, 1),
      rect(18, 17, 3, 1),
      rect(28, 14, 15, 2),
      rect(28, 16, 3, 12),
      rect(28, 28, 15, 2),
      rect(40, 16, 3, 3),
      rect(40, 25, 3, 3),
      rect(50, 5, 12, 3),
      rect(59, 8, 3, 2),
      rect(59, 16, 3, 2),
      rect(50, 18, 12, 3),
      rect(50, 8, 3, 10),
    ],
    design: {
      routeDecision:
        'Secure the nearby interrupted rim and its broad landing, or cross the open centre to reach the far reversed rim before its patrol returns?',
      lesson:
        'Unequal contour mouths create different timing windows even though every bay follows the same retained-region and frontier rules.',
      counterplay:
        'The near rim offers the shortest closure. The lower centre gives a staging return, while the far reversed rim is safest just after its frontier patrol leaves the mouth.',
      captureConsequence:
        'Near-first play builds a broad western network; far-first play redirects pressure before the centre and west are connected.',
      memorableMoment:
        'Three Opishne-bowl-informed interrupted contours read as near rim, lower centre and reversed far rim instead of three repeated boxes.',
      mastery: 'Connect all three contour frames while using both a broad and a narrow mouth.',
    },
  },
});

/** Copy-on-write successor to v15. Existing actors, physics, hazards, bonuses,
 * objectives and art remain exact; only foundation geometry and route guidance
 * change for the selected identities. */
export function createNeonCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createSignalCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-neon-cultural-routes-original-review'
    : 'whole-neon-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Neon Ukrainian cultural routes';
  project.revision = NEON_CULTURAL_ROUTES_REVISION;

  for (const selection of NEON_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    nextMap.revision = NEON_CULTURAL_ROUTES_REVISION;
    nextMap.foundations = structuredClone(revision.foundations);
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: NEON_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: { ...mission.design, ...revision.design },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = NEON_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = NEON_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
