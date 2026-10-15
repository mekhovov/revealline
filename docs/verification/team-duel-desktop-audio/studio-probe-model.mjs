import { resolvePresentation } from '../../../game/presentation/model.mjs';

/** A read-only adapter over a bundle already verified by importThemeBundle.
 * This deliberately does not stand in for Studio persistence or a compiled host. */
export function captureFromVerifiedBundle(bundle) {
  const resolved = resolvePresentation(bundle.document);
  const asset = resolved.assets['audio.capture'];
  const blob = asset?.file && bundle.assets.get(asset.file.sha256);
  if (asset?.kind !== 'audio' || !(blob instanceof Blob) || blob.size !== asset.file.bytes)
    throw new Error('Choose a Studio bundle with an uploaded capture sound.');
  return {
    asset,
    blob,
    theme: resolved.theme,
    readAudio: async (slot, { signal } = {}) => {
      if (signal?.aborted) throw new DOMException('Read cancelled.', 'AbortError');
      return slot === 'audio.capture' ? { asset, blob } : null;
    },
  };
}

/** Delay delivery, not decoding: the held buffer comes from the real decoder.
 * Restoring always releases the wait, including cancellation and failed checks. */
export function holdNextDecode(context) {
  const original = context.decodeAudioData;
  let enter,
    fail,
    release,
    used = false;
  const entered = new Promise((resolve, reject) => {
    enter = resolve;
    fail = reject;
  });
  const held = new Promise((resolve) => {
    release = resolve;
  });
  const wrapped = async (...args) => {
    if (used) return original.apply(context, args);
    used = true;
    try {
      const buffer = await original.apply(context, args);
      enter(buffer);
      await held;
      return buffer;
    } catch (error) {
      fail(error);
      throw error;
    }
  };
  context.decodeAudioData = wrapped;
  return {
    entered,
    release,
    restore() {
      if (context.decodeAudioData === wrapped) context.decodeAudioData = original;
      release();
    },
  };
}

export function captureVoices(sound, expectedBuffer) {
  const all = [...sound.voices];
  const custom = all.filter((voice) => voice.name === 'capture');
  return {
    custom: custom.length,
    owners: custom.map((voice) => voice.board),
    exactDecodedBuffer:
      custom.length > 0 && custom.every((voice) => voice.source?.buffer === expectedBuffer),
    nativeReveal: all.filter((voice) => /^reveal-/.test(voice.name ?? '')).length,
  };
}

/** Observe successful native scheduling over the entire window. An analyser
 * sampled after a delay can miss a short cue that already finished. */
export function observeBufferStarts(context) {
  const original = context.createBufferSource;
  const sources = [];
  let count = 0;
  const wrapped = function (...args) {
    const source = original.apply(context, args);
    const start = source.start;
    const observed = function (...startArgs) {
      const result = start.apply(source, startArgs);
      count++;
      return result;
    };
    source.start = observed;
    sources.push({ source, start, observed });
    return source;
  };
  context.createBufferSource = wrapped;
  return {
    get count() {
      return count;
    },
    restore() {
      if (context.createBufferSource === wrapped) context.createBufferSource = original;
      for (const { source, start, observed } of sources)
        if (source.start === observed) source.start = start;
      sources.length = 0;
    },
  };
}
