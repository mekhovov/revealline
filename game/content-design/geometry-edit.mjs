import { boundedJSON, exactKeys, required, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { forkMissionMap } from './drafts.mjs';

/** Edit one existing rectangle against an exact source map; never mutate a
 * shared revision or re-target a stale array index after another edit. */
export function editContentGeometry(source, missionId, input) {
  const project = compileContentProject(source).source;
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 32, maxDepth: 3 });
  required(['replace', 'remove'].includes(command.action), 'Choose replace or remove geometry.');
  exactKeys(
    command,
    [
      'action',
      'surface',
      'index',
      'expectedMap',
      ...(command.action === 'replace' ? ['rectangle'] : []),
    ],
    'geometry command',
  );
  required(
    ['walls', 'foundations', 'terrain'].includes(command.surface),
    'Choose an authored rectangle.',
  );
  const mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.');
  const map = project.maps.find(
    (entry) => entry.id === mission.map.id && entry.revision === mission.map.revision,
  );
  required(
    command.expectedMap === dataIdentity(map),
    'The map changed. Select its current rectangle before editing.',
  );
  const list = structuredClone(map[command.surface] ?? []);
  required(
    Number.isSafeInteger(command.index) && command.index >= 0 && command.index < list.length,
    'Choose an existing rectangle.',
  );
  if (command.action === 'remove') list.splice(command.index, 1);
  else {
    exactKeys(
      command.rectangle,
      ['x', 'y', 'w', 'h', ...(command.surface === 'terrain' ? ['kind'] : [])],
      'replacement rectangle',
    );
    list[command.index] = {
      ...(command.surface === 'terrain' ? { id: list[command.index].id } : {}),
      ...command.rectangle,
    };
  }
  const candidate = forkMissionMap(project, missionId, { [command.surface]: list });
  return structuredClone(compileContentProject(candidate).source);
}
