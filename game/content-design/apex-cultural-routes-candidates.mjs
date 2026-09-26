import { freezeDesign } from './catalogs.mjs';
import { createSentinelCulturalRoutesCandidates } from './sentinel-cultural-routes-candidates.mjs';

export const APEX_CULTURAL_ROUTES_REVISION = 'apex-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const APEX_CULTURAL_ROUTES_SOURCES = freezeDesign({
  threeDiamondTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Embroidered towel, collection record 98567',
    region: 'Volyn Regional Museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-vishitiy-98567',
    observedVocabulary: [
      'three large rhomboid figures containing smaller rhomboid organization',
      'rhythmic repeated elements along the upper and lower edges',
      'a decorative field concentrated near the two ends',
    ],
    adaptationBoundary:
      'An original crossing field borrows three-focus, nested-centre and rhythmic-edge organization only. No towel, embroidery, motif, stitch plan, palette, meaning or source coordinates are copied.',
  },
  krolevetsTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Krolevets woven towel, collection record 108366',
    region: 'Krolevets local-history museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-kroleveckiy-108366',
    observedVocabulary: [
      'vertical side bands organized from triangular forms',
      'small rhomboid forms scattered through the central field',
      'a composition repeated symmetrically from both ends',
    ],
    adaptationBoundary:
      'An original stepping-route field borrows triangular side cadence, scattered-centre and end-symmetry organization only. No towel, figure, motif, weave draft, palette, meaning or source coordinates are copied.',
  },
  fourPointTile: {
    institution: 'Museum Fund of Ukraine',
    record: 'Decorated stove tile, collection record 267010',
    region: 'Andrey Sheptytsky National Museum in Lviv',
    url: 'https://museum.mincult.gov.ua/collections/267010',
    observedVocabulary: [
      'a four-point central figure',
      'details placed at the four outer points and between them',
      'a distinct ornamental perimeter surrounding the central field',
    ],
    adaptationBoundary:
      'An original four-relay finale borrows centre-to-four-points and bounded-perimeter organization only. No tile, star, flower, named decoration, painting, palette, meaning or source coordinates are copied.',
  },
});

export const APEX_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'crossing-complete',
    disposition: 'three-focus-contested-crossing',
    sourceIds: ['threeDiamondTowel'],
    approaches: ['central-first-close', 'west-long-close'],
    pressurePoints: ['central-gap', 'west-landing', 'lethal-belt', 'frontier-turn'],
  },
  {
    id: 'returning-light',
    disposition: 'triangular-stepping-returns',
    sourceIds: ['krolevetsTowel'],
    approaches: ['central-long-close', 'upper-step-close'],
    pressurePoints: ['long-crossing', 'upper-step', 'lane-column', 'roamer-return'],
  },
  {
    id: 'home-signal',
    disposition: 'four-relay-centred-finale',
    sourceIds: ['fourPointTile'],
    approaches: ['central-dock-close', 'south-wing-close'],
    pressurePoints: ['home-departure', 'central-dock', 'south-wing', 'four-relay-order'],
  },
]);

const revisions = Object.freeze({
  'crossing-complete': {
    walls: [
      rect(29, 11, 4, 2),
      rect(38, 11, 4, 2),
      rect(26, 13, 4, 2),
      rect(42, 13, 4, 2),
      rect(22, 15, 4, 2),
      rect(46, 15, 4, 2),
      rect(26, 17, 4, 2),
      rect(42, 17, 4, 2),
      rect(29, 19, 4, 2),
      rect(38, 19, 4, 2),
    ],
    foundations: [rect(29, 7, 14, 3), rect(8, 20, 8, 3), rect(56, 20, 8, 3), rect(33, 30, 6, 3)],
    terrain: [
      { id: 'north-west-thread', kind: 'slow', ...rect(2, 11, 18, 3) },
      { id: 'north-east-thread', kind: 'slow', ...rect(52, 11, 18, 3) },
      { id: 'south-west-thread', kind: 'lethal', ...rect(2, 25, 18, 3) },
      { id: 'south-east-thread', kind: 'lethal', ...rect(52, 25, 18, 3) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Close quickly at the central upper focus before the frontier turns, or travel west on the perimeter and make the longer close beside the lethal belt for a quieter next departure?',
      lesson:
        'A museum towel record informs three-focus and nested-centre organization only. The stepped forms are walls; they do not close a cut.',
      counterplay:
        'The centre is faster but exposes the next departure to both patrol domains. The west landing costs time, then offers a shorter angle on one hazardous belt.',
      captureConsequence:
        'Neutralizing a side belt creates ordinary reclaimed territory there. A line-only central closure still reshapes the frontier without pretending a wall is return ground.',
      memorableMoment:
        'Three stepped obstacle focuses turn one open striped field into distinct centre, west and east route problems.',
      mastery:
        'Bank the west landing first, neutralize both lethal side fields and clear without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 11,
        coordination: 0,
      },
    },
  },
  'returning-light': {
    walls: [
      rect(11, 5, 2, 2),
      rect(14, 8, 2, 2),
      rect(17, 11, 2, 2),
      rect(11, 29, 2, 2),
      rect(14, 26, 2, 2),
      rect(17, 23, 2, 2),
      rect(53, 11, 2, 2),
      rect(50, 8, 2, 2),
      rect(47, 5, 2, 2),
      rect(53, 23, 2, 2),
      rect(50, 26, 2, 2),
      rect(47, 29, 2, 2),
    ],
    foundations: [
      rect(4, 6, 4, 24),
      rect(20, 8, 5, 7),
      rect(33, 17, 6, 5),
      rect(42, 27, 5, 5),
      rect(64, 6, 4, 24),
    ],
    terrain: [],
    spawn: { id: 'home', x: 5.5, y: 17.5 },
    design: {
      routeDecision:
        'Take the exposed long centre crossing before the lane warning, or climb the home rail and bank the upper stepping return before waking reclaimed-ground pressure?',
      lesson:
        'A Krolevets towel record informs triangular side cadence and scattered-centre organization only. The small baffles mark route rhythm without becoming return ground.',
      counterplay:
        'The centre is efficient while the emitter recovers. The upper step offers a shorter cut and preserves the middle landing for the roamer’s first pass.',
      captureConsequence:
        'The fast crossing becomes ordinary reclaimed territory and may be used by the roamer. Outer stepping returns remain useful after the reveal.',
      memorableMoment:
        'A direct centre shortcut and a stepped side approach exchange value once the roamer activates.',
      mastery:
        'Bank the upper step first, connect the centre and lower step, then clear without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 11,
        coordination: 0,
      },
    },
  },
  'home-signal': {
    walls: [
      rect(30, 8, 14, 2),
      rect(27, 10, 3, 5),
      rect(44, 10, 3, 7),
      rect(24, 17, 6, 2),
      rect(44, 17, 6, 2),
      rect(27, 22, 3, 4),
      rect(44, 21, 3, 5),
      rect(30, 25, 5, 2),
      rect(39, 25, 5, 2),
    ],
    foundations: [
      rect(10, 14, 10, 8),
      rect(8, 5, 8, 4),
      rect(18, 9, 6, 4),
      rect(8, 27, 8, 4),
      rect(18, 23, 6, 4),
      rect(32, 14, 5, 4),
      rect(58, 4, 8, 4),
      rect(32, 28, 8, 3),
      rect(60, 28, 7, 4),
    ],
    terrain: [],
    spawn: { id: 'home', x: 15.5, y: 17.5 },
    design: {
      routeDecision:
        'Use the short central dock close and accept immediate frontier pressure, or descend from home to establish the south wing before choosing the four-relay order?',
      lesson:
        'A museum tile record informs centre-to-four-points organization only. The finale still uses the familiar capture, relay and reclaimed-ground rules.',
      counterplay:
        'The dock is the fastest permanent return. The south wing takes longer but separates the next departure from the frontier and the awakened roamer.',
      captureConsequence:
        'Each visible relay persists and the dock connector remains non-scoring. Captures still fill only enemy-free components and can wake the roamer.',
      memorableMoment:
        'Four relay approaches orbit a distinct centre while the player decides which permanent return should become home first.',
      mastery:
        'Establish the south wing first, visit the central dock and both far platforms, then clear without losing a life.',
      difficulty: {
        band: 12,
        planning: 12,
        execution: 10,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 11,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v24. Existing identities, policies, catalogues,
 * actors, objectives, relay links, bonuses and art remain exact. */
export function createApexCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createSentinelCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-apex-cultural-routes-original-review'
    : 'whole-apex-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Apex Ukrainian cultural routes';
  project.revision = APEX_CULTURAL_ROUTES_REVISION;

  for (const selection of APEX_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: APEX_CULTURAL_ROUTES_REVISION,
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
      revision: APEX_CULTURAL_ROUTES_REVISION,
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
    if (owningCampaignIds.has(campaign.id)) campaign.revision = APEX_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = APEX_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
