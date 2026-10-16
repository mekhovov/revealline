/** Read the existing mixer owner; rendering never starts audio or saves a
 * preference. Idempotent labels preserve focus and in-progress pointer targets. */
export function updateReviewAudioStatus({ sound, words, result, mute, status }) {
  const state = sound.snapshot();
  if (state.muted) result = 'muted';
  else if (state.volume === 0) result = 'silent';
  else if (result === 'muted' || result === 'silent') result = 'ready';
  else if (result === 'played' && !state.playing) result = 'stopped';
  const label = state.muted ? words.unmute : words.mute,
    message = words[result] ?? words.ready;
  if (mute.textContent !== label) mute.textContent = label;
  if (status.textContent !== message) status.textContent = message;
  return result;
}
