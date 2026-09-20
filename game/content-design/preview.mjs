import { compileContentProject, resolveMission } from './project.mjs';
import { FOUNDATION_SCENARIO_VERSION, validateScenario } from '../content.mjs';
import { createRun } from '../core/index.mjs';
import { inspectCaptureSnapshot } from '../core/capture-regions.mjs';

/** Both preview surfaces use the same resolved candidate as the CLI. No awards. */
export function prepareContentPreview(
  source,
  missionId,
  { difficulty = 'standard', mode = 'solo', theme, trailCells = [] } = {},
) {
  const project = compileContentProject(source);
  const manifest = resolveMission(project, missionId, { difficulty, mode });
  const mission = project.missions.find((candidate) => candidate.id === missionId);
  const map = project.maps.find(
    (candidate) =>
      candidate.source.id === mission.map.id && candidate.source.revision === mission.map.revision,
  );
  const run = createRun(manifest.level, { seed: 1, classId: 'scout', turnPolicy: 'immediate' });
  const capture = inspectCaptureSnapshot(run, { trailCells });
  let scenario = null;
  if (theme) {
    if (mode !== 'solo')
      throw new Error(
        'Only Solo has a Studio gameplay preview; paired-race launch is not substituted.',
      );
    scenario = {
      format: FOUNDATION_SCENARIO_VERSION,
      masteryDefinition: null,
      visualOverrides: {},
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
  return { manifest, geometry: map.geometry, capture, scenario };
}
