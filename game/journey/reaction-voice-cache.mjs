import { inspectRecordingContainer } from './reaction-recording-format.mjs';
export const REACTION_VOICE_LIMITS = Object.freeze({
  bytes: 2 * 1024 * 1024,
  seconds: 15,
  channels: 2,
  decodedBytes: 12 * 1024 * 1024,
  perDecodeBytes: 6 * 1024 * 1024,
  buffers: 24,
  loads: 2,
});
const aborted = () => new DOMException('Reaction recording operation cancelled.', 'AbortError');

/** Metadata-only browser demux before PCM decode; never plays or unmutes media. */
export async function inspectReactionRecording(
  blob,
  { signal, document = globalThis.document } = {},
) {
  if (signal?.aborted) return Promise.reject(aborted());
  if (!blob?.size || blob.size > REACTION_VOICE_LIMITS.bytes || !document?.createElement)
    return Promise.reject(
      new Error('A recording up to 2 MiB and browser media inspection are required.'),
    );
  const container = inspectRecordingContainer(await blob.arrayBuffer());
  if (signal?.aborted) throw aborted();
  return new Promise((resolve, reject) => {
    const media = document.createElement('audio');
    let url = null,
      timer = null,
      settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
      media.removeEventListener('loadedmetadata', ready);
      media.removeEventListener('durationchange', ready);
      media.removeEventListener('error', failed);
      try {
        media.pause();
        media.removeAttribute('src');
        media.load();
      } catch {
        /* Detached media cleanup. */
      }
      if (url) URL.revokeObjectURL(url);
      if (error) reject(error);
      else resolve(value);
    };
    const cancel = () => finish(aborted());
    const failed = () => finish(new Error('This browser could not inspect the recording.'));
    const ready = () => {
      if (!Number.isFinite(media.duration)) return;
      if (media.duration <= 0 || media.duration > REACTION_VOICE_LIMITS.seconds)
        finish(new Error('A recording must be between 0 and 15 seconds.'));
      else finish(null, Object.freeze({ ...container, duration: media.duration }));
    };
    media.muted = true;
    media.volume = 0;
    media.preload = 'metadata';
    media.addEventListener('loadedmetadata', ready);
    media.addEventListener('durationchange', ready);
    media.addEventListener('error', failed);
    signal?.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => finish(new Error('Recording inspection timed out.')), 10000);
    try {
      url = URL.createObjectURL(blob);
      media.src = url;
      media.load();
      if (signal?.aborted) cancel();
    } catch (error) {
      finish(error);
    }
  });
}

/** Bounded decoded cache. A completed asset load never schedules speech. */
export function createReactionVoiceCache({
  sound,
  library,
  inspect = inspectReactionRecording,
  now = () => Date.now(),
}) {
  const buffers = new Map(),
    pending = new Map(),
    failures = new Map();
  let generation = 0,
    closed = false,
    bytes = 0,
    context = null;
  const keyFor = (lineId, locale) => `${lineId}|${locale}`;
  function clearBuffers() {
    buffers.clear();
    bytes = 0;
  }
  function cancel({ clear = false } = {}) {
    generation++;
    for (const request of pending.values()) request.abort.abort();
    failures.clear();
    if (clear) clearBuffers();
    return Promise.allSettled([...pending.values()].map((request) => request.promise));
  }
  async function load(lineId, locale) {
    if (closed || !sound.context) return false;
    if (context !== sound.context) {
      context = sound.context;
      await cancel({ clear: true });
    }
    const key = keyFor(lineId, locale),
      revision = generation,
      audioContext = context;
    if (buffers.has(key)) return true;
    if (pending.has(key)) return pending.get(key).promise;
    if (pending.size >= REACTION_VOICE_LIMITS.loads || now() < (failures.get(key) ?? 0))
      return false;
    const abort = new AbortController(),
      timeout = setTimeout(() => abort.abort(), 10000),
      request = { abort, promise: null };
    request.promise = (async () => {
      try {
        const recording = await library.resolve(lineId, locale, { signal: abort.signal });
        if (!recording || closed || abort.signal.aborted || revision !== generation) return false;
        if (
          !recording.bytes?.byteLength ||
          recording.bytes.byteLength > REACTION_VOICE_LIMITS.bytes
        )
          return false;
        const metadata = await inspect(
          new Blob([recording.bytes], { type: recording.mime ?? 'audio/mp4' }),
          {
            signal: abort.signal,
          },
        );
        if (closed || abort.signal.aborted || revision !== generation) return false;
        admitReactionDecode(metadata, audioContext.sampleRate);
        const buffer = await audioContext.decodeAudioData(recording.bytes.slice(0));
        if (
          closed ||
          abort.signal.aborted ||
          revision !== generation ||
          audioContext !== sound.context
        )
          return false;
        const size = buffer.length * buffer.numberOfChannels * 4;
        if (
          !(
            buffer.duration > 0 &&
            buffer.duration <= REACTION_VOICE_LIMITS.seconds &&
            buffer.numberOfChannels === metadata.channels &&
            buffer.duration <= metadata.maxDecodedSeconds + 0.05 &&
            size <= REACTION_VOICE_LIMITS.perDecodeBytes
          )
        )
          return false;
        while (
          buffers.size &&
          (bytes + size > REACTION_VOICE_LIMITS.decodedBytes ||
            buffers.size >= REACTION_VOICE_LIMITS.buffers)
        ) {
          const oldest = buffers.keys().next().value;
          bytes -= buffers.get(oldest).length * buffers.get(oldest).numberOfChannels * 4;
          buffers.delete(oldest);
        }
        buffers.set(key, buffer);
        bytes += size;
        return true;
      } catch {
        return false;
      } finally {
        clearTimeout(timeout);
        if (pending.get(key) === request) pending.delete(key);
        if (!closed && !abort.signal.aborted && revision === generation && !buffers.has(key))
          failures.set(key, now() + 30000);
      }
    })();
    pending.set(key, request);
    return request.promise;
  }
  return Object.freeze({
    load,
    cancel,
    ready: () => Promise.allSettled([...pending.values()].map((request) => request.promise)),
    get(lineId, locale) {
      const key = keyFor(lineId, locale),
        buffer = buffers.get(key);
      if (buffer) {
        buffers.delete(key);
        buffers.set(key, buffer);
      }
      return buffer;
    },
    snapshot: () =>
      Object.freeze({
        buffers: buffers.size,
        decodedBytes: bytes,
        loading: pending.size,
        generation,
        closed,
      }),
    dispose() {
      closed = true;
      void cancel({ clear: true });
    },
  });
}

/** Bound expected PCM before asking the browser decoder to allocate it. Native
 * decoder overhead remains browser-owned; only admitted mono/stereo is decoded. */
export function admitReactionDecode(metadata, sampleRate) {
  const bytes = Math.ceil(metadata.maxDecodedSeconds * sampleRate) * metadata.decodeChannels * 4;
  if (!Number.isFinite(bytes) || bytes <= 0 || bytes > REACTION_VOICE_LIMITS.perDecodeBytes)
    throw new Error(
      'This recording exceeds the 6 MiB per-decode PCM budget. Use a shorter recording.',
    );
  return bytes;
}
