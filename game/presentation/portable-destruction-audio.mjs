import { PORTABLE_DESTRUCTION_AUDIO } from '../audio/portable-destruction.mjs';

/** The optional package contains the exact accepted release recordings. No
 * network, draft-library access, object URL, or playback belongs to this reader. */
export async function readPortableDestructionAudio(slot, { signal } = {}) {
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  const clip = PORTABLE_DESTRUCTION_AUDIO.clips[slot];
  if (!clip) return null;
  const bytes = Uint8Array.from(atob(clip.base64), (value) => value.charCodeAt(0));
  if (bytes.length !== clip.bytes)
    throw new TypeError('Incomplete portable destruction recording.');
  if (signal?.aborted) throw new DOMException('Cancelled', 'AbortError');
  return { blob: new Blob([bytes], { type: clip.mime }), asset: clip };
}
