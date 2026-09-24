import { createWholeErosionReviewCandidates } from './whole-spatial-candidates.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'ornament-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'garden-refuges': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 9.5,
        y: 25.5,
        heading: [1, -1],
      },
      {
        id: 'east',
        role: 'field-keeper',
        tier: 'measured',
        x: 62.5,
        y: 24.5,
        heading: [-1, -1],
      },
      {
        id: 'crown',
        role: 'field-keeper',
        tier: 'measured',
        x: 44.5,
        y: 5.5,
        heading: [1, 1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 28, y: 14, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(17, 8, 8, 2),
      rect(14, 10, 6, 2),
      rect(12, 12, 5, 2),
      rect(47, 8, 8, 2),
      rect(52, 10, 6, 2),
      rect(55, 12, 5, 2),
      rect(19, 23, 7, 2),
      rect(46, 23, 7, 2),
      rect(28, 31, 5, 2),
      rect(39, 31, 5, 2),
    ],
    foundations: [
      rect(34, 10, 4, 19),
      rect(29, 14, 5, 3),
      rect(38, 14, 5, 3),
      rect(24, 19, 10, 3),
      rect(38, 19, 10, 3),
      rect(28, 27, 16, 3),
    ],
    terrain: [
      { id: 'west-blossom', kind: 'lethal', ...rect(7, 15, 9, 6) },
      { id: 'east-blossom', kind: 'lethal', ...rect(56, 15, 9, 6) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the rushnyk-inspired trunk for many short returns, or circle a stepped branch first to neutralize one dangerous blossom bed?',
      lesson:
        'The Tree-of-Life-inspired return network is reclaimed ground; its stepped leaves are walls, and the marked side beds remain lethal until captured.',
      counterplay:
        'Read the crown keeper before the direct trunk approach. Use one branch as a short return, then depart on the side opposite the frontier patrol.',
      captureConsequence:
        'Joining the trunk opens several branch departures; enclosing a side bed neutralizes that hazard while keepers in the other branches still retain their regions.',
      memorableMoment:
        'A first narrow connection turns the central tree into a choice of three visibly different departures.',
      mastery:
        'Neutralize both blossom beds and close once on an upper branch without losing a life.',
      difficulty: {
        band: 4,
        planning: 5,
        execution: 4,
        threatDensity: 3,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
  'four-quarters': {
    actors: [
      {
        id: 'north-west',
        role: 'field-keeper',
        tier: 'measured',
        x: 11.5,
        y: 7.5,
        heading: [1, 1],
      },
      {
        id: 'north-east',
        role: 'field-keeper',
        tier: 'measured',
        x: 60.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'south-west',
        role: 'field-keeper',
        tier: 'measured',
        x: 10.5,
        y: 29.5,
        heading: [1, -1],
      },
      {
        id: 'south-east',
        role: 'field-keeper',
        tier: 'measured',
        x: 61.5,
        y: 28.5,
        heading: [-1, -1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 33, y: 11, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(24, 6, 7, 2),
      rect(41, 6, 7, 2),
      rect(18, 10, 7, 2),
      rect(47, 10, 7, 2),
      rect(15, 14, 6, 2),
      rect(51, 14, 6, 2),
      rect(15, 20, 6, 2),
      rect(51, 20, 6, 2),
      rect(18, 24, 7, 2),
      rect(47, 24, 7, 2),
      rect(24, 28, 7, 2),
      rect(41, 28, 7, 2),
    ],
    foundations: [
      rect(34, 8, 4, 20),
      rect(26, 16, 20, 4),
      rect(31, 13, 3, 3),
      rect(38, 13, 3, 3),
      rect(31, 20, 3, 3),
      rect(38, 20, 3, 3),
    ],
    terrain: [
      { id: 'north-west-thread', kind: 'slow', ...rect(7, 11, 7, 5) },
      { id: 'south-east-thread', kind: 'slow', ...rect(58, 20, 7, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the near point of the eight-point-star return, or circle a stepped outer ray for a larger enclosure before the frontier patrol reaches it?',
      lesson:
        'The star-inspired center is a return network, while the broken outer rays are walls. Four occupied quarters still retain independently.',
      counterplay:
        'Use the center to change launch direction. Take short closures beside the frontier patrol, or circle a wall end only when the keeper in that quarter is moving away.',
      captureConsequence:
        'A quarter capture creates new approaches around two ray ends without clearing the other keeper-held quarters; captured slow thread becomes ordinary reclaimed ground.',
      memorableMoment:
        'Closing beside one star point makes the opposite point the safer next route rather than repeating the same quadrant cut.',
      mastery:
        'Earn territory in three quarters and neutralize both slow-thread patches without losing a life.',
      difficulty: {
        band: 4,
        planning: 5,
        execution: 4,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 4,
        coordination: 0,
      },
    },
  },
});

/** Copy-on-write successor for two current Journey missions. Historical routes,
 * pictures, objectives, policy and completion identities remain untouched. */
export function createJourneyOrnamentSpatialPairCandidates({ artwork = false } = {}) {
  const source = createWholeErosionReviewCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-ornament-spatial-pair-original-review'
    : 'whole-ornament-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · two Ukrainian ornament spatial successors';
  for (const [missionId, revision] of Object.entries(revisions)) {
    const mission = project.missions.find((item) => item.id === missionId);
    const oldMap = project.maps.find(
      (item) => item.id === mission.map.id && item.revision === mission.map.revision,
    );
    const map = {
      ...oldMap,
      revision: REVISION,
      walls: revision.walls,
      foundations: revision.foundations,
      terrain: revision.terrain,
      spawns: [revision.spawn],
    };
    project.maps = project.maps.filter(
      (item) => item.id !== oldMap.id || item.revision !== oldMap.revision,
    );
    project.maps.push(map);
    Object.assign(mission, {
      revision: REVISION,
      map: { id: map.id, revision: map.revision },
      actors: revision.actors,
      design: {
        ...mission.design,
        ...revision.design,
        practices: [...new Set([...mission.design.practices, 'walls'])],
        combines: [...new Set([...mission.design.combines, 'walls'])],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns]) item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
