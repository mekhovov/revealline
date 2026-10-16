import { requireAuthoring as required } from './authoring-error.mjs';
import { boundedJSON, exactKeys, stableId, dataIdentity } from '../data-json.mjs';
import { compileContentProject } from './project.mjs';
import { forkMissionMap } from './drafts.mjs';
import { journeyActors, SENTINEL_ACTOR_CATALOG, SENTINEL_RECIPE } from './catalogs.mjs';

/** Candidate-only atomic authoring: actor, core and shield bindings travel together.
 * Explicit opt-in forks older geometry, never changes a shared historical map. */
export function editContentEncounter(source, missionId, input) {
  let project = structuredClone(compileContentProject(source).source);
  const command = boundedJSON(input, { maxBytes: 4096, maxNodes: 32, maxDepth: 3, maxArray: 4 });
  required(
    ['set', 'remove'].includes(command.action),
    'Choose an encounter operation.',
    'errors:studio.encounter.operation',
  );
  exactKeys(
    command,
    [
      'action',
      'expectedMap',
      'expectedMission',
      ...(command.action === 'set' ? ['enemyId', 'coreObjectiveId', 'shieldObjectiveIds'] : []),
    ],
    'encounter command',
  );
  let mission = project.missions.find((entry) => entry.id === missionId);
  required(mission, 'Choose an existing mission.', 'errors:studio.existingMission');
  required(
    !mission.modes.includes('team'),
    'Sentinel encounters are not qualified for Team.',
    'errors:studio.encounter.teamUnavailable',
  );
  const map = project.maps.find(
    (entry) => entry.id === mission.map.id && entry.revision === mission.map.revision,
  );
  required(
    command.expectedMap === dataIdentity(map) && command.expectedMission === dataIdentity(mission),
    'The map or mission changed. Refresh the encounter selection before editing.',
    'errors:studio.encounter.sourceChanged',
  );
  if (command.action === 'remove') {
    required(
      mission.format === 'MissionDesignV4' && mission.encounter,
      'Choose an existing Sentinel encounter.',
      'errors:studio.encounter.existing',
    );
    mission.actors = mission.actors.filter((actor) => actor.id !== mission.encounter.enemyId);
    mission.encounter = null;
  } else {
    required(
      stableId(command.enemyId),
      'Give the Sentinel a stable actor ID.',
      'errors:studio.encounter.stableId',
    );
    required(
      !mission.encounter || mission.encounter.enemyId === command.enemyId,
      'Keep the existing Sentinel actor ID when replacing links.',
      'errors:studio.encounter.identity',
    );
    const previous = mission.actors.find((actor) => actor.id === command.enemyId);
    required(
      !previous || ['field-keeper', 'relay-sentinel'].includes(previous.role),
      'Only an explicitly selected field keeper can become the Sentinel.',
      'errors:studio.encounter.keeper',
    );
    const core = mission.objectives.find((objective) => objective.id === command.coreObjectiveId);
    required(
      core && core.required && !core.hidden,
      'Choose a visible required core objective.',
      'errors:studio.encounter.core',
    );
    const actor = {
      id: command.enemyId,
      role: 'relay-sentinel',
      tier: 'measured',
      x: core.x,
      y: core.y,
    };
    if (previous)
      mission.actors = mission.actors.map((entry) => (entry.id === actor.id ? actor : entry));
    else mission.actors.push(actor);
    mission.format = 'MissionDesignV4';
    mission.relayLinks ??= [];
    mission.encounter = {
      recipeId: SENTINEL_RECIPE.id,
      enemyId: actor.id,
      coreObjectiveId: core.id,
      shieldObjectiveIds: command.shieldObjectiveIds,
    };
    if (
      journeyActors(project.actorCatalogId).roles['relay-sentinel']?.recipeId !== SENTINEL_RECIPE.id
    )
      project.actorCatalogId = SENTINEL_ACTOR_CATALOG.id;
    if (map.format !== 'MapDesignV3')
      project = forkMissionMap(project, missionId, {
        format: 'MapDesignV3',
        gates: map.gates ?? [],
        speedZones: [],
      });
  }
  mission = project.missions.find((entry) => entry.id === missionId);
  mission.revision = `draft-${dataIdentity({ previous: mission.revision, command, map: mission.map })}`;
  project.revision = `draft-${dataIdentity(project)}`;
  return structuredClone(compileContentProject(project).source);
}
