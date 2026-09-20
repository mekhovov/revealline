import { createStarterProject } from './starter.mjs';
import { freezeDesign } from './catalogs.mjs';
import { BORDER_ART_CANDIDATES } from './border-art.mjs';

// Original P02 greyboxes, not released missions. Placement, pacing, artwork and
// complete routes need qualification; no reference screenshot proves actor AI.
export const BORDER_ARCS = freezeDesign([
  {
    id: 'outer-timing',
    missionIds: ['behind-the-patrol', 'second-landing', 'long-rail'],
    introduces: 'perimeter-patrol',
  },
  {
    id: 'changing-returns',
    missionIds: ['new-frontier', 'turn-the-corner', 'return-pocket'],
    introduces: 'frontier-patrol',
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
const outer = (x = 60.5, y = 0.5) => ({
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
const bonus = (kind, x, y) => ({ id: kind, kind, x, y });
const candidates = [
  {
    id: 'behind-the-patrol',
    name: 'Behind the patrol',
    spawn: [18, 0],
    band: 2,
    coverage: 0.62,
    foundations: [{ x: 16, y: 16, w: 7, h: 5 }],
    actors: [keeper('west', 8.5, 25.5, [1, -1]), keeper('east', 58.5, 12.5), outer()],
    bonuses: [],
    departure: 'down',
    introduces: ['perimeter-patrol'],
    decision:
      'Leave before the outer patrol approaches, or wait for it to pass and return behind it?',
    lesson: 'Reclaimed ground closes a cut, but the outer patrol can still hit the craft there.',
    counterplay:
      'The first island offers an interior return while the patrol stays on the outside rail.',
    consequence: 'Capturing a new inner return does not redirect the outer patrol.',
    moment: 'A return inside the board avoids a dangerous stretch of the outer rail.',
    mastery: 'Complete without touching the outer patrol.',
    duration: [45, 120],
  },
  {
    id: 'second-landing',
    name: 'Second landing',
    spawn: [15, 0],
    band: 2,
    coverage: 0.65,
    foundations: [
      { x: 10, y: 12, w: 25, h: 3 },
      { x: 50, y: 24, w: 8, h: 3 },
    ],
    actors: [keeper('west', 8.5, 25.5), keeper('east', 60.5, 8.5, [-1, 1]), outer(71.5, 13.5)],
    bonuses: [bonus('extra-life', 22.5, 12.5)],
    departure: 'down',
    introduces: [],
    decision:
      'Use the long landing to wait out a patrol pass, or bridge to the shorter far landing?',
    lesson: 'Touch the optional life pickup on reclaimed ground; enclosing it is not collection.',
    counterplay: 'Both landings offer return choices without needing the pickup.',
    consequence: 'The first bridge changes return distance while the outer route remains fixed.',
    moment: 'A deliberate detour across the landing earns a visible recovery bonus.',
    mastery: 'Use both landings before clearing.',
    duration: [60, 130],
  },
  {
    id: 'long-rail',
    name: 'Long rail',
    spawn: [35, 0],
    band: 2,
    coverage: 0.68,
    foundations: [
      { x: 33, y: 10, w: 5, h: 16 },
      { x: 15, y: 18, w: 12, h: 3 },
    ],
    actors: [keeper('west', 8.5, 8.5), keeper('east', 60.5, 23.5, [-1, -1]), outer(71.5, 25.5)],
    bonuses: [bonus('player-speed', 50.5, 0.5)],
    departure: 'down',
    introduces: [],
    decision:
      'Use the central return immediately, or detour along a broad rail for an optional speed window?',
    lesson:
      'Speed is a contact bonus with an expiry, not different handling assigned to this level.',
    counterplay:
      'The direct departure avoids acceleration; the optional pickup has a broad straight approach.',
    consequence:
      'Join the off-centre shelf to shorten later closures without changing enemy speed tiers.',
    moment: 'The same long rail becomes an optional launch route, not a compulsory sprint.',
    mastery: 'Connect the shelf and central landing without losing a life.',
    duration: [60, 140],
  },
  {
    id: 'new-frontier',
    name: 'New frontier',
    spawn: [33, 0],
    band: 2,
    coverage: 0.66,
    foundations: [{ x: 28, y: 13, w: 12, h: 8 }],
    actors: [keeper('west', 9.5, 26.5, [1, -1]), keeper('east', 61.5, 8.5), frontier(27, 16)],
    bonuses: [],
    departure: 'down',
    introduces: ['frontier-patrol'],
    decision:
      'Close ahead of the moving frontier patrol, or shape a return on the opposite side of its route?',
    lesson:
      'Unlike the outer patrol, a frontier patrol follows the changing field/reclaimed boundary.',
    counterplay:
      'The first return approaches the broad top of the island, away from the patrol on its left edge.',
    consequence:
      'A closure changes the contour that the patrol follows; it does not become a field-retaining enemy.',
    moment: 'The newly reclaimed edge becomes part of the patrol route.',
    mastery: 'Create a new frontier and depart from a different edge.',
    duration: [60, 140],
  },
  {
    id: 'turn-the-corner',
    name: 'Turn the corner',
    spawn: [30, 13],
    band: 3,
    coverage: 0.7,
    foundations: [
      { x: 18, y: 12, w: 25, h: 3 },
      { x: 18, y: 15, w: 4, h: 14 },
    ],
    actors: [keeper('west', 9.5, 24.5, [-1, -1]), keeper('east', 60.5, 20.5), frontier(17, 20)],
    bonuses: [bonus('enemy-slow', 60.5, 10.5)],
    departure: 'left',
    introduces: [],
    decision:
      'Extend the short arm to redirect contour pressure, or reach around the long arm for more ground?',
    lesson: 'Practice changing a frontier route before combining it with an outer patrol.',
    counterplay:
      'Use the broad L-shaped foundation to change approach; the optional slow pickup is not required.',
    consequence:
      'The chosen enclosure changes the contour around one arm and the next useful return.',
    moment: 'A new return draws the frontier patrol around a different side of the L.',
    mastery: 'Close from both arms without losing a life.',
    duration: [75, 150],
  },
  {
    id: 'return-pocket',
    name: 'Return pocket',
    spawn: [26, 17],
    band: 3,
    coverage: 0.71,
    foundations: [
      { x: 25, y: 10, w: 22, h: 3 },
      { x: 25, y: 24, w: 22, h: 3 },
      { x: 25, y: 13, w: 3, h: 11 },
    ],
    actors: [
      keeper('inside', 36.5, 18.5),
      keeper('outside', 60.5, 20.5, [-1, -1]),
      outer(20.5, 0.5),
      frontier(24, 22),
    ],
    bonuses: [bonus('enemy-freeze', 52.5, 20.5)],
    departure: 'right',
    introduces: [],
    decision:
      'Close the pocket mouth first or cross outward while the frontier patrol works around the other side?',
    lesson:
      'Combine distinct outer and frontier patrol routes; the optional freeze never replaces a legal return.',
    counterplay:
      'The mouth stays broad enough for a direct route without collecting the freeze pickup.',
    consequence:
      'Closing the pocket can separate keeper regions and reshape patrol pressure at the mouth.',
    moment: 'An open shelter becomes two differently threatened approaches after closure.',
    mastery: 'Use an inward and an outward return without losing a life.',
    duration: [75, 150],
  },
  {
    id: 'border-remix',
    name: 'Living border',
    spawn: [19, 12],
    band: 3,
    coverage: 0.74,
    foundations: [
      { x: 16, y: 10, w: 7, h: 6 },
      { x: 46, y: 22, w: 9, h: 5 },
      { x: 32, y: 10, w: 3, h: 16 },
    ],
    actors: [
      keeper('west', 9.5, 25.5),
      keeper('east', 61.5, 8.5, [-1, 1]),
      outer(71.5, 28.5),
      frontier(45, 24),
    ],
    bonuses: [bonus('extra-life', 50.5, 25.5), bonus('enemy-freeze', 35.5, 6.5)],
    departure: 'up',
    introduces: [],
    decision:
      'Link the nearer spine first or approach the far island before its frontier patrol comes around?',
    lesson:
      'Combine known keeper, outer-patrol and frontier-patrol rules; no new mandatory mechanic.',
    counterplay:
      'Keep an interior retreat while choosing which optional bonus detour is worth its exposure.',
    consequence:
      'Connection order changes frontier pressure; only the two field keepers retain regions.',
    moment: 'The same new bridge is a useful return and a possible future patrol edge.',
    mastery: 'Connect all three foundations without losing a life.',
    duration: [90, 150],
  },
];

export const BORDER_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(candidates.map((row) => [row.id, row.departure])),
);

export function createBorderCandidates({ artwork = false } = {}) {
  const project = createStarterProject('border-greybox-candidates');
  project.name = 'Border Bloom · greybox candidates';
  project.revision = 'greybox-2';
  if (artwork) project.assets = structuredClone(BORDER_ART_CANDIDATES);
  project.maps = [];
  project.missions = candidates.map((candidate, index) => {
    const template = createStarterProject().missions[0];
    const map = {
      format: 'MapDesignV1',
      id: `${candidate.id}-map`,
      revision: 'greybox-1',
      name: candidate.name,
      width: 72,
      height: 36,
      walls: [],
      foundations: structuredClone(candidate.foundations),
      terrain: [],
      spawns: [{ id: 'home', x: candidate.spawn[0] + 0.5, y: candidate.spawn[1] + 0.5 }],
    };
    project.maps.push(map);
    return {
      ...template,
      id: candidate.id,
      name: candidate.name,
      revision: index >= 3 ? 'greybox-2' : 'greybox-1',
      map: { id: map.id, revision: map.revision },
      actors: structuredClone(candidate.actors),
      bonuses: structuredClone(candidate.bonuses),
      coverage: candidate.coverage,
      presentation: {
        themeId: 'border-bloom',
        backgroundAssetId: artwork ? `border-${candidate.id}` : null,
      },
      design: {
        ...template.design,
        routeDecision: candidate.decision,
        lesson: candidate.lesson,
        counterplay: candidate.counterplay,
        captureConsequence: candidate.consequence,
        memorableMoment: candidate.moment,
        mastery: candidate.mastery,
        introduces: [...candidate.introduces],
        practices: [
          'enemy-seeded-closure',
          'foundations',
          ...(index > 0 && candidate.actors.some((actor) => actor.role === 'perimeter-patrol')
            ? ['perimeter-patrol']
            : []),
          ...(index > 3 ? ['frontier-patrol'] : []),
        ],
        combines:
          index >= 5
            ? ['perimeter-patrol', 'frontier-patrol', 'enemy-seeded-closure']
            : ['foundations', 'enemy-seeded-closure'],
        durationSeconds: [...candidate.duration],
        difficulty: {
          band: candidate.band,
          planning: candidate.band,
          execution: 2,
          threatDensity: candidate.actors.length - 1,
          timePressure: 0,
          mechanicLoad: index < 3 ? 2 : 3,
          coordination: 0,
        },
      },
    };
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'border-bloom',
      revision: 'greybox-1',
      name: 'Border Bloom',
      band: 2,
      missionIds: candidates.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'border-remixes',
      revision: 'greybox-1',
      name: 'Border Remix · optional',
      band: 3,
      missionIds: ['border-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-border',
      revision: 'greybox-1',
      name: 'Border Bloom candidates',
      campaignIds: ['border-bloom'],
    },
    {
      format: 'PackDesignV1',
      id: 'border-remixes',
      revision: 'greybox-1',
      name: 'Optional Border Remix',
      campaignIds: ['border-remixes'],
    },
  ];
  return project;
}
