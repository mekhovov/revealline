import { createSentinelSpatialCandidates } from './sentinel-spatial-candidates.mjs';
import { compileContentProject } from './project.mjs';

/** Explicit placement study. Earlier receiver editions, rules and geometry stay
 * unchanged; closing the outer gallery cannot also collect the inner receiver. */
export function createSentinelInnerCandidates() {
  const source = createSentinelSpatialCandidates();
  source.id = 'sentinel-inner-receiver-review';
  source.revision = 'inner-receiver-1';
  source.name = 'Sentinel Crown · inner receiver study';
  const mission = source.missions.find((row) => row.id === 'twin-receivers');
  mission.revision = 'inner-receiver-1';
  Object.assign(
    mission.objectives.find((row) => row.id === 'east-shield'),
    {
      x: 50.5,
      y: 19.5,
    },
  );
  mission.design.routeDecision =
    'Secure the upper receiver and an outer return first, or enter the lower mouth to take the inner receiver before enclosing the galleries?';
  mission.design.lesson =
    'The inner receiver shares the retained core court. Closing its entrance secures the outer receiver, but leaves the inner objective to capture.';
  mission.design.captureConsequence =
    'An outer enclosure creates return ground for a second inner approach; both receiver objectives still obey ordinary enemy-seeded capture.';
  mission.design.memorableMoment =
    'The outer galleries reveal while a second receiver remains inside the Sentinel court.';
  mission.design.mastery =
    'Capture the inner receiver before the upper receiver, in separate closures, and clear without losing a life.';
  for (const row of [...source.packs, ...source.campaigns]) row.revision = source.revision;
  return structuredClone(compileContentProject(source).source);
}
