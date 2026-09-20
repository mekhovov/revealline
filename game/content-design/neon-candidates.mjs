import { createStarterProject } from './starter.mjs';
import { freezeDesign } from './catalogs.mjs';
import { NEON_ART_CANDIDATES } from './neon-art.mjs';

// Original spatial hypotheses, not released missions. No new mandatory rule or
// actor speed tier: this campaign develops already-taught frontier decisions.
export const NEON_ARCS = freezeDesign([
  {
    id: 'choose-the-contour',
    missionIds: ['folded-corner', 'inside-out', 'four-quarters'],
    introduces: null,
  },
  {
    id: 'reshape-the-return',
    missionIds: ['side-door-bays', 'dogleg-return', 'staggered-circuit'],
    introduces: null,
  },
]);
const rect = (x, y, w, h) => ({ x, y, w, h });
const keeper = (id, x, y, heading = [1, 1]) => ({
  id,
  role: 'field-keeper',
  tier: 'measured',
  x,
  y,
  heading,
});
const frontier = (id, x, y, side = 'east', clockwise = true) => ({
  id,
  role: 'frontier-patrol',
  tier: 'measured',
  edge: { x, y, side },
  clockwise,
});
const outer = () => ({
  id: 'outer',
  role: 'perimeter-patrol',
  tier: 'measured',
  x: 71.5,
  y: 22.5,
  clockwise: true,
});
// Interrupted rings stay field-connected through broad six-cell mouths. A ring
// is made from normal foundation rectangles, not a new surface or capture rule.
const openRing = (x, y) => [
  rect(x, y, 14, 3),
  rect(x, y + 11, 14, 3),
  rect(x, y + 3, 3, 8),
  rect(x + 11, y + 3, 3, 1),
  rect(x + 11, y + 10, 3, 1),
];
const rows = [
  {
    id: 'folded-corner',
    name: 'Folded corner',
    reference: 'xposed-pack-1-level-09',
    band: 4,
    spawn: [23, 0],
    departure: 'down',
    coverage: 0.72,
    foundations: [rect(20, 11, 7, 16), rect(27, 22, 22, 5)],
    terrain: [],
    actors: [
      keeper('west', 9.5, 28.5, [1, -1]),
      keeper('east', 60.5, 8.5, [-1, 1]),
      frontier('frontier', 19, 18),
    ],
    decision:
      'Close a short cut at the elbow, or use the long arm to redirect the frontier before the next departure?',
    lesson:
      'A frontier patrol follows the changed field edge; its speed does not increase when the route gets shorter.',
    counterplay:
      'Watch the marked patrol, return to the broad elbow, and keep the outside approach available.',
    consequence:
      'Filling beside one arm removes old edges and changes the patrol route around the other.',
    moment:
      'The same L-shaped return becomes a different departure after its inside corner is captured.',
    mastery: 'Connect both ends of the elbow to the outer perimeter without losing a life.',
    duration: [70, 140],
  },
  {
    id: 'inside-out',
    name: 'Inside out',
    revision: 'greybox-2',
    reference: 'xposed-pack-1-level-11',
    band: 4,
    spawn: [32, 9],
    departure: 'up',
    coverage: 0.73,
    foundations: openRing(27, 8),
    terrain: [],
    actors: [
      keeper('inside', 34.5, 15.5, [0, 1]),
      keeper('outside', 60.5, 28.5, [-1, -1]),
      // Keep the lower approach occupied while the upper keeper travels toward
      // the ring. The original two-keeper edition exposed a two-cut 10.75s clear.
      keeper('lower-approach', 12.5, 28.5, [1, 0]),
      frontier('frontier', 26, 15),
    ],
    decision:
      'Close the mouth around the inner keeper first, or grow an outside return while the ring remains open?',
    lesson:
      'Closing a ring does not fill an occupied center. The keeper, not the visible loop, determines retained field.',
    counterplay:
      'Use the broad ring as a return; compare the inner keeper, lower approach keeper and outer contour before crossing.',
    consequence:
      'A mouth closure may secure only the connecting line; an outside enclosure can instead move patrol pressure.',
    moment:
      'A visually closed ring can still contain unclaimed ground, with its retaining enemy plainly visible.',
    mastery:
      'Earn a closure through the ring mouth and connect the ring to the perimeter without losing a life.',
    duration: [75, 145],
  },
  {
    id: 'four-quarters',
    name: 'Four quarters',
    reference: 'xposed-pack-2-level-02',
    band: 4,
    spawn: [25, 17],
    departure: 'up',
    coverage: 0.72,
    foundations: [rect(28, 1, 5, 34), rect(1, 15, 70, 5)],
    terrain: [],
    actors: [
      keeper('north-west', 10.5, 6.5),
      keeper('north-east', 58.5, 6.5, [-1, 1]),
      keeper('south-west', 10.5, 28.5, [1, -1]),
      keeper('south-east', 58.5, 28.5, [-1, -1]),
      frontier('frontier', 27, 8),
    ],
    decision:
      'Start with a small near quadrant, or use the spacious cross to tackle the larger region while its keeper is distant?',
    lesson:
      'Each occupied chamber retains its own field. Permanent cross lanes provide returns but do not earn coverage.',
    counterplay:
      'Reposition along the broad cross; the four field keepers cannot leave their starting chambers without a field connection.',
    consequence:
      'A completed chamber contributes earned territory without automatically clearing the other occupied chambers.',
    moment:
      'The same central crossing lets the player choose the order of unequal spatial problems.',
    mastery: 'Make captures in three different starting chambers without losing a life.',
    duration: [80, 150],
  },
  {
    id: 'side-door-bays',
    name: 'Side-door bays',
    reference: 'xposed-pack-1-level-06',
    band: 4,
    spawn: [11, 0],
    departure: 'down',
    coverage: 0.73,
    foundations: [...openRing(7, 8), ...openRing(28, 15), ...openRing(50, 6)],
    terrain: [],
    actors: [
      keeper('west', 12.5, 15.5),
      keeper('east', 56.5, 12.5, [-1, 1]),
      frontier('near-frontier', 6, 14),
      frontier('far-frontier', 49, 12, 'east', false),
    ],
    decision:
      'Bridge the nearby bays for several returns, or approach the distant bay before its frontier patrol arrives?',
    lesson:
      'An open mouth is unclaimed field, not a safe doorway. Closing it changes both retention and contour connections.',
    counterplay:
      'Every mouth is broad; use outside routes instead of following a patrol through a narrow return.',
    consequence:
      'Connecting two bays can make one useful return network while the remaining bay stays a separate route choice.',
    moment:
      'Three interrupted contours can be joined in different orders without clearing five repetitive boxes.',
    mastery: 'Connect all three bay foundations without losing a life.',
    duration: [80, 150],
  },
  {
    id: 'dogleg-return',
    name: 'Dogleg return',
    reference: 'xposed-pack-2-level-08',
    band: 5,
    spawn: [34, 17],
    departure: 'up',
    coverage: 0.74,
    foundations: [rect(21, 1, 5, 16), rect(21, 15, 30, 5), rect(46, 19, 5, 16)],
    terrain: [{ id: 'upper-slow', kind: 'slow', x: 33, y: 6, w: 15, h: 4 }],
    actors: [
      keeper('lower-west', 9.5, 28.5, [1, -1]),
      keeper('upper-east', 62.5, 7.5, [-1, 1]),
      frontier('frontier', 20, 9),
      outer(),
    ],
    decision:
      'Enclose beside the short bend, or use the long dogleg to leave the patrol on the opposite side?',
    lesson:
      'A connected foundation can separate occupied field regions while frontier and perimeter patrols keep distinct routes.',
    counterplay:
      'Use the wide central bend to change approach, and neutralize the optional slow patch before a longer crossing.',
    consequence:
      'A capture beside the bend changes the next frontier without changing the permanent return or denominator.',
    moment: 'A route that looks long on the board can be the shorter exposed trail.',
    mastery:
      'Earn territory on both sides of the dogleg and neutralize the slow patch without losing a life.',
    duration: [85, 150],
  },
  {
    id: 'staggered-circuit',
    name: 'Staggered circuit',
    reference: 'xposed-pack-3-level-06',
    band: 5,
    spawn: [17, 0],
    departure: 'down',
    coverage: 0.75,
    foundations: [rect(14, 8, 6, 21), rect(33, 1, 5, 23), rect(53, 11, 6, 24)],
    terrain: [{ id: 'middle-slow', kind: 'slow', x: 24, y: 12, w: 5, h: 12 }],
    actors: [
      keeper('west', 7.5, 30.5, [1, -1]),
      keeper('center', 45.5, 28.5, [-1, -1]),
      frontier('frontier', 13, 17),
      outer(),
    ],
    decision:
      'Alternate the broad top and bottom connections, or take a slow central link to reshape the frontier sooner?',
    lesson:
      'Staggered return lanes reward planning the next departure, not just reaching the nearest reclaimed cell.',
    counterplay:
      'The upper and lower gaps stay wide; wait on a foundation and choose the side away from patrol pressure.',
    consequence:
      'A bridge between lanes creates a new return and can move the contour across the next intended approach.',
    moment:
      'One diagonal-looking route is executed as clear orthogonal cuts between staggered platforms.',
    mastery: 'Join all three return lanes without losing a life.',
    duration: [85, 150],
  },
  {
    id: 'neon-remix',
    name: 'Three open circuits',
    reference: 'xposed-pack-4-level-02',
    band: 5,
    spawn: [13, 8],
    departure: 'up',
    coverage: 0.76,
    foundations: [...openRing(8, 7), ...openRing(29, 16), ...openRing(50, 7)],
    terrain: [
      { id: 'slow-bridge', kind: 'slow', x: 24, y: 12, w: 4, h: 12 },
      { id: 'hot-bridge', kind: 'lethal', x: 45, y: 12, w: 3, h: 10 },
    ],
    actors: [
      keeper('west', 14.5, 13.5),
      keeper('east', 56.5, 13.5, [-1, 1]),
      frontier('near-frontier', 7, 13),
      frontier('far-frontier', 49, 13, 'east', false),
      outer(),
    ],
    decision:
      'Connect the three rings along the long clear outside, or neutralize the marked bridges to form a shorter return circuit?',
    lesson:
      'Known slow, lethal, field-retention and frontier rules combine; the rings do not introduce a new surface.',
    counterplay:
      'Use broad outside bypasses, choose one patrol at a time, and capture marked field before treating it as return ground.',
    consequence:
      'A successful bridge can neutralize terrain, join foundations and redirect a patrol in the same capture.',
    moment:
      'Three broken circuits become one readable reclaimed network through a chosen sequence of cuts.',
    mastery: 'Connect all three rings and neutralize both marked bridges without losing a life.',
    duration: [100, 150],
  },
];

export const NEON_REFERENCE_ADAPTATIONS = freezeDesign(
  rows.map((row) => ({
    reference: row.reference,
    missionId: row.id,
    decision: 'redesign',
    final: false,
    reason: row.decision,
  })),
);
export const NEON_FIRST_RETURNS = freezeDesign(
  Object.fromEntries(rows.map((row) => [row.id, row.departure])),
);
export function createNeonCandidates({ artwork = false } = {}) {
  const project = createStarterProject('neon-greybox-candidates');
  project.name = 'Neon Contours · greybox candidates';
  project.revision = 'greybox-1';
  project.maps = [];
  project.assets = artwork ? structuredClone(NEON_ART_CANDIDATES) : [];
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
      revision: row.revision ?? 'greybox-1',
      map: { id: map.id, revision: map.revision },
      actors: structuredClone(row.actors),
      bonuses: [],
      coverage: row.coverage,
      presentation: {
        themeId: 'horizon',
        backgroundAssetId: artwork ? `neon-pixel-${row.id}` : null,
      },
      design: {
        ...template.design,
        routeDecision: row.decision,
        lesson: row.lesson,
        counterplay: row.counterplay,
        captureConsequence: row.consequence,
        memorableMoment: row.moment,
        mastery: row.mastery,
        introduces: [],
        practices: ['enemy-seeded-closure', 'foundations', 'frontier-patrol'],
        combines: [
          'enemy-seeded-closure',
          'foundations',
          'frontier-patrol',
          ...(row.terrain.length ? ['slow-field'] : []),
          ...(row.id === 'neon-remix' ? ['lethal-field'] : []),
          ...(row.actors.some((actor) => actor.role === 'perimeter-patrol')
            ? ['perimeter-patrol']
            : []),
        ],
        durationSeconds: row.duration,
        difficulty: {
          band: row.band,
          planning: row.band,
          execution: 3,
          threatDensity: row.actors.length - 1,
          timePressure: 0,
          mechanicLoad: index < 4 ? 3 : 4,
          coordination: 0,
        },
      },
    };
  });
  project.campaigns = [
    {
      format: 'CampaignDesignV1',
      id: 'neon-contours',
      revision: 'greybox-1',
      name: 'Neon Contours',
      band: 4,
      missionIds: rows.slice(0, 6).map((row) => row.id),
    },
    {
      format: 'CampaignDesignV1',
      id: 'neon-remixes',
      revision: 'greybox-1',
      name: 'Neon Remix · optional',
      band: 5,
      missionIds: ['neon-remix'],
    },
  ];
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'journey-neon',
      revision: 'greybox-1',
      name: 'Neon Contours candidates',
      campaignIds: ['neon-contours'],
    },
    {
      format: 'PackDesignV1',
      id: 'neon-remixes',
      revision: 'greybox-1',
      name: 'Optional Neon Remix',
      campaignIds: ['neon-remixes'],
    },
  ];
  return project;
}
