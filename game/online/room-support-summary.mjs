/** Only local transport phase and accepted room status enter support copy.
 * No credentials, room identity, server health or queue observations escape. */
export function roomSupportState({ phase, status } = {}) {
  if (['idle', 'connecting', 'recovering', 'abandoned'].includes(phase)) return phase;
  if (phase === 'connected' && ['waiting', 'playing', 'paused', 'finished'].includes(status))
    return status;
  return null;
}
