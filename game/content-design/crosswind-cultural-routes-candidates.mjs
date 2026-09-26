import { freezeDesign } from './catalogs.mjs';
import { createRelayCulturalRoutesCandidates } from './relay-cultural-routes-candidates.mjs';

export const CROSSWIND_CULTURAL_ROUTES_REVISION = 'crosswind-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const CROSSWIND_CULTURAL_ROUTES_SOURCES = freezeDesign({
  branchedRhombusTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Embroidered towel, collection record 94261',
    region: 'Lviv Historical Museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-vishitiy-94261',
    observedVocabulary: [
      'geometric ornament recorded by the museum',
      'a broad rhombus-and-triangle band organization',
      'a large rhomboid figure whose outside edges carry branching details',
    ],
    adaptationBoundary:
      'An original route field borrows central-diamond, staggered-triangle and outward-branch organization only. No towel, motif, stitch chart, palette, meaning or source coordinates are copied.',
  },
  alternatingBandTowel: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven towel, collection record КН-761',
    region: 'Middle Polissia, Zahaltsi',
    url: 'https://honchar.org.ua/collections/detail/2461',
    observedVocabulary: [
      'bands of different widths recorded by the museum',
      'some bands organized with squares in a checker arrangement',
      'plain-color bands alternating with ornamented bands',
    ],
    adaptationBoundary:
      'An original windbreak field borrows alternating band width and checker-like offset only. No towel, flower/star, rhombus-in-octagon, weave draft, palette, meaning or source coordinates are copied.',
  },
  joinedParallelGerdan: {
    institution: 'Museum Fund of Ukraine',
    record: 'Gerdan, collection record 40778',
    region: 'Museum of Arts of Prykarpattia',
    url: 'https://museum.mincult.gov.ua/collections/40778',
    observedVocabulary: [
      'two parallel ornamental strips',
      'a rhomboid joining form at the ends of the strips',
      'symmetric geometric rows separated by contrasting cross forms',
    ],
    adaptationBoundary:
      'An original paired-route field borrows parallel-strip, central-join and separated-row organization only. No gerdan, bead pattern, rhombus, cross, palette, meaning or source coordinates are copied.',
  },
});

export const CROSSWIND_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'read-the-arrows',
    disposition: 'branched-rhombus-directional-approaches',
    sourceIds: ['branchedRhombusTowel'],
    approaches: ['marked-center-run', 'west-chevron-detour'],
    pressurePoints: ['north-departure', 'marked-center-run', 'west-landing', 'east-pocket'],
  },
  {
    id: 'windbreak-weave',
    disposition: 'alternating-band-windbreak-field',
    sourceIds: ['alternatingBandTowel'],
    approaches: ['north-thread', 'west-meander'],
    pressurePoints: ['central-turn', 'north-thread', 'west-opening', 'moving-frontier'],
  },
  {
    id: 'long-wave',
    disposition: 'joined-parallel-wave-routes',
    sourceIds: ['joinedParallelGerdan'],
    approaches: ['central-wave', 'west-riser'],
    pressurePoints: ['north-departure', 'central-fast-lane', 'west-riser', 'emitter-window'],
  },
]);

const revisions = Object.freeze({
  'read-the-arrows': {
    walls: [
      rect(23, 7, 6, 2),
      rect(43, 7, 6, 2),
      rect(18, 11, 4, 2),
      rect(50, 11, 4, 2),
      rect(19, 23, 6, 2),
      rect(44, 23, 8, 2),
    ],
    foundations: [rect(30, 15, 12, 4), rect(10, 9, 7, 4), rect(55, 23, 7, 4)],
    terrain: [
      { id: 'west-weather', kind: 'slow', ...rect(8, 16, 9, 6) },
      { id: 'east-weather', kind: 'slow', ...rect(55, 14, 9, 6) },
    ],
    speedZones: [
      { id: 'southbound', direction: 'down', ...rect(33, 3, 6, 12) },
      { id: 'northbound', direction: 'up', ...rect(25, 19, 5, 12) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Use the short marked centre run before the eastern keeper crosses it, or travel west on the perimeter and take the slower chevron-side landing for a quieter first return?',
      lesson:
        'A museum towel record informs central-diamond, staggered-triangle and outward-branch organization only. Walls block movement; arrows change speed only in unclaimed field and never force a turn.',
      counterplay:
        'The centre run is faster but commits directly between both keepers. The west detour delays departure, avoids the shared line and leaves the central landing available for a later ambitious cut.',
      captureConsequence:
        'Closing the centre run neutralizes its directional field. Closing on the west landing instead establishes an offset return while both occupied central regions remain active.',
      memorableMoment:
        'The visually dominant marked route is not always the safest first closure, and the chosen branch permanently changes the next departure.',
      mastery:
        'Use the west landing first, later neutralize the marked centre run and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'windbreak-weave': {
    walls: [
      rect(16, 9, 18, 2),
      rect(40, 9, 17, 2),
      rect(8, 13, 17, 2),
      rect(47, 13, 17, 2),
      rect(8, 21, 17, 2),
      rect(47, 21, 17, 2),
      rect(16, 25, 18, 2),
      rect(40, 25, 17, 2),
    ],
    foundations: [
      rect(33, 15, 7, 6),
      rect(28, 4, 16, 3),
      rect(7, 16, 9, 4),
      rect(56, 16, 9, 4),
      rect(28, 29, 16, 3),
    ],
    terrain: [],
    speedZones: [
      { id: 'north-thread', direction: 'up', ...rect(34, 7, 4, 8) },
      { id: 'west-thread', direction: 'left', ...rect(16, 16, 17, 4) },
      { id: 'east-thread', direction: 'right', ...rect(40, 16, 16, 4) },
      { id: 'south-thread', direction: 'down', ...rect(34, 21, 4, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 17.5 },
    design: {
      routeDecision:
        'Take the short marked north thread, or cross west through the alternating band openings to reshape the frontier before approaching another return?',
      lesson:
        'A museum woven-towel record informs alternating band width and checker-like offset only. Broken bands are walls with visible openings; only foundations and captured territory close cuts.',
      counterplay:
        'Read the frontier from the central landing. North is the shortest assisted closure, while west creates a broader return and sends the frontier around a different sequence of wall ends.',
      captureConsequence:
        'The chosen directional thread becomes ordinary reclaimed movement and the moving frontier follows the new contour, changing the useful opening on the opposite side.',
      memorableMoment:
        'One straight assisted closure turns the alternating side openings into the more valuable second problem instead of repeating another spoke.',
      mastery:
        'Close north and west in either order, then reach a third landing without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'long-wave': {
    walls: [
      rect(20, 8, 9, 2),
      rect(43, 8, 9, 2),
      rect(25, 11, 3, 4),
      rect(44, 11, 3, 4),
      rect(25, 21, 3, 4),
      rect(44, 21, 3, 4),
      rect(20, 26, 9, 2),
      rect(43, 26, 9, 2),
    ],
    foundations: [
      rect(32, 15, 8, 5),
      rect(13, 6, 7, 5),
      rect(13, 25, 7, 5),
      rect(52, 6, 7, 5),
      rect(52, 25, 7, 5),
    ],
    terrain: [],
    speedZones: [
      { id: 'west-up', direction: 'up', ...rect(15, 11, 4, 14) },
      { id: 'middle-down', direction: 'down', ...rect(34, 3, 4, 12) },
      { id: 'east-up', direction: 'up', ...rect(53, 11, 4, 14) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Ride the central down-arrow to the joined landing before a keeper contests it, or reposition west and close on the upper riser while preserving the centre for an emitter recovery window?',
      lesson:
        'A museum gerdan record informs parallel-strip and central-join organization only. Directional zones change craft travel time; the lane emitter keeps its own warning, commitment and recovery schedule.',
      counterplay:
        'The central wave is quick but shared by both field keepers. The west riser is unmarked on approach, then supports a later with-arrow return timed outside the emitter lane.',
      captureConsequence:
        'The first closed strip becomes ordinary-speed return ground. Its paired strip and the stationary emitter remain active, so the next route still needs a different timing decision.',
      memorableMoment:
        'Two apparently parallel routes diverge: one rewards immediate speed, while the other preserves a safer closure for the next attack window.',
      mastery:
        'Close on the west riser first, then neutralize the central wave during an emitter recovery and clear without losing a life.',
      difficulty: {
        band: 11,
        planning: 11,
        execution: 9,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v22. Existing identities, policies, catalogues,
 * actors, objectives, bonuses and art remain exact. */
export function createCrosswindCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createRelayCulturalRoutesCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-crosswind-cultural-routes-original-review'
    : 'whole-crosswind-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Crosswind Ukrainian cultural routes';
  project.revision = CROSSWIND_CULTURAL_ROUTES_REVISION;

  for (const selection of CROSSWIND_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: CROSSWIND_CULTURAL_ROUTES_REVISION,
      walls: structuredClone(revision.walls),
      foundations: structuredClone(revision.foundations),
      terrain: structuredClone(revision.terrain),
      speedZones: structuredClone(revision.speedZones),
      spawns: [structuredClone(revision.spawn)],
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: CROSSWIND_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls', 'terrain'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'terrain'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = CROSSWIND_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = CROSSWIND_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
