import { createStarterProject } from './starter.mjs';
import { freezeDesign, LIVEWIRE_ACTOR_CATALOG } from './catalogs.mjs';

// Original greyboxes, not released content. Reference images establish motifs only.
const rect = (x, y, w, h) => ({ x, y, w, h });
const gate = (id, objectiveId, x, y, w, h) => ({ id, objectiveId, x, y, w, h });
const objective = (id, x, y) => ({ id, x, y, required: true });
const mover = (id, role, x, y, heading = [-1, 0]) => ({
  id,
  role,
  tier: 'measured',
  x,
  y,
  heading,
});
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
  y: 25.5,
  clockwise: true,
});
const rows = [
  {
    id: 'first-link',
    name: 'First link',
    band: 9,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.8,
    foundations: [rect(31, 14, 10, 4), rect(31, 27, 10, 4)],
    gates: [gate('south-bridge', 'landing-relay', 34, 18, 4, 9)],
    objectives: [objective('landing-relay', 35.5, 8.5)],
    actors: [
      keeper('west-keeper', 12.5, 26.5, [1, -1]),
      keeper('east-keeper', 59.5, 9.5, [-1, 1]),
      outer(),
    ],
    decision:
      'Land through the visible relay to establish a permanent southward shortcut, or keep using the longer outside return?',
    lesson:
      'Capture the numbered trigger to open its matching connector. A closed crossbar blocks a cut; an opened connector closes it.',
    counterplay:
      'Close on the existing platform first. The opened bridge then reaches a second landing without another exposed crossing.',
    consequence:
      'The south bridge becomes permanent reclaimed ground without awarding coverage or releasing either field keeper.',
    moment: 'One short closure visibly joins two separated landings before the next route begins.',
    mastery: 'Use the opened bridge to reach the lower landing and clear without a life loss.',
  },
  {
    id: 'second-approach',
    name: 'Second approach',
    band: 9,
    spawn: [5, 17],
    departure: 'up',
    coverage: 0.8,
    foundations: [rect(3, 14, 6, 7), rect(30, 14, 8, 7), rect(57, 14, 8, 7)],
    gates: [
      gate('west-bridge', 'west-relay', 9, 16, 21, 3),
      gate('east-bridge', 'east-relay', 38, 16, 19, 3),
    ],
    objectives: [objective('west-relay', 5.5, 8.5), objective('east-relay', 37.5, 8.5)],
    actors: [
      keeper('upper-keeper', 45.5, 5.5, [-1, 1]),
      keeper('lower-keeper', 52.5, 28.5, [1, 0]),
      frontier(65, 17, 'west'),
    ],
    decision:
      'Open the nearer link to gain a central launch point, or approach the eastern trigger from the outer boundary first?',
    lesson:
      'Each number is a separate capture link. Opening one connector does not open every gate.',
    counterplay:
      'Choose a visible return before entering the upper field and watch the frontier at the far landing.',
    consequence:
      'Two independently earned connectors turn three landings into a usable cross-board return.',
    moment:
      'The same upper trigger can be approached from the outer rail or the newly connected middle platform.',
    mastery:
      'Open the eastern connector before the western connector and clear without a life loss.',
  },
  {
    id: 'three-compounds',
    name: 'Three compounds',
    band: 9,
    reference: 'xposed-pack-2-level-06',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.81,
    foundations: [rect(32, 14, 8, 7), rect(7, 13, 8, 9), rect(56, 13, 8, 9), rect(32, 3, 8, 4)],
    gates: [
      gate('west-link', 'upper-relay', 15, 16, 17, 3),
      gate('east-link', 'east-relay', 40, 16, 16, 3),
    ],
    objectives: [objective('upper-relay', 35.5, 9.5), objective('east-relay', 48.5, 7.5)],
    actors: [
      keeper('west-keeper', 12.5, 6.5, [1, 0]),
      keeper('east-keeper', 60.5, 28.5, [-1, 0]),
      mover('roamer', 'reclaimed-roamer', 48.5, 24.5),
    ],
    decision:
      'Connect the western yard first or claim the eastern trigger while keeping a retreat away from the dormant roamer?',
    lesson:
      'An opened connector is permanent, but reclaimed-ground roamers may still use it after activation.',
    counterplay:
      'Leave a long escape corridor before reclaiming the roamer and use the upper landing as an alternate departure.',
    consequence:
      'The opened yards share return ground while their outer field remains governed by the ordinary enemy-retained fill rule.',
    moment:
      'A new cross-yard connection becomes both an escape route and possible roamer territory.',
    mastery: 'Visit both outer yards after opening their links and clear without a life loss.',
  },
  {
    id: 'spiral-stores',
    name: 'Spiral stores',
    band: 10,
    reference: 'xposed-pack-2-level-09',
    spawn: [35, 17],
    departure: 'left',
    coverage: 0.81,
    foundations: [
      rect(6, 6, 22, 3),
      rect(6, 9, 3, 18),
      rect(9, 24, 19, 3),
      rect(44, 9, 22, 3),
      rect(63, 12, 3, 18),
      rect(44, 27, 19, 3),
      rect(33, 14, 6, 7),
      rect(33, 9, 3, 5),
      rect(36, 21, 3, 6),
    ],
    gates: [
      gate('upper-break', 'west-relay', 28, 6, 8, 3),
      gate('lower-break', 'east-relay', 36, 27, 8, 3),
    ],
    objectives: [objective('west-relay', 18.5, 17.5), objective('east-relay', 54.5, 20.5)],
    actors: [
      keeper('west-keeper', 18.5, 12.5, [1, 0]),
      keeper('east-keeper', 54.5, 24.5, [-1, 0]),
      keeper('outer-keeper', 64.5, 4.5, [0, 1]),
      frontier(38, 13, 'south'),
    ],
    decision:
      'Break the western inward route at the top or the eastern route at the bottom before moving across the central spine?',
    lesson:
      'A shortcut changes return distance, not the meaning of the surrounding open field. Broad exits remain available before either relay.',
    counterplay:
      'Use the open side of each store to enclose a trigger instead of tracing every bend of the structure.',
    consequence:
      'Capturing a relay joins its store to the spine and gives a shorter later departure without mandatory corridor cleanup.',
    moment:
      'An apparently winding route becomes a direct permanent connection after one deliberate enclosure.',
    mastery: 'Open both shortcuts within two consecutive captures and clear without a life loss.',
  },
  {
    id: 'nested-relays',
    name: 'Nested relays',
    band: 10,
    reference: 'xposed-pack-3-level-11',
    spawn: [29, 13],
    departure: 'up',
    coverage: 0.81,
    foundations: [
      rect(13, 5, 46, 3),
      rect(13, 8, 3, 21),
      rect(16, 26, 43, 3),
      rect(56, 8, 3, 10),
      rect(56, 22, 3, 4),
      rect(28, 12, 20, 3),
      rect(28, 15, 3, 9),
      rect(31, 21, 17, 3),
    ],
    gates: [
      gate('inner-link', 'upper-relay', 31, 15, 25, 3),
      gate('lower-link', 'inner-relay', 36, 24, 4, 2),
    ],
    objectives: [objective('upper-relay', 29.5, 10.5), objective('inner-relay', 45.5, 19.5)],
    actors: [
      keeper('inner-keeper', 39.5, 19.5, [1, 0]),
      keeper('ring-keeper', 20.5, 17.5, [0, 1]),
      keeper('outer-keeper', 65.5, 30.5, [-1, 0]),
      frontier(46, 11, 'south'),
    ],
    decision:
      'Open the cross-ring link before taking the inner trigger, or use the open lower approach and preserve the shorter return for later?',
    lesson:
      'The field keeper, not a closed gate, retains each chamber. Numbered links change player routes without moving that keeper into another region.',
    counterplay:
      'Read the inner keeper before a short closure and keep the broad lower opening as an alternative to the gated route.',
    consequence:
      'Each captured trigger removes a different return detour; opening never performs a second hidden flood.',
    moment:
      'The inner link opens while the neighbouring keeper remains in exactly the same field component.',
    mastery: 'Open the lower connector first and clear without a life loss.',
  },
  {
    id: 'watchpost-exchange',
    name: 'Watchpost exchange',
    band: 10,
    reference: 'xposed-pack-4-level-09',
    spawn: [10, 0],
    departure: 'down',
    coverage: 0.82,
    foundations: [rect(34, 1, 4, 34), rect(1, 16, 26, 3), rect(45, 16, 26, 3)],
    gates: [
      gate('west-junction', 'northwest-relay', 27, 16, 7, 3),
      gate('east-junction', 'southeast-relay', 38, 16, 7, 3),
    ],
    objectives: [objective('northwest-relay', 10.5, 8.5), objective('southeast-relay', 52.5, 25.5)],
    actors: [
      keeper('northwest', 20.5, 9.5, [1, 0]),
      keeper('southwest', 15.5, 27.5, [1, 0]),
      keeper('northeast', 53.5, 9.5, [-1, 0]),
      keeper('southeast', 60.5, 27.5, [-1, 0]),
      frontier(38, 8, 'west'),
    ],
    decision:
      'Use the first opened junction to move through the hub or work around the outside to reach the opposite relay before the frontier approaches?',
    lesson:
      'Each occupied chamber remains a separate field problem. A junction opens traversal, not an automatic chamber clear.',
    counterplay:
      'Use different launch heights around the central spine; avoid treating four chambers as four compulsory identical cuts.',
    consequence:
      'The two relay captures assemble a cross-board reclaimed route without changing any chamber keeper’s domain.',
    moment:
      'A formerly blocked side of the central hub becomes a useful return from either adjacent chamber.',
    mastery: 'Use both opened junctions and clear all required objectives without a life loss.',
  },
  {
    id: 'relay-remix',
    name: 'Switchback exchange',
    band: 10,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.82,
    foundations: [rect(31, 14, 10, 7), rect(33, 3, 6, 4), rect(10, 15, 7, 6), rect(55, 15, 7, 6)],
    gates: [
      gate('west-link', 'upper-relay', 17, 16, 14, 3),
      gate('east-link', 'east-relay', 41, 16, 14, 3),
    ],
    objectives: [objective('upper-relay', 35.5, 10.5), objective('east-relay', 38.5, 10.5)],
    actors: [
      {
        id: 'emitter',
        role: 'lane-emitter',
        tier: 'measured',
        x: 60.5,
        y: 29.5,
        axis: 'horizontal',
      },
      mover('carrier', 'impact-carrier', 12.5, 9.5),
      mover('roamer', 'reclaimed-roamer', 47.5, 25.5),
    ],
    decision:
      'Spend the next attack window opening a new escape connection or enclose a smaller region while keeping the roamer dormant?',
    lesson:
      'Combine established relay, lane and impact rules. Opening a link changes return choices, not enemy attack periods.',
    counterplay:
      'Close before the marked lane fires, then use the new connection while preserving space from an activated roamer.',
    consequence:
      'One closure can clear a travelling impact and open a permanent connection, but the emitter still retains its field.',
    moment:
      'An opened link provides a fresh launch point after a narrow closure escapes a known lane attack.',
    mastery: 'Open a connector on a cut carrying an active impact and clear without a life loss.',
  },
];

export const RELAY_ARCS = freezeDesign([
  {
    id: 'make-the-link',
    missionIds: rows.slice(0, 3).map((r) => r.id),
    introduces: 'permanent-relay-connectors',
  },
  { id: 'choose-the-order', missionIds: rows.slice(3, 6).map((r) => r.id), introduces: null },
]);
export const RELAY_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((r) => [r.id, r.departure])),
);
export const RELAY_REFERENCE_ADAPTATIONS = freezeDesign(
  rows
    .filter((r) => r.reference)
    .map((r) => ({
      reference: r.reference,
      missionId: r.id,
      decision: 'redesign',
      final: false,
      reason: r.decision,
    })),
);

export function createRelayCandidates() {
  const project = createStarterProject('relay-greybox-candidates');
  project.name = 'Relay Labyrinth · greybox candidates';
  project.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  project.assets = [];
  project.maps = rows.map((row) => ({
    format: 'MapDesignV2',
    id: `${row.id}-map`,
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: [],
    foundations: structuredClone(row.foundations),
    terrain: [],
    gates: row.gates.map(({ objectiveId: _objectiveId, ...geometry }) => geometry),
    spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
  }));
  project.missions = rows.map((row, index) => ({
    ...createStarterProject().missions[0],
    format: 'MissionDesignV2',
    id: row.id,
    name: row.name,
    revision: 'greybox-1',
    map: { id: `${row.id}-map`, revision: 'greybox-1' },
    actors: structuredClone(row.actors),
    objectives: structuredClone(row.objectives),
    bonuses: [],
    relayLinks: row.gates.map(({ id, objectiveId }) => ({ gateId: id, objectiveId })),
    coverage: row.coverage,
    presentation: { themeId: 'horizon', backgroundAssetId: null },
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: index === 0 ? ['permanent-relay-connectors'] : [],
      practices: [
        'enemy-seeded-closure',
        'foundations',
        ...(index ? ['permanent-relay-connectors'] : []),
      ],
      combines: [...new Set(row.actors.map((a) => a.role))],
      durationSeconds: [90, 150],
      difficulty: {
        band: row.band,
        planning: row.band,
        execution: index < 3 ? 7 : 8,
        threatDensity: index < 3 ? 4 : 5,
        timePressure: 0,
        mechanicLoad: index < 3 ? 7 : 8,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'relay-labyrinth',
      revision: 'greybox-1',
      name: 'Relay Labyrinth',
      band: 9,
      missionIds: rows.slice(0, 6).map((r) => r.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'relay-remixes',
      revision: 'greybox-1',
      name: 'Relay Labyrinth Remix · optional',
      band: 10,
      missionIds: ['relay-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-relay',
      revision: 'greybox-1',
      name: 'Relay Labyrinth candidates',
      campaignIds: ['relay-labyrinth'],
    },
    {
      format: 'PackDesignV1',
      id: 'relay-remixes',
      revision: 'greybox-1',
      name: 'Optional Relay Labyrinth Remix',
      campaignIds: ['relay-remixes'],
    },
  ];
  return project;
}
