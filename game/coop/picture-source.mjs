import { dataIdentity, required } from '../data-json.mjs';
import { matchRecordedGameplayTuning, recoverGameplayTuning } from '../gameplay-tuning.mjs';
import {
  matchTeamRunningEnemyLevel,
  teamRunningEnemyBaseLevel,
} from '../hunt/team-running-enemies.mjs';
import {
  isTeamRunningLevel,
  TEAM_RUNNING_RULESET,
  TEAM_PURSUIT_RULESET,
} from './running-enemies.mjs';

const accepted = new WeakMap();

/** The host retains immutable preparation data because Team's live level also
 * owns moving inherited enemies. Authenticate the supplemental projection once,
 * then expose its unchanged base edition to the existing picture lease guard. */
export function teamPictureArenaLevel(run, { runtimeLevel, sourceLevel }) {
  if (!run.level.runningEnemies) return run.level;
  required(
    isTeamRunningLevel(runtimeLevel) &&
      run.level.version === runtimeLevel.version &&
      [TEAM_RUNNING_RULESET, TEAM_PURSUIT_RULESET].includes(run.ruleset) &&
      run.level.id === runtimeLevel.id &&
      run.level.revision === runtimeLevel.revision &&
      run.width === runtimeLevel.width &&
      run.height === runtimeLevel.height,
    'Team running-enemy picture needs its exact prepared arena.',
  );
  let binding = accepted.get(run);
  if (binding?.runtimeLevel !== runtimeLevel || binding?.sourceLevel !== sourceLevel) {
    required(
      dataIdentity(run.level.runningEnemies) === dataIdentity(runtimeLevel.runningEnemies),
      'Team running-enemy picture inheritance changed.',
    );
    const matches = recoverGameplayTuning(runtimeLevel)
      ? matchRecordedGameplayTuning(sourceLevel, runtimeLevel)
      : matchTeamRunningEnemyLevel(sourceLevel, runtimeLevel, {
          style: runtimeLevel.pursuit ? 'varied' : 'original',
        });
    required(matches, 'Team running-enemy picture source differs from its exact recipe.');
    binding = {
      runtimeLevel,
      sourceLevel,
      base: teamRunningEnemyBaseLevel(runtimeLevel),
    };
    accepted.set(run, binding);
  }
  return binding.base;
}
