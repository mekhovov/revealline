import { createRoverTeachingCandidates } from './rover-teaching-candidates.mjs';
import { withPressureDifficulty } from './pressure-candidates.mjs';
import { compileContentProject } from './project.mjs';

// Explicit candidate edition. Preserve earlier maps, replays and navigation;
// use shared pressure tiers, never per-map physics or a compulsory waiting gate.
export function createRoverSpatialCandidates({ artwork = false } = {}) {
  const project = withPressureDifficulty(createRoverTeachingCandidates({ artwork }));
  project.id = 'rover-sorting-spatial-review';
  project.name = 'Rover Yard · contested sorting lanes review';
  project.revision = 'sorting-spatial-1';
  const mission = project.missions.find((item) => item.id === 'sorting-yard');
  const map = project.maps.find((item) => item.id === mission.map.id);
  map.revision = mission.revision = mission.map.revision = 'sorting-spatial-1';
  // Retain the broad shared spine and its two perpendicular returns. Opposite
  // baffles make the ends of those returns useful for dogleg approaches.
  map.walls = [
    { x: 8, y: 8, w: 10, h: 2 },
    { x: 28, y: 3, w: 2, h: 10 },
    { x: 42, y: 23, w: 2, h: 10 },
    { x: 54, y: 26, w: 10, h: 2 },
  ];
  Object.assign(
    mission.actors.find((item) => item.id === 'north-sleeper'),
    { x: 22.5, y: 7.5, heading: [0, 1] },
  );
  Object.assign(
    mission.actors.find((item) => item.id === 'south-sleeper'),
    { x: 50.5, y: 27.5, heading: [0, -1] },
  );
  mission.actors.push(
    { id: 'north-pocket', role: 'field-keeper', tier: 'measured', x: 7.5, y: 5.5, heading: [1, 1] },
    {
      id: 'south-pocket',
      role: 'field-keeper',
      tier: 'measured',
      x: 64.5,
      y: 30.5,
      heading: [-1, -1],
    },
  );
  mission.design.routeDecision =
    'Take a broad outer slice, use a stub return around its baffle, or switch chambers before a roamer meets your landing?';
  mission.design.lesson =
    'The two roamer lanes warn from the start. Each field chamber has two retaining keepers, so separating occupied pockets may bank only the trail.';
  mission.design.counterplay =
    'Keep the centre of the broad spine available. Approach either side of a stub after reading its roamer; walls block movement and never close a cut.';
  mission.design.captureConsequence =
    'A modest return can establish a new approach around a baffle without erasing the occupied far pocket. Reclaimed routes remain exposed to roamers.';
  mission.design.memorableMoment =
    'A fast return lands beside a moving roamer; the next cut leaves from the opposite side of the same stub.';
  mission.design.mastery =
    'Earn territory in both starting chambers and close at both stub returns after the roamers activate, without losing a life.';
  mission.design.difficulty.threatDensity = 5;
  mission.design.difficulty.planning = 6;
  for (const item of [...project.campaigns, ...project.packs]) item.revision = project.revision;
  return structuredClone(compileContentProject(project).source);
}
