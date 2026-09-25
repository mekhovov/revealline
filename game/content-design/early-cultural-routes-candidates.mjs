import { freezeDesign } from './catalogs.mjs';
import { createBorderSignalCulturalNextBatchCandidates } from './border-signal-cultural-next-batch-candidates.mjs';

export const EARLY_CULTURAL_ROUTES_REVISION = 'early-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const EARLY_CULTURAL_ROUTES_SOURCES = freezeDesign({
  crimeanTatarOrnek: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Ornek, a Crimean Tatar ornament and knowledge about it',
    region: 'Crimean Tatar communities in Ukraine',
    url: 'https://ich.unesco.org/en/RL/ornek-a-crimean-tatar-ornament-and-knowledge-about-it-01601?RL=01601',
    observedVocabulary: [
      'geometric ornament used primarily in weaving',
      'symbols arranged as narrative compositions',
      'knowledge transmitted by skilled artisans within communities',
    ],
    adaptationBoundary:
      'Two original offset landing blocks translate only a woven alternation of solid and open space. No Örnek symbol, composition, meaning, palette, craft object or source coordinates are copied or reassigned.',
  },
  ukrainianPysanka: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Pysanka, Ukrainian tradition and art of decorating eggs',
    region: 'Ukraine and Ukrainian communities in Estonia',
    url: 'https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134',
    observedVocabulary: [
      'wax-resist layers preserve areas through repeated dye stages',
      'patterns and symbols are composed across divided surfaces',
      'families develop and transmit their own specific traditions',
    ],
    adaptationBoundary:
      'An original stepped divider translates layered sectioning and alternating compartments only. No pysanka, symbol, message, palette, division scheme or source coordinates are copied.',
  },
  krychevskyTactilePanels: {
    institution: 'National Museum of Ukrainian Pottery in Opishne',
    record: 'Ornaments that can be felt',
    region: 'Opishne, Poltava region',
    url: 'https://opishne-museum.gov.ua/ornamenty-yaki-mozhna-vidchuty/',
    observedVocabulary: [
      'large openwork wooden panels informed by Vasyl Krychevsky ornament',
      'five unequal diagonal panels installed beside a staircase',
      'ornament reinterpreted as an interactive and inclusive spatial object',
    ],
    adaptationBoundary:
      'An original open stair-and-panel return translates unequal diagonal rhythm and tactile spatial access only. No Krychevsky ornament, panel silhouette, artwork, palette or source coordinates are copied.',
  },
});

export const EARLY_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'nearby-shore',
    disposition: 'crimean-tatar-woven-offset-landings',
    sourceIds: ['crimeanTatarOrnek'],
    approaches: ['near-landing-first', 'far-landing-first'],
    pressurePoints: ['near-landing', 'open-weave-gap', 'far-landing'],
  },
  {
    id: 'two-bays',
    disposition: 'pysanka-layered-stepped-divider',
    sourceIds: ['ukrainianPysanka'],
    approaches: ['upper-step-first', 'lower-step-first'],
    pressurePoints: ['upper-step', 'central-offset', 'lower-step'],
  },
  {
    id: 'behind-the-patrol',
    disposition: 'krychevsky-open-stair-panel',
    sourceIds: ['krychevskyTactilePanels'],
    approaches: ['crossbar-first', 'stair-tip-first'],
    pressurePoints: ['outer-rail-window', 'open-crossbar', 'stair-tip', 'timed-slow-detour'],
  },
]);

const revisions = Object.freeze({
  'nearby-shore': {
    foundations: [rect(27, 12, 3, 3), rect(39, 20, 4, 4)],
    design: {
      routeDecision:
        'Take the short exposed line to the near woven landing, or cross the open gap to establish the larger far landing first?',
      lesson:
        'Separate foundation islands offer different return values; neither is earned coverage and neither fills territory by itself.',
      counterplay:
        'Commit to the near landing when the western keeper turns away. The far landing is more useful only when the eastern keeper leaves the open gap.',
      captureConsequence:
        'The near landing shortens the first return; the far landing creates a broader staging edge for the next enclosure.',
      memorableMoment:
        'Two Örnek-weaving-informed offset blocks turn the first island lesson into a real near-versus-far choice without borrowing a cultural symbol.',
      mastery: 'Connect both landings before completing a large enclosure.',
    },
  },
  'two-bays': {
    foundations: [rect(33, 1, 3, 10), rect(35, 10, 2, 15), rect(33, 24, 3, 11)],
    design: {
      routeDecision:
        'Work from the upper offset into the tighter western bay, or descend through the centre and use the lower offset against the wider eastern bay?',
      lesson:
        'A stepped divider still retains two occupied bays, but its unequal edges make departure height and capture order matter.',
      counterplay:
        'Use the upper shoulder for a short western cut; wait for the eastern keeper to retreat before crossing from the longer lower shoulder.',
      captureConsequence:
        'An upper closure improves the narrow bay without calming the east; a lower closure creates a longer return for the later eastern capture.',
      memorableMoment:
        'A pysanka-layering-informed stepped axis replaces the uniform rail with alternating compartments and two enclosure rhythms.',
      mastery: 'Earn territory from both offsets without using the outer boundary as the return.',
    },
  },
  'behind-the-patrol': {
    foundations: [rect(14, 15, 9, 2), rect(18, 17, 2, 7), rect(20, 20, 3, 1)],
    design: {
      routeDecision:
        'Slip behind the perimeter patrol onto the broad crossbar, or wait longer and descend the open stair to its safer inner tip?',
      lesson:
        'An asymmetric interior return can trade immediate access for a safer later departure while the outer patrol keeps its established route.',
      counterplay:
        'The crossbar is closest but exposed to the next patrol pass. The stair tip takes longer to reach and offers a quieter east-facing return.',
      captureConsequence:
        'A crossbar closure preserves fast access to both sides; a stair-tip closure moves the useful frontier away from the outer rail.',
      memorableMoment:
        'A Krychevsky-panel-informed open stair turns one rectangular island into a visible timing choice around the patrolled border.',
      mastery: 'Use both the crossbar and stair tip while ignoring the optional timed slow bonus.',
    },
  },
});

/** Copy-on-write successor to v13. Existing actors, physics, hazards, bonuses,
 * objectives and art remain exact; only foundation geometry and route guidance
 * change for the selected identities. */
export function createEarlyCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createBorderSignalCulturalNextBatchCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-early-cultural-routes-original-review'
    : 'whole-early-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Early Ukrainian cultural routes';
  project.revision = EARLY_CULTURAL_ROUTES_REVISION;

  for (const selection of EARLY_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    nextMap.revision = EARLY_CULTURAL_ROUTES_REVISION;
    nextMap.foundations = structuredClone(revision.foundations);
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: EARLY_CULTURAL_ROUTES_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = EARLY_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = EARLY_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
