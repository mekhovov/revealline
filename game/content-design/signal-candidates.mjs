import { createStarterProject } from './starter.mjs';
import { freezeDesign } from './catalogs.mjs';

// Original P03 hypotheses. These are not released, human-validated or Team maps.
// "Interference" is represented by the established slow material, not a hidden
// input penalty, new physics override or guessed behavior from a reference still.
export const SIGNAL_ARCS = freezeDesign([
  {
    id: 'route-through-slow',
    missionIds: ['soft-crossing', 'dry-spine', 'wide-approach'],
    introduces: 'slow-field',
  },
  {
    id: 'neutralize-before-crossing',
    missionIds: ['cool-the-crossing', 'garden-refuges', 'neutral-ground'],
    introduces: 'lethal-field',
  },
]);
const keeper = (id, x, y, heading = [1, 1]) => ({
  id,
  role: 'field-keeper',
  tier: 'measured',
  x,
  y,
  heading,
});
const outer = (x = 71.5, y = 25.5) => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x,
  y,
  clockwise: true,
});
const frontier = (x, y) => ({
  id: 'frontier',
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side: 'east' },
  clockwise: true,
});
const material = (id, kind, x, y, w, h) => ({ id, kind, x, y, w, h });
const rows = [
  {
    id: 'soft-crossing',
    name: 'Soft crossing',
    spawn: [36, 0],
    departure: 'down',
    band: 3,
    coverage: 0.68,
    foundations: [{ x: 32, y: 16, w: 9, h: 3 }],
    terrain: [material('soft-band', 'slow', 24, 5, 25, 5)],
    actors: [keeper('west', 10.5, 27.5, [1, -1]), keeper('east', 60.5, 12.5), outer()],
    introduces: ['slow-field'],
    practices: [],
    bonuses: [],
    duration: [60, 130],
    decision:
      'Cross the short slow band to reach the island, or take the longer clear approach around it?',
    lesson:
      'Paired dashes slow the craft only while this ground is unclaimed. Enemies keep their catalog speed.',
    counterplay:
      'The first crossing leads to a broad return; inspect the keeper before choosing the exposed shortcut.',
    consequence:
      'Enclosing the band neutralizes its slowing effect and creates a faster future approach.',
    moment: 'A route that was slow becomes ordinary reclaimed ground after the enclosure.',
    mastery: 'Neutralize the whole slow band without losing a life.',
  },
  {
    id: 'dry-spine',
    name: 'Dry spine',
    spawn: [35, 15],
    departure: 'up',
    band: 3,
    coverage: 0.7,
    foundations: [{ x: 33, y: 8, w: 5, h: 21 }],
    terrain: [
      material('west-bed', 'slow', 8, 10, 18, 12),
      material('east-bed', 'slow', 46, 8, 17, 16),
    ],
    actors: [keeper('west', 10.5, 4.5), keeper('east', 60.5, 30.5, [-1, -1]), outer(55.5, 0.5)],
    introduces: [],
    practices: ['slow-field'],
    bonuses: [{ id: 'life-detour', kind: 'extra-life', x: 35.5, y: 26.5 }],
    duration: [65, 140],
    decision:
      'Use the central spine to enclose one slow bed first, or take a larger route around both?',
    lesson: 'Reclaimed routes stay fast even when the adjacent unclaimed approach is slow.',
    counterplay:
      'Return to either end of the spine; the optional life is not needed to complete the board.',
    consequence:
      'The first reclaimed bed determines which side offers a shorter, faster next route.',
    moment:
      'Two apparently symmetric sides offer different return distances from the interior start.',
    mastery: 'Reclaim one entire slow bed before crossing the other.',
  },
  {
    id: 'wide-approach',
    name: 'Wide approach',
    spawn: [18, 0],
    departure: 'down',
    band: 3,
    coverage: 0.72,
    foundations: [
      { x: 14, y: 16, w: 10, h: 5 },
      { x: 49, y: 10, w: 8, h: 5 },
    ],
    terrain: [material('middle-bed', 'slow', 27, 6, 18, 24)],
    actors: [
      keeper('west', 10.5, 28.5, [1, -1]),
      keeper('east', 63.5, 26.5, [-1, -1]),
      frontier(48, 12),
    ],
    introduces: [],
    practices: ['slow-field', 'frontier-patrol'],
    bonuses: [],
    duration: [70, 145],
    decision:
      'Bridge the slow center for a large enclosure, or link the landings by a longer clear route?',
    lesson:
      'A slow crossing extends trail exposure while the familiar frontier patrol keeps moving.',
    counterplay:
      'The first island is outside the slow bed; wait there and choose the next approach deliberately.',
    consequence:
      'The route both neutralizes material and changes the frontier leading to the far landing.',
    moment: 'A wide enclosure can remove a slow approach and redirect patrol pressure at once.',
    mastery: 'Link both landings without losing a life.',
  },
  {
    id: 'cool-the-crossing',
    name: 'Cool the crossing',
    spawn: [18, 0],
    departure: 'down',
    band: 3,
    coverage: 0.7,
    foundations: [
      { x: 15, y: 8, w: 7, h: 3 },
      { x: 50, y: 24, w: 7, h: 3 },
    ],
    terrain: [material('hot-bed', 'lethal', 25, 10, 20, 10)],
    actors: [keeper('west', 8.5, 28.5, [1, -1]), keeper('east', 62.5, 8.5), outer()],
    introduces: ['lethal-field'],
    practices: [],
    bonuses: [],
    duration: [65, 140],
    decision:
      'Enclose the marked central bed before crossing, or keep a longer clear path around it?',
    lesson:
      'Framed crosses harm the craft on unclaimed field. Capturing that field neutralizes the hazard.',
    counterplay: 'The first return and broad outside approaches avoid the marked bed entirely.',
    consequence:
      'A successful enclosure turns the dangerous center into a new traversable return surface.',
    moment:
      'The crossed warning disappears from earned ground without changing the underlying map rule.',
    mastery: 'Neutralize the whole central bed without visiting the far landing first.',
  },
  {
    id: 'garden-refuges',
    name: 'Garden refuges',
    spawn: [19, 0],
    departure: 'down',
    band: 4,
    coverage: 0.72,
    foundations: [
      { x: 17, y: 8, w: 5, h: 21 },
      { x: 47, y: 12, w: 8, h: 4 },
    ],
    terrain: [
      material('near-row', 'lethal', 25, 8, 5, 21),
      material('far-row', 'lethal', 37, 8, 5, 21),
    ],
    actors: [
      keeper('west', 8.5, 25.5, [1, -1]),
      keeper('east', 62.5, 25.5, [-1, -1]),
      frontier(46, 14),
    ],
    introduces: [],
    practices: ['lethal-field', 'frontier-patrol'],
    bonuses: [],
    duration: [75, 150],
    decision:
      'Neutralize the nearer row from the spine, or loop around the ends to reach the far refuge first?',
    lesson:
      'Clear lanes between lethal rows are still unclaimed field, not guaranteed return ground.',
    counterplay:
      'Use the broad upper and lower bypasses, then return to a foundation or earned ground.',
    consequence:
      'Capturing one row opens route choices without requiring the second row to be crossed.',
    moment:
      'A long protected spine offers several departures into the same changing hazard problem.',
    mastery: 'Neutralize at least one marked row and connect both refuges without losing a life.',
  },
  {
    id: 'neutral-ground',
    name: 'Neutral ground',
    spawn: [35, 19],
    departure: 'up',
    band: 4,
    coverage: 0.73,
    foundations: [
      { x: 33, y: 13, w: 5, h: 4 },
      { x: 25, y: 17, w: 21, h: 5 },
      { x: 33, y: 22, w: 5, h: 4 },
    ],
    terrain: [
      material('slow-west', 'slow', 9, 8, 16, 18),
      material('hot-east', 'lethal', 48, 9, 12, 17),
    ],
    actors: [
      keeper('west', 6.5, 29.5, [1, -1]),
      keeper('east', 65.5, 29.5, [-1, -1]),
      outer(60.5, 0.5),
      frontier(32, 15),
    ],
    introduces: [],
    practices: ['slow-field', 'lethal-field', 'frontier-patrol'],
    bonuses: [],
    duration: [80, 150],
    decision:
      'Open the slower west approach first or enclose the lethal east bed while keeping the central return?',
    lesson: 'Slow and lethal marks have different consequences; both are neutralized by capture.',
    counterplay:
      'Depart through the clear center, preserving multiple returns while watching both patrol domains.',
    consequence:
      'The first capture chooses which outer route becomes ordinary ground and reshapes patrol pressure.',
    moment: 'A reclaimed central cross makes the same board approachable from four directions.',
    mastery: 'Neutralize both beds without losing a life.',
  },
  {
    id: 'signal-remix',
    name: 'Winding channels',
    spawn: [17, 13],
    departure: 'up',
    band: 4,
    coverage: 0.75,
    foundations: [
      { x: 15, y: 10, w: 5, h: 17 },
      { x: 34, y: 16, w: 9, h: 5 },
      { x: 53, y: 8, w: 5, h: 18 },
    ],
    terrain: [
      material('soft-channel', 'slow', 24, 5, 6, 25),
      material('marked-channel', 'lethal', 44, 10, 5, 20),
    ],
    actors: [
      keeper('west', 9.5, 30.5, [1, -1]),
      keeper('east', 66.5, 28.5, [-1, -1]),
      outer(62.5, 0.5),
      frontier(52, 12),
    ],
    introduces: [],
    practices: ['slow-field', 'lethal-field', 'frontier-patrol'],
    bonuses: [{ id: 'freeze-detour', kind: 'enemy-freeze', x: 39.5, y: 28.5 }],
    duration: [90, 150],
    decision:
      'Link the near and central refuges through slow ground, or loop around the marked channel to the far landing?',
    lesson: 'Combine known terrain and patrol rules; no new mandatory mechanic is introduced.',
    counterplay:
      'The upper and lower clear approaches remain available; the freeze detour is optional.',
    consequence:
      'Connection order changes the fastest return route and which marked channel can be neutralized next.',
    moment: 'Three separated refuges become a route network through two distinct kinds of field.',
    mastery: 'Link all three refuges without collecting the optional freeze.',
  },
];

export const SIGNAL_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);

export function createSignalCandidates({ campaignTheme = false } = {}) {
  const project = createStarterProject('signal-greybox-candidates');
  project.name = 'Signal Gardens · greybox candidates';
  project.revision = campaignTheme ? 'greybox-2' : 'greybox-1';
  project.maps = [];
  project.missions = rows.map((row, index) => {
    const template = createStarterProject().missions[0];
    const map = {
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
    };
    project.maps.push(map);
    return {
      ...template,
      id: row.id,
      name: row.name,
      revision: campaignTheme ? 'greybox-2' : 'greybox-1',
      map: { id: map.id, revision: map.revision },
      actors: structuredClone(row.actors),
      bonuses: structuredClone(row.bonuses),
      coverage: row.coverage,
      // Campaign palette only; original reveal artwork is still pending.
      presentation: {
        themeId: campaignTheme ? 'signal-gardens' : 'horizon',
        backgroundAssetId: null,
      },
      design: {
        ...template.design,
        routeDecision: row.decision,
        lesson: row.lesson,
        counterplay: row.counterplay,
        captureConsequence: row.consequence,
        memorableMoment: row.moment,
        mastery: row.mastery,
        introduces: [...row.introduces],
        practices: ['enemy-seeded-closure', 'foundations', ...row.practices],
        combines: [...new Set([...row.actors.map((actor) => actor.role), ...row.practices])],
        durationSeconds: [...row.duration],
        difficulty: {
          band: row.band,
          planning: row.band,
          execution: index < 3 ? 2 : 3,
          threatDensity: row.actors.length - 1,
          timePressure: 0,
          mechanicLoad: index < 5 ? 3 : 4,
          coordination: 0,
        },
      },
    };
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'signal-gardens',
      revision: 'greybox-1',
      name: 'Signal Gardens',
      band: 3,
      missionIds: rows.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'signal-remixes',
      revision: 'greybox-1',
      name: 'Signal Remix · optional',
      band: 4,
      missionIds: ['signal-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-signal',
      revision: 'greybox-1',
      name: 'Signal Gardens candidates',
      campaignIds: ['signal-gardens'],
    },
    {
      format: 'PackDesignV1',
      id: 'signal-remixes',
      revision: 'greybox-1',
      name: 'Optional Signal Remix',
      campaignIds: ['signal-remixes'],
    },
  ];
  return project;
}
