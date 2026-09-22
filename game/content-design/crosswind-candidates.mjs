import { createStarterProject } from './starter.mjs';
import { freezeDesign, LIVEWIRE_ACTOR_CATALOG } from './catalogs.mjs';
import { CROSSWIND_ART_CANDIDATES } from './crosswind-art.mjs';

// Original greyboxes. Reference silhouettes do not establish movement rules.
const rect = (x, y, w, h) => ({ x, y, w, h });
const zone = (id, direction, x, y, w, h) => ({ id, direction, x, y, w, h });
const mover = (id, role, x, y, heading = [1, 0]) => ({ id, role, tier: 'measured', x, y, heading });
const keeper = (id, x, y, heading) => mover(id, 'field-keeper', x, y, heading);
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 25.5,
  clockwise: true,
});
const frontier = (x, y, side) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise: true,
});
const emitter = (x, y, axis) => ({
  id: 'emitter',
  role: 'lane-emitter',
  tier: 'measured',
  x,
  y,
  axis,
});
const rows = [
  {
    id: 'read-the-arrows',
    name: 'Read the arrows',
    band: 10,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.82,
    foundations: [rect(30, 15, 12, 4), rect(12, 10, 6, 4), rect(54, 23, 6, 4)],
    speedZones: [zone('southbound', 'down', 33, 3, 6, 12), zone('northbound', 'up', 25, 19, 5, 12)],
    actors: [keeper('west', 10.5, 25.5, [1, -1]), keeper('east', 61.5, 7.5, [-1, 1]), outer()],
    decision:
      'Take the marked run to the central landing, or a shorter unmarked slice near the western platform?',
    lesson:
      'Arrows change craft speed only while moving on unclaimed cells: faster with, slower against, unchanged across. They never push a stopped craft.',
    counterplay:
      'Read the far landing before accelerating. The wide marked approach has no required turn at its end; the next direction stays your choice.',
    consequence:
      'The captured part loses its arrows and becomes ordinary reclaimed movement, so the return trip uses a different route budget.',
    moment:
      'The marked center route disappears behind a stopped craft while neighboring arrows remain.',
    mastery: 'Reclaim both marked fields completely and clear without losing a life.',
  },
  {
    id: 'survey-markers',
    name: 'Survey markers',
    band: 10,
    reference: 'xposed-pack-2-level-05',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.82,
    foundations: [rect(31, 15, 10, 5), rect(6, 15, 9, 5), rect(57, 15, 9, 5), rect(31, 3, 10, 3)],
    speedZones: [
      zone('north-survey', 'up', 33, 6, 5, 9),
      zone('west-survey', 'left', 15, 16, 16, 3),
      zone('east-survey', 'right', 41, 16, 16, 3),
    ],
    actors: [keeper('north', 15.5, 7.5, [1, 0]), keeper('south', 52.5, 27.5, [-1, 0]), outer()],
    decision:
      'Connect a distant side platform with the arrows or make the shorter northward return before crossing the open lower field?',
    lesson:
      'An interrupted line of landing platforms is not one continuous return. Check the next reclaimed segment before leaving.',
    counterplay:
      'Use the central platform to change direction without exposure; the unmarked lower approaches remain usable in either direction.',
    consequence:
      'Each connection removes a local speed effect and gives a new departure instead of opening an automatic chain of captures.',
    moment: 'A long sideways crossing becomes a plain return lane between two platforms.',
    mastery: 'Visit both side platforms after connecting them and clear without losing a life.',
  },
  {
    id: 'windbreak-weave',
    name: 'Windbreak weave',
    band: 10,
    reference: 'xposed-pack-2-level-11',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.82,
    foundations: [
      rect(32, 15, 8, 6),
      rect(25, 4, 19, 3),
      rect(7, 11, 4, 15),
      rect(28, 28, 19, 3),
      rect(60, 9, 4, 15),
    ],
    speedZones: [
      zone('north', 'up', 33, 7, 5, 8),
      zone('east', 'right', 40, 16, 20, 4),
      zone('south', 'down', 33, 21, 5, 7),
      zone('west', 'left', 11, 16, 21, 4),
    ],
    actors: [
      keeper('northwest', 15.5, 5.5, [1, 1]),
      keeper('southeast', 55.5, 28.5, [-1, -1]),
      frontier(40, 19, 'west'),
    ],
    decision:
      'Follow one spoke to a broad windbreak or cross between spokes to shape a shorter frontier?',
    lesson:
      'Changing the frontier changes patrol routes, but never rotates arrows or alters their strength.',
    counterplay:
      'Turn on the central platform first and watch the frontier before making a second connection. Open corners provide unmarked alternatives.',
    consequence:
      'Capturing a spoke creates a permanent-speed return while the frontier moves around the newly reclaimed edge.',
    moment:
      'Four visibly different approaches converge on one platform without forced spinning or drift.',
    mastery: 'Connect three outer windbreaks and clear without losing a life.',
  },
  {
    id: 'compass-array',
    name: 'Compass array',
    band: 11,
    reference: 'xposed-pack-3-level-04',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.83,
    foundations: [
      rect(31, 15, 10, 6),
      rect(22, 5, 28, 3),
      rect(22, 28, 28, 3),
      rect(9, 13, 5, 9),
      rect(58, 13, 5, 9),
    ],
    speedZones: [
      zone('north-neck', 'up', 33, 8, 5, 7),
      zone('south-neck', 'up', 33, 21, 5, 7),
      zone('upper-west', 'right', 14, 9, 19, 4),
      zone('upper-east', 'right', 38, 9, 19, 4),
      zone('lower-west', 'left', 14, 23, 19, 4),
      zone('lower-east', 'left', 38, 23, 19, 4),
    ],
    actors: [
      keeper('west', 19.5, 17.5, [0, 1]),
      keeper('east', 52.5, 17.5, [0, -1]),
      frontier(41, 18, 'west'),
    ],
    decision:
      'Use the short central neck against the lower arrows or take the longer lateral approach with them?',
    lesson:
      'Shortest distance and shortest exposure need not be the same. Across an arrow is ordinary speed, not a sideways push.',
    counterplay:
      'Compare the keeper positions with both nearby landings. Cross an arrow band at right angles when its direction is unhelpful.',
    consequence:
      'A reclaimed neck removes its speed penalty and changes the value of the next central crossing.',
    moment:
      'An initially awkward against-arrow route becomes the best ordinary-speed connection after capture.',
    mastery: 'Reclaim both central necks and clear without losing a life.',
  },
  {
    id: 'outer-loop',
    name: 'Outer loop',
    band: 11,
    reference: 'xposed-pack-4-level-07',
    spawn: [6, 17],
    departure: 'right',
    coverage: 0.83,
    foundations: [
      rect(4, 6, 4, 24),
      rect(8, 6, 50, 3),
      rect(8, 27, 50, 3),
      rect(25, 14, 4, 8),
      rect(44, 14, 4, 8),
      rect(62, 11, 4, 13),
    ],
    speedZones: [
      zone('inner-east', 'right', 8, 16, 17, 4),
      zone('middle-west', 'left', 29, 16, 15, 4),
      zone('outer-north', 'up', 58, 3, 4, 27),
    ],
    actors: [
      keeper('upper', 18.5, 11.5, [1, 0]),
      keeper('lower', 52.5, 24.5, [-1, 0]),
      keeper('outside', 67.5, 31.5, [0, -1]),
      mover('roamer', 'reclaimed-roamer', 36.5, 10.5),
    ],
    decision:
      'Cross the shorter inner posts, including an against-arrow gap, or reposition along the long reclaimed U before taking the outer approach?',
    lesson:
      'A return loop supports movement but may become roamer territory. Marked speed never makes reclaimed ground universally safe.',
    counterplay:
      'Preserve two exits before activating the roamer. Broad upper and lower approaches bypass the middle arrow penalty.',
    consequence:
      'Connecting the posts creates an inner escape corridor, while capturing the roamer changes pressure on the outer loop.',
    moment: 'A slow middle gap becomes a direct escape after its enclosing cut.',
    mastery: 'Visit both interior posts after connecting them and clear without losing a life.',
  },
  {
    id: 'long-wave',
    name: 'Long wave',
    band: 11,
    reference: 'xposed-pack-4-level-10',
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.83,
    foundations: [
      rect(14, 9, 6, 5),
      rect(14, 24, 6, 5),
      rect(32, 15, 8, 5),
      rect(52, 6, 6, 5),
      rect(52, 24, 6, 5),
    ],
    speedZones: [
      zone('west-up', 'up', 15, 14, 4, 10),
      zone('middle-down', 'down', 34, 3, 4, 12),
      zone('east-up', 'up', 53, 11, 4, 13),
    ],
    actors: [
      keeper('west', 8.5, 20.5, [1, -1]),
      keeper('east', 64.5, 20.5, [-1, 1]),
      emitter(62.5, 30.5, 'horizontal'),
    ],
    decision:
      'Use the short alternating vertical links or make a wider unmarked capture during a visible lane-emitter recovery?',
    lesson:
      'Arrow speed changes travel time, not attack warnings or enemy speed. Read the full route and the next landing before using a window.',
    counterplay:
      'Stage on a broad platform; wait out the lower lane warning without drawing, then choose a return above it or through its recovery.',
    consequence:
      'Neutralized vertical links simplify later travel, but the stationary emitter still retains field and follows the same attack schedule.',
    moment: 'Opposing long lanes stop being asymmetric after they are reclaimed.',
    mastery: 'Reclaim the east and west marked links and clear without losing a life.',
  },
  {
    id: 'crosswind-remix',
    name: 'Return currents',
    band: 11,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.84,
    foundations: [rect(30, 14, 12, 4), rect(30, 27, 12, 4), rect(8, 14, 6, 6), rect(58, 14, 6, 6)],
    speedZones: [
      zone('first-current', 'down', 33, 2, 5, 12),
      zone('west-current', 'right', 14, 15, 16, 3),
      zone('east-current', 'left', 42, 15, 16, 3),
    ],
    gates: [{ id: 'protected-return', x: 34, y: 18, w: 4, h: 9 }],
    objectives: [{ id: 'return-relay', x: 35.5, y: 9.5, required: true }],
    relayLinks: [{ gateId: 'protected-return', objectiveId: 'return-relay' }],
    actors: [
      keeper('keeper', 60.5, 27.5, [-1, 0]),
      mover('eroder', 'territory-eroder', 15.5, 7.5),
      emitter(55.5, 30.5, 'horizontal'),
    ],
    decision:
      'Secure the permanent return first or invest in an earned sideways shortcut that erosion may reopen into an arrow field?',
    lesson:
      'Combine known arrow, erosion and relay rules: foundations and opened connectors are permanent; earned marked territory can reactivate.',
    counterplay:
      'Use the protected connector as a fallback and follow erosion and lane warnings. Neither forces a repair before another route is available.',
    consequence:
      'The relay adds a non-scoring permanent return; erosion may restore arrows only on the earned side routes.',
    moment:
      'The center connector stays dependable while a reopened current visibly changes a side route.',
    mastery:
      'Use the protected connector and reclaim both side currents before clearing without a life loss.',
  },
];

export const CROSSWIND_ARCS = freezeDesign([
  {
    id: 'read-and-reclaim',
    missionIds: rows.slice(0, 3).map((row) => row.id),
    introduces: 'directional-speed-fields',
  },
  {
    id: 'choose-the-exposure',
    missionIds: rows.slice(3, 6).map((row) => row.id),
    introduces: null,
  },
]);
export const CROSSWIND_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);
export const CROSSWIND_REFERENCE_ADAPTATIONS = freezeDesign(
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

export function createCrosswindCandidates({ artwork = false } = {}) {
  const project = createStarterProject('crosswind-greybox-candidates');
  project.name = 'Crosswind Array · greybox candidates';
  project.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  project.assets = artwork ? structuredClone(CROSSWIND_ART_CANDIDATES) : [];
  project.maps = rows.map((row) => ({
    format: 'MapDesignV3',
    id: `${row.id}-map`,
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: [],
    foundations: structuredClone(row.foundations),
    terrain: [],
    gates: structuredClone(row.gates ?? []),
    speedZones: structuredClone(row.speedZones),
    spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
  }));
  project.missions = rows.map((row, index) => ({
    ...createStarterProject().missions[0],
    format: 'MissionDesignV3',
    id: row.id,
    revision: 'greybox-1',
    name: row.name,
    map: { id: `${row.id}-map`, revision: 'greybox-1' },
    actors: structuredClone(row.actors),
    objectives: structuredClone(row.objectives ?? []),
    bonuses: [],
    relayLinks: structuredClone(row.relayLinks ?? []),
    coverage: row.coverage,
    presentation: {
      themeId: 'horizon',
      backgroundAssetId: artwork
        ? (CROSSWIND_ART_CANDIDATES.find((asset) => asset.id === `crosswind-highlands-${row.id}`)
            ?.id ?? null)
        : null,
    },
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: index === 0 ? ['directional-speed-fields'] : [],
      practices: [
        'enemy-seeded-closure',
        'foundations',
        ...(index ? ['directional-speed-fields'] : []),
      ],
      combines: [
        ...new Set(row.actors.map((actor) => actor.role)),
        ...(row.gates ? ['permanent-relay-connectors'] : []),
      ],
      durationSeconds: [90, 150],
      difficulty: {
        band: row.band,
        planning: row.band,
        execution: index < 3 ? 8 : 9,
        threatDensity: index < 3 ? 4 : 5,
        timePressure: 0,
        mechanicLoad: index < 3 ? 8 : 9,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'crosswind-array',
      revision: 'greybox-1',
      name: 'Crosswind Array',
      band: 10,
      missionIds: rows.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'crosswind-remixes',
      revision: 'greybox-1',
      name: 'Crosswind Array Remix · optional',
      band: 11,
      missionIds: ['crosswind-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-crosswind',
      revision: 'greybox-1',
      name: 'Crosswind Array candidates',
      campaignIds: ['crosswind-array'],
    },
    {
      format: 'PackDesignV1',
      id: 'crosswind-remixes',
      revision: 'greybox-1',
      name: 'Optional Crosswind Array Remix',
      campaignIds: ['crosswind-remixes'],
    },
  ];
  return project;
}
