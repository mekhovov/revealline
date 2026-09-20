import { boundedJSON, exactKeys, required, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { forkMissionMap } from './drafts.mjs';

/** Candidate-only edits. Explicit opt-in upgrades one mission through copy-on-write;
 * gate geometry belongs to the map, objective links belong to the mission. */
export function editContentRelay(source, missionId, input) {
  let project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 40, maxDepth: 3 });
  required(
    ['enable', 'add', 'replace', 'remove'].includes(command.action),
    'Choose a relay operation.',
  );
  exactKeys(
    command,
    [
      'action',
      'expectedMap',
      'expectedMission',
      ...(command.action === 'enable' ? [] : ['id']),
      ...(['add', 'replace'].includes(command.action) ? ['gate'] : []),
    ],
    'relay command',
  );
  let mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.');
  required(!mission.modes.includes('team'), 'Relay gates are not qualified for Team.');
  const map = project.maps.find(
    (entry) => entry.id === mission.map.id && entry.revision === mission.map.revision,
  );
  required(
    command.expectedMap === dataIdentity(map) && command.expectedMission === dataIdentity(mission),
    'The map or mission changed. Refresh the relay selection before editing.',
  );
  let gates;
  if (command.action === 'enable') {
    required(mission.format === 'MissionDesignV1', 'This mission already uses the relay edition.');
    mission.format = 'MissionDesignV2';
    mission.relayLinks = [];
    gates = [];
  } else {
    required(
      ['MissionDesignV2', 'MissionDesignV3'].includes(mission.format),
      'Explicitly enable the relay edition first.',
    );
    required(stableId(command.id), 'Give the gate a stable ID.');
    gates = structuredClone(map.gates);
    const index = gates.findIndex((gate) => gate.id === command.id);
    required(
      command.action === 'add' ? index === -1 : index !== -1,
      command.action === 'add' ? 'That gate ID already exists.' : 'Choose an existing gate.',
    );
    if (command.action === 'remove') {
      gates.splice(index, 1);
      mission.relayLinks = mission.relayLinks.filter((link) => link.gateId !== command.id);
    } else {
      exactKeys(command.gate, ['x', 'y', 'w', 'h', 'objectiveId'], 'gate edit');
      const { objectiveId, ...rectangle } = command.gate;
      required(
        stableId(objectiveId) && mission.objectives.some((item) => item.id === objectiveId),
        'Choose an existing capture objective.',
      );
      const gate = { id: command.id, ...rectangle },
        link = { gateId: command.id, objectiveId };
      if (command.action === 'add') {
        gates.push(gate);
        mission.relayLinks.push(link);
      } else {
        gates[index] = gate;
        mission.relayLinks = mission.relayLinks.map((item) =>
          item.gateId === command.id ? link : item,
        );
      }
    }
  }
  project = forkMissionMap(project, missionId, {
    format: mission.format === 'MissionDesignV3' ? 'MapDesignV3' : 'MapDesignV2',
    gates,
  });
  mission = project.missions.find((entry) => entry.id === missionId);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command, map: mission.map })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
