import { failureExplanation } from '../../game/ui/retry-view.mjs';

function ownValue(source, key) {
  if (!source || typeof source !== 'object' || Array.isArray(source)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(source, key);
  return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
}

function advice(cause) {
  const { reason, tip } = failureExplanation(cause);
  return `${reason} ${tip}`;
}

function livesRemaining(run) {
  const lives = ownValue(run, 'lives');
  return Number.isSafeInteger(lives) && lives >= 0
    ? ` ${lives} ${lives === 1 ? 'life remains' : 'lives remain'}.`
    : '';
}

/** One message per actual core event batch, never a per-tick summary. A null
 * result preserves the host's current status. This projection owns no controls,
 * timers, live regions or progress data. */
export function outcomeMessage(events, run) {
  if (!Array.isArray(events)) return null;
  const ofType = (type) => events.filter((event) => ownValue(event, 'type') === type);
  const status = ownValue(run, 'status');
  const failure = ofType('player.failed').at(-1);
  if (ofType('run.completed').length) {
    if (status === 'won')
      return 'Mission complete. Choose Retry to play this same setup again. No progress was saved.';
    if (status === 'lost')
      return `Attempt lost. ${advice(failure ? ownValue(failure, 'cause') : ownValue(run, 'failureCause'))} Choose Retry for a new attempt.`;
  }
  if (status !== 'running' && status !== 'respawning') return null;
  if (failure)
    return `Life lost. ${advice(ownValue(failure, 'cause'))}${livesRemaining(run)} Recovery continues in this attempt.`;
  if (ofType('player.respawned').length)
    return `Recovered.${livesRemaining(run)} Continue this attempt.`;
  const claims = ofType('cells.claimed');
  if (!claims.length) return null;
  const indices = claims.map((event) => ownValue(event, 'indices'));
  const cells = indices.every(Array.isArray)
    ? indices.reduce((total, items) => total + items.length, 0)
    : null;
  const captured =
    cells > 0 ? `Captured ${cells} ${cells === 1 ? 'cell' : 'cells'}.` : 'Area captured.';
  const coverage = ownValue(run, 'coverage');
  const revealed =
    Number.isFinite(coverage) && coverage >= 0 && coverage <= 1
      ? ` ${Math.round(coverage * 1000) / 10}% revealed.`
      : '';
  return captured + revealed;
}
