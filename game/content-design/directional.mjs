import { requireAuthoring as required } from './authoring-error.mjs';
import { boundedJSON, exactKeys, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { forkMissionMap } from './drafts.mjs';

/** Explicit candidate upgrade/edit, preserving shared maps and previous editions. */
export function editContentDirectional(source, missionId, input) {
  let project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 40, maxDepth: 3 });
  required(
    ['enable', 'add', 'replace', 'remove'].includes(command.action),
    'Choose a directional-field operation.',
    'errors:studio.directional.operation',
  );
  exactKeys(
    command,
    [
      'action',
      'expectedMap',
      'expectedMission',
      ...(command.action === 'enable' ? [] : ['id']),
      ...(['add', 'replace'].includes(command.action) ? ['zone'] : []),
    ],
    'directional command',
  );
  let mission = project.missions.find((mission) => mission.id === missionId);
  required(mission, 'Choose an existing mission.', 'errors:studio.existingMission');
  required(
    !mission.modes.includes('team'),
    'Directional fields are not qualified for Team.',
    'errors:studio.directional.teamUnavailable',
  );
  const map = project.maps.find(
    (map) => map.id === mission.map.id && map.revision === mission.map.revision,
  );
  required(
    command.expectedMap === dataIdentity(map) && command.expectedMission === dataIdentity(mission),
    'The map or mission changed. Refresh the directional selection before editing.',
    'errors:studio.directional.sourceChanged',
  );
  let speedZones;
  if (command.action === 'enable') {
    required(
      !['MissionDesignV3', 'MissionDesignV4'].includes(mission.format),
      'This mission already uses the directional edition.',
      'errors:studio.directional.alreadyEnabled',
    );
    mission.format = 'MissionDesignV3';
    mission.relayLinks ??= [];
    speedZones = [];
  } else {
    required(
      ['MissionDesignV3', 'MissionDesignV4'].includes(mission.format),
      'Explicitly enable the directional edition first.',
      'errors:studio.directional.enableFirst',
    );
    required(
      stableId(command.id),
      'Give the field a stable ID.',
      'errors:studio.directional.stableId',
    );
    speedZones = structuredClone(map.speedZones);
    const index = speedZones.findIndex((zone) => zone.id === command.id);
    required(
      command.action === 'add' ? index === -1 : index !== -1,
      command.action === 'add' ? 'That field ID already exists.' : 'Choose an existing field.',
      command.action === 'add'
        ? 'errors:studio.directional.duplicateId'
        : 'errors:studio.directional.existing',
    );
    if (command.action === 'remove') speedZones.splice(index, 1);
    else {
      exactKeys(command.zone, ['x', 'y', 'w', 'h', 'direction'], 'directional field edit');
      const zone = { id: command.id, ...command.zone };
      if (command.action === 'add') speedZones.push(zone);
      else speedZones[index] = zone;
    }
  }
  project = forkMissionMap(project, missionId, {
    format: 'MapDesignV3',
    gates: map.gates ?? [],
    speedZones,
  });
  mission = project.missions.find((mission) => mission.id === missionId);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command, map: mission.map })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
