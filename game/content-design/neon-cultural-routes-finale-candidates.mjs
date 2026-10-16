import { freezeDesign } from './catalogs.mjs';
import { createNeonCulturalRoutesCandidates } from './neon-cultural-routes-candidates.mjs';

export const NEON_CULTURAL_ROUTES_FINALE_REVISION = 'neon-cultural-routes-2';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const NEON_CULTURAL_ROUTES_FINALE_SOURCES = freezeDesign({
  podoliaStripedRiadno: {
    institution: 'Ivan Honchar Museum',
    record: 'Striped woollen riadno panel',
    region: 'Podolia',
    url: 'https://honchar.org.ua/en/collections/detail/2581',
    observedVocabulary: [
      'striped woollen field',
      'twill and domestic weaving',
      'geometric ornament classification',
    ],
    adaptationBoundary:
      'An original hooked route uses alternating offset bands and open gaps only. No textile, stripe sequence, palette, ornament, meaning or source coordinates are copied.',
  },
  hutsulWovenZapaska: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven zapaska',
    region: 'Hutsul Area',
    url: 'https://honchar.org.ua/en/collections/detail/2972',
    observedVocabulary: [
      'woven woollen construction',
      'twill and domestic weaving',
      'geometric ornament classification',
    ],
    adaptationBoundary:
      'An original staggered circuit translates alternating woven-lane rhythm only. No garment, pattern, palette, ornament, meaning or source coordinates are copied.',
  },
  ukrainianPysanka: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Pysanka, Ukrainian tradition and art of decorating eggs',
    region: 'Ukraine and Ukrainian communities',
    url: 'https://ich.unesco.org/en/RL/pysanka-ukrainian-tradition-and-art-of-decorating-eggs-02134',
    observedVocabulary: [
      'successive wax-resist and dye stages',
      'community and family-specific practice',
      'decorated surfaces carrying personal wishes and messages',
    ],
    adaptationBoundary:
      'Three original open circuits translate layered resist-and-field separation only. No pysanka, symbol, wish, message, palette, ritual meaning or source coordinates are copied.',
  },
});

export const NEON_CULTURAL_ROUTES_FINALE_SELECTIONS = freezeDesign([
  {
    id: 'dogleg-return',
    disposition: 'podolia-offset-striped-hooks',
    sourceIds: ['podoliaStripedRiadno'],
    approaches: ['central-hook-first', 'east-landing-first'],
    pressurePoints: ['upper-gap', 'central-elbow', 'slow-thread', 'east-landing'],
  },
  {
    id: 'staggered-circuit',
    disposition: 'hutsul-staggered-woven-lanes',
    sourceIds: ['hutsulWovenZapaska'],
    approaches: ['controller-pad-first', 'right-rail-first'],
    pressurePoints: ['controller-pad', 'central-mask', 'trace-ends', 'right-rail'],
  },
  {
    id: 'neon-remix',
    disposition: 'pysanka-layered-open-circuits',
    sourceIds: ['ukrainianPysanka'],
    approaches: ['west-mouth-first', 'upper-span-first'],
    pressurePoints: ['west-mouth', 'upper-span', 'central-circuit', 'hot-bridge'],
  },
]);

const revisions = Object.freeze({
  'dogleg-return': {
    actors: [
      {
        id: 'lower-west',
        role: 'field-keeper',
        tier: 'measured',
        x: 9.5,
        y: 28.5,
        heading: [1, -1],
      },
      {
        id: 'upper-east',
        role: 'field-keeper',
        tier: 'measured',
        x: 62.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 32, y: 13, side: 'east' },
        clockwise: true,
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 22.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(22, 6, 8, 2),
      rect(42, 6, 8, 2),
      rect(18, 10, 7, 2),
      rect(47, 10, 7, 2),
      rect(15, 14, 6, 2),
      rect(51, 14, 6, 2),
      rect(19, 24, 8, 2),
      rect(49, 24, 6, 2),
      rect(25, 28, 7, 2),
      rect(40, 28, 7, 2),
    ],
    foundations: [
      rect(33, 8, 5, 11),
      rect(33, 17, 15, 4),
      rect(43, 20, 5, 8),
      rect(10, 20, 8, 5),
      rect(55, 8, 7, 5),
    ],
    terrain: [
      { id: 'west-hook-thread', kind: 'slow', ...rect(23, 16, 8, 5) },
      { id: 'east-hook-thread', kind: 'slow', ...rect(49, 16, 6, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short upper point of the central hook, or pass the broken offset bands to establish the east landing before the perimeter patrol arrives?',
      lesson:
        'Alternating woven-band-inspired walls obstruct movement but never close a cut. Slow thread remains field until enclosed and never acts as a return.',
      counterplay:
        'Use the wide elbow after reading the frontier patrol. The longer east approach avoids slow thread but exposes more trail to the upper keeper.',
      captureConsequence:
        'Connecting the dogleg gives short departures on three edges and moves frontier pressure; an east landing first preserves a quieter return beyond one hook.',
      memorableMoment:
        'Podolia-woven-field-inspired offset bands make the visually longer route the less obstructed enclosure.',
      mastery:
        'Earn territory on both sides of the hooked dogleg and neutralize both slow-thread fields without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'staggered-circuit': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 7.5,
        y: 30.5,
        heading: [1, -1],
      },
      {
        id: 'center',
        role: 'field-keeper',
        tier: 'measured',
        x: 45.5,
        y: 28.5,
        heading: [-1, -1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 51, y: 16, side: 'east' },
        clockwise: true,
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 22.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(20, 7, 9, 2),
      rect(43, 7, 8, 2),
      rect(20, 9, 2, 8),
      rect(50, 9, 2, 7),
      rect(22, 19, 8, 2),
      rect(42, 22, 8, 2),
      rect(29, 25, 5, 2),
      rect(38, 27, 5, 2),
    ],
    foundations: [rect(33, 7, 6, 5), rect(12, 14, 8, 12), rect(52, 10, 8, 13), rect(31, 29, 10, 3)],
    terrain: [
      { id: 'central-woven-field', kind: 'slow', ...rect(33, 12, 6, 13) },
      { id: 'west-woven-field', kind: 'slow', ...rect(22, 11, 5, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Use the short central pad and cross the slow woven field, or follow a clear staggered lane to the right rail before reshaping the frontier?',
      lesson:
        'Hutsul-woven-lane-inspired bands are blocking walls with visible open ends. Foundations close cuts; marked field slows only the exposed craft.',
      counterplay:
        'Read the frontier patrol on the right rail before its long clear approach. From the central pad, depart beside a lane end instead of repeating a vertical cut.',
      captureConsequence:
        'The central pad offers a short but slowed follow-up; reaching a side rail first creates an outer return and changes the order of the remaining openings.',
      memorableMoment:
        'Alternating woven-lane ends turn parallel bands into a choice between a short slowed link and a long clear enclosure.',
      mastery:
        'Join both side rails to the central pad and neutralize both slow fields without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'neon-remix': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 14.5,
        y: 13.5,
        heading: [1, 1],
      },
      {
        id: 'east',
        role: 'field-keeper',
        tier: 'measured',
        x: 56.5,
        y: 13.5,
        heading: [-1, 1],
      },
      {
        id: 'near-frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 11, y: 13, side: 'west' },
        clockwise: true,
      },
      {
        id: 'far-frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 60, y: 13, side: 'east' },
        clockwise: false,
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 22.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(24, 10, 4, 2),
      rect(44, 10, 4, 2),
      rect(23, 24, 5, 2),
      rect(45, 25, 4, 2),
      rect(33, 10, 7, 2),
      rect(34, 32, 7, 2),
    ],
    foundations: [
      rect(8, 6, 14, 3),
      rect(8, 9, 3, 10),
      rect(8, 19, 14, 3),
      rect(19, 9, 3, 2),
      rect(19, 17, 3, 2),
      rect(29, 14, 15, 3),
      rect(29, 17, 3, 12),
      rect(29, 29, 15, 3),
      rect(41, 17, 3, 3),
      rect(41, 26, 3, 3),
      rect(50, 6, 14, 3),
      rect(61, 9, 3, 10),
      rect(50, 19, 14, 3),
      rect(50, 9, 3, 2),
      rect(50, 17, 3, 2),
    ],
    terrain: [
      { id: 'slow-bridge', kind: 'slow', ...rect(24, 12, 4, 12) },
      { id: 'hot-bridge', kind: 'lethal', ...rect(45, 12, 3, 12) },
    ],
    spawn: { id: 'home', x: 13.5, y: 7.5 },
    design: {
      routeDecision:
        'Close the short western mouth under near-frontier pressure, or span the exposed upper field to establish the far circuit first?',
      lesson:
        'Three layered-resist-inspired circuits keep walls, foundations and hazardous field visually separate while known capture rules combine.',
      counterplay:
        'The western mouth is short but patrolled. The upper span is long and clear; wait for both field keepers to move below its line before committing.',
      captureConsequence:
        'West-first play creates a compact local return. Upper-span-first joins the outer circuits and changes which hazardous bridge is worth neutralizing next.',
      memorableMoment:
        'Three unequal open circuits turn successive field layers into a route-order puzzle rather than repeated boxes.',
      mastery:
        'Connect all three circuits and neutralize both marked bridges without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v16. Existing identities, policy, catalogues,
 * objectives, bonuses and art stay intact; selected maps gain authored walls,
 * returns and hazard placement while actor roles/counts remain stable. */
export function createNeonCulturalRoutesFinaleCandidates({ artwork = false } = {}) {
  const before = createNeonCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-neon-cultural-routes-finale-original-review'
    : 'whole-neon-cultural-routes-finale-greybox-review';
  project.name = 'Whole Journey · Neon Ukrainian cultural routes finale';
  project.revision = NEON_CULTURAL_ROUTES_FINALE_REVISION;

  for (const selection of NEON_CULTURAL_ROUTES_FINALE_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: NEON_CULTURAL_ROUTES_FINALE_REVISION,
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
      revision: NEON_CULTURAL_ROUTES_FINALE_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      actors: structuredClone(revision.actors),
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
    if (owningCampaignIds.has(campaign.id))
      campaign.revision = NEON_CULTURAL_ROUTES_FINALE_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = NEON_CULTURAL_ROUTES_FINALE_REVISION;
  return structuredClone(project);
}
