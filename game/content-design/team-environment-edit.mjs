import { boundedJSON, dataIdentity, exactKeys } from '../data-json.mjs';
import { requireAuthoring as required } from './authoring-error.mjs';
import { compileContentProject } from './project.mjs';

/** Edit only an already qualified Team environment. All native constraints,
 * including gates occupying authored walls, are checked before committing. */
export function editTeamEnvironment(source, missionId, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 32768, maxNodes: 2048, maxDepth: 8 });
  exactKeys(command, ['expectedMission', 'expectedMap', 'environment'], 'Team environment edit');
  const mission = project.missions.find((row) => row.id === missionId);
  required(
    mission?.team?.format === 'TeamMissionV10' &&
      mission.modes.length === 1 &&
      mission.modes[0] === 'team',
    'Select an expedition Team environment first.',
    'errors:studio.teamEnvironment.unavailable',
  );
  const map = project.maps.find(
    (row) => row.id === mission.map.id && row.revision === mission.map.revision,
  );
  required(
    command.expectedMission === dataIdentity(mission) && command.expectedMap === dataIdentity(map),
    'The mission or map changed. Inspect the environment again.',
    'errors:studio.teamEnvironment.stale',
  );
  mission.team.environment = command.environment;
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, environment: command.environment })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
