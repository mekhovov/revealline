import { requireAuthoring as required } from './authoring-error.mjs';
import { boundedJSON, exactKeys, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';

/** One candidate actor command, validated in every supported mode and preset.
 * Maps, shared catalog physics, published editions and progress are untouched. */
export function editContentActor(source, missionId, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 64, maxDepth: 5 });
  const { action, id, actor } = command;
  required(
    ['add', 'replace', 'remove'].includes(action),
    'Choose an actor operation.',
    'errors:studio.actor.operation',
  );
  exactKeys(command, ['action', 'id', ...(action === 'remove' ? [] : ['actor'])], 'actor command');
  required(stableId(id), 'Give the actor a stable ID.', 'errors:studio.actor.stableId');
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.', 'errors:studio.existingMission');
  const index = mission.actors.findIndex((entry) => entry.id === id);
  required(
    action === 'add' ? index === -1 : index !== -1,
    action === 'add' ? 'That actor ID already exists.' : 'Choose an existing actor.',
    action === 'add' ? 'errors:studio.actor.duplicateId' : 'errors:studio.actor.existing',
  );
  if (action !== 'remove')
    required(
      actor?.id === id,
      'Actor identity must match the command.',
      'errors:studio.actor.identity',
    );
  if (action === 'add') mission.actors.push(actor);
  else if (action === 'replace') mission.actors[index] = actor;
  else mission.actors.splice(index, 1);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
