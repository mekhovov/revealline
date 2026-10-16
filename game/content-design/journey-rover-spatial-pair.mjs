import { createJourneyCrosswindSpatialPairCandidates } from './journey-crosswind-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'rover-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

export const JOURNEY_ROVER_SPATIAL_PAIR_REVISIONS = Object.freeze({
  'split-berths': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 9.5,
        y: 28.5,
        heading: [1, -1],
      },
      {
        id: 'east',
        role: 'field-keeper',
        tier: 'measured',
        x: 62.5,
        y: 27.5,
        heading: [-1, -1],
      },
      {
        id: 'near-sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 35.5,
        y: 9.5,
        heading: [1, 0],
      },
      {
        id: 'far-sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 52.5,
        y: 18.5,
        heading: [-1, 0],
      },
    ],
    walls: [
      rect(13, 9, 4, 2),
      rect(23, 9, 4, 2),
      rect(13, 11, 2, 7),
      rect(25, 11, 2, 7),
      rect(45, 9, 4, 2),
      rect(55, 9, 4, 2),
      rect(45, 11, 2, 7),
      rect(57, 11, 2, 7),
      rect(21, 23, 9, 2),
      rect(42, 23, 9, 2),
    ],
    foundations: [rect(33, 7, 6, 5), rect(15, 16, 10, 4), rect(47, 16, 10, 4), rect(31, 27, 10, 3)],
    terrain: [{ id: 'cable-tray', kind: 'slow', ...rect(33, 12, 6, 12) }],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short central flight-controller pad and wake its nearby roamer, or take a long clear approach through one split battery berth before joining the workbench?',
      lesson:
        'FPV-component-inspired brackets are walls, battery pads are reclaimed returns, and the marked cable tray slows only the craft while it remains unclaimed.',
      counterplay:
        'Read the keeper below the workbench before using its short approach. A side berth costs more exposed trail but delays enlarging the central roamer network.',
      captureConsequence:
        'Joining the central pad opens several short departures through the cable tray but activates the nearby roamer; a side berth first creates a quieter lateral return.',
      memorableMoment:
        'The visually shortest component connection wakes pressure on the useful hub, while the longer battery-bay route changes which return is safest next.',
      mastery:
        'Connect both battery berths and the central workbench after activating a roamer, without losing a life.',
      difficulty: {
        band: 5,
        planning: 6,
        execution: 4,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 5,
        coordination: 0,
      },
    },
  },
  'stepped-return': {
    actors: [
      {
        id: 'west',
        role: 'field-keeper',
        tier: 'measured',
        x: 8.5,
        y: 28.5,
        heading: [1, -1],
      },
      {
        id: 'east',
        role: 'field-keeper',
        tier: 'measured',
        x: 63.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'sleeper',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 35.5,
        y: 18.5,
        heading: [0, 1],
      },
      {
        id: 'outer',
        role: 'perimeter-patrol',
        tier: 'measured',
        x: 71.5,
        y: 25.5,
        clockwise: true,
      },
    ],
    walls: [
      rect(19, 7, 9, 2),
      rect(44, 7, 9, 2),
      rect(17, 12, 6, 2),
      rect(49, 12, 6, 2),
      rect(18, 23, 7, 2),
      rect(47, 23, 7, 2),
      rect(24, 28, 6, 2),
      rect(42, 28, 6, 2),
    ],
    foundations: [
      rect(34, 8, 4, 4),
      rect(30, 12, 12, 4),
      rect(27, 16, 18, 4),
      rect(30, 20, 12, 4),
      rect(34, 24, 4, 4),
      rect(10, 17, 7, 4),
      rect(55, 17, 7, 4),
    ],
    terrain: [
      { id: 'west-bead-field', kind: 'slow', ...rect(22, 14, 5, 7) },
      { id: 'east-bead-field', kind: 'slow', ...rect(45, 15, 5, 7) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Take the short point of the stepped central diamond and accept its roamer pressure, or pass an alternating lattice opening to establish a side return first?',
      lesson:
        'The gerdan-inspired diagonal rhythm is built from blocking wall bands around a reclaimed stepped diamond; the side bead fields slow only exposed craft.',
      counterplay:
        'Use the widening diamond to change departure side before the roamer reaches the chosen edge. Approach a side landing through the open end of a band, not through its slow bead field.',
      captureConsequence:
        'Connecting the diamond creates several differently sized launch edges for the roamer to contest; a side connection neutralizes one bead field and offers an escape beyond it.',
      memorableMoment:
        'The central stepped return becomes a moving timing puzzle while the alternating wall openings make the two side approaches genuinely unequal.',
      mastery:
        'Close from both sides of the central diamond and neutralize both bead fields without losing a life.',
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

/** Third copy-on-write spatial batch, intentionally stacked on the prior pairs.
 * It creates candidate editions only; route enrolment remains a separate review. */
export function createJourneyRoverSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyCrosswindSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-rover-spatial-pair-original-review'
    : 'whole-rover-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Rover FPV and Ukrainian lattice spatial successors';
  for (const [missionId, revision] of Object.entries(JOURNEY_ROVER_SPATIAL_PAIR_REVISIONS)) {
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
