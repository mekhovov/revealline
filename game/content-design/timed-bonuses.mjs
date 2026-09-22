import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import {
  TIMED_BONUS_VERSION,
  TIMED_BONUS_TRAIL_VERSION,
  TIMED_BONUS_VERSIONS,
} from '../core/timed-bonuses.mjs';

/** A schedule edit is a candidate revision, never a publication or a live-attempt
 * mutation. The shared compiler validates bounds, anchors and every mode/preset. */
export function editTimedBonus(
  source,
  missionId,
  input,
  { version = TIMED_BONUS_TRAIL_VERSION } = {},
) {
  required(TIMED_BONUS_VERSIONS.includes(version), 'Unsupported timed bonus edit version.');
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
  if (mission.modes.includes('team')) {
    required(
      version === TIMED_BONUS_TRAIL_VERSION,
      'Team timed bonuses require the trail-aware v2 edition.',
    );
    // Explicit schedule Apply creates this mission's new edition, not a live
    // attempt or an automatic migration of other Team missions.
    mission.team.format = 'TeamMissionV4';
  }
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
  if (schedules.length) mission.timedBonuses = { version, schedules };
  else delete mission.timedBonuses;
  mission.revision = `timed-${dataIdentity({
    previous: mission.revision,
    command,
    ...(version === TIMED_BONUS_VERSION ? {} : { version }),
  })}`;
  project.revision = `timed-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
