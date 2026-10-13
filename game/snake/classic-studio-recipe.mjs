import { makeClassicSnakeV3, validateClassicSnakeLevel } from './classic-core.mjs';

/** Studio copies preserve accepted modern rulesets. Older templates receive
 * their existing explicit v3 upgrade; v4/v5 policies are never downgraded. */
export function prepareClassicSnakeStudioLevel(source) {
  return structuredClone(
    ['classic-snake-level.v4', 'classic-snake-level.v5'].includes(source?.version)
      ? validateClassicSnakeLevel(source)
      : makeClassicSnakeV3(source),
  );
}
