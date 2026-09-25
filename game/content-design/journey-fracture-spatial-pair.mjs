import { createJourneyNeonSpatialPairCandidates } from './journey-neon-spatial-pair.mjs';
import { compileContentProject } from './project.mjs';

const REVISION = 'fracture-spatial-pair-1';
const rect = (x, y, w, h) => ({ x, y, w, h });

const revisions = Object.freeze({
  'bank-the-crossing': {
    actors: [
      {
        id: 'cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 64.5,
        y: 7.5,
        heading: [-1, 1],
      },
      {
        id: 'keeper',
        role: 'field-keeper',
        tier: 'measured',
        x: 8.5,
        y: 30.5,
        heading: [1, -1],
      },
      {
        id: 'upper-roamer',
        role: 'reclaimed-roamer',
        tier: 'measured',
        x: 58.5,
        y: 11.5,
        heading: [-1, 0],
      },
    ],
    walls: [
      rect(21, 7, 8, 2),
      rect(43, 7, 8, 2),
      rect(17, 11, 8, 2),
      rect(47, 11, 7, 2),
      rect(18, 23, 10, 2),
      rect(44, 23, 10, 2),
      rect(25, 27, 6, 2),
      rect(41, 27, 6, 2),
    ],
    foundations: [rect(33, 8, 6, 12), rect(28, 14, 16, 4), rect(10, 24, 8, 4), rect(54, 8, 8, 5)],
    terrain: [
      { id: 'west-tool-mat', kind: 'slow', ...rect(23, 16, 5, 7) },
      { id: 'east-tool-mat', kind: 'slow', ...rect(44, 15, 5, 8) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Connect the short center of the FPV frame jig and bank the crossing anchor from its lower arm, or establish the isolated upper equipment pad before joining its roamer network?',
      lesson:
        'Carbon-frame-inspired clamps are walls, jig pads are permanent returns, and capturing the existing anchor still protects one deterministic connection against erosion.',
      counterplay:
        'Use the central cross as a choice of four departures, but bank the anchor before the cutter reaches nearby earned territory. A side-pad approach is longer and delays enlarging the roamer domain.',
      captureConsequence:
        'The center makes the anchor a short follow-up and creates several repair approaches; the side pad provides a separate reserve until a later connection activates its roamer on the larger network.',
      memorableMoment:
        'A protected anchor path survives erosion through the frame center while an adjacent, unprotected capture can still be eaten away.',
      mastery:
        'Bank the crossing anchor from the central jig before joining the upper equipment pad, without losing a life.',
      difficulty: {
        band: 6,
        planning: 7,
        execution: 5,
        threatDensity: 4,
        timePressure: 0,
        mechanicLoad: 6,
        coordination: 0,
      },
    },
  },
  'five-anchors': {
    actors: [
      {
        id: 'west-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 8.5,
        y: 18.5,
        heading: [1, 0],
      },
      {
        id: 'east-cutter',
        role: 'territory-eroder',
        tier: 'measured',
        x: 63.5,
        y: 18.5,
        heading: [-1, 0],
      },
      {
        id: 'frontier',
        role: 'frontier-patrol',
        tier: 'measured',
        edge: { x: 33, y: 13, side: 'east' },
        clockwise: true,
      },
    ],
    walls: [
      rect(21, 6, 8, 2),
      rect(21, 8, 2, 7),
      rect(23, 14, 6, 2),
      rect(43, 6, 8, 2),
      rect(49, 8, 2, 7),
      rect(43, 14, 6, 2),
      rect(21, 20, 6, 2),
      rect(21, 22, 2, 7),
      rect(23, 29, 8, 2),
      rect(45, 20, 6, 2),
      rect(49, 22, 2, 7),
      rect(41, 29, 8, 2),
    ],
    foundations: [
      rect(34, 8, 4, 20),
      rect(29, 16, 14, 4),
      rect(12, 8, 8, 5),
      rect(52, 7, 8, 5),
      rect(12, 24, 8, 5),
      rect(52, 23, 8, 5),
    ],
    terrain: [
      { id: 'west-horn-field', kind: 'slow', ...rect(23, 8, 6, 6) },
      { id: 'east-horn-field', kind: 'slow', ...rect(43, 22, 6, 7) },
    ],
    spawn: { id: 'home', x: 35.5, y: 0.5 },
    design: {
      routeDecision:
        'Bank the western anchor through the upper ram-horn opening, or secure an eastern landing first and approach its lower anchor from the central cross?',
      lesson:
        'The horn-inspired bands are broken walls, not returns. Five permanent landings support route choice; only the two existing captured anchors protect earned connections from erosion.',
      counterplay:
        'Use the central cross to change side before the frontier patrol arrives. Enter each curled wall band through its open face and keep an uncrowded landing available for repair.',
      captureConsequence:
        'Anchor order determines which route can survive the two cutters. A corner landing changes the next useful approach without turning every island into a required chore.',
      memorableMoment:
        'One banked route remains intact inside a horn-shaped chamber while the mirrored unprotected connection is visibly eroded.',
      mastery:
        'Capture both anchors from opposite horn openings before reaching three quarters of the earned target, without losing a life.',
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

/** Fifth copy-on-write spatial batch. Candidate editions only: no route
 * enrolment, historical reinterpretation, versioning or release mutation. */
export function createJourneyFractureSpatialPairCandidates({ artwork = false } = {}) {
  const source = createJourneyNeonSpatialPairCandidates({ artwork });
  const project = structuredClone(source);
  project.id = artwork
    ? 'whole-fracture-spatial-pair-original-review'
    : 'whole-fracture-spatial-pair-greybox-review';
  project.revision = REVISION;
  project.name = 'Whole Journey · Fracture FPV jig and ram-horn spatial successors';
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
