import assert from 'node:assert/strict';
import { createRun, stepRun, releaseInputs, FIXED_DT } from '../game/core/index.mjs';
import { verifyReplay, authoritativeCheckpoint } from '../game/replay.mjs';
import { jammerPictureStrength } from '../game/ui/jammer-picture.mjs';
import { combatView } from '../game/ui/combat-view.mjs';

import { inspectReplayMechanics } from './solo-qualification-replay-core.mjs';

/** Node tooling/model verification. Native evidence uses the same inspector
 * with the observed artifact's dependencies and exact browser engine instead. */
export function inspectQualificationReplayPortability(
  recording,
  requirements = {},
  expectedDefinition,
) {
  const result = inspectReplayMechanics(
    recording,
    requirements,
    {
      createRun,
      stepRun,
      releaseInputs,
      FIXED_DT,
      verifyReplay,
      authoritativeCheckpoint,
      jammerPictureStrength,
      combatView,
    },
    expectedDefinition,
  );
  return result;
}

export function inspectQualificationReplay(recording, requirements = {}) {
  const result = inspectQualificationReplayPortability(recording, requirements);
  assert(result.match, `Native public replay mismatch: ${JSON.stringify(result.diagnostics)}`);
  return result;
}
