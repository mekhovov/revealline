import { createJourneyRoverSpatialPairCandidates } from './journey-rover-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'neon-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'dogleg-return': {
    actors: [
      {
        id: 'lower-west',
        role: 'field-keeper',
        tier: 'measured',
        x: 9.5,
        y: 28.5,
        heading: [1, -1],
      },
      {
        id: 'upper-east',
        role: 'field-keeper',
        tier: 'measured',
        x: 62.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 32, y: 13, side: 'east' },
        clockwise: true,
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 22.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(22, 6, 8, 2),
      rect(42, 6, 8, 2),
      rect(18, 10, 7, 2),
      rect(47, 10, 7, 2),
      rect(15, 14, 6, 2),
      rect(51, 14, 6, 2),
      rect(19, 24, 8, 2),
      rect(49, 24, 6, 2),
      rect(25, 28, 7, 2),
      rect(40, 28, 7, 2),
    ],
    foundations: [
      rect(33, 8, 5, 11),
      rect(33, 17, 15, 4),
      rect(43, 20, 5, 8),
      rect(10, 20, 8, 5),
      rect(55, 8, 7, 5),
    ],
    terrain: [
      { id: 'west-hook-thread', kind: 'slow', ...rect(23, 16, 8, 5) },
      { id: 'east-hook-thread', kind: 'slow', ...rect(49, 16, 6, 5) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short upper point of the hooked central dogleg, or pass a broken outer hook to establish the east landing before the perimeter patrol arrives?',
      lesson:
        'The embroidery-inspired hooked bands are walls around a reclaimed dogleg. Slow thread remains field until enclosed and never acts as a return.',
      counterplay:
        'Use the wide elbow to change departure side after reading the frontier patrol. A longer side approach stays clear of slow thread but exposes more trail to the upper keeper.',
      captureConsequence:
        'Connecting the dogleg gives short departures on three differently oriented edges and moves frontier pressure; a side landing first preserves a quieter return beyond one hook.',
      memorableMoment:
        'The central return looks like the obvious shortcut, but its moving frontier can make the long route around a hooked wall the safer enclosure.',
      mastery:
        'Earn territory on both sides of the hooked dogleg and neutralize both slow-thread fields without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'staggered-circuit': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 7.5,
        y: 30.5,
        heading: [1, -1],
      },
      {
        id: 'center',
        role: 'field-keeper',
        tier: 'measured',
        x: 45.5,
        y: 28.5,
        heading: [-1, -1],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 51, y: 16, side: 'east' },
        clockwise: true,
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 22.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(20, 7, 9, 2),
      rect(43, 7, 8, 2),
      rect(20, 9, 2, 8),
      rect(50, 9, 2, 7),
      rect(22, 19, 8, 2),
      rect(42, 22, 8, 2),
      rect(29, 25, 5, 2),
      rect(38, 27, 5, 2),
    ],
    foundations: [rect(33, 7, 6, 5), rect(12, 14, 8, 12), rect(52, 10, 8, 13), rect(31, 29, 10, 3)],
    terrain: [
      { id: 'central-solder-mask', kind: 'slow', ...rect(33, 12, 6, 13) },
      { id: 'west-solder-mask', kind: 'slow', ...rect(22, 11, 5, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Use the short flight-controller pad and cross the slow central solder mask, or follow a clear staggered trace to the right rail before reshaping the frontier?',
      lesson:
        'FPV circuit-board-inspired traces are blocking walls with visible open ends. Copper-pad foundations close cuts; marked solder-mask field slows only exposed craft.',
      counterplay:
        'Read the frontier patrol on the right rail before committing to its long clear approach. From the controller pad, depart beside a trace end rather than repeating the same vertical cut.',
      captureConsequence:
        'A controller-pad connection offers a short but slowed central follow-up; reaching a side rail first creates an outer return and changes the useful order of the remaining traces.',
      memorableMoment:
        'Alternating trace ends turn three parallel-looking lanes into a choice between a short slowed link and a long clear enclosure.',
      mastery:
        'Join both side rails to the controller pad and neutralize both solder-mask fields without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
});

/** Fourth copy-on-write spatial batch. It creates review candidates only and
 * deliberately leaves default-route enrolment and historical editions alone. */
export function createJourneyNeonSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyRoverSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-neon-spatial-pair-original-review'
    : 'whole-neon-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Neon hooked-dogleg and FPV circuit spatial successors';
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
        practices: [...new Set([...mission.design.practices, 'walls', 'slow-field'])],
        combines: [...new Set([...mission.design.combines, 'walls', 'slow-field'])],
      },
    });
  }
  for (const item of [...project.packs, ...project.campaigns]) item.revision = REVISION;
  return structuredClone(compileContentProject(project).source);
}
