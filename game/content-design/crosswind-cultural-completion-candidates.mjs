import { freezeDesign } from './catalogs.mjs';
import { createRelayCulturalCompletionCandidates } from './relay-cultural-completion-candidates.mjs';

export const CROSSWIND_CULTURAL_COMPLETION_REVISION = 'crosswind-cultural-routes-2';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const CROSSWIND_CULTURAL_COMPLETION_SOURCES = freezeDesign({
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
      'An original survey field borrows parallel-strip, separated-row and joined-end organization only. No gerdan, bead pattern, cross, palette, meaning or source coordinates are copied.',
  },
  branchedRhombusTowel: {
    institution: 'Museum Fund of Ukraine',
    record: 'Embroidered towel, collection record 94261',
    region: 'Lviv Historical Museum',
    url: 'https://museum.mincult.gov.ua/collections/rushnik-vishitiy-94261',
    observedVocabulary: [
      'a geometric cross-stitch band organized around rhombi and triangles',
      'three separated rhombi containing flower forms',
      'a larger rhomboid figure with branching outer sides',
    ],
    adaptationBoundary:
      'An original compass field borrows separated-rhombus, triangular-gap and outward-branch organization only. No towel, flower, stitch chart, palette, meaning or source coordinates are copied.',
  },
  alternatingBandTowel: {
    institution: 'Ivan Honchar Museum',
    record: 'Woven towel, collection number KN-761',
    region: 'Middle Polissia, Zahaltsi',
    url: 'https://honchar.org.ua/collections/detail/2461',
    observedVocabulary: [
      'bands of different widths recorded by the museum',
      'some bands organized with squares in a checker arrangement',
      'plain-color bands alternating with ornamented bands',
    ],
    adaptationBoundary:
      'An original outer-loop field borrows alternating band width, checker-like offset and interrupted-row organization only. No towel, flower, weave draft, palette, meaning or source coordinates are copied.',
  },
});

export const CROSSWIND_CULTURAL_COMPLETION_SELECTIONS = freezeDesign([
  {
    id: 'survey-markers',
    disposition: 'parallel-strip-survey-approaches',
    sourceIds: ['joinedParallelGerdan'],
    approaches: ['north-receiver-first', 'east-receiver-first'],
    pressurePoints: ['north-gap', 'east-crossing', 'west-strip-end', 'perimeter-window'],
  },
  {
    id: 'compass-array',
    disposition: 'branched-rhombus-compass-gaps',
    sourceIds: ['branchedRhombusTowel'],
    approaches: ['north-neck-first', 'west-arm-first'],
    pressurePoints: ['north-neck', 'west-arm', 'central-turn', 'frontier-window'],
  },
  {
    id: 'outer-loop',
    disposition: 'alternating-band-loop-posts',
    sourceIds: ['alternatingBandTowel'],
    approaches: ['inner-post-first', 'outer-post-first'],
    pressurePoints: ['inner-gap', 'middle-band', 'outer-column', 'roamer-return'],
  },
]);

const revisions = Object.freeze({
  'survey-markers': {
    walls: [
      rect(23, 7, 3, 8),
      rect(46, 7, 3, 8),
      rect(17, 10, 3, 5),
      rect(52, 20, 3, 6),
      rect(21, 21, 3, 7),
      rect(48, 27, 3, 5),
    ],
    design: {
      routeDecision:
        'Take the short north receiver through the separated strip ends, or commit to the longer east crossing before the perimeter patrol closes its return window?',
      lesson:
        'A museum gerdan record informs parallel strips, separated rows and joined-end organization only. The dark bands are walls; arrows alter travel time only in unclaimed field.',
      counterplay:
        'North-first is short but shares a visible lane with the nearest keeper. East-first stays exposed longer, then establishes a broad with-arrow return beyond the lower strip end.',
      captureConsequence:
        'Connecting one receiver neutralizes its directional field and creates a departure beyond one wall band. The other occupied approaches remain active.',
      memorableMoment:
        'The paired strips turn one open four-way choice into two visibly different closures: a quick neck and a long assisted traverse.',
      mastery:
        'Connect the east receiver first, then use the north gap and clear without losing a life.',
      difficulty: {
        band: 10,
        planning: 10,
        execution: 9,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'compass-array': {
    walls: [
      rect(23, 13, 7, 2),
      rect(43, 13, 8, 2),
      rect(23, 21, 7, 2),
      rect(43, 21, 8, 2),
      rect(15, 4, 5, 2),
      rect(52, 4, 5, 2),
      rect(15, 32, 5, 2),
      rect(52, 32, 5, 2),
    ],
    design: {
      routeDecision:
        'Use the short north neck between the inner rhombus bands, or cross the longer west arm with its arrows before the frontier reaches the central landing?',
      lesson:
        'A museum towel record informs separated-rhombus and outward-branch organization only. Wall gaps define the compass choices without forcing a turn or changing capture rules.',
      counterplay:
        'North-first limits exposure but gives the frontier a predictable contour. West-first is longer, uses favourable arrows and preserves both central necks for later cuts.',
      captureConsequence:
        'A reclaimed neck loses its speed modifier. A lateral closure instead establishes ordinary return ground outside the inner bands while both keepers remain active.',
      memorableMoment:
        'The apparently decorative branch ends become readable timing gates around the central compass pad.',
      mastery:
        'Secure the west arm first, then reclaim both central necks and clear without losing a life.',
      difficulty: {
        band: 11,
        planning: 11,
        execution: 9,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 9,
        coordination: 0,
      },
    },
  },
  'outer-loop': {
    walls: [
      rect(9, 10, 7, 2),
      rect(32, 12, 8, 2),
      rect(48, 10, 8, 2),
      rect(9, 24, 7, 2),
      rect(32, 24, 8, 2),
      rect(48, 25, 8, 2),
    ],
    design: {
      routeDecision:
        'Take the nearby inner post through an alternating-band opening, or reposition along the reclaimed U before committing to the narrow outer column?',
      lesson:
        'A museum woven-towel record informs alternating band width and checker-like offset only. Reclaimed loops support returns but remain vulnerable to their authored roamer.',
      counterplay:
        'Inner-first is quick and enlarges the roamer network early. Outer-first consumes safe repositioning time, then asks for a short exposed closure through a distant wall gap.',
      captureConsequence:
        'The inner closure establishes the shortest escape between bands. The outer closure preserves two separated inner approaches while moving pressure toward the long loop.',
      memorableMoment:
        'A calm run along the reclaimed U ends in a tight outer closure while the active roamer remains visibly separated.',
      mastery:
        'Secure the outer post first, then visit both inner posts and clear without losing a life.',
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

/** Copy-on-write successor to v26. Actors, objectives, speed zones, bonuses,
 * foundations, artwork and gameplay policy remain exact; only wall topology and
 * its documented route evidence change. */
export function createCrosswindCulturalCompletionCandidates({ artwork = false } = {}) {
  const before = createRelayCulturalCompletionCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-crosswind-cultural-completion-original-review'
    : 'whole-crosswind-cultural-completion-greybox-review';
  project.name = 'Whole Journey · Crosswind Ukrainian cultural completion';
  project.revision = CROSSWIND_CULTURAL_COMPLETION_REVISION;

  for (const selection of CROSSWIND_CULTURAL_COMPLETION_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: CROSSWIND_CULTURAL_COMPLETION_REVISION,
      walls: structuredClone(revision.walls),
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: CROSSWIND_CULTURAL_COMPLETION_REVISION,
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
    if (owningCampaignIds.has(campaign.id))
      campaign.revision = CROSSWIND_CULTURAL_COMPLETION_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = CROSSWIND_CULTURAL_COMPLETION_REVISION;
  return structuredClone(project);
}
