import { freezeDesign } from './catalogs.mjs';
import { createCrosswindCulturalRoutesCandidates } from './crosswind-cultural-routes-candidates.mjs';

export const SENTINEL_CULTURAL_ROUTES_REVISION = 'sentinel-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const SENTINEL_CULTURAL_ROUTES_SOURCES = freezeDesign({
  carvedChest: {
    institution: 'Museum Fund of Ukraine',
    record: 'Carved chest, collection record 241663',
    region: 'Ivano-Frankivsk Regional Museum',
    url: 'https://museum.mincult.gov.ua/collections/241663',
    observedVocabulary: [
      'a triangular lid divided into two parts by a carved ridge',
      'a front organized in three distinct horizontal sections',
      'rings, triangles and six-petal floral forms recorded by the museum',
    ],
    adaptationBoundary:
      'An original shield field borrows tripartite, ring-and-triangle and divided-ridge organization only. No chest, carving, flower, pattern, palette, meaning or source coordinates are copied.',
  },
  fiveZoneRunner: {
    institution: 'Museum Fund of Ukraine',
    record: 'Hand-woven runner, collection record 235942',
    region: 'Tyvriv local-history museum',
    url: 'https://museum.mincult.gov.ua/collections/235942',
    observedVocabulary: [
      'five main decorative zones separated by dark technical bands',
      'a large concentric rhomboid organization in the central zone',
      'mirrored outer zones and smaller repeated geometric rows',
    ],
    adaptationBoundary:
      'An original relay field borrows five-zone, central-focus and mirrored-outer organization only. No runner, anthropomorphic form, motif, weave draft, palette, meaning or source coordinates are copied.',
  },
  symmetricCarvedShelf: {
    institution: 'Ivan Honchar Museum',
    record: 'Carved icon shelf, collection record КН-2869',
    region: 'Middle Dnipro, Kyiv region',
    url: 'https://honchar.org.ua/collections/detail/1826',
    observedVocabulary: [
      'a trapezoidal overall form recorded by the museum',
      'a symmetric composition with a distinct central focus',
      'paired side rosettes balancing the centre',
    ],
    adaptationBoundary:
      'An original four-approach arena borrows trapezoidal spacing and centre-with-paired-sides organization only. No shelf, sacred object, named motif, rosette, carving, palette, meaning or source coordinates are copied.',
  },
});

export const SENTINEL_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'first-relay',
    disposition: 'tripartite-shield-approaches',
    sourceIds: ['carvedChest'],
    approaches: ['central-ridge', 'west-upper-landing'],
    pressurePoints: ['north-departure', 'central-ridge', 'west-upper-landing', 'shield-opening'],
  },
  {
    id: 'relay-perimeter',
    disposition: 'five-zone-relay-order',
    sourceIds: ['fiveZoneRunner'],
    approaches: ['left-zone-close', 'central-focus-close'],
    pressurePoints: ['left-departure', 'central-opening', 'west-relay', 'roamer-return'],
  },
  {
    id: 'crown-audience',
    disposition: 'symmetric-four-shield-court',
    sourceIds: ['symmetricCarvedShelf'],
    approaches: ['north-centre-close', 'west-side-close'],
    pressurePoints: ['central-platform', 'north-return', 'west-return', 'four-shield-order'],
  },
]);

const revisions = Object.freeze({
  'first-relay': {
    walls: [
      rect(46, 10, 19, 2),
      rect(46, 25, 19, 2),
      rect(63, 12, 2, 13),
      rect(46, 12, 2, 3),
      rect(46, 22, 2, 3),
      rect(20, 8, 7, 2),
      rect(24, 10, 2, 4),
      rect(20, 26, 7, 2),
      rect(24, 22, 2, 4),
    ],
    foundations: [rect(32, 14, 8, 7), rect(10, 7, 7, 4), rect(10, 25, 7, 4), rect(54, 29, 5, 4)],
    terrain: [
      { id: 'west-rib', kind: 'slow', ...rect(21, 14, 3, 8) },
      { id: 'east-rib', kind: 'slow', ...rect(43, 15, 3, 7) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Close quickly on the central ridge and accept both patrol domains for the shield approach, or travel west on the perimeter and bank the upper side landing before entering the chamber?',
      lesson:
        'A museum chest record informs tripartite and divided-ridge organization only. Carved-looking baffles are walls; only foundations and reclaimed territory close a cut.',
      counterplay:
        'The centre is the shortest return but leaves the frontier beside the next departure. The west landing delays entry, then provides a quieter angle on the chamber opening.',
      captureConsequence:
        'A first closure establishes an approach without changing the Sentinel contract. Capturing the shield still opens the explicit core stage; no wall becomes return ground.',
      memorableMoment:
        'The broad central route and the side landing lead to the same shield through meaningfully different patrol timing.',
      mastery:
        'Bank the west upper landing first, disable the chamber shield and release the core without losing a life.',
      difficulty: {
        band: 11,
        planning: 11,
        execution: 9,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'relay-perimeter': {
    walls: [
      rect(24, 5, 3, 10),
      rect(24, 21, 3, 10),
      rect(28, 8, 5, 2),
      rect(39, 8, 16, 2),
      rect(28, 26, 5, 2),
      rect(39, 26, 16, 2),
      rect(55, 11, 3, 6),
      rect(55, 20, 3, 6),
    ],
    foundations: [
      rect(6, 8, 8, 5),
      rect(5, 22, 8, 5),
      rect(18, 16, 6, 4),
      rect(33, 14, 6, 7),
      rect(59, 26, 6, 5),
    ],
    terrain: [],
    spawn: { id: 'home', x: 8.5, y: 0.5 },
    design: {
      routeDecision:
        'Take the immediate left-zone return, or cross the perimeter to the narrow central opening and establish the focused middle landing before choosing a shield order?',
      lesson:
        'A museum runner record informs five-zone, central-focus and mirrored-outer organization only. The existing relay opens permanent connectors; the surrounding bands remain blocking walls.',
      counterplay:
        'The left close is short but activates the roamer beside the transfer. The central close is longer under frontier pressure, then creates a strong return for either outer shield.',
      captureConsequence:
        'Opening the west relay still joins the existing corner connectors. A central approach changes later return geometry without awarding an objective or skipping the core stage.',
      memorableMoment:
        'The opened corner and the central landing compete as repositioning routes instead of producing another perimeter loop.',
      mastery:
        'Establish the central landing first, traverse the opened west corner and release the core without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 10,
        coordination: 0,
      },
    },
  },
  'crown-audience': {
    walls: [
      rect(22, 7, 2, 6),
      rect(48, 7, 2, 6),
      rect(14, 12, 8, 2),
      rect(50, 12, 8, 2),
      rect(22, 23, 2, 6),
      rect(48, 23, 2, 6),
      rect(14, 22, 8, 2),
      rect(50, 22, 8, 2),
    ],
    foundations: [
      rect(32, 15, 8, 6),
      rect(28, 4, 16, 3),
      rect(28, 29, 16, 3),
      rect(7, 14, 5, 8),
      rect(60, 14, 5, 8),
    ],
    terrain: [],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Reach the broad north return through the central opening, or establish the west side return first and work around the paired shield baffles from the outside?',
      lesson:
        'A museum carved-shelf record informs centre-with-paired-sides symmetry only. The four shield sites stay independent objectives and the boss release rule remains unchanged.',
      counterplay:
        'North is a long exposed close watched by the changing frontier. West is shorter, but activating more reclaimed side ground gives the roamer a stronger route into later departures.',
      captureConsequence:
        'Each approach creates a different safe launch network. A broad capture may disable multiple shields, while separate closures preserve more deliberate control over the roamer.',
      memorableMoment:
        'The symmetric court stops being a visual pattern and becomes a choice between central reach and side control before the final release.',
      mastery:
        'Establish the west return first, capture all four shields in separate closures and release the core without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 10,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v23. Existing identities, policies, catalogues,
 * actors, objectives, relay links, bonuses and art remain exact. */
export function createSentinelCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createCrosswindCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-sentinel-cultural-routes-original-review'
    : 'whole-sentinel-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Sentinel Ukrainian cultural routes';
  project.revision = SENTINEL_CULTURAL_ROUTES_REVISION;

  for (const selection of SENTINEL_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: SENTINEL_CULTURAL_ROUTES_REVISION,
      walls: structuredClone(revision.walls),
      foundations: structuredClone(revision.foundations),
      terrain: structuredClone(revision.terrain),
      spawns: [structuredClone(revision.spawn)],
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: SENTINEL_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls', 'foundations'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'foundations'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = SENTINEL_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = SENTINEL_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
