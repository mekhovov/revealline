import { createStarterProject } from './starter.mjs';
import { freezeDesign, SENTINEL_ACTOR_CATALOG, SENTINEL_RECIPE } from './catalogs.mjs';

// Original greyboxes, not copied artwork or inferred Reloaded physics.
const rect = (x, y, w, h) => ({ x, y, w, h });
const objective = (id, x, y) => ({ id, x, y, required: true, hidden: false });
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 30.5,
  clockwise: true,
});
const frontier = (x, y, side) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise: true,
});
const rover = (x, y) => ({
  id: 'rover',
  role: 'reclaimed-roamer',
  tier: 'measured',
  x,
  y,
  heading: [0, 1],
});
const rows = [
  {
    id: 'first-relay',
    name: 'First relay',
    band: 11,
    reference: 'xposed-pack-1-level-12',
    spawn: [35, 0],
    departure: 'down',
    core: [54.5, 17.5],
    foundations: [rect(32, 14, 8, 7), rect(14, 7, 5, 5), rect(54, 29, 5, 4)],
    walls: [
      rect(46, 10, 19, 2),
      rect(46, 25, 19, 2),
      rect(63, 12, 2, 13),
      rect(46, 12, 2, 3),
      rect(46, 22, 2, 3),
    ],
    terrain: [
      { id: 'west-rib', kind: 'slow', ...rect(21, 14, 3, 12) },
      { id: 'east-rib', kind: 'slow', ...rect(43, 7, 3, 12) },
    ],
    shields: [objective('chamber-shield', 60.5, 13.5)],
    actors: [outer(), frontier(31, 18, 'east')],
    decision:
      'Secure an approach to the upper side of the chamber opening, or the lower side, before turning a cut around the enclosed shield?',
    lesson:
      'A shield capture opens a deliberate transition, not an immediate victory. After the vertical attack, close eight fresh trail cells during CORE OPEN or isolate the core.',
    counterplay:
      'The chamber walls block movement and never close a cut. Plan the complete return through the opening. Watch both perimeter and frontier patrols when repositioning between attempts.',
    consequence:
      'The shield stays disabled after a life loss. The Sentinel remains a field anchor until its explicit release, which secures the remaining unclaimed picture.',
    moment:
      'The horizontal shield attack gives way to a vertical core attack after the first relay.',
    mastery: 'Release the core in its first exposed opening and clear without losing a life.',
  },
  {
    id: 'twin-receivers',
    name: 'Twin receivers',
    band: 11,
    reference: 'xposed-pack-4-level-03',
    spawn: [35, 17],
    departure: 'up',
    core: [35.5, 28.5],
    foundations: [rect(34, 12, 4, 12), rect(7, 10, 6, 5), rect(59, 21, 6, 5)],
    walls: [
      rect(28, 24, 5, 2),
      rect(38, 24, 5, 2),
      rect(28, 26, 2, 6),
      rect(41, 26, 2, 6),
      rect(28, 32, 15, 2),
    ],
    shields: [objective('west-shield', 31.5, 29.5), objective('east-shield', 39.5, 29.5)],
    actors: [frontier(33, 21, 'east'), rover(22.5, 18.5)],
    decision:
      'Approach the western receiver around the core, or the eastern receiver first, while preserving the five-cell return opening?',
    lesson:
      'Every listed shield must be captured; one relay does not expose the core. Their display order does not force a route order.',
    counterplay:
      'The broken central return leaves the whole field connected initially. Both receivers lie inside the retained chamber; outer captures do not collect them. Keep the northward opening available and stay clear of the core body.',
    consequence:
      'The first receiver advances the visible shield count while the original attack cadence continues. Only the final shield cancels that lane and starts the transition.',
    moment: 'Two opposing receiver sites share one Sentinel without a free half-board reveal.',
    mastery:
      'Capture the eastern shield before the western shield, in separate closures, and clear without losing a life.',
  },
  {
    id: 'relay-perimeter',
    name: 'Relay perimeter',
    band: 12,
    reference: 'xposed-pack-4-level-11',
    spawn: [35, 0],
    departure: 'down',
    core: [35.5, 18.5],
    foundations: [rect(7, 7, 3, 23), rect(10, 7, 46, 3), rect(10, 27, 46, 3), rect(58, 13, 4, 11)],
    shields: [
      objective('west-shield', 32.5, 15.5),
      objective('east-shield', 40.5, 21.5),
      objective('north-shield', 35.5, 12.5),
    ],
    actors: [rover(22.5, 18.5), frontier(10, 18, 'west')],
    gates: [
      { id: 'corner-top', ...rect(56, 7, 6, 3) },
      { id: 'corner-side', ...rect(58, 10, 4, 3) },
    ],
    relayLinks: [
      { gateId: 'corner-top', objectiveId: 'west-shield' },
      { gateId: 'corner-side', objectiveId: 'west-shield' },
    ],
    decision:
      'Secure the western shield to connect the upper-right return first, or approach the eastern shields through the wider lower corridor?',
    lesson:
      'One capture can disable a shield and open a permanent connector, but an awakened ground roamer changes which return remains comfortable.',
    counterplay:
      'Keep the lower corridor available before enclosing the roamer. The linked corner is protected from erosion and adds no earned coverage; it is a route improvement, not free score.',
    consequence:
      'The western shield joins two reserved connector segments into a useful upper route while the roamer warns and then moves on reclaimed ground.',
    moment: 'A missing corner becomes a complete return route before the last shield opens.',
    mastery:
      'Traverse the opened corner before capturing the final shield, then clear without losing a life.',
  },
  {
    id: 'crown-audience',
    name: 'Crown audience',
    band: 12,
    spawn: [35, 17],
    departure: 'up',
    core: [48.5, 22.5],
    foundations: [
      rect(32, 15, 8, 6),
      rect(25, 4, 22, 3),
      rect(25, 29, 22, 3),
      rect(7, 12, 4, 12),
      rect(60, 12, 4, 12),
    ],
    shields: [
      objective('northwest-shield', 18.5, 8.5),
      objective('northeast-shield', 53.5, 8.5),
      objective('southwest-shield', 18.5, 27.5),
      objective('southeast-shield', 53.5, 27.5),
    ],
    actors: [frontier(31, 18, 'east'), rover(15.5, 18.5)],
    decision:
      'Disable several shields with one ambitious enclosure, or secure separate return platforms while controlling the roamer and changing frontier?',
    lesson:
      'Four shield sites ask for an objective order and a return plan; the boss warning, movement and release rules remain unchanged.',
    counterplay:
      'Read the two moving domains before making a long cut. The broad middle and outer platforms offer repositioning without forcing precision turns under acceleration.',
    consequence:
      'A larger capture may disable several shields together, but it also enlarges the reclaimed area available to the roamer and redirects the frontier patrol.',
    moment:
      'The last of four shield sites disappears and the central route becomes the launch point for the release cut.',
    mastery: 'Capture the four shields in four separate closures and clear without losing a life.',
  },
  {
    id: 'sentinel-remix',
    name: 'Rings of return',
    band: 12,
    spawn: [35, 17],
    departure: 'up',
    core: [54.5, 18.5],
    foundations: [rect(29, 15, 14, 5), rect(26, 4, 20, 4), rect(26, 29, 20, 3)],
    shields: [
      objective('west-shield', 12.5, 8.5),
      objective('east-shield', 59.5, 28.5),
      objective('south-shield', 24.5, 24.5),
    ],
    actors: [outer(), frontier(25, 5, 'east')],
    speedZones: [{ id: 'north-current', direction: 'up', ...rect(33, 8, 5, 7) }],
    gates: [{ id: 'release-dock', ...rect(43, 16, 5, 3) }],
    relayLinks: [{ gateId: 'release-dock', objectiveId: 'west-shield' }],
    decision:
      'Open the release dock first, or use the marked northern approach to rearrange the frontier before disabling the other shields?',
    lesson:
      'Known arrows and permanent relays alter route efficiency, not the Sentinel cadence. No new rule is introduced in this optional Remix.',
    counterplay:
      'Capture removes the marked speed effect, so reassess the return trip. Wait on a platform, away from perimeter and frontier patrol paths, before a long release cut.',
    consequence:
      'The western shield extends the central dock with non-scoring return cells; the exposed stage still requires a fresh closure during the opening.',
    moment: 'The earlier shortcut becomes the return point for the final ambitious cut.',
    mastery:
      'Use the opened release dock and secure a release cut of at least sixteen new cells without losing a life.',
  },
];
export const SENTINEL_LEARNING_ARCS = freezeDesign([
  {
    id: 'open-the-shield',
    name: 'Open the shield',
    missionIds: rows.slice(0, 4).map((row) => row.id),
    introduces: ['shield-relay-sentinel'],
  },
]);
export const SENTINEL_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);
export const SENTINEL_REFERENCE_ADAPTATIONS = freezeDesign(
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

export function createSentinelCandidates() {
  const project = createStarterProject('sentinel-greybox-candidates');
  project.name = 'Sentinel Crown · greybox candidates';
  project.actorCatalogId = SENTINEL_ACTOR_CATALOG.id;
  project.assets = [];
  project.maps = rows.map((row) => ({
    format: 'MapDesignV3',
    id: row.id + '-map',
    revision: 'greybox-1',
    name: row.name,
    width: 72,
    height: 36,
    walls: structuredClone(row.walls ?? []),
    foundations: structuredClone(row.foundations),
    terrain: structuredClone(row.terrain ?? []),
    gates: structuredClone(row.gates ?? []),
    speedZones: structuredClone(row.speedZones ?? []),
    spawns: [{ id: 'home', x: row.spawn[0] + 0.5, y: row.spawn[1] + 0.5 }],
  }));
  project.missions = rows.map((row, index) => ({
    ...createStarterProject().missions[0],
    format: 'MissionDesignV4',
    id: row.id,
    revision: 'greybox-1',
    name: row.name,
    map: { id: row.id + '-map', revision: 'greybox-1' },
    actors: [
      { id: 'sentinel', role: 'relay-sentinel', tier: 'measured', x: row.core[0], y: row.core[1] },
      ...structuredClone(row.actors),
    ],
    objectives: [...structuredClone(row.shields), objective('core', ...row.core)],
    bonuses: [],
    coverage: 0.85,
    timeLimitSeconds: 0,
    relayLinks: structuredClone(row.relayLinks ?? []),
    encounter: {
      recipeId: SENTINEL_RECIPE.id,
      enemyId: 'sentinel',
      shieldObjectiveIds: row.shields.map((shield) => shield.id),
      coreObjectiveId: 'core',
    },
    presentation: { themeId: 'horizon', backgroundAssetId: null },
    design: {
      routeDecision: row.decision,
      lesson: row.lesson,
      counterplay: row.counterplay,
      captureConsequence: row.consequence,
      memorableMoment: row.moment,
      mastery: row.mastery,
      introduces: index === 0 ? ['shield-relay-sentinel'] : [],
      practices: [
        'enemy-seeded-closure',
        'foundations',
        ...(index ? ['shield-relay-sentinel'] : []),
      ],
      combines: [
        ...new Set(row.actors.map((actor) => actor.role)),
        ...(row.gates ? ['permanent-relay-connectors'] : []),
        ...(row.speedZones ? ['directional-speed-fields'] : []),
      ],
      durationSeconds: [60, 150],
      difficulty: {
        band: row.band,
        planning: row.band,
        execution: index < 2 ? 9 : 10,
        threatDensity: index < 3 ? 4 : 5,
        timePressure: 0,
        mechanicLoad: index < 2 ? 9 : 10,
        coordination: 0,
      },
    },
  }));
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'sentinel-crown',
      revision: 'greybox-1',
      name: 'Sentinel Crown',
      band: 11,
      missionIds: rows.slice(0, 4).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'sentinel-remixes',
      revision: 'greybox-1',
      name: 'Sentinel Crown Remix · optional',
      band: 12,
      missionIds: ['sentinel-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-sentinel',
      revision: 'greybox-1',
      name: 'Sentinel Crown candidates',
      campaignIds: ['sentinel-crown'],
    },
    {
      format: 'PackDesignV1',
      id: 'sentinel-remixes',
      revision: 'greybox-1',
      name: 'Optional Sentinel Crown Remix',
      campaignIds: ['sentinel-remixes'],
    },
  ];
  return project;
}
