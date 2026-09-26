import { boundedJSON, exactKeys } from '../data-json.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { freezeDesign } from './catalogs.mjs';
import { resolveContentJourney } from './journey.mjs';
import { compileContentProject } from './project.mjs';

/**
 * Read-only spatial inventory for an authored Journey selection.
 *
 * Runtime counts are prepared through the same gameplay-tuning adapter used by
 * fresh attempts. The report deliberately describes geometry and starting
 * pressure only: it does not infer route quality, fairness, fun or human
 * difficulty from the presence or absence of a wall, terrain rectangle or
 * enemy.
 */
export function inspectJourneySpatialVariety(source, options = {}) {
  const selection = boundedJSON(options, { maxBytes: 16384, maxNodes: 512, maxDepth: 4 });
  exactKeys(selection, ['packIds', 'mode', 'difficulty', 'overrides'], 'spatial-variety selection');
  const mode = selection.mode ?? 'solo';
  const difficulty = selection.difficulty ?? 'standard';
  const overrides = selection.overrides ?? {};
  const project = compileContentProject(source);
  const journey = resolveContentJourney(project, {
    ...(selection.packIds ? { packIds: selection.packIds } : {}),
    mode,
    difficulty,
  });
  const tuning = resolveGameplayTuning(difficulty, overrides);
  const rows = [];

  for (const campaign of journey.campaigns)
    for (const manifest of campaign.manifests) {
      const mission = project.missions.find((item) => item.id === manifest.missionId);
      const map = project.maps.find(
        (item) =>
          item.source.id === mission.map.id && item.source.revision === mission.map.revision,
      );
      const level = applyGameplayTuning(manifest.level, tuning);
      const terrain = map.source.terrain ?? [];
      const walls = map.source.walls ?? [];
      const foundations = map.source.foundations ?? [];
      const gates = map.source.gates ?? [];
      const speedZones = map.source.speedZones ?? [];
      const optionalCombat = level.classic?.combatPatrols;
      const enabledOptionalActors = optionalCombat?.enabled
        ? (optionalCombat.actors?.length ?? 0)
        : 0;
      const fieldEnemies = level.enemies?.length ?? 0;
      rows.push({
        ordinal: rows.length + 1,
        packId: campaign.packId,
        campaignId: campaign.campaignId,
        missionId: mission.id,
        missionRevision: mission.revision,
        name: mission.name,
        mapId: map.source.id,
        mapRevision: map.source.revision,
        geometryIdentity: map.geometryIdentity,
        difficultyBand: mission.design.difficulty.band,
        routeDecision: mission.design.routeDecision,
        countdownSeconds: level.rules.timeLimitSeconds ?? 0,
        playerSpeed: level.rules.moveSpeed,
        startingPressure: {
          fieldEnemies,
          enabledOptionalActors,
          totalEnabledActors: fieldEnemies + enabledOptionalActors,
        },
        surfaces: {
          wallRectangles: walls.length,
          foundationRectangles: foundations.length,
          terrainRectangles: terrain.length,
          slowRectangles: terrain.filter((item) => item.kind === 'slow').length,
          lethalRectangles: terrain.filter((item) => item.kind === 'lethal').length,
          gateRectangles: gates.length,
          directionalZones: speedZones.length,
        },
        openPlain: walls.length === 0 && terrain.length === 0,
      });
    }

  const campaigns = journey.campaigns.map((campaign) => {
    const missions = rows.filter(
      (row) => row.packId === campaign.packId && row.campaignId === campaign.campaignId,
    );
    const values = (pick) => missions.map(pick);
    return {
      packId: campaign.packId,
      campaignId: campaign.campaignId,
      missionCount: missions.length,
      difficultyBand: {
        minimum: Math.min(...values((row) => row.difficultyBand)),
        maximum: Math.max(...values((row) => row.difficultyBand)),
      },
      startingPressure: {
        minimum: Math.min(...values((row) => row.startingPressure.totalEnabledActors)),
        maximum: Math.max(...values((row) => row.startingPressure.totalEnabledActors)),
      },
      missionsWithWalls: missions.filter((row) => row.surfaces.wallRectangles > 0).length,
      missionsWithTerrain: missions.filter((row) => row.surfaces.terrainRectangles > 0).length,
      openPlainMissions: missions.filter((row) => row.openPlain).map((row) => row.missionId),
    };
  });
  const timedMissionOccurrences = rows.filter((row) => row.countdownSeconds > 0).length;

  return freezeDesign({
    format: 'JourneySpatialVarietyInspectionV1',
    projectId: project.source.id,
    projectRevision: project.source.revision,
    mode,
    difficulty,
    tuning,
    missionCount: rows.length,
    timedMissionOccurrences,
    timedFraction: rows.length ? timedMissionOccurrences / rows.length : 0,
    rows,
    campaigns,
    qualification: 'runtime-prepared-inventory-not-human-balance-evidence',
    limitations: [
      'Counts authored rectangles and fresh-attempt actors; rectangle area, topology, live activation and capture consequences remain separate evidence.',
      'An open board can be an intentional spatial problem. Open-plain rows are review candidates, not automatic defects.',
      'Enemy counts do not measure exposure, warning readability, route safety, cleanup or player enjoyment.',
      'No moving capture outcome, completion time, accessibility behavior or device input is simulated.',
    ],
  });
}
