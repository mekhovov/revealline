import { createStarterProject } from './starter.mjs';
import { freezeDesign, FRACTURE_ACTOR_CATALOG } from './catalogs.mjs';
import { FRACTURE_ART_CANDIDATES } from './fracture-art.mjs';

// Original greybox hypotheses. Still images establish spatial motifs, not AI,
// erosion timings, surface behavior, collision rules or a finished difficulty curve.
const rect = (x, y, w, h) => ({ x, y, w, h });
const eroder = (id, x, y, heading = [-1, 0]) => ({
  id,
  role: 'territory-eroder',
  tier: 'measured',
  x,
  y,
  heading,
});
const keeper = (id, x, y, heading = [1, -1]) => ({
  id,
  role: 'field-keeper',
  tier: 'measured',
  x,
  y,
  heading,
});
const roamer = (id, x, y, heading = [-1, 0]) => ({
  id,
  role: 'reclaimed-roamer',
  tier: 'measured',
  x,
  y,
  heading,
});
const frontier = (x, y) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side: 'east' },
  clockwise: true,
});
const anchor = (id, x, y) => ({ id, x, y, required: true });
const cross = (x, y) => [rect(x - 5, y - 1, 11, 3), rect(x - 1, y - 3, 3, 7)];
export const FRACTURE_ARCS = freezeDesign([
  {
    id: 'ground-can-reopen',
    missionIds: ['first-fracture', 'island-reserve', 'two-districts'],
    introduces: 'territory-erosion',
  },
  {
    id: 'bank-the-route',
    missionIds: ['bank-the-crossing', 'five-anchors', 'staggered-reserve'],
    introduces: 'captured-anchor-protection',
  },
]);

const rows = [
  {
    id: 'first-fracture',
    name: 'First fracture',
    reference: null,
    band: 6,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.76,
    foundations: [rect(29, 13, 13, 5)],
    terrain: [],
    objectives: [],
    actors: [
      eroder('cutter', 60.5, 8.5),
      keeper('keeper', 12.5, 26.5),
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 27.5,
        clockwise: true,
      },
    ],
    decision:
      'Use the permanent landing for repeated returns, or bank a larger exposed edge that the eroder can reopen?',
    lesson:
      'The marked cell warns before reopening. Foundations remain permanent; earned ground can need repair.',
    counterplay:
      'Watch the eroder stop and mark a cell. Keep a permanent return within reach instead of chasing every lost cell.',
    consequence:
      'A capture changes your return options but can create an eligible frontier for erosion.',
    moment: 'A small gap reopens beside a landing that stays intact.',
    mastery: 'Repair an eroded cell with a legal closure without losing a life.',
    duration: [90, 150],
  },
  {
    id: 'island-reserve',
    name: 'Island reserve',
    reference: 'xposed-pack-3-level-08',
    band: 6,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.76,
    foundations: [rect(31, 14, 10, 8), rect(10, 8, 8, 5), rect(53, 22, 8, 5)],
    terrain: [{ id: 'soft-approach', kind: 'slow', x: 23, y: 7, w: 4, h: 7 }],
    objectives: [],
    actors: [
      eroder('east-cutter', 64.5, 9.5, [-1, 1]),
      eroder('west-cutter', 7.5, 25.5, [1, -1]),
      keeper('keeper', 59.5, 30.5, [-1, -1]),
    ],
    decision:
      'Join the near island through the slowing approach, or open the wider clear side and retain a second return?',
    lesson:
      'Isolated foundations provide dependable landings even when the earned links between them are vulnerable.',
    counterplay:
      'Keep the central island as a reserve; neutralize the slow approach by enclosure before relying on it.',
    consequence:
      'A useful connection can shorten the next cut without making every cell in that connection permanent.',
    moment: 'One return link breaks while the island itself remains available.',
    mastery: 'Join all three foundations and repair eroded ground without losing a life.',
    duration: [90, 150],
  },
  {
    id: 'two-districts',
    name: 'Two districts',
    reference: 'xposed-pack-4-level-01',
    band: 6,
    spawn: [35, 18],
    departure: 'left',
    coverage: 0.77,
    foundations: [rect(34, 1, 4, 34)],
    terrain: [
      { id: 'west-slow', kind: 'slow', x: 12, y: 6, w: 8, h: 5 },
      { id: 'east-hazard', kind: 'lethal', x: 54, y: 24, w: 7, h: 5 },
    ],
    objectives: [],
    actors: [
      eroder('west-cutter', 8.5, 8.5, [1, 1]),
      eroder('east-cutter', 64.5, 27.5, [-1, -1]),
      frontier(33, 8),
    ],
    decision:
      'Develop the slow western district first, or make a larger eastern enclosure around the marked hazard?',
    lesson:
      'Each district retains its own eroder. The permanent center lane separates their field domains and never erodes.',
    counterplay:
      'Choose a departure behind the frontier patrol, then change districts instead of defending an unimportant lost cell.',
    consequence:
      'Progress in one occupied district does not silently fill the other; both remain readable capture problems.',
    moment: 'The reliable center lane lets you switch priorities when pressure builds on one side.',
    mastery:
      'Close a cut in each district and neutralize the eastern hazard without losing a life.',
    duration: [95, 150],
  },
  {
    id: 'bank-the-crossing',
    name: 'Bank the crossing',
    reference: 'xposed-pack-2-level-07',
    band: 6,
    spawn: [12, 11],
    departure: 'down',
    coverage: 0.77,
    foundations: [
      rect(1, 10, 24, 4),
      rect(39, 10, 32, 4),
      rect(1, 23, 35, 4),
      rect(49, 23, 22, 4),
      rect(24, 14, 4, 6),
      rect(42, 4, 4, 6),
    ],
    terrain: [],
    objectives: [anchor('crossing-anchor', 30.5, 18.5)],
    actors: [
      eroder('cutter', 64.5, 7.5, [-1, 1]),
      keeper('keeper', 8.5, 30.5),
      roamer('upper-roamer', 58.5, 11.5),
    ],
    decision:
      'Capture the crossing anchor before expanding farther, or use the lower permanent lane to approach from the opposite side?',
    lesson:
      'A captured required objective protects its cell and one deterministic reclaimed path to a permanent foundation or outer rail.',
    counterplay:
      'Connect the anchor to useful reclaimed ground before the next enclosure; other earned cells remain vulnerable.',
    consequence:
      'The required capture banks a stable return connection instead of merely adding a completion checkbox.',
    moment: 'One protected connection survives while neighboring earned frontier remains erodible.',
    mastery:
      'Capture the anchor before reaching half of the earned coverage target, without losing a life.',
    duration: [95, 150],
  },
  {
    id: 'five-anchors',
    revision: 'greybox-2',
    name: 'Five landings',
    reference: 'xposed-pack-3-level-09',
    band: 7,
    spawn: [35, 18],
    departure: 'up',
    coverage: 0.78,
    foundations: [
      ...cross(16, 10),
      ...cross(54, 9),
      ...cross(35, 18),
      ...cross(16, 28),
      ...cross(54, 27),
    ],
    terrain: [],
    objectives: [anchor('west-anchor', 25.5, 10.5), anchor('east-anchor', 46.5, 26.5)],
    actors: [
      eroder('west-cutter', 8.5, 18.5, [1, 0]),
      eroder('east-cutter', 63.5, 18.5),
      frontier(33, 16),
    ],
    decision:
      'Bank the western connection first, or secure the eastern anchor while keeping a cross-shaped landing between both eroders?',
    lesson:
      'Two captured anchors can protect different connections; five foundations are return choices, not five mandatory chores.',
    counterplay:
      'Use broad cross arms to change departure direction and avoid following the frontier patrol into a narrow return.',
    consequence:
      'Anchor order changes which established connections can be relied upon during later captures.',
    moment:
      'Two protected routes support a larger capture without requiring every island to be visited.',
    mastery:
      'Capture both anchors before reaching three quarters of the earned target, without losing a life.',
    duration: [100, 150],
  },
  {
    id: 'staggered-reserve',
    name: 'Staggered reserve',
    reference: 'xposed-pack-4-level-08',
    band: 7,
    spawn: [36, 15],
    departure: 'up',
    coverage: 0.78,
    foundations: [
      rect(11, 6, 10, 6),
      rect(31, 13, 10, 6),
      rect(52, 5, 10, 6),
      rect(13, 25, 10, 5),
      rect(52, 24, 10, 6),
    ],
    terrain: [
      { id: 'soft-gap', kind: 'slow', x: 24, y: 5, w: 5, h: 7 },
      { id: 'marked-gap', kind: 'lethal', x: 43, y: 20, w: 5, h: 6 },
    ],
    objectives: [anchor('north-anchor', 26.5, 10.5), anchor('south-anchor', 46.5, 27.5)],
    actors: [
      eroder('west-cutter', 8.5, 19.5, [1, 0]),
      eroder('east-cutter', 63.5, 18.5),
      roamer('high-roamer', 56.5, 7.5),
    ],
    decision:
      'Secure the slowing northern connection first, or enclose the southern danger pocket before banking its anchor?',
    lesson:
      'Capture order should make the next route easier, not demand that every repeated cluster be cleared.',
    counterplay:
      'Keep the middle reserve and choose an approach outside the active roamer’s reclaimed domain.',
    consequence:
      'Neutralizing terrain and protecting a return connection solve different parts of the same route.',
    moment: 'An awkward stagger becomes a useful diagonal sequence of axis-aligned captures.',
    mastery: 'Neutralize both marked terrain areas and capture both anchors without losing a life.',
    duration: [100, 150],
  },
  {
    id: 'fracture-remix',
    name: 'Keep the network',
    reference: null,
    band: 7,
    spawn: [31, 17],
    departure: 'down',
    coverage: 0.79,
    foundations: [
      rect(28, 15, 17, 5),
      rect(9, 6, 14, 4),
      rect(50, 25, 14, 4),
      rect(53, 5, 5, 9),
      rect(14, 23, 5, 8),
    ],
    terrain: [{ id: 'soft-middle', kind: 'slow', x: 22, y: 21, w: 5, h: 9 }],
    objectives: [anchor('north-anchor', 25.5, 10.5), anchor('south-anchor', 47.5, 24.5)],
    actors: [
      eroder('west-cutter', 7.5, 18.5, [1, -1]),
      eroder('east-cutter', 64.5, 18.5, [-1, 1]),
      roamer('hub-roamer', 42.5, 17.5),
      frontier(52, 8),
    ],
    decision:
      'Bank two useful connections while routing around reclaimed-ground pressure, or take a larger capture while leaving a reserve return?',
    lesson: 'Combine known erosion, anchor, roamer and frontier rules. No new mandatory mechanic.',
    counterplay:
      'The permanent hub cannot erode but can still host a roamer; preserve a fresh departure and do not confuse permanence with immunity from enemies.',
    consequence:
      'The growing network changes field and reclaimed-ground threat domains in different ways.',
    moment:
      'A damaged network still offers a deliberate escape because its essential connections were banked.',
    mastery:
      'Capture both anchors, make a repair and close a cut after the hub roamer activates, without losing a life.',
    duration: [105, 150],
  },
];

export const FRACTURE_REFERENCE_ADAPTATIONS = freezeDesign(
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
export const FRACTURE_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);

export function createFractureCandidates({ artwork = false } = {}) {
  const project = createStarterProject('fracture-greybox-candidates');
  project.name = 'Fractured Grid · greybox candidates';
  project.actorCatalogId = FRACTURE_ACTOR_CATALOG.id;
  project.maps = [];
  project.assets = artwork ? structuredClone(FRACTURE_ART_CANDIDATES) : [];
  project.missions = rows.map((row, index) => {
    const map = {
      format: 'MapDesignV1',
      id: `${row.id}-map`,
      revision: row.revision ?? 'greybox-1',
      name: row.name,
      width: 72,
      height: 36,
      walls: [],
      foundations: structuredClone(row.foundations),
      terrain: structuredClone(row.terrain),
      spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
    };
    project.maps.push(map);
    return {
      ...createStarterProject().missions[0],
      id: row.id,
      revision: row.revision ?? 'greybox-1',
      name: row.name,
      map: { id: map.id, revision: map.revision },
      actors: structuredClone(row.actors),
      objectives: structuredClone(row.objectives),
      bonuses: [],
      coverage: row.coverage,
      presentation: {
        themeId: 'horizon',
        backgroundAssetId:
          project.assets.find((asset) => asset.id === `fracture-coastal-${row.id}`)?.id ?? null,
      },
      design: {
        routeDecision: row.decision,
        lesson: row.lesson,
        counterplay: row.counterplay,
        captureConsequence: row.consequence,
        memorableMoment: row.moment,
        mastery: row.mastery,
        introduces:
          index === 0 ? ['territory-erosion'] : index === 3 ? ['captured-anchor-protection'] : [],
        practices: [
          'enemy-seeded-closure',
          'foundations',
          ...(index ? ['territory-erosion'] : []),
          ...(index > 3 ? ['captured-anchor-protection'] : []),
        ],
        combines: [
          ...new Set([
            ...row.actors.map((actor) => actor.role),
            ...row.terrain.map((area) => `${area.kind}-field`),
          ]),
        ],
        durationSeconds: row.duration,
        difficulty: {
          band: row.band,
          planning: row.band,
          execution: index < 3 ? 4 : 5,
          threatDensity: index < 3 ? 3 : 4,
          timePressure: 0,
          mechanicLoad: index < 3 ? 5 : 6,
          coordination: 0,
        },
      },
    };
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'fractured-grid',
      revision: 'greybox-1',
      name: 'Fractured Grid',
      band: 6,
      missionIds: rows.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'fracture-remixes',
      revision: 'greybox-1',
      name: 'Fracture Remix · optional',
      band: 7,
      missionIds: ['fracture-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-fracture',
      revision: 'greybox-1',
      name: 'Fractured Grid candidates',
      campaignIds: ['fractured-grid'],
    },
    {
      format: 'PackDesignV1',
      id: 'fracture-remixes',
      revision: 'greybox-1',
      name: 'Optional Fracture Remix',
      campaignIds: ['fracture-remixes'],
    },
  ];
  return project;
}
