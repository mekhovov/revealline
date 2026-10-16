import { freezeDesign } from './catalogs.mjs';
import { createNeonCulturalRoutesFinaleCandidates } from './neon-cultural-routes-finale-candidates.mjs';

export const ROVER_CULTURAL_ROUTES_REVISION = 'rover-cultural-routes-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const ROVER_CULTURAL_ROUTES_SOURCES = freezeDesign({
  reshetylivkaWhitework: {
    institution: 'Regional Centre for the Safeguarding of Intangible Cultural Heritage',
    record: 'White on White technique of embroidery of Reshetylivka',
    region: 'Reshetylivka, Poltava region',
    url: 'https://www.unesco-centerbg.org/en/2021/11/22/white-on-white-technique-of-embroidery-of-reshetylivka/',
    observedVocabulary: [
      'geometric and floral merezhka compositions',
      'cutwork formed from one, three, five or more square holes',
      'light-and-dark relief produced without relying on colour',
    ],
    adaptationBoundary:
      'An original open-window route borrows alternating solid and cut-out spacing only. No embroidery, stitch chart, motif, palette, meaning or source coordinates are copied.',
  },
  kosivCeramics: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Tradition of Kosiv painted ceramics',
    region: 'Kosiv and the Hutsul community',
    url: 'https://ich.unesco.org/en/RL/tradition-of-kosiv-painted-ceramics-01456',
    observedVocabulary: [
      'graphical contour drawing formed before colour is applied',
      'figurative compositions connected to Hutsul history and community life',
      'practical objects organized through bordered painted fields',
    ],
    adaptationBoundary:
      'An original pair of unequal framed fields borrows contour-and-border organization only. No figure, object, story, palette, ornament, belief, custom or source coordinates are copied or turned into a target.',
  },
  petrykivkaPainting: {
    institution: 'UNESCO Intangible Cultural Heritage',
    record: 'Petrykivka decorative painting as Ukrainian ornamental folk art',
    region: 'Petrykivka, Dnipropetrovsk region',
    url: 'https://ich.unesco.org/en/RL/petrykivka-decorative-painting-as-a-phenomenon-of-the-ukrainian-ornamental-folk-art-00893',
    observedVocabulary: [
      'imaginary flowers and other natural elements',
      'compositions informed by close observation of local flora and fauna',
      'ornamental painting applied to homes, objects and musical instruments',
    ],
    adaptationBoundary:
      'An original branching return network borrows broad clustered-and-branching composition only. No flower, bird, animal, object, palette, symbol, meaning or source coordinates are copied or used as enemy silhouettes.',
  },
});

export const ROVER_CULTURAL_ROUTES_SELECTIONS = freezeDesign([
  {
    id: 'wake-the-yard',
    disposition: 'reshetylivka-open-cutwork-yard',
    sourceIds: ['reshetylivkaWhitework'],
    approaches: ['central-window-first', 'east-window-first'],
    pressurePoints: ['upper-cutwork', 'central-roamer', 'east-window', 'lower-gap'],
  },
  {
    id: 'between-the-rows',
    disposition: 'kosiv-unequal-contour-panels',
    sourceIds: ['kosivCeramics'],
    approaches: ['west-panel-first', 'east-panel-first'],
    pressurePoints: ['west-panel', 'middle-roamer', 'slow-contour', 'east-frontier'],
  },
  {
    id: 'rover-remix',
    disposition: 'petrykivka-branching-return-clusters',
    sourceIds: ['petrykivkaPainting'],
    approaches: ['central-branch-first', 'outer-cluster-first'],
    pressurePoints: ['central-branch', 'west-roamer', 'east-roamer', 'outer-cluster'],
  },
]);

const revisions = Object.freeze({
  'wake-the-yard': {
    actors: [
      { id: 'west', role: 'field-keeper', tier: 'measured', x: 8.5, y: 28.5, heading: [1, -1] },
      { id: 'east', role: 'field-keeper', tier: 'measured', x: 63.5, y: 28.5, heading: [-1, -1] },
      {
        id: 'sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 35.5,
        y: 15.5,
        heading: [0, 1],
      },
    ],
    walls: [
      rect(18, 7, 8, 2),
      rect(46, 7, 8, 2),
      rect(15, 12, 7, 2),
      rect(50, 12, 7, 2),
      rect(18, 23, 8, 2),
      rect(46, 23, 8, 2),
      rect(26, 28, 6, 2),
      rect(40, 28, 6, 2),
    ],
    foundations: [rect(32, 8, 8, 5), rect(34, 13, 4, 10), rect(53, 14, 8, 5), rect(11, 18, 8, 5)],
    terrain: [{ id: 'cutwork-shadow', kind: 'slow', ...rect(42, 14, 6, 7) }],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Close the short central cutwork window and wake its roamer, or pass the offset square openings to establish the east window first?',
      lesson:
        'Reshetylivka-cutwork-inspired openings are formed from walls and empty field. Only reclaimed foundations close a cut, and waking a roamer changes the value of the central return.',
      counterplay:
        'The central stem is short but becomes contested after activation. The east window costs a longer exposed route and leaves a separate escape beyond the roamer network.',
      captureConsequence:
        'Central-first play creates several short departures under roamer pressure; east-first play preserves an independent landing before the hub is connected.',
      memorableMoment:
        'A light-and-dark cutwork rhythm turns the shortest connection into the return that becomes dangerous first.',
      mastery:
        'Activate the central roamer, then close at both an outer window and the central stem without losing a life.',
      difficulty: {
        band: 5,
        planning: 5,
        execution: 4,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'between-the-rows': {
    actors: [
      { id: 'west', role: 'field-keeper', tier: 'measured', x: 7.5, y: 29.5, heading: [1, -1] },
      { id: 'east', role: 'field-keeper', tier: 'measured', x: 64.5, y: 30.5, heading: [-1, -1] },
      {
        id: 'middle-roamer',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 36.5,
        y: 14.5,
        heading: [0, 1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 51, y: 14, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(11, 7, 12, 2),
      rect(11, 25, 12, 2),
      rect(11, 9, 2, 6),
      rect(21, 19, 2, 6),
      rect(49, 9, 12, 2),
      rect(49, 27, 12, 2),
      rect(59, 11, 2, 6),
      rect(49, 21, 2, 6),
    ],
    foundations: [rect(14, 9, 7, 14), rect(33, 8, 7, 15), rect(52, 13, 7, 14), rect(27, 26, 18, 3)],
    terrain: [
      { id: 'west-contour-wash', kind: 'slow', ...rect(24, 12, 5, 10) },
      { id: 'east-contour-wash', kind: 'slow', ...rect(43, 14, 5, 10) },
    ],
    spawn: { id: 'home', x: 17.5, y: 0.5 },
    design: {
      routeDecision:
        'Take the short west contour panel, or cross the clear upper field to reach the east panel before its frontier patrol returns?',
      lesson:
        'Kosiv-ceramic-inspired contour frames remain gameplay abstractions: walls block, slow washes affect exposed craft, and the middle foundation supports reclaimed-ground pressure.',
      counterplay:
        'The west panel closes quickly but points toward the central roamer. The east panel is a longer opening; enter just after the frontier leaves its upper shoulder.',
      captureConsequence:
        'West-first play establishes a short route toward the centre. East-first play reshapes frontier pressure and preserves a separate return beyond the slow contour.',
      memorableMoment:
        'Two unequal framed fields ask for different timing without turning Hutsul figures or stories into targets.',
      mastery:
        'Join both contour panels to the middle return and neutralize both slow washes without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'rover-remix': {
    actors: [
      { id: 'west', role: 'field-keeper', tier: 'measured', x: 6.5, y: 31.5, heading: [1, -1] },
      { id: 'east', role: 'field-keeper', tier: 'measured', x: 65.5, y: 5.5, heading: [-1, 1] },
      {
        id: 'west-sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 18.5,
        y: 18.5,
        heading: [1, 0],
      },
      {
        id: 'east-sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 54.5,
        y: 18.5,
        heading: [-1, 0],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 32, y: 9, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(22, 7, 7, 2),
      rect(43, 7, 7, 2),
      rect(14, 11, 6, 2),
      rect(52, 11, 6, 2),
      rect(22, 25, 7, 2),
      rect(43, 25, 7, 2),
      rect(31, 29, 4, 2),
      rect(37, 29, 4, 2),
    ],
    foundations: [
      rect(33, 7, 7, 5),
      rect(34, 12, 5, 15),
      rect(12, 16, 12, 5),
      rect(48, 16, 12, 5),
      rect(8, 26, 8, 4),
      rect(56, 6, 8, 4),
    ],
    terrain: [
      { id: 'west-branch-shadow', kind: 'lethal', ...rect(25, 14, 5, 8) },
      { id: 'east-branch-shadow', kind: 'lethal', ...rect(42, 14, 5, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short central branch and release pressure onto it, or take the long upper route to the far outer cluster before joining either sleeper?',
      lesson:
        'A Petrykivka-informed branching composition combines known roles only: clustered returns, retained field, hazardous gaps, frontier pressure and two reclaimed-ground roamers.',
      counterplay:
        'The central branch offers several exits but becomes shared roamer ground. The far cluster costs more exposed trail and keeps one outer escape disconnected until needed.',
      captureConsequence:
        'Central-first play shortens later cuts while enlarging both roamer domains after connection. Outer-first play banks a remote reserve and changes which hazardous gap is worth neutralizing.',
      memorableMoment:
        'A broad ornamental branching rhythm makes the useful central route and the safer detached cluster visibly compete.',
      mastery:
        'Join both side clusters through the central branch, activate both roamers and neutralize both lethal gaps without losing a life.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 5,
        threatDensity: 6,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor to v17. Existing identities, policy, catalogues,
 * objectives, bonuses and art stay exact; only the three unowned Rover maps,
 * spawn placement and actor attachment change with their new spatial topology. */
export function createRoverCulturalRoutesCandidates({ artwork = false } = {}) {
  const before = createNeonCulturalRoutesFinaleCandidates({ artwork });
  const project = structuredClone(before);
  project.id = artwork
    ? 'whole-rover-cultural-routes-original-review'
    : 'whole-rover-cultural-routes-greybox-review';
  project.name = 'Whole Journey · Rover Ukrainian cultural routes';
  project.revision = ROVER_CULTURAL_ROUTES_REVISION;

  for (const selection of ROVER_CULTURAL_ROUTES_SELECTIONS) {
    const mission = project.missions.find((item) => item.id === selection.id);
    const priorMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const revision = revisions[selection.id];
    const nextMap = structuredClone(priorMap);
    Object.assign(nextMap, {
      revision: ROVER_CULTURAL_ROUTES_REVISION,
      walls: structuredClone(revision.walls),
      foundations: structuredClone(revision.foundations),
      terrain: structuredClone(revision.terrain),
      spawns: [structuredClone(revision.spawn)],
    });
    project.maps = project.maps.filter(
      (item) => item.id !== priorMap.id || item.revision !== priorMap.revision,
    );
    project.maps.push(nextMap);
    Object.assign(mission, {
      revision: ROVER_CULTURAL_ROUTES_REVISION,
      map: { id: nextMap.id, revision: nextMap.revision },
      actors: structuredClone(revision.actors),
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }

  const owningCampaignIds = new Set(
    project.campaigns
      .filter((campaign) => campaign.missionIds.some((id) => revisions[id]))
      .map((campaign) => campaign.id),
  );
  for (const campaign of project.campaigns)
    if (owningCampaignIds.has(campaign.id)) campaign.revision = ROVER_CULTURAL_ROUTES_REVISION;
  for (const pack of project.packs)
    if (pack.campaignIds.some((id) => owningCampaignIds.has(id)))
      pack.revision = ROVER_CULTURAL_ROUTES_REVISION;
  return structuredClone(project);
}
