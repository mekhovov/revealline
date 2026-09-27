import { CURRENT_ART_SOURCES } from '../presentation/current-art-sources.mjs';
import { normalizedLevel } from '../core/level.mjs';
import { createHorizonNextBatchCandidates } from './horizon-next-batch-candidates.mjs';
import { createTeamImpactOriginalCandidates } from './team-impact-originals.mjs';
import { compileContentProject, resolveMission } from './project.mjs';

export const UNIQUENESS_PILOT_VERSION = 'revealline-uniqueness-pilot.v1';
// Review-only successors. No current default, progress ID, collection owner,
// source pack or historical factory is modified by constructing this pilot.
const CLASSIC_BRIEFS = [
  {
    id: 'illustrated-orchard',
    name: 'Orchard return lanes',
    replaces: 'original-fpv-orchard-crossing',
    decision:
      'Bank the short middle cut, then choose the upper western entrance or the lower eastern entrance to reach the required far-side marker.',
    difference:
      'Long staggered partitions create opposite entry directions; the required eastern capture prevents a near-side-only clear.',
    walls: [
      { x: 18, y: 1, w: 2, h: 24 },
      { x: 51, y: 11, w: 2, h: 24 },
    ],
    objectives: [{ id: 'east-marker', x: 61.5, y: 7.5, required: true }],
    terrain: [{ id: 'west-mud', kind: 'slow', x: 7, y: 25, w: 18, h: 3 }],
    powerups: [{ id: 'west-speed', kind: 'player-speed', x: 9.5, y: 29.5 }],
    coverage: 0.68,
    durationSeconds: [45, 100],
    artBrief:
      'A high-angle orchard loading yard: three irregular apricot terraces, a small eastern packing shed and a curved irrigation pond, with a low morning sun. No watchtower, courtyard or skyline reused from another mission.',
  },
  {
    id: 'woven-crossings',
    name: 'Woven crossing bands',
    replaces: 'original-atlas-woven-dawn',
    decision:
      'Cross the slow middle ribbon directly while the hunter is cooling, or travel around its end to approach two required markers from opposite banks.',
    difference:
      'A slow transversal and opposed target captures make return timing and approach direction matter instead of reusing Orchard Crossing’s side walls.',
    walls: [
      { x: 5, y: 10, w: 20, h: 2 },
      { x: 47, y: 23, w: 20, h: 2 },
    ],
    objectives: [
      { id: 'north-thread', x: 57.5, y: 7.5, required: true },
      { id: 'south-thread', x: 14.5, y: 28.5, required: true },
    ],
    terrain: [{ id: 'woven-ribbon', kind: 'slow', x: 25, y: 16, w: 22, h: 3 }],
    powerups: [{ id: 'east-freeze', kind: 'enemy-freeze', x: 61.5, y: 18.5 }],
    coverage: 0.62,
    durationSeconds: [55, 110],
    artBrief:
      'A river weaving workshop seen from a low upstream bank: a suspended loom, curved willow roots, hanging linen and a distant wooden footbridge. Use a new perspective and silhouette, with researched Ukrainian textile motifs rather than a recoloured orchard.',
  },
  {
    id: 'arcade-delivery',
    name: 'Last delivery circuit',
    replaces: 'original-retro-midnight-arcade',
    decision:
      'Reach the northern delivery marker first, or spend the opening detour collecting speed before committing to the southern return under a finite clock.',
    difference:
      'A two-ended delivery circuit, asymmetrical side pockets and optional speed detour replace free coverage expansion.',
    walls: [
      { x: 1, y: 10, w: 25, h: 2 },
      { x: 46, y: 24, w: 25, h: 2 },
    ],
    objectives: [
      { id: 'delivery-north', x: 59.5, y: 5.5, required: true },
      { id: 'delivery-south', x: 10.5, y: 30.5, required: true },
    ],
    terrain: [],
    powerups: [{ id: 'alley-speed', kind: 'player-speed', x: 9.5, y: 18.5 }],
    coverage: 0.55,
    timeLimitSeconds: 90,
    durationSeconds: [40, 85],
    artBrief:
      'A rain-soaked 1994 bicycle courier depot viewed from inside a repair alcove, with a red cargo bicycle, stacked parcels, an illuminated wall clock and reflected amber street lights. Avoid arcade-cabinet or train-platform compositions.',
  },
  {
    id: 'shared-branches',
    name: 'Shared market branches',
    replaces: 'original-spend-shared-harbor',
    decision:
      'Secure one side’s required exchange and expand from that return, or build a central connection first and alternate between both branches.',
    difference:
      'Four interrupted shelves create two target branches sharing a middle corridor; either side can be approached first but both must be completed.',
    walls: [
      { x: 14, y: 8, w: 18, h: 2 },
      { x: 40, y: 8, w: 18, h: 2 },
      { x: 14, y: 26, w: 18, h: 2 },
      { x: 40, y: 26, w: 18, h: 2 },
    ],
    objectives: [
      { id: 'exchange-west', x: 8.5, y: 18.5, required: true },
      { id: 'exchange-east', x: 63.5, y: 18.5, required: true },
    ],
    terrain: [{ id: 'north-delay', kind: 'slow', x: 30, y: 3, w: 12, h: 3 }],
    powerups: [{ id: 'central-freeze', kind: 'enemy-freeze', x: 36.5, y: 20.5 }],
    coverage: 0.7,
    durationSeconds: [55, 120],
    artBrief:
      'A circular community market beneath a timber canopy, seen from the central tea stall, with four distinct radial stalls, baskets and one sunlit fabric awning. No skyline, harbour or warehouse layout from the existing collection.',
  },
];

export function createClassicUniquenessPilots() {
  const original = CURRENT_ART_SOURCES.find(
    (row) => row.owner.levelId === 'orchard-crossing' && row.source.packId === 'fpv-arcade-r5',
  );
  if (!original?.level) throw new Error('The exact Pressure Lines baseline is required.');
  return CLASSIC_BRIEFS.map((brief) => {
    const level = structuredClone(original.level);
    level.id = `uniqueness-pilot-${brief.id}`;
    level.revision = 'greybox-1';
    level.name = brief.name;
    level.walls = structuredClone(brief.walls);
    Object.assign(level.enemies[1], { x: 60.5, y: 29.5 });
    Object.assign(level.enemies[2], { x: 29.5, y: 30.5 });
    level.objectives = structuredClone(brief.objectives);
    level.classic.terrain = structuredClone(brief.terrain);
    level.classic.powerups = structuredClone(brief.powerups);
    level.goal.coverage = brief.coverage;
    level.rules.timeLimitSeconds = brief.timeLimitSeconds ?? original.level.rules.timeLimitSeconds;
    delete level.musicId;
    level.metadata = {
      title: brief.name,
      description: `UNAPPROVED GREYBOX. ${brief.decision}`,
      author: 'RevealLine',
      license: 'Original project content',
      rightsStatus: 'Review-only original gameplay design; no replacement artwork commissioned.',
    };
    return {
      id: level.id,
      classification: 'tooling',
      approval: 'pending-human-playtest',
      baselineLevelId: original.level.id,
      brief: structuredClone(brief),
      level: normalizedLevel(level),
    };
  });
}

export function createHorizonVersusUniquenessPilot() {
  const current = createHorizonNextBatchCandidates({ artwork: false });
  const mission = structuredClone(current.missions.find((entry) => entry.id === 'first-return'));
  const map = structuredClone(current.maps.find((entry) => entry.id === mission.map.id));
  map.id = 'uniqueness-pilot-horizon-race-map';
  map.revision = 'greybox-1';
  map.name = 'Two-bank time trial';
  map.walls = [{ x: 27, y: 15, w: 18, h: 2 }];
  map.foundations = [
    { x: 10, y: 11, w: 7, h: 3 },
    { x: 55, y: 22, w: 7, h: 3 },
  ];
  map.spawns = [{ id: 'home', x: 12.5, y: 0.5 }];
  mission.id = 'uniqueness-pilot-horizon-race';
  mission.revision = 'greybox-1';
  mission.name = map.name;
  mission.map = { id: map.id, revision: map.revision };
  mission.modes = ['versus'];
  mission.presentation.backgroundAssetId = null;
  mission.actors = [
    {
      id: 'north-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 35.5,
      y: 8.5,
      heading: [1, 0],
    },
    {
      id: 'south-keeper',
      role: 'field-keeper',
      tier: 'measured',
      x: 36.5,
      y: 27.5,
      heading: [-1, 0],
    },
  ];
  mission.coverage = 0.62;
  mission.design = {
    ...mission.design,
    routeDecision:
      'Bank the nearby island for a reliable start, or take the longer outside return to claim a wider region before the opponent?',
    lesson:
      'A competitive time trial offers a short reliable bank and a longer high-value opening; both players receive the same course.',
    counterplay:
      'Watch the keeper above each shelf; use either foundation to shorten an unfinished cut. The middle wall never banks a line.',
    captureConsequence:
      'A conservative first enclosure creates safe staging ground; a successful longer route can overtake that head start.',
    memorableMoment:
      'The two racers reach different amounts of safe territory from different opening commitments.',
    mastery:
      'Complete the same course using both the conservative and long-return openings without losing a life.',
    introduces: ['foundations'],
    practices: ['enemy-seeded-closure'],
    combines: [],
    durationSeconds: [35, 85],
    difficulty: {
      ...mission.design.difficulty,
      band: 2,
      planning: 2,
      execution: 2,
      threatDensity: 2,
      mechanicLoad: 2,
    },
  };
  const source = {
    ...current,
    id: 'uniqueness-pilot-horizon-versus',
    revision: 'greybox-1',
    name: 'Uniqueness pilot · Horizon Versus · unapproved',
    maps: [map],
    missions: [mission],
    assets: [],
    campaigns: [
      {
        format: 'CampaignDesignV1',
        id: 'uniqueness-pilot-horizon',
        revision: 'greybox-1',
        name: 'Horizon race review',
        band: 2,
        missionIds: [mission.id],
      },
    ],
    packs: [
      {
        format: 'PackDesignV1',
        id: 'uniqueness-pilot-horizon',
        revision: 'greybox-1',
        name: 'Horizon race review',
        campaignIds: ['uniqueness-pilot-horizon'],
      },
    ],
  };
  return structuredClone(compileContentProject(source).source);
}

export function createUniquenessPilotControls(difficulty = 'standard') {
  const solo = compileContentProject(createHorizonNextBatchCandidates({ artwork: false }));
  const team = compileContentProject(createTeamImpactOriginalCandidates());
  return {
    solo: resolveMission(solo, 'first-return', { mode: 'solo', difficulty }),
    team: resolveMission(team, 'twin-landings', { mode: 'team', difficulty }),
  };
}
