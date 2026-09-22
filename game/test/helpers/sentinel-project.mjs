import { createStarterProject } from '../../content-design/starter.mjs';
import { SENTINEL_ACTOR_CATALOG, SENTINEL_RECIPE } from '../../content-design/catalogs.mjs';

export function sentinelProjectFixture() {
  const project = createStarterProject();
  project.actorCatalogId = SENTINEL_ACTOR_CATALOG.id;
  const map = project.maps[0],
    mission = project.missions[0];
  map.format = 'MapDesignV3';
  map.gates = [];
  map.speedZones = [];
  mission.format = 'MissionDesignV4';
  mission.relayLinks = [];
  mission.actors = [{ id: 'sentinel', role: 'relay-sentinel', tier: 'measured', x: 54.5, y: 18.5 }];
  mission.objectives = [
    { id: 'west', x: 8.5, y: 8.5, required: true },
    { id: 'east', x: 60.5, y: 8.5, required: true },
    { id: 'core', x: 54.5, y: 18.5, required: true },
  ];
  mission.encounter = {
    recipeId: SENTINEL_RECIPE.id,
    enemyId: 'sentinel',
    shieldObjectiveIds: ['west', 'east'],
    coreObjectiveId: 'core',
  };
  return project;
}
