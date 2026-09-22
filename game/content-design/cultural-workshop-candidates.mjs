import { createStarterProject } from './starter.mjs';
import { freezeDesign, PRESSURE_DIFFICULTY_CATALOG, ROVER_ACTOR_CATALOG } from './catalogs.mjs';

const rect = (x, y, w, h) => ({ x, y, w, h });
const keeper = (id, x, y, heading = [1, 1]) => ({
  id,
  role: 'field-keeper',
  tier: 'standard',
  x,
  y,
  heading,
});
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'standard',
  x: 71.5,
  y: 26.5,
  clockwise: true,
});
const frontier = (x, y) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'standard',
  edge: { x, y, side: 'east' },
  clockwise: true,
});
// Open east and west sides deliberately. These are original stepped game motifs,
// not traced embroidery or a claim of regional symbolic meaning.
const diamond = (x, y) =>
  [
    [0, -8],
    [2, -6],
    [4, -4],
    [6, -2],
    [6, 2],
    [4, 4],
    [2, 6],
    [0, 8],
    [-2, 6],
    [-4, 4],
    [-6, 2],
    [-6, -2],
    [-4, -4],
    [-2, -6],
  ].map(([dx, dy]) => rect(x + dx, y + dy, 2, 2));

const rows = [
  {
    id: 'cross-stitch-crossings',
    name: 'Cross-stitch crossings',
    arc: 'ornament-crossings',
    band: 4,
    spawn: [8.5, 0.5],
    coverage: 0.7,
    walls: [...diamond(22, 17), ...diamond(49, 17)],
    foundations: [rect(6, 15, 5, 5), rect(33, 15, 6, 5), rect(62, 15, 5, 5)],
    actors: [keeper('west', 16.5, 28.5, [1, -1]), keeper('east', 59.5, 6.5, [-1, 1])],
    decision:
      'Thread an opening in a stepped diamond, or take the longer outer route to the next landing?',
    lesson:
      'The ornament is made of walls: only the contrasting reclaimed landings can close a cut.',
    counterplay:
      'Inspect both open sides before leaving. Each landing offers several departures; a wall touch is not a return.',
    consequence:
      'Connecting an off-axis landing gives a shorter approach through a different side of the motif.',
    moment: 'Two apparent decorative diamonds become useful choices of crossing direction.',
    mastery: 'Connect both far landings before clearing without a life loss.',
    combines: ['walls', 'foundations', 'enemy-seeded-closure'],
  },
  {
    id: 'rushnyk-bands',
    name: 'Rushnyk bands',
    arc: 'ornament-crossings',
    band: 4,
    spawn: [12.5, 0.5],
    coverage: 0.72,
    walls: [rect(4, 10, 19, 2), rect(31, 10, 37, 2), rect(4, 24, 37, 2), rect(49, 24, 19, 2)],
    foundations: [rect(10, 15, 8, 5), rect(26, 6, 3, 11), rect(44, 18, 3, 12), rect(56, 15, 8, 5)],
    actors: [keeper('west', 7.5, 29.5, [1, -1]), keeper('east', 62.5, 5.5, [-1, 1]), outer()],
    decision:
      'Cross at the staggered inner passage, or circle the end of the textile-like band for a larger enclosure?',
    lesson: 'Repeated bands do not repeat the same route: their openings alternate sides.',
    counterplay:
      'Use the internal return strips while the outside patrol passes; keep one passage available for the next cut.',
    consequence:
      'A short passage connection can make the far band easier to approach without changing patrol domain.',
    moment: 'A left-to-right crossing becomes a right-to-left problem at the next band.',
    mastery: 'Close a cut through each of the two inner passages.',
    combines: ['walls', 'foundations', 'perimeter-patrol'],
  },
  {
    id: 'pysanka-sections',
    name: 'Pysanka sections',
    arc: 'ornament-crossings',
    band: 5,
    spawn: [35.5, 17.5],
    coverage: 0.74,
    walls: [
      rect(27, 5, 18, 2),
      rect(21, 8, 6, 2),
      rect(45, 8, 6, 2),
      rect(17, 11, 4, 6),
      rect(51, 11, 4, 6),
      rect(17, 22, 4, 5),
      rect(51, 22, 4, 5),
      rect(21, 27, 6, 2),
      rect(45, 27, 6, 2),
      rect(27, 30, 18, 2),
    ],
    foundations: [rect(33, 13, 6, 10), rect(8, 16, 5, 5), rect(59, 17, 5, 5)],
    actors: [
      keeper('inside', 27.5, 20.5, [1, -1]),
      keeper('outside', 63.5, 6.5, [-1, 1]),
      frontier(32, 18),
    ],
    decision:
      'Leave the central spindle through a side opening, or reach past the segmented oval end?',
    lesson:
      'This egg-decoration-inspired outline stays open; walls cannot create a secretly empty sealed chamber.',
    counterplay:
      'Depart from the side away from the frontier patrol and choose a return before entering an opening.',
    consequence:
      'A new return reshapes the frontier and may move its patrol toward your next departure.',
    moment: 'An inward enclosure changes which opening is useful on the next outward cut.',
    mastery: 'Use one side opening and one stepped end opening.',
    combines: ['walls', 'foundations', 'frontier-patrol'],
  },
  {
    id: 'dnipro-crossings',
    name: 'Dnipro crossings',
    arc: 'ornament-crossings',
    band: 5,
    spawn: [13.5, 11.5],
    coverage: 0.75,
    walls: [rect(25, 6, 3, 11), rect(43, 20, 3, 10)],
    foundations: [
      rect(6, 8, 12, 6),
      rect(10, 23, 12, 6),
      rect(53, 6, 12, 6),
      rect(49, 22, 14, 6),
      rect(32, 15, 7, 5),
    ],
    actors: [keeper('north', 43.5, 5.5, [-1, 1]), keeper('south', 28.5, 29.5, [1, -1]), outer()],
    decision:
      'Connect the nearby central landing first, or cross broadly to the opposite shore before the patrol reaches it?',
    lesson:
      'Staggered shores change return distance; the two obstructions make crossing order matter.',
    counterplay:
      'Keep a second internal landing within reach instead of relying on a single outside-border return.',
    consequence:
      'A bridge shortens the next route but may retain enemies on both sides, securing only its line.',
    moment: 'A narrow bridge opens a wide choice of later river crossings.',
    mastery: 'Connect landings on both shores before the final enclosure.',
    combines: ['walls', 'foundations', 'perimeter-patrol'],
  },
  {
    id: 'four-motor-landings',
    name: 'Four motor landings',
    arc: 'workshop-routing',
    band: 4,
    spawn: [17.5, 0.5],
    coverage: 0.7,
    walls: [rect(31, 13, 10, 10)],
    foundations: [rect(14, 6, 8, 7), rect(50, 6, 8, 7), rect(14, 24, 8, 7), rect(50, 24, 8, 7)],
    actors: [
      keeper('west', 7.5, 18.5, [1, -1]),
      keeper('middle', 36.5, 5.5, [-1, 1]),
      keeper('east', 64.5, 28.5, [-1, -1]),
      outer(),
    ],
    decision:
      'Connect adjacent motor-like pads, or take a dogleg around the blocked central controller silhouette?',
    lesson:
      'The four reclaimed pads are real return surfaces; the central component is an impassable wall.',
    counterplay:
      'Use an adjacent pad for a short closure, observe the keepers across all three aisles, and depart behind the outer patrol.',
    consequence:
      'Joining one side changes which unclaimed region retains a keeper and which pad is useful next.',
    moment:
      'A familiar four-corner silhouette becomes an asymmetric network after the first capture.',
    mastery: 'Connect all four pads without losing a life.',
    combines: ['walls', 'foundations', 'perimeter-patrol'],
  },
  {
    id: 'circuit-lanes',
    name: 'Circuit lanes',
    arc: 'workshop-routing',
    band: 4,
    spawn: [13.5, 0.5],
    coverage: 0.72,
    walls: [rect(21, 5, 3, 14), rect(24, 16, 17, 3), rect(48, 15, 3, 15), rect(33, 27, 15, 3)],
    foundations: [rect(9, 11, 8, 5), rect(29, 7, 10, 5), rect(33, 21, 9, 4), rect(57, 19, 8, 5)],
    actors: [keeper('west', 7.5, 28.5, [1, -1]), keeper('east', 60.5, 5.5, [-1, 1]), outer()],
    decision:
      'Thread the offset circuit corridor, or accept a longer exposed cut around a trace end?',
    lesson: 'Component-like walls redirect routes without changing craft speed or controls.',
    counterplay:
      'The broad work pads provide independent returns; do not chase the outside patrol through a narrow approach.',
    consequence:
      'Capturing the inner aisle creates a useful return beside, not on, the obstructing trace.',
    moment: 'A frustrating detour becomes the shorter route once adjacent field is reclaimed.',
    mastery: 'Close from each of the two interior work pads.',
    combines: ['walls', 'foundations', 'perimeter-patrol'],
  },
  {
    id: 'twin-lens-chambers',
    name: 'Twin lens chambers',
    arc: 'workshop-routing',
    band: 5,
    spawn: [35.5, 17.5],
    coverage: 0.74,
    walls: [
      rect(9, 7, 20, 2),
      rect(9, 27, 20, 2),
      rect(9, 9, 2, 7),
      rect(9, 21, 2, 6),
      rect(27, 9, 2, 5),
      rect(27, 22, 2, 5),
      rect(43, 7, 20, 2),
      rect(43, 27, 20, 2),
      rect(61, 9, 2, 7),
      rect(61, 21, 2, 6),
      rect(43, 9, 2, 5),
      rect(43, 22, 2, 5),
    ],
    foundations: [rect(29, 16, 14, 4), rect(16, 15, 6, 6), rect(50, 15, 6, 6)],
    actors: [
      keeper('left', 17.5, 11.5, [1, 1]),
      keeper('right', 53.5, 24.5, [-1, -1]),
      frontier(28, 17),
    ],
    decision:
      'Work inward toward one lens landing, or close around the outside of both open frames?',
    lesson:
      'Open frames are not separate capture rules: only keeper positions decide retained regions.',
    counterplay:
      'Leave the bridge away from the frontier patrol and preserve the opposite side as a return option.',
    consequence:
      'A connection can send frontier pressure around one frame while the other remains open.',
    moment: 'One shared bridge supports two different chamber problems.',
    mastery: 'Make a closure from each lens landing.',
    combines: ['walls', 'foundations', 'frontier-patrol'],
  },
  {
    id: 'toolbench-weave',
    name: 'Toolbench weave',
    arc: 'workshop-routing',
    band: 5,
    spawn: [12.5, 0.5],
    coverage: 0.75,
    walls: [
      rect(23, 5, 3, 18),
      rect(20, 5, 3, 4),
      rect(26, 5, 3, 4),
      rect(45, 13, 3, 17),
      rect(42, 26, 3, 4),
      rect(48, 26, 3, 4),
    ],
    foundations: [rect(8, 10, 9, 6), rect(31, 7, 8, 5), rect(31, 24, 8, 5), rect(55, 17, 9, 6)],
    actors: [
      keeper('west', 7.5, 28.5, [1, -1]),
      keeper('east', 62.5, 7.5, [-1, 1]),
      {
        id: 'work-rover',
        role: 'reclaimed-roamer',
        tier: 'standard',
        x: 35.5,
        y: 17.5,
        heading: [1, 0],
      },
    ],
    decision:
      'Reclaim the middle aisle now and wake its roamer, or join an outer work mat first to preserve another escape?',
    lesson:
      'Opening the board can activate a new threat on reclaimed ground; the warning gives time to leave.',
    counterplay:
      'Keep a parallel aisle and choose the next departure before the sleeper becomes active.',
    consequence:
      'A newly connected work mat extends both your return network and the roamer movement domain.',
    moment: 'The best new shortcut becomes a shared route with a visibly awakening threat.',
    mastery: 'Use three different work mats after waking the roamer.',
    combines: ['walls', 'foundations', 'reclaimed-roamer'],
  },
];

export const CULTURAL_WORKSHOP_ARCS = freezeDesign([
  {
    id: 'ornament-crossings',
    name: 'Ornament crossings · greybox',
    band: 4,
    missionIds: rows.slice(0, 4).map((row) => row.id),
  },
  {
    id: 'workshop-routing',
    name: 'Workshop routing · greybox',
    band: 4,
    missionIds: rows.slice(4).map((row) => row.id),
  },
]);

/** Eight original topology studies. No new art, Team qualification, published
 * enrollment, earned progress or human-balanced pacing is claimed here. */
export function createCulturalWorkshopCandidates() {
  const project = createStarterProject('cultural-workshop-spatial-review');
  const template = project.missions[0];
  project.name = 'Ornament + workshop · unvalidated spatial studies';
  project.revision = 'greybox-1';
  project.actorCatalogId = ROVER_ACTOR_CATALOG.id;
  project.difficultyCatalogId = PRESSURE_DIFFICULTY_CATALOG.id;
  project.maps = rows.map((row) => ({
    format: 'MapDesignV1',
    id: `${row.id}-map`,
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: structuredClone(row.walls),
    foundations: structuredClone(row.foundations),
    terrain: [],
    spawns: [{ id: 'home', x: row.spawn[0], y: row.spawn[1] }],
  }));
  project.missions = rows.map((row, index) => ({
    ...structuredClone(template),
    id: row.id,
    revision: 'greybox-1',
    name: row.name,
    map: { id: project.maps[index].id, revision: 'greybox-1' },
    actors: structuredClone(row.actors),
    coverage: row.coverage,
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: [],
      practices: ['enemy-seeded-closure', 'foundations', 'walls'],
      combines: [...row.combines],
      durationSeconds: [60, 150],
      difficulty: {
        band: row.band,
        planning: row.band,
        execution: row.band - 1,
        threatDensity: row.actors.length - 1,
        timePressure: 0,
        mechanicLoad: 3,
        coordination: 0,
      },
    },
    presentation: { themeId: index < 4 ? 'horizon' : 'rover-yard', backgroundAssetId: null },
  }));
  project.campaigns = CULTURAL_WORKSHOP_ARCS.map((arc) => ({
    format: 'CampaignDesignV1',
    revision: 'greybox-1',
    ...structuredClone(arc),
  }));
  project.packs = CULTURAL_WORKSHOP_ARCS.map((arc) => ({
    format: 'PackDesignV1',
    id: `${arc.id}-study`,
    revision: 'greybox-1',
    name: arc.name,
    campaignIds: [arc.id],
  }));
  return project;
}
