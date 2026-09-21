import { createStarterProject } from './starter.mjs';
import { APEX_ART_CANDIDATES } from './apex-art.mjs';
import { freezeDesign, SENTINEL_ACTOR_CATALOG, SENTINEL_RECIPE } from './catalogs.mjs';

// Original capstone greyboxes. No new mechanic, source coordinates or artwork.
const rect = (x, y, w, h) => ({ x, y, w, h });
const zone = (id, direction, x, y, w, h) => ({ id, direction, ...rect(x, y, w, h) });
const terrain = (id, kind, x, y, w, h) => ({ id, kind, ...rect(x, y, w, h) });
const mover = (id, role, x, y, heading) => ({ id, role, tier: 'measured', x, y, heading });
const keeper = (id, x, y, heading) => mover(id, 'field-keeper', x, y, heading);
const frontier = (x, y, side) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise: true,
});
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 27.5,
  clockwise: true,
});
const objective = (id, x, y) => ({ id, x, y, required: true, hidden: false });
const bonus = (kind, x, y) => ({ id: kind, kind, x, y });
const rows = [
  {
    id: 'crossing-complete',
    name: 'Crossing complete',
    reference: 'xposed-pack-2-level-12',
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.84,
    foundations: [rect(29, 7, 14, 3), rect(8, 15, 22, 3), rect(42, 23, 22, 3), rect(31, 29, 10, 3)],
    terrain: [
      terrain('upper-west', 'slow', 3, 10, 24, 3),
      terrain('upper-east', 'slow', 45, 10, 24, 3),
      terrain('middle-west', 'lethal', 7, 19, 21, 2),
      terrain('middle-east', 'lethal', 44, 19, 21, 2),
      terrain('lower-west', 'slow', 3, 26, 25, 3),
      terrain('lower-east', 'slow', 44, 28, 25, 3),
    ],
    speedZones: [
      zone('upper-crossing', 'down', 33, 10, 5, 9),
      zone('lower-crossing', 'up', 33, 20, 5, 9),
    ],
    actors: [
      keeper('upper', 13.5, 5.5, [1, 1]),
      keeper('lower', 59.5, 31.5, [-1, -1]),
      frontier(28, 8, 'east'),
      outer(),
    ],
    bonuses: [bonus('enemy-freeze', 11.5, 16.5)],
    decision:
      'Cross the open center between the three belts, or enclose a hazardous side belt to create a wider return?',
    lesson:
      'Combine established terrain neutralization, enemy-retained regions and changing-frontier routes. A marked crossing changes exposure time, not control direction.',
    counterplay:
      'The center gaps avoid lethal field. Read both keeper positions before a large enclosure; the separated terraces offer shorter closures and an optional freeze detour.',
    consequence:
      'A captured belt loses both its hazard and arrow effect where reclaimed. A line-only connection can still improve the next return without a large reveal.',
    moment:
      'A threatening striped belt becomes an ordinary sideways return while the frontier patrol takes its new contour.',
    mastery:
      'Reclaim both lethal side fields completely and visit the connected lower terrace before clearing without a life loss.',
  },
  {
    id: 'final-broadcast',
    name: 'Final broadcast',
    reference: 'xposed-pack-3-level-12',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.84,
    foundations: [
      rect(32, 16, 8, 4),
      rect(10, 7, 17, 3),
      rect(17, 10, 3, 5),
      rect(45, 7, 17, 3),
      rect(52, 10, 3, 5),
      rect(10, 26, 17, 3),
      rect(17, 21, 3, 5),
      rect(45, 26, 17, 3),
      rect(52, 21, 3, 5),
      rect(26, 13, 3, 4),
      rect(43, 20, 3, 4),
    ],
    gates: [
      { id: 'upper-link', ...rect(20, 13, 6, 2) },
      { id: 'lower-link', ...rect(46, 21, 6, 2) },
    ],
    objectives: [objective('upper-anchor', 28.5, 11.5), objective('lower-anchor', 42.5, 23.5)],
    relayLinks: [
      { gateId: 'upper-link', objectiveId: 'upper-anchor' },
      { gateId: 'lower-link', objectiveId: 'lower-anchor' },
    ],
    actors: [
      mover('eroder', 'territory-eroder', 12.5, 19.5, [1, -1]),
      mover('carrier', 'impact-carrier', 60.5, 17.5, [-1, 1]),
      frontier(31, 18, 'east'),
    ],
    bonuses: [bonus('extra-life', 13.5, 27.5)],
    decision:
      'Open the upper protected link first, or invest in the lower anchor while the carrier and eroder occupy different corridors?',
    lesson:
      'A territory repair and a carrier closure race are familiar but different decisions. Permanent foundations, opened connectors and captured objective anchors protect the planned return.',
    counterplay:
      'Do not treat every field contact as a travelling impact. Only the marked carrier sends sparks; the eroder still breaks a live trail immediately. Use the broad center corridor to change your approach.',
    consequence:
      'Capturing either anchor both protects its cell and opens a non-scoring connector. Earned side shortcuts remain vulnerable to warned erosion.',
    moment: 'An opened T-shaped return stays intact while a nearby earned edge is reopened.',
    mastery: 'Traverse both opened connectors before clearing without losing a life.',
  },
  {
    id: 'returning-light',
    name: 'Returning light',
    spawn: [5, 17],
    departure: 'right',
    coverage: 0.85,
    foundations: [
      rect(4, 6, 4, 24),
      rect(20, 8, 5, 7),
      rect(33, 17, 6, 5),
      rect(49, 24, 5, 6),
      rect(61, 8, 5, 20),
    ],
    speedZones: [
      zone('eastbound', 'right', 8, 16, 25, 3),
      zone('westbound', 'left', 39, 19, 10, 3),
      zone('outer-current', 'up', 56, 9, 4, 20),
    ],
    actors: [
      keeper('keeper', 16.5, 30.5, [1, -1]),
      mover('roamer', 'reclaimed-roamer', 45.5, 11.5, [0, 1]),
      { id: 'emitter', role: 'lane-emitter', tier: 'measured', x: 56.5, y: 5.5, axis: 'vertical' },
    ],
    bonuses: [bonus('enemy-slow', 22.5, 11.5)],
    decision:
      'Use the fast long crossing toward the middle landing, or claim the upper stepping platform before awakening the ground roamer?',
    lesson:
      'A direct arrow route can be efficient without being the best return after a capture. The locked lane and awakened ground domain remain separately readable.',
    counterplay:
      'The first broad arrow has a clear landing and no forced turn. Leave the locked column before it fires; retain a second departure when reclaiming the roamer.',
    consequence:
      'The marked shortcut becomes ordinary-speed reclaimed ground. The roamer may now use it too, so the outer stepping platforms retain their value.',
    moment:
      'The fastest outward route turns into contested reclaimed ground, making the quieter stepping return useful.',
    mastery:
      'Connect and visit the upper and lower stepping platforms before clearing without losing a life.',
  },
  {
    id: 'home-signal',
    name: 'Home signal',
    reference: 'xposed-pack-4-level-12',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.85,
    foundations: [
      rect(30, 14, 12, 8),
      rect(8, 5, 8, 4),
      rect(18, 9, 8, 4),
      rect(8, 27, 8, 4),
      rect(18, 23, 8, 4),
      rect(48, 9, 8, 4),
      rect(58, 5, 8, 4),
      rect(48, 23, 8, 4),
      rect(58, 27, 8, 4),
    ],
    gates: [{ id: 'home-dock', ...rect(42, 16, 6, 4) }],
    objectives: [
      objective('west-shield', 49.5, 16.5),
      objective('east-shield', 60.5, 17.5),
      objective('south-shield', 54.5, 22.5),
      objective('core', 54.5, 18.5),
    ],
    relayLinks: [{ gateId: 'home-dock', objectiveId: 'west-shield' }],
    encounter: {
      recipeId: SENTINEL_RECIPE.id,
      enemyId: 'sentinel',
      shieldObjectiveIds: ['west-shield', 'east-shield', 'south-shield'],
      coreObjectiveId: 'core',
    },
    actors: [
      { id: 'sentinel', role: 'relay-sentinel', tier: 'measured', x: 54.5, y: 18.5 },
      mover('roamer', 'reclaimed-roamer', 21.5, 18.5, [0, -1]),
      frontier(29, 18, 'east'),
    ],
    bonuses: [bonus('enemy-freeze', 11.5, 28.5)],
    decision:
      'Connect the western wing to preserve an escape first, or disable the near shield to extend the permanent release dock?',
    lesson:
      'The final core uses the same shield count, warning, transition and release rule already learned. The branching returns ask for a route order, not a new boss control.',
    counterplay:
      'Keep room around the active frontier and leave a western escape for the awakened roamer. Captured shields and opened dock survive life recovery; the last release still needs the advertised opening.',
    consequence:
      'A near-shield capture extends the central return without changing earned coverage. The final explicit release reveals the remaining picture and ends the core route.',
    moment:
      'A connected homeward dock supports the last enclosure, followed by a voluntary choice of Remix, mastery, replay or exit.',
    mastery:
      'Connect and visit a wing platform on each side before releasing the core without a life loss.',
  },
  {
    id: 'apex-remix',
    name: 'Dawn circuit',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.85,
    foundations: [
      rect(31, 15, 10, 6),
      rect(14, 5, 38, 3),
      rect(14, 8, 3, 16),
      rect(20, 28, 38, 3),
      rect(55, 12, 3, 16),
    ],
    gates: [
      { id: 'west-corner', ...rect(14, 24, 6, 7) },
      { id: 'east-corner', ...rect(52, 5, 6, 7) },
    ],
    objectives: [objective('west-relay', 25.5, 23.5), objective('east-relay', 47.5, 11.5)],
    relayLinks: [
      { gateId: 'west-corner', objectiveId: 'west-relay' },
      { gateId: 'east-corner', objectiveId: 'east-relay' },
    ],
    speedZones: [zone('north-spoke', 'up', 33, 8, 5, 7), zone('south-spoke', 'down', 33, 21, 5, 7)],
    terrain: [
      terrain('west-hazard', 'lethal', 20, 12, 6, 3),
      terrain('east-hazard', 'lethal', 46, 21, 6, 3),
    ],
    actors: [
      mover('eroder', 'territory-eroder', 8.5, 18.5, [0, 1]),
      mover('carrier', 'impact-carrier', 46.5, 18.5, [0, -1]),
      outer(),
    ],
    bonuses: [bonus('player-speed', 23.5, 6.5)],
    decision:
      'Complete the protected outer circuit through relay corners, or use the shorter marked center while field threats remain on opposite sides?',
    lesson:
      'This optional combination uses only known roles. The protected circuit and earned spokes have different erosion consequences; neither changes the capture contract.',
    counterplay:
      'Enclose the two lethal patches before crossing them. The optional speed pickup sits on a wide straight return, away from mandatory precision turns.',
    consequence:
      'Relay corners stay permanent while erosion can restore a marked inner spoke. Carrier impacts still disappear when a valid closure secures the trail.',
    moment: 'Two missing corners become a complete durable circuit around a changing interior.',
    mastery:
      'Traverse both opened corners and neutralize both lethal patches before clearing without a life loss.',
  },
];

export const APEX_LEARNING_ARCS = freezeDesign([
  { id: 'bring-it-home', missionIds: rows.slice(0, 4).map((row) => row.id), introduces: [] },
]);
export const APEX_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);
export const APEX_REFERENCE_ADAPTATIONS = freezeDesign(
  rows
    .filter((row) => row.reference)
    .map((row) => ({
      reference: row.reference,
      missionId: row.id,
      decision: 'redesign',
      final: false,
      reason: row.decision,
    })),
);

export function createApexCandidates({ artwork = false } = {}) {
  const project = createStarterProject('apex-greybox-candidates');
  project.name = 'Apex Aurora · greybox candidates';
  project.actorCatalogId = SENTINEL_ACTOR_CATALOG.id;
  project.assets = artwork ? structuredClone(APEX_ART_CANDIDATES) : [];
  project.maps = rows.map((row) => ({
    format: 'MapDesignV3',
    id: `${row.id}-map`,
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: [],
    foundations: structuredClone(row.foundations),
    terrain: structuredClone(row.terrain ?? []),
    gates: structuredClone(row.gates ?? []),
    speedZones: structuredClone(row.speedZones ?? []),
    spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
  }));
  project.missions = rows.map((row) => ({
    ...createStarterProject().missions[0],
    format: 'MissionDesignV4',
    id: row.id,
    revision: 'greybox-1',
    name: row.name,
    map: { id: `${row.id}-map`, revision: 'greybox-1' },
    actors: structuredClone(row.actors),
    objectives: structuredClone(row.objectives ?? []),
    bonuses: structuredClone(row.bonuses),
    relayLinks: structuredClone(row.relayLinks ?? []),
    encounter: structuredClone(row.encounter ?? null),
    coverage: row.coverage,
    timeLimitSeconds: 0,
    presentation: {
      themeId: 'horizon',
      backgroundAssetId: artwork ? 'apex-polar-' + row.id : null,
    },
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: [],
      practices: ['enemy-seeded-closure', 'foundations', 'contact-bonuses'],
      combines: [
        ...new Set(row.actors.map((actor) => actor.role)),
        ...(row.gates ? ['permanent-relay-connectors'] : []),
        ...(row.speedZones ? ['directional-speed-fields'] : []),
      ],
      durationSeconds: [60, 150],
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
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'apex-aurora',
      revision: 'greybox-1',
      name: 'Apex Aurora',
      band: 12,
      missionIds: rows.slice(0, 4).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'apex-remixes',
      revision: 'greybox-1',
      name: 'Apex Aurora Remix · optional',
      band: 12,
      missionIds: ['apex-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-apex',
      revision: 'greybox-1',
      name: 'Apex Aurora candidates',
      campaignIds: ['apex-aurora'],
    },
    {
      format: 'PackDesignV1',
      id: 'apex-remixes',
      revision: 'greybox-1',
      name: 'Optional Apex Aurora Remix',
      campaignIds: ['apex-remixes'],
    },
  ];
  return project;
}
