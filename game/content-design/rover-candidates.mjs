import { createStarterProject } from './starter.mjs';
import { freezeDesign, ROVER_ACTOR_CATALOG } from './catalogs.mjs';
import { ROVER_ART_CANDIDATES } from './rover-art.mjs';

// Spatial hypotheses only. Reclaimed roamers use an explicit catalogue edition;
// no screenshot establishes their movement, warning or collision behavior.
const rect = (x, y, w, h) => ({ x, y, w, h });
const keeper = (id, x, y, heading = [1, 1]) => ({
  id,
  role: 'field-keeper',
  tier: 'measured',
  x,
  y,
  heading,
});
const roamer = (id, x, y, heading = [1, 0]) => ({
  id,
  role: 'reclaimed-roamer',
  tier: 'measured',
  x,
  y,
  heading,
});
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 25.5,
  clockwise: true,
});
const frontier = (x, y) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side: 'east' },
  clockwise: true,
});

export const ROVER_ARCS = freezeDesign([
  {
    id: 'wake-and-leave',
    missionIds: ['wake-the-yard', 'split-berths', 'stepped-return'],
    introduces: 'reclaimed-roamer',
  },
  {
    id: 'preserve-an-exit',
    missionIds: ['between-the-rows', 'broken-yard', 'sorting-yard'],
    introduces: null,
  },
]);
const rows = [
  {
    id: 'wake-the-yard',
    name: 'Wake the yard',
    reference: null,
    band: 5,
    spawn: [32, 0],
    departure: 'down',
    coverage: 0.74,
    foundations: [rect(29, 12, 8, 8)],
    terrain: [],
    actors: [
      keeper('west', 10.5, 28.5, [1, -1]),
      keeper('east', 60.5, 28.5, [-1, -1]),
      roamer('sleeper', 12.5, 6.5),
      outer(),
    ],
    decision:
      'Enclose the dormant roamer early and leave by a broad return, or keep its pocket unclaimed while opening the other side?',
    lesson:
      'A dormant roamer does not retain field. Reclaiming its full body starts a warning, then it moves and threatens reclaimed ground.',
    counterplay:
      'Use the wide landing and the warning to move away; plan the next departure before waking the roamer.',
    consequence:
      'A rewarding capture can create both new return ground and a new threat on that ground.',
    moment: 'The picture opens around a sleeper that warns before it begins moving.',
    mastery: 'Activate the roamer and complete another closure without losing a life.',
    duration: [80, 145],
  },
  {
    id: 'split-berths',
    name: 'Split berths',
    reference: 'xposed-pack-1-level-10',
    band: 5,
    spawn: [18, 0],
    departure: 'down',
    coverage: 0.74,
    foundations: [rect(14, 10, 9, 5), rect(46, 7, 8, 5), rect(35, 25, 12, 5)],
    terrain: [],
    actors: [
      keeper('west', 8.5, 29.5, [1, -1]),
      keeper('east', 63.5, 24.5, [-1, -1]),
      roamer('near-sleeper', 10.5, 5.5),
      roamer('far-sleeper', 56.5, 17.5),
    ],
    decision:
      'Join the nearby berths before waking their sleepers, or isolate one side and keep the far return clear?',
    lesson:
      'Only reclaimed ground supports an active roamer. An unclaimed gap can keep two return networks separate.',
    counterplay:
      'Use the three unequal landings and choose when to connect them; no bonus or timer forces the order.',
    consequence:
      'A connection shortens your return but can also enlarge a roamer’s movement domain.',
    moment:
      'Joining useful landings has a visible cost as a formerly isolated threat gains more room.',
    mastery:
      'Connect all three landings after activating at least one roamer, without losing a life.',
    duration: [85, 150],
  },
  {
    id: 'stepped-return',
    revision: 'greybox-2',
    name: 'Stepped return',
    reference: 'xposed-pack-2-level-03',
    band: 5,
    spawn: [28, 0],
    departure: 'down',
    coverage: 0.75,
    foundations: [rect(24, 8, 9, 5), rect(28, 13, 5, 8), rect(28, 21, 16, 5)],
    terrain: [],
    actors: [
      keeper('west', 9.5, 28.5, [1, -1]),
      keeper('east', 62.5, 8.5, [-1, 1]),
      roamer('sleeper', 30.5, 18.5, [0, 1]),
      outer(),
    ],
    decision:
      'Return to the short upper step or the long lower arm while the warned roamer patrols the stepped foundation?',
    lesson:
      'A return closes the trail but does not protect the craft from an active roamer approaching along reclaimed ground.',
    counterplay:
      'Leave both ends of the stepped platform usable and depart again when the roamer approaches.',
    consequence:
      'The same step is a useful short closure before activation and a place to keep moving afterward.',
    moment: 'A familiar return surface becomes a timing choice without changing the capture rule.',
    mastery: 'Use both ends of the stepped foundation for closures after activating the roamer.',
    duration: [85, 150],
  },
  {
    id: 'between-the-rows',
    name: 'Between the rows',
    reference: 'xposed-pack-1-level-08',
    band: 5,
    spawn: [17, 0],
    departure: 'down',
    coverage: 0.75,
    foundations: [rect(14, 9, 7, 18), rect(33, 5, 7, 17), rect(53, 15, 7, 15)],
    terrain: [{ id: 'soft-link', kind: 'slow', x: 24, y: 12, w: 5, h: 12 }],
    actors: [
      keeper('west', 7.5, 29.5, [1, -1]),
      keeper('east', 63.5, 6.5, [-1, 1]),
      roamer('middle-roamer', 36.5, 10.5, [0, 1]),
      frontier(52, 20),
    ],
    decision:
      'Take the clear long link around the middle roamer, or neutralize the slow gap to make a shorter next departure?',
    lesson:
      'A foundation can already support a warned roamer; its interior route differs from the patrol tracing the field edge.',
    counterplay:
      'The near landing starts away from both threats; watch the middle lane before connecting it.',
    consequence:
      'Linking rows changes the frontier and the reclaimed movement domain in different ways.',
    moment: 'Two enemies use different parts of the same newly connected return network.',
    mastery: 'Join all three rows and neutralize the slow link without losing a life.',
    duration: [90, 150],
  },
  {
    id: 'broken-yard',
    revision: 'greybox-2',
    name: 'Broken yard',
    reference: 'xposed-pack-2-level-04',
    band: 6,
    spawn: [34, 17],
    departure: 'up',
    coverage: 0.76,
    foundations: [
      rect(31, 12, 7, 13),
      rect(19, 15, 12, 5),
      rect(38, 20, 14, 5),
      rect(8, 7, 7, 5),
      rect(55, 8, 8, 5),
    ],
    terrain: [{ id: 'marked-pocket', kind: 'lethal', x: 44, y: 6, w: 6, h: 7 }],
    actors: [
      keeper('west', 6.5, 28.5, [1, -1]),
      keeper('east', 65.5, 27.5, [-1, -1]),
      roamer('sleeper', 49.5, 22.5),
      frontier(54, 10),
    ],
    decision:
      'Build an outside escape to the near platform, or neutralize the marked pocket before joining the far platform?',
    lesson:
      'An escape corridor needs a usable departure, not merely a connection to reclaimed cells occupied by a roamer.',
    counterplay:
      'Use the broad central branch to switch sides; leave another return available before enlarging the roamer’s domain.',
    consequence:
      'Capture order determines which branch remains a convenient return under pressure.',
    moment: 'The best next capture opens a way out rather than maximizing immediate area.',
    mastery: 'Connect both outer platforms and neutralize the marked pocket without losing a life.',
    duration: [95, 150],
  },
  {
    id: 'sorting-yard',
    name: 'Sorting yard',
    reference: 'xposed-pack-3-level-02',
    band: 6,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.76,
    foundations: [rect(1, 15, 70, 5), rect(20, 5, 5, 10), rect(48, 20, 5, 10)],
    terrain: [],
    actors: [
      keeper('north', 59.5, 6.5, [-1, 0]),
      keeper('south', 10.5, 29.5, [1, 0]),
      roamer('north-sleeper', 9.5, 7.5),
      roamer('south-sleeper', 62.5, 27.5),
    ],
    decision:
      'Reclaim the upper side first or divide work between both sides before waking the second roamer?',
    lesson:
      'Each occupied chamber retains its field, while active roamers can share the connecting reclaimed spine.',
    counterplay:
      'Use wide separated departure points and the short stub returns; avoid waiting on the spine between active roamers.',
    consequence:
      'A chamber capture may release pressure into the shared return without automatically filling the other chamber.',
    moment:
      'A familiar central spine becomes a route to cross deliberately rather than a permanent waiting place.',
    mastery:
      'Activate both roamers and earn territory in both starting chambers without losing a life.',
    duration: [95, 150],
  },
  {
    id: 'rover-remix',
    name: 'Open frequency',
    reference: 'xposed-pack-4-level-06',
    band: 6,
    spawn: [35, 17],
    departure: 'up',
    coverage: 0.77,
    foundations: [
      rect(1, 15, 17, 5),
      rect(28, 15, 16, 5),
      rect(55, 15, 16, 5),
      rect(33, 5, 5, 6),
      rect(35, 24, 5, 7),
    ],
    terrain: [
      { id: 'marked-west', kind: 'lethal', x: 9, y: 6, w: 5, h: 6 },
      { id: 'marked-east', kind: 'lethal', x: 57, y: 24, w: 5, h: 6 },
    ],
    actors: [
      keeper('west', 7.5, 28.5, [1, -1]),
      keeper('east', 65.5, 6.5, [-1, 1]),
      roamer('west-sleeper', 19.5, 8.5),
      roamer('east-sleeper', 50.5, 27.5),
      frontier(32, 8),
    ],
    decision:
      'Reconnect the broken spine, or first establish a vertical escape before the two sleepers gain access to it?',
    lesson:
      'Combine known retention, return-ground, terrain and threat-domain rules; no new mandatory mechanic.',
    counterplay:
      'Use broad gaps and distinct upper/lower returns, neutralize marked pockets by enclosure and leave a fresh departure ready.',
    consequence:
      'Reconnecting the spine creates a useful route that both active roamers may also use.',
    moment:
      'An apparently broken return network becomes useful only after choosing how to keep it escapable.',
    mastery: 'Join the three spine segments and activate both roamers without losing a life.',
    duration: [100, 150],
  },
];

export const ROVER_REFERENCE_ADAPTATIONS = freezeDesign(
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
export const ROVER_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);
export function createRoverCandidates({ artwork = false } = {}) {
  const project = createStarterProject('rover-greybox-candidates');
  project.name = 'Rover Yard · greybox candidates';
  project.actorCatalogId = ROVER_ACTOR_CATALOG.id;
  project.maps = [];
  project.assets = artwork ? structuredClone(ROVER_ART_CANDIDATES) : [];
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
      bonuses: [],
      coverage: row.coverage,
      presentation: {
        themeId: 'horizon',
        backgroundAssetId: artwork ? `rover-pixel-${row.id}` : null,
      },
      design: {
        routeDecision: row.decision,
        lesson: row.lesson,
        counterplay: row.counterplay,
        captureConsequence: row.consequence,
        memorableMoment: row.moment,
        mastery: row.mastery,
        introduces: index === 0 ? ['reclaimed-roamer'] : [],
        practices: ['enemy-seeded-closure', 'foundations', ...(index ? ['reclaimed-roamer'] : [])],
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
          execution: index < 3 ? 3 : 4,
          threatDensity: index < 4 ? 3 : 4,
          timePressure: 0,
          mechanicLoad: index < 3 ? 4 : 5,
          coordination: 0,
        },
      },
    };
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'rover-yard',
      revision: 'greybox-1',
      name: 'Rover Yard',
      band: 5,
      missionIds: rows.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'rover-remixes',
      revision: 'greybox-1',
      name: 'Rover Remix · optional',
      band: 6,
      missionIds: ['rover-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-rover',
      revision: 'greybox-1',
      name: 'Rover Yard candidates',
      campaignIds: ['rover-yard'],
    },
    {
      format: 'PackDesignV1',
      id: 'rover-remixes',
      revision: 'greybox-1',
      name: 'Optional Rover Remix',
      campaignIds: ['rover-remixes'],
    },
  ];
  return project;
}
