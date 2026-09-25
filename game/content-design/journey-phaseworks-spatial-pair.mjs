import { createJourneyFractureSpatialPairCandidates } from './journey-fracture-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'phaseworks-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'two-ways-home': {
    actors: [
      {
        id: 'carrier',
        role: 'trail-pursuer',
        tier: 'measured',
        x: 15.5,
        y: 9.5,
        heading: [1, 0],
      },
      {
        id: 'keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 58.5,
        y: 26.5,
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
      rect(20, 6, 8, 2),
      rect(44, 6, 8, 2),
      rect(16, 10, 8, 2),
      rect(48, 10, 8, 2),
      rect(22, 14, 8, 2),
      rect(42, 14, 8, 2),
      rect(27, 18, 4, 7),
      rect(41, 18, 4, 7),
      rect(20, 27, 8, 2),
      rect(44, 27, 8, 2),
    ],
    foundations: [rect(33, 7, 6, 5), rect(12, 20, 8, 5), rect(52, 20, 8, 5)],
    terrain: [
      { id: 'west-w-thread', kind: 'slow', ...rect(20, 16, 7, 8) },
      { id: 'east-w-thread', kind: 'slow', ...rect(45, 16, 7, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short center landing before provoking pursuit, or follow a longer clear opening through one woven W-band to establish a side return first?',
      lesson:
        'The alternating textile-inspired bands are walls with open ends. Only the three reclaimed landings close cuts, and the pursuer still warns before committing to a finite route.',
      counterplay:
        'Read the frontier patrol before leaving the center. On a side approach, stay outside the slow thread and choose the open W-band opposite the pursuer commitment.',
      captureConsequence:
        'The center offers two symmetric but pressured follow-ups; a side landing first creates a longer alternate return and changes which band opening is useful after the frontier moves.',
      memorableMoment:
        'A visible pursuit lock toward one W opening turns the unused mirrored landing into the safe way home.',
      mastery:
        'Connect both side landings and close once while a pursuit is active, without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'dogleg-transfer': {
    actors: [
      {
        id: 'upper-carrier',
        role: 'trail-pursuer',
        tier: 'measured',
        x: 58.5,
        y: 6.5,
        heading: [-1, 0],
      },
      {
        id: 'lower-carrier',
        role: 'field-keeper',
        tier: 'measured',
        x: 54.5,
        y: 27.5,
        heading: [-1, 0],
      },
      {
        id: 'keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 8.5,
        y: 29.5,
        heading: [1, 0],
      },
    ],
    walls: [
      rect(20, 7, 9, 2),
      rect(43, 7, 8, 2),
      rect(16, 11, 8, 2),
      rect(50, 14, 6, 2),
      rect(20, 19, 9, 2),
      rect(49, 22, 7, 2),
      rect(26, 25, 5, 2),
      rect(41, 27, 6, 2),
    ],
    foundations: [
      rect(33, 8, 6, 8),
      rect(33, 12, 16, 4),
      rect(45, 14, 4, 9),
      rect(12, 27, 8, 4),
      rect(52, 9, 8, 4),
    ],
    terrain: [
      { id: 'upper-pocket', kind: 'slow', ...rect(50, 3, 10, 3) },
      { id: 'lower-pocket', kind: 'lethal', ...rect(18, 23, 6, 4) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short propeller-jig hub and use its dogleg as a pursuit screen, or establish the lower service pad before crossing the lethal pocket from outside?',
      lesson:
        'Balancing-stand-inspired rails are walls that interrupt sensing but never close cuts. The hub, dogleg and service pads are the only permanent returns.',
      counterplay:
        'Use the hub elbow to leave the carrier line of sight, wait out its finite commitment, then depart toward the nearer occupied chamber. Enclose the lethal pocket from its clear side.',
      captureConsequence:
        'The hub creates differently oriented emergency returns behind two screens; the lower pad first shortens a later outside enclosure of the lethal pocket.',
      memorableMoment:
        'A committed pursuer crosses behind one balancing rail while the craft turns around the hub and closes at a perpendicular edge.',
      mastery:
        'Close from both service pads and neutralize the lower lethal pocket after screening a pursuit, without losing a life.',
      difficulty: {
        band: 7,
        planning: 8,
        execution: 6,
        threatDensity: 5,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
});

/** Sixth copy-on-write spatial batch. Candidate editions only; default-route,
 * version, publication and historical replay behavior remain unchanged. */
export function createJourneyPhaseworksSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyFractureSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-phaseworks-spatial-pair-original-review'
    : 'whole-phaseworks-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Phaseworks woven-band and FPV jig spatial successors';
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
