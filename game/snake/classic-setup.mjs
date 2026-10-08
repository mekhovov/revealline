import { makeClassicSnakeV2, makeClassicSnakeV3, makeClassicSnakeV4 } from './classic-core.mjs';

export const CLASSIC_PACES = Object.freeze({ slow: 1.4, normal: 1, fast: 0.75 });

/** Survival has a deliberately narrow arena contract. Installed packages do
 * not necessarily contain the official catalogue's empty first board. */
export function classicSnakeSurvivalEntry(entries) {
  return (
    entries.find((entry) => {
      try {
        const level = prepareClassicSnakeLevel(entry, { format: 'endless' });
        return (
          !level.wrap &&
          !level.walls.length &&
          !level.shutters.length &&
          !level.pickups.length &&
          level.targets.maxActive === 1 &&
          level.targets.required.every((target) => target.kind === 'still') &&
          level.targets.bonus === null
        );
      } catch {
        return false;
      }
    }) ?? null
  );
}

export function prepareClassicSnakeLevel(
  entry,
  { pace = 'normal', format = 'campaign', targetRules = 'authored', preset = 'classic' } = {},
) {
  let level = structuredClone(entry.level);
  if (targetRules === 'moving' || targetRules === 'varied' || format === 'endless')
    level = structuredClone(
      (level.version.endsWith('v4')
        ? makeClassicSnakeV4
        : targetRules === 'varied' || level.version.endsWith('v3')
          ? makeClassicSnakeV3
          : makeClassicSnakeV2)(level, {
        ...(targetRules === 'varied' ? { varied: true } : {}),
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
