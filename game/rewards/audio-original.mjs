import { canonicalJSON, required } from '../data-json.mjs';
import { inspectMP3, ownSoundtrackBlob, throwIfSoundtrackAborted } from '../mp3.mjs';
import { soundtrackRights } from '../soundtrack.mjs';
import { REWARD_MEDIA_LIMITS } from './media-format.mjs';

export function canPrepareDiscoveryRecording(track, { catalogue } = {}) {
  if (
    track?.kind !== 'mp3' ||
    !(track.asset.durationSeconds > 0) ||
    track.asset.durationSeconds > REWARD_MEDIA_LIMITS.durationSeconds
  )
    return false;
  const rights = soundtrackRights(track, { catalogue });
  return ['webPlayback', 'offlineCache', 'redistribute'].every((key) => rights[key] === 'allowed');
}

/** Deliberate original-file export. This producer has no reward editor, source
 * draft or player completion dependency and never changes music selection. */
export async function prepareDiscoveryRecording(track, original, { catalogue, signal } = {}) {
  required(track?.kind === 'mp3', 'Choose a local MP3 recording, not a synth recipe.');
  const rights = soundtrackRights(track, { catalogue });
  required(
    ['webPlayback', 'offlineCache', 'redistribute'].every((key) => rights[key] === 'allowed'),
    'Discovery recordings need permission for web playback, offline storage and redistribution.',
  );
  const blob = ownSoundtrackBlob(original, REWARD_MEDIA_LIMITS.sourceBytes);
  const actual = await inspectMP3(blob, { signal });
  required(
    canonicalJSON(actual) === canonicalJSON(track.asset),
    'The recording differs from its exact soundtrack metadata.',
  );
  required(
    actual.durationSeconds <= REWARD_MEDIA_LIMITS.durationSeconds,
    'Choose an approved original at most 120 seconds long. Handoff never clips or re-encodes a recording.',
  );
  throwIfSoundtrackAborted(signal);
  return {
    blob,
    filename: `${
      String(track.title)
        .replace(/[^a-zA-Z0-9_-]/g, '-')
        .slice(0, 100) || 'discovery-recording'
    }.mp3`,
  };
}
