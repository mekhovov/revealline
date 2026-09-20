import { compileContentProject, resolveMission } from './project.mjs';
import {
  FOUNDATION_SCENARIO_VERSION,
  RELAY_SCENARIO_VERSION,
  validateScenario,
} from '../content.mjs';
import { createRun } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';
import { verifiedPreviewBackground } from './assets.mjs';
import { createCoop } from '../coop/core.mjs';
import { relayView } from '../ui/relay-view.mjs';

/** Both preview surfaces use the same resolved candidate as the CLI. No awards. */
export function prepareContentPreview(
  source,
  missionId,
  { difficulty = 'standard', mode = 'solo', theme, artwork, trailCells = [] } = {},
) {
  const project = compileContentProject(source);
  const manifest = resolveMission(project, missionId, { difficulty, mode });
  const mission = project.missions.find((candidate) => candidate.id === missionId);
  const map = project.maps.find(
    (candidate) =>
      candidate.source.id === mission.map.id && candidate.source.revision === mission.map.revision,
  );
  // Foundation Team candidates have only active field keepers and no strongholds;
  // their region-retention contract is identical. Never substitute a Solo run.
  const run =
    mode === 'team'
      ? createCoop(manifest.level, { seed: 1 })
      : createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
  const capture = inspectCaptureSnapshot(run, { trailCells });
  let scenario = null;
  if (theme) {
    if (mode !== 'solo')
      throw new Error(
        'Only Solo has a Studio gameplay preview; Team and paired-race launches are not substituted.',
      );
    if (theme.id !== manifest.presentation.themeId)
      throw new Error('Preview theme must match the authored mission presentation.');
    scenario = {
      format:
        manifest.level.version === 'xonix-level.v6'
          ? RELAY_SCENARIO_VERSION
          : FOUNDATION_SCENARIO_VERSION,
      masteryDefinition: null,
      visualOverrides: manifest.background
        ? { background: verifiedPreviewBackground(manifest.background, artwork) }
        : {},
      level: structuredClone(manifest.level),
      theme: structuredClone(theme),
      settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
      presentation: { style: 'microtile', showGrid: true },
      metadata: {
        title: manifest.level.name,
        description:
          'Content Studio greybox preview. No campaign awards; artwork and human validation are pending.',
      },
    };
    const result = validateScenario(scenario);
    if (!result.valid) throw new Error(result.errors.join(' '));
  }
  // Actor recipes such as contour patrols contain route edges, not positions.
  // Use the engine's resolved initial state for the authoring view, never invent
  // an alternate placement or expose the mutable run to Studio.
  const markers = {
    actors: run.enemies.map(({ id, type, x, y }) => ({ id, type, x, y })),
    objectives: (run.objectives ?? []).map(({ id, x, y }) => ({ id, x, y })),
    ...(mode === 'team' ? { spawns: run.players.map(({ id, x, y }) => ({ id, x, y })) } : {}),
    ...(run.relay ? { gates: relayView(run).gates } : {}),
  };
  const authoredTerrain = structuredClone(
    manifest.level.classic?.terrain ?? manifest.level.terrain ?? [],
  );
  return { manifest, geometry: map.geometry, capture, markers, scenario, authoredTerrain };
}
