import { createStarterProject } from './starter.mjs';
import { freezeDesign, PHASE_ACTOR_CATALOG } from './catalogs.mjs';

// Original spatial hypotheses, not copied coordinates or inferred screenshot physics.
const rect = (x, y, w, h) => ({ x, y, w, h });
const actor = (id, role, x, y, heading = [-1, 0]) => ({
  id,
  role,
  tier: 'measured',
  x,
  y,
  heading,
});
const carrier = (id, x, y, heading) => actor(id, 'impact-carrier', x, y, heading);
const keeper = (id, x, y, heading) => actor(id, 'field-keeper', x, y, heading);
const roamer = (id, x, y, heading) => actor(id, 'reclaimed-roamer', x, y, heading);
const frontier = (x, y, side) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise: true,
});
const slow = (id, x, y, w, h) => ({ id, kind: 'slow', x, y, w, h });
const lethal = (id, x, y, w, h) => ({ id, kind: 'lethal', x, y, w, h });

const rows = [
  {
    id: 'return-in-reserve',
    name: 'A return in reserve',
    band: 7,
    spawn: [35, 0],
    departure: 'down',
    coverage: 0.78,
    foundations: [rect(31, 14, 9, 3)],
    terrain: [],
    actors: [
      carrier('carrier', 38.5, 1.5),
      keeper('keeper', 12.5, 27.5, [1, -1]),
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
      'Use the landing as a short return, or pass it for a larger enclosure with more exposed trail?',
    lesson:
      'Only the bolt-shaped carrier sends moving impacts. Ordinary keepers still damage the trail immediately.',
    counterplay:
      'First connect the nearby landing. When an impact appears, close on reclaimed ground before it reaches the craft; a hit at the live endpoint gives no grace.',
    consequence:
      'The landing becomes a repeatable shortcut without changing which field enemies retain their regions.',
    moment: 'A travelling impact disappears when a short return closes in time.',
    mastery: 'Close a cut with an active travelling impact without losing a life.',
  },
  {
    id: 'two-ways-home',
    name: 'Two ways home',
    band: 7,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.78,
    foundations: [rect(28, 16, 16, 3), rect(34, 6, 5, 4)],
    terrain: [],
    actors: [
      carrier('carrier', 15.5, 9.5, [1, 0]),
      keeper('keeper', 58.5, 26.5),
      frontier(44, 17, 'west'),
    ],
    decision:
      'Link the upper landing first or leave two separate return destinations while shaping the frontier?',
    lesson:
      'Choose a fallback destination before departing; a frontier patrol still threatens the unfinished trail immediately.',
    counterplay:
      'Keep both ends of a short crossing visible. Redirect the frontier away from the chosen return before extending the cut.',
    consequence:
      'Connecting foundations shortens later escape paths but also changes the patrol route.',
    moment: 'The alternative landing remains reachable when the first approach becomes pressured.',
    mastery:
      'Connect both foundations and close a cut with an active impact without losing a life.',
  },
  {
    id: 'dogleg-transfer',
    name: 'Dogleg transfer',
    band: 7,
    reference: 'xposed-pack-4-level-05',
    spawn: [2, 9],
    departure: 'up',
    coverage: 0.79,
    foundations: [rect(1, 9, 28, 2), rect(27, 9, 2, 8), rect(27, 15, 44, 2)],
    terrain: [slow('upper-pocket', 50, 3, 10, 3), lethal('lower-pocket', 18, 23, 6, 4)],
    actors: [
      carrier('upper-carrier', 58.5, 6.5),
      carrier('lower-carrier', 54.5, 27.5),
      keeper('keeper', 12.5, 28.5, [1, 0]),
    ],
    decision:
      'Work the shallow upper chamber first, or use the dogleg to reach the deeper lower chamber?',
    lesson:
      'The two chambers retain independently; the permanent dogleg closes cuts but does not itself earn coverage.',
    counterplay:
      'Follow the change in boundary height before committing. Slice across each chamber toward the nearer part of the dogleg.',
    consequence:
      'Each chamber remains until its own retaining actors are isolated; there is no unexplained remote fill.',
    moment: 'One stepped return gives two different useful closure heights.',
    mastery:
      'Make a closure in both starting chambers and neutralize the lower lethal pocket without losing a life.',
  },
  {
    id: 'crossed-bands',
    name: 'Crossed bands',
    band: 8,
    reference: 'xposed-pack-3-level-03',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.79,
    foundations: [rect(30, 14, 12, 8)],
    terrain: [
      slow('west-upper-band', 19, 4, 3, 12),
      slow('west-lower-band', 19, 18, 3, 13),
      slow('east-upper-band', 47, 4, 3, 12),
      slow('east-lower-band', 47, 18, 3, 13),
      lethal('west-crossbar', 12, 16, 12, 2),
      lethal('east-crossbar', 48, 16, 12, 2),
    ],
    actors: [
      carrier('carrier', 64.5, 10.5),
      keeper('keeper', 8.5, 28.5, [1, 0]),
      frontier(42, 17, 'west'),
    ],
    decision:
      'Capture a dangerous crossbar from its clear side, or take a shorter slow-band crossing to open another approach?',
    lesson:
      'Use known terrain rules while planning an impact escape. There is no new mandatory rule in this arc.',
    counterplay:
      'The central foundation is a permanent return. Keep the exposed part short; capture neutralizes terrain but merely crossing it does not.',
    consequence:
      'A neutralized band changes route efficiency without changing actor movement speeds.',
    moment: 'A hazardous crossbar becomes the return surface for the next enclosure.',
    mastery:
      'Neutralize both lethal crossbars and close a cut with an active impact without losing a life.',
  },
  {
    id: 'pressure-ladder',
    name: 'Pressure ladder',
    band: 8,
    reference: 'xposed-pack-3-level-07',
    spawn: [35, 15],
    departure: 'up',
    coverage: 0.8,
    foundations: [rect(14, 6, 10, 3), rect(30, 14, 12, 3), rect(48, 23, 10, 3)],
    terrain: [slow('lower-rung-approach', 33, 21, 4, 10)],
    actors: [
      carrier('east-carrier', 60.5, 10.5),
      carrier('west-carrier', 10.5, 26.5, [1, 0]),
      frontier(40, 13, 'south'),
    ],
    decision:
      'Build short diagonal connections between staggered landings, or expose a longer trail to reclaim a larger side?',
    lesson:
      'A sequence of deliberate returns can reduce impact exposure more than a single ambitious crossing.',
    counterplay:
      'Use the clear sides of the rungs and observe the frontier before returning. The slow lower approach is optional, not a forced precision sprint.',
    consequence: 'Each connection changes the next usable return and the patrol contour.',
    moment: 'The ladder acquires a new rung through the player’s own capture.',
    mastery:
      'Connect all three foundations and close a cut with an active impact without losing a life.',
  },
  {
    id: 'signal-channels',
    name: 'Signal channels',
    band: 8,
    reference: 'xposed-pack-3-level-10',
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.8,
    foundations: [rect(32, 15, 8, 6), rect(10, 5, 8, 4), rect(52, 25, 9, 5)],
    terrain: [
      slow('northwest-bank', 21, 4, 7, 10),
      slow('southeast-bank', 44, 20, 5, 10),
      lethal('southwest-bank', 22, 23, 7, 5),
      lethal('northeast-bank', 45, 5, 5, 6),
    ],
    actors: [
      keeper('keeper', 10.5, 12.5, [1, 0]),
      carrier('carrier', 58.5, 7.5),
      roamer('roamer', 45.5, 27.5),
    ],
    decision:
      'Open the northern clear channel or the southern island connection while preserving room for the reclaimed-ground roamer?',
    lesson:
      'A capture can remove terrain danger and wake a different movement-domain threat at the same time.',
    counterplay:
      'Keep broad cross-connections available. A permanent landing closes the cut but does not protect against an active roamer.',
    consequence:
      'Enclosing the roamer changes reclaimed-ground pressure; the carrier and keeper retain field normally.',
    moment:
      'A blocked-looking approach becomes clear, then requires a different return plan as the roamer wakes.',
    mastery:
      'Neutralize both lethal banks and close a cut after the roamer activates without losing a life.',
  },
  {
    id: 'phase-remix',
    name: 'Close the circuit',
    band: 8,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.81,
    foundations: [rect(31, 15, 10, 6), rect(33, 5, 6, 4), rect(12, 16, 7, 4), rect(52, 16, 7, 4)],
    terrain: [slow('west-delay', 24, 23, 5, 6), lethal('east-bank', 45, 25, 9, 3)],
    actors: [
      carrier('west-carrier', 9.5, 8.5, [1, 0]),
      carrier('east-carrier', 63.5, 28.5),
      roamer('roamer', 48.5, 20.5),
      frontier(41, 17, 'west'),
    ],
    decision:
      'Keep disconnected fallback landings or connect a circuit that gives both the craft and frontier patrol new routes?',
    lesson:
      'Combine known impact, frontier and reclaimed-ground rules. This optional Remix adds no mandatory mechanic.',
    counterplay:
      'Watch the carrier’s trail strike and the current patrol route; close early enough to preserve an exit from a newly awakened roamer.',
    consequence:
      'Connecting the circuit reshapes both field and reclaimed-ground danger without changing the capture contract.',
    moment:
      'An impact is extinguished at the return just as a new escape corridor becomes necessary.',
    mastery:
      'Close a cut with an active impact after the roamer activates and neutralize the lethal bank without losing a life.',
  },
];

export const PHASE_ARCS = freezeDesign([
  {
    id: 'a-return-before-impact',
    missionIds: rows.slice(0, 3).map((r) => r.id),
    introduces: 'selective-trail-impact',
  },
  { id: 'choose-the-next-return', missionIds: rows.slice(3, 6).map((r) => r.id), introduces: null },
]);
export const PHASE_REFERENCE_ADAPTATIONS = freezeDesign(
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
export const PHASE_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);

export function createPhaseCandidates() {
  const project = createStarterProject('phase-greybox-candidates');
  project.name = 'Phaseworks · greybox candidates';
  project.actorCatalogId = PHASE_ACTOR_CATALOG.id;
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
      introduces: index === 0 ? ['selective-trail-impact'] : [],
      practices: [
        'enemy-seeded-closure',
        'foundations',
        ...(index ? ['selective-trail-impact'] : []),
      ],
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
        execution: index < 3 ? 5 : 6,
        threatDensity: index < 3 ? 3 : 4,
        timePressure: 0,
        mechanicLoad: index < 3 ? 5 : 6,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'phaseworks',
      revision: 'greybox-1',
      name: 'Phaseworks',
      band: 7,
      missionIds: rows.slice(0, 6).map((r) => r.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'phase-remixes',
      revision: 'greybox-1',
      name: 'Phaseworks Remix · optional',
      band: 8,
      missionIds: ['phase-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-phase',
      revision: 'greybox-1',
      name: 'Phaseworks candidates',
      campaignIds: ['phaseworks'],
    },
    {
      format: 'PackDesignV1',
      id: 'phase-remixes',
      revision: 'greybox-1',
      name: 'Optional Phaseworks Remix',
      campaignIds: ['phase-remixes'],
    },
  ];
  return project;
}
