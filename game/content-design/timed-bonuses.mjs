import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { TIMED_BONUS_VERSION } from '../core/timed-bonuses.mjs';

/** A schedule edit is a candidate revision, never a publication or a live-attempt
 * mutation. The shared compiler validates bounds, anchors and every mode/preset. */
export function editTimedBonus(source, missionId, input) {
  const project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 8192, maxNodes: 128, maxDepth: 5 });
  required(
    ['add', 'replace', 'remove'].includes(command.action),
    'Choose a timed bonus operation.',
  );
  exactKeys(
    command,
    ['action', 'id', ...(command.action === 'remove' ? [] : ['schedule'])],
    'timed bonus command',
  );
  required(stableId(command.id), 'Give the schedule a stable ID.');
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.');
  required(!mission.modes.includes('team'), 'Timed bonuses are not yet qualified for Team.');
  const schedules = mission.timedBonuses?.schedules ?? [];
  const index = schedules.findIndex((entry) => entry.id === command.id);
  required(
    command.action === 'add' ? index === -1 : index !== -1,
    'Choose a unique new schedule or an existing schedule to edit.',
  );
  if (command.action !== 'remove')
    required(command.schedule?.id === command.id, 'Schedule identity must match the command.');
  if (command.action === 'add') schedules.push(command.schedule);
  else if (command.action === 'replace') schedules[index] = command.schedule;
  else schedules.splice(index, 1);
  if (schedules.length) mission.timedBonuses = { version: TIMED_BONUS_VERSION, schedules };
  else delete mission.timedBonuses;
  mission.revision = `timed-${dataIdentity({ previous: mission.revision, command })}`;
  project.revision = `timed-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
