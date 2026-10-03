import { makeClassicSnakeV2 } from './classic-core.mjs';

export const CLASSIC_PACES = Object.freeze({ slow: 1.4, normal: 1, fast: 0.75 });
export function prepareClassicSnakeLevel(
  entry,
  { pace = 'normal', format = 'campaign', targetRules = 'authored', preset = 'classic' } = {},
) {
  let level = structuredClone(entry.level);
  if (targetRules === 'moving' || format === 'endless')
    level = structuredClone(
      makeClassicSnakeV2(level, {
        targetRemix: targetRules === 'moving',
        endless: format === 'endless',
        preset,
      }),
    );
  level.stepMs = Math.min(300, Math.max(80, Math.round(level.stepMs * CLASSIC_PACES[pace])));
  level.minStepMs = Math.min(
    level.stepMs,
    Math.max(60, Math.round(level.minStepMs * CLASSIC_PACES[pace])),
  );
  return level;
}
