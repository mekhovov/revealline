import { makeClassicSnakeV3, validateClassicSnakeLevel } from './classic-core.mjs';

/** Studio copies preserve accepted modern rulesets. Older templates receive
 * their existing explicit v3 upgrade; v4 policies are never downgraded. */
export function prepareClassicSnakeStudioLevel(source) {
  return structuredClone(
    source?.version === 'classic-snake-level.v4'
      ? validateClassicSnakeLevel(source)
      : makeClassicSnakeV3(source),
  );
}
