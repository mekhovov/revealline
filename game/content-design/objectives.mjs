import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';

/** Capture-marker edits share runtime validation; no gate or encounter behavior is inferred. */
export function editContentObjective(source, missionId, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 32, maxDepth: 3 });
  required(['add', 'replace', 'remove'].includes(command.action), 'Choose an objective operation.');
  exactKeys(
    command,
    ['action', 'id', ...(command.action === 'remove' ? [] : ['objective'])],
    'objective command',
  );
  required(stableId(command.id), 'Give the objective a stable ID.');
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.');
  required(
    !mission.modes.includes('team'),
    'Capture objectives are not yet qualified for authored Team missions.',
  );
  const index = mission.objectives.findIndex((entry) => entry.id === command.id);
  required(
    command.action === 'add' ? index === -1 : index !== -1,
    command.action === 'add'
      ? 'That objective ID already exists.'
      : 'Choose an existing objective.',
  );
  if (command.action !== 'remove') {
    exactKeys(command.objective, ['id', 'x', 'y', 'required', 'hidden'], 'capture objective');
    required(
      ['x', 'y'].every((axis) => Number.isInteger(command.objective[axis] - 0.5)),
      'Use cell-centre coordinates.',
    );
    required(
      typeof command.objective.required === 'boolean' &&
        typeof command.objective.hidden === 'boolean',
      'Choose explicit completion and visibility rules.',
    );
    required(
      !mission.objectives.some(
        (item, offset) =>
          offset !== index && item.x === command.objective.x && item.y === command.objective.y,
      ),
      'Another objective occupies that cell.',
    );
    required(command.objective?.id === command.id, 'Objective identity must match the command.');
  }
  if (command.action === 'remove') {
    const dependents = (mission.relayLinks ?? []).filter((link) => link.objectiveId === command.id);
    required(
      !dependents.length,
      `Objective controls relay gates: ${dependents.map((link) => link.gateId).join(', ')}. Relink or remove those gates first.`,
    );
  }
  if (command.action === 'add') mission.objectives.push(command.objective);
  else if (command.action === 'replace') mission.objectives[index] = command.objective;
  else mission.objectives.splice(index, 1);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
