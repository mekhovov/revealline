import { createStarterProject } from './starter.mjs';
import { freezeDesign, LIVEWIRE_ACTOR_CATALOG } from './catalogs.mjs';

// Original greyboxes. Screenshot motifs are not collision, timing or AI evidence.
const rect = (x, y, w, h) => ({ x, y, w, h });
const mover = (id, role, x, y, heading = [-1, 0]) => ({
  id,
  role,
  tier: 'measured',
  x,
  y,
  heading,
});
const keeper = (id, x, y, heading) => mover(id, 'field-keeper', x, y, heading);
const emitter = (id, x, y, axis) => ({ id, role: 'lane-emitter', tier: 'measured', x, y, axis });
const frontier = (x, y, side) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise: true,
});
const terrain = (id, kind, x, y, w, h) => ({ id, kind, x, y, w, h });

const rows = [
  {
    id: 'read-the-lock',
    name: 'Read the lock',
    band: 8,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.79,
    foundations: [rect(30, 28, 12, 3)],
    terrain: [],
    actors: [
      emitter('emitter', 56.5, 27.5, 'horizontal'),
      keeper('keeper', 12.5, 27.5, [1, -1]),
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 25.5,
        clockwise: true,
      },
    ],
    decision:
      'Close on the landing during the warning, or carry a longer exposed trail toward the far border?',
    lesson:
      'A lane locks to your row, warns, then fires. Moving the craft out is not enough if the unfinished trail still crosses it.',
    counterplay:
      'Watch the marked row and close on the landing before the attack. Start the next crossing after the active lane clears.',
    consequence:
      'A secured connection shelters the craft from the lane, while the stationary emitter continues retaining its field region.',
    moment: 'The first cut closes after the lock appears and before the lane fires.',
    mastery:
      'Clear without a life loss after closing a cut whose exposed trail crossed a warning lane.',
  },
  {
    id: 'cross-the-afterglow',
    name: 'Cross the afterglow',
    band: 8,
    spawn: [35, 17],
    departure: 'left',
    coverage: 0.79,
    foundations: [rect(31, 15, 10, 6), rect(10, 16, 7, 4), rect(34, 4, 5, 4)],
    terrain: [],
    actors: [
      emitter('emitter', 57.5, 8.5, 'vertical'),
      keeper('keeper', 14.5, 28.5, [1, 0]),
      frontier(41, 17, 'west'),
    ],
    decision:
      'Establish a short westward return before extending north, or use the next rest window for the longer connection?',
    lesson:
      'A column attack uses the same locked-warning rule as a row. Frontier patrols still threaten reclaimed edges and unfinished cuts.',
    counterplay:
      'Keep a landing at each end of the planned crossing. Read the locked column rather than chasing a countdown.',
    consequence:
      'Each connected landing shortens later exposed crossings but also gives the frontier a new route.',
    moment:
      'A column attack passes through a completed connector while the next route remains available.',
    mastery: 'Connect all three foundations and clear without losing a life.',
  },
  {
    id: 'switchyard',
    name: 'Switchyard',
    band: 8,
    reference: 'xposed-pack-2-level-10',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.8,
    foundations: [rect(30, 16, 12, 3), rect(1, 8, 23, 2), rect(48, 26, 23, 2)],
    terrain: [
      terrain('west-slow', 'slow', 12, 22, 8, 4),
      terrain('east-hot', 'lethal', 52, 6, 7, 4),
    ],
    actors: [
      emitter('emitter', 62.5, 14.5, 'horizontal'),
      keeper('keeper', 11.5, 29.5, [1, 0]),
      frontier(42, 17, 'west'),
    ],
    decision:
      'Connect the nearer staggered rail or claim a hazardous pocket first to open the wider side approach?',
    lesson:
      'A rail is a return surface, not a wall. Staggered rails change crossing length without changing attack timing.',
    counterplay:
      'Plan the bend before departure and use the central platform as a fallback when the locked row crosses your trail.',
    consequence:
      'Capturing the hot pocket creates usable ground; untouched slow ground still delays the craft, never the emitter clock.',
    moment: 'One new connector turns offset rails into a useful stepped return.',
    mastery: 'Join all three foundations and neutralize the lethal pocket without losing a life.',
  },
  {
    id: 'split-junction',
    name: 'Split junction',
    band: 9,
    reference: 'xposed-pack-3-level-05',
    spawn: [35, 17],
    departure: 'down',
    coverage: 0.8,
    foundations: [rect(1, 16, 25, 3), rect(46, 16, 25, 3), rect(33, 14, 6, 7)],
    terrain: [
      terrain('northwest', 'slow', 8, 5, 12, 6),
      terrain('southeast', 'slow', 52, 24, 12, 6),
      terrain('northeast', 'lethal', 53, 5, 8, 5),
      terrain('southwest', 'lethal', 10, 25, 8, 5),
    ],
    actors: [
      emitter('emitter', 60.5, 12.5, 'vertical'),
      keeper('keeper', 12.5, 21.5, [1, 0]),
      frontier(39, 17, 'west'),
    ],
    decision:
      'Bridge a short gap into an outer rail, or first reclaim one corner to give the next crossing a different approach?',
    lesson:
      'Keep the two open junctions useful. Corner terrain changes approach cost while the locked column can cut across both.',
    counterplay:
      'Stay on a landing while reading a lock, then cross toward a reachable return. Enclose lethal corners before flying through them.',
    consequence:
      'Reclaimed corners become alternative launch ground instead of decorative completion cleanup.',
    moment:
      'A short connector changes which side of the junction can be crossed in one rest window.',
    mastery:
      'Neutralize both lethal corners and connect all three foundations without a life loss.',
  },
  {
    id: 'crossbar-depot',
    name: 'Crossbar depot',
    band: 9,
    reference: 'xposed-pack-4-level-04',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.81,
    foundations: [
      rect(32, 14, 8, 8),
      rect(34, 1, 4, 9),
      rect(1, 16, 24, 3),
      rect(47, 16, 24, 3),
      rect(34, 26, 4, 9),
    ],
    terrain: [
      terrain('northwest', 'slow', 11, 5, 10, 5),
      terrain('southeast', 'lethal', 52, 25, 8, 5),
    ],
    actors: [
      emitter('row-emitter', 59.5, 8.5, 'horizontal'),
      emitter('column-emitter', 12.5, 27.5, 'vertical'),
      keeper('keeper', 58.5, 21.5),
    ],
    decision:
      'Complete a north-south spine or an east-west link first when both a row and a column can lock?',
    lesson:
      'Two known emitters mark a cross. The permanent landing is a refuge from the lanes, not a switch that disables them.',
    counterplay:
      'Choose one short connection at a time. Close before the simultaneous attacks instead of trying to outrun both with a long live trail.',
    consequence:
      'The growing cross offers shorter return paths; both stationary anchors continue to retain their own regions.',
    moment: 'A completed central connection stays usable through a crossing pair of attacks.',
    mastery: 'Connect all five foundations and clear without losing a life.',
  },
  {
    id: 'cooling-loop',
    name: 'Cooling loop',
    band: 9,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.81,
    foundations: [rect(30, 15, 12, 6), rect(33, 4, 6, 4), rect(10, 15, 8, 5), rect(54, 15, 8, 5)],
    terrain: [
      terrain('west-bank', 'lethal', 20, 24, 8, 5),
      terrain('east-bank', 'lethal', 45, 6, 8, 5),
    ],
    actors: [
      emitter('emitter', 60.5, 28.5, 'vertical'),
      mover('eroder', 'territory-eroder', 14.5, 9.5, [1, 0]),
      keeper('keeper', 12.5, 27.5, [1, 0]),
    ],
    decision:
      'Use an earned shortcut across a cooled bank or connect permanent landings before erosion can reopen that route?',
    lesson:
      'Lanes and erosion use separate warnings. Foundations never erode; reclaimed hazards can reactivate if earned territory reopens.',
    counterplay:
      'Keep the next permanent return in view, repair a valuable gap, and do not treat cooled terrain as permanently protected.',
    consequence:
      'An enclosure neutralizes the bank immediately, but route resilience depends on which foundations you connect.',
    moment:
      'A permanent alternate return remains available when an earned frontier is marked for erosion.',
    mastery:
      'Neutralize both lethal banks, connect all four foundations and clear without losing a life.',
  },
  {
    id: 'livewire-remix',
    name: 'Windows in the wire',
    band: 9,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.82,
    foundations: [rect(31, 15, 10, 6), rect(33, 4, 6, 4), rect(11, 16, 7, 4), rect(53, 16, 7, 4)],
    terrain: [
      terrain('lower-bank', 'lethal', 24, 25, 7, 4),
      terrain('upper-delay', 'slow', 44, 5, 6, 5),
    ],
    actors: [
      emitter('row-emitter', 61.5, 7.5, 'horizontal'),
      emitter('column-emitter', 10.5, 28.5, 'vertical'),
      mover('carrier', 'impact-carrier', 55.5, 27.5),
      mover('roamer', 'reclaimed-roamer', 47.5, 20.5),
    ],
    decision:
      'Spend the rest window linking another refuge, or close a smaller cut and preserve a corridor before the roamer wakes?',
    lesson:
      'Combine known lane, impact and reclaimed-ground threats. A travelling spark has grace; an active lane striking the trail does not.',
    counterplay:
      'Shorten the live trail before the marked cross fires and leave an exit on reclaimed ground before capturing the roamer.',
    consequence:
      'Capturing removes live impacts and neutralizes terrain, but may activate a new ground threat without disabling either emitter.',
    moment:
      'A timely closure extinguishes a moving impact while the new ground still offers an escape from the roamer.',
    mastery:
      'Clear without a life loss after closing an active-impact cut while the roamer was already active.',
  },
];

export const LIVEWIRE_ARCS = freezeDesign([
  {
    id: 'read-the-lane',
    missionIds: rows.slice(0, 3).map((r) => r.id),
    introduces: 'locked-lane-attacks',
  },
  { id: 'build-the-next-window', missionIds: rows.slice(3, 6).map((r) => r.id), introduces: null },
]);
export const LIVEWIRE_REFERENCE_ADAPTATIONS = freezeDesign(
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
export const LIVEWIRE_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((r) => [r.id, r.departure])),
);

export function createLivewireCandidates() {
  const project = createStarterProject('livewire-greybox-candidates');
  project.name = 'Livewire Foundry · greybox candidates';
  project.actorCatalogId = LIVEWIRE_ACTOR_CATALOG.id;
  project.assets = [];
  project.maps = rows.map((row) => ({
    format: 'MapDesignV1',
    id: `${row.id}-map`,
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: [],
    foundations: structuredClone(row.foundations),
    terrain: structuredClone(row.terrain),
    spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
  }));
  project.missions = rows.map((row, index) => ({
    ...createStarterProject().missions[0],
    id: row.id,
    name: row.name,
    revision: 'greybox-1',
    map: { id: `${row.id}-map`, revision: 'greybox-1' },
    actors: structuredClone(row.actors),
    objectives: [],
    bonuses: [],
    coverage: row.coverage,
    presentation: { themeId: 'horizon', backgroundAssetId: null },
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: index === 0 ? ['locked-lane-attacks'] : [],
      practices: ['enemy-seeded-closure', 'foundations', ...(index ? ['locked-lane-attacks'] : [])],
      combines: [
        ...new Set([
          ...row.actors.map((a) => a.role),
          ...row.terrain.map((t) => `${t.kind}-field`),
        ]),
      ],
      durationSeconds: [90, 150],
      difficulty: {
        band: row.band,
        planning: row.band,
        execution: index < 3 ? 6 : 7,
        threatDensity: index < 3 ? 4 : 5,
        timePressure: 0,
        mechanicLoad: index < 3 ? 6 : 7,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'livewire-foundry',
      revision: 'greybox-1',
      name: 'Livewire Foundry',
      band: 8,
      missionIds: rows.slice(0, 6).map((r) => r.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'livewire-remixes',
      revision: 'greybox-1',
      name: 'Livewire Foundry Remix · optional',
      band: 9,
      missionIds: ['livewire-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-livewire',
      revision: 'greybox-1',
      name: 'Livewire Foundry candidates',
      campaignIds: ['livewire-foundry'],
    },
    {
      format: 'PackDesignV1',
      id: 'livewire-remixes',
      revision: 'greybox-1',
      name: 'Optional Livewire Foundry Remix',
      campaignIds: ['livewire-remixes'],
    },
  ];
  return project;
}
