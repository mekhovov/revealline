import { boundedJSON, exactKeys, required, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';

/** Candidate mission tuning only. Physics, lives and actor speed remain catalog
 * policy, not arbitrary per-mission overrides. The complete project validates
 * every campaign membership before any caller can adopt or save the edit. */
export function tuneContentMission(source, missionId, changes) {
  const project = structuredClone(compileContentProject(source).source);
  const edit = boundedJSON(changes, { maxBytes: 4096, maxNodes: 24, maxDepth: 3 });
  exactKeys(edit, ['coverage', 'timeLimitSeconds', 'difficulty'], 'mission tuning');
  required(Object.keys(edit).length > 0, 'Choose a mission setting to change.');
  const mission = project.missions.find((candidate) => candidate.id === missionId);
  required(mission, 'Choose an existing mission.');
  if (Object.hasOwn(edit, 'coverage')) mission.coverage = edit.coverage;
  if (Object.hasOwn(edit, 'timeLimitSeconds')) mission.timeLimitSeconds = edit.timeLimitSeconds;
  if (Object.hasOwn(edit, 'difficulty')) mission.design.difficulty = edit.difficulty;
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, edit })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
