import { requireAuthoring as required } from './authoring-error.mjs';
import { boundedJSON, exactKeys, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';

export const BONUS_CHOICES = Object.freeze(
  [
    ['extra-life', 'Extra life'],
    ['player-speed', 'Player speed'],
    ['enemy-slow', 'Enemy slow'],
    ['enemy-freeze', 'Enemy freeze'],
  ].map(Object.freeze),
);

/** Candidate placements only: collection, effect strength, duration and caps
 * remain engine policy. No completion requirement or random drop is introduced. */
export function editContentBonus(source, missionId, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 32, maxDepth: 3 });
  required(
    ['add', 'replace', 'remove'].includes(command.action),
    'Choose a bonus operation.',
    'errors:studio.bonus.operation',
  );
  exactKeys(
    command,
    ['action', 'id', ...(command.action === 'remove' ? [] : ['bonus'])],
    'bonus command',
  );
  required(stableId(command.id), 'Give the bonus a stable ID.', 'errors:studio.bonus.stableId');
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.', 'errors:studio.existingMission');
  required(
    !mission.modes.includes('team'),
    'Contact bonuses are not yet qualified for authored Team missions.',
    'errors:studio.bonus.teamUnavailable',
  );
  const index = mission.bonuses.findIndex((entry) => entry.id === command.id);
  required(
    command.action === 'add' ? index === -1 : index !== -1,
    command.action === 'add' ? 'That bonus ID already exists.' : 'Choose an existing bonus.',
    command.action === 'add' ? 'errors:studio.bonus.duplicateId' : 'errors:studio.bonus.existing',
  );
  if (command.action !== 'remove')
    required(
      command.bonus?.id === command.id,
      'Bonus identity must match the command.',
      'errors:studio.bonus.identity',
    );
  if (command.action === 'add') mission.bonuses.push(command.bonus);
  else if (command.action === 'replace') mission.bonuses[index] = command.bonus;
  else mission.bonuses.splice(index, 1);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
