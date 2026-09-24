const VERSION = '1.59.1';
const OUTPUT_MIME = 'video/mp4';
const DETAIL = `Mediabunny ${VERSION} can re-encode this silent AVC MP4 as AVC MP4 in this browser.`;
const unsupported = (reason) => Object.freeze({ supported: false, formats: [], reason });
const abortError = () => new DOMException('Physical trim cancelled.', 'AbortError');

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

async function defaultLibrary() {
  return import('./vendor/mediabunny-1.59.1.min.mjs');
}

function explainDiscarded(discarded) {
  const reason = discarded?.[0]?.reason;
  return reason
    ? `The browser could not preserve the video track (${reason.replaceAll('_', ' ')}).`
    : 'The browser could not build a verified AVC conversion.';
}

/**
 * Browser-only, intentionally narrow production adapter. It accepts one silent AVC MP4 and
 * always re-encodes the video. Audio-bearing files stay unsupported until decoded audio timing
 * can be independently checked after conversion.
 */
export function createMediabunnyTrimAdapter({ loadLibrary = defaultLibrary } = {}) {
  let libraryPromise = null;
  const library = () => (libraryPromise ??= Promise.resolve().then(loadLibrary));

  async function prepare(original, info, range, { signal } = {}) {
    checkAbort(signal);
    if (!(original instanceof Blob))
      return { capability: unsupported('Choose the owned source again.') };
    if (info?.mime !== OUTPUT_MIME || original.type !== OUTPUT_MIME)
      return {
        capability: unsupported(
          'Physical trim currently supports MP4 input only. WebM remains unchanged.',
        ),
      };
    if (!range || !(range.endSeconds > range.startSeconds))
      return { capability: unsupported('Choose a shorter playback range before checking trim.') };

    const media = await library();
    checkAbort(signal);
    const input = new media.Input({
      source: new media.BlobSource(original),
      formats: [media.MP4],
    });
    let conversion = null;
    try {
      const tracks = await input.getTracks();
      checkAbort(signal);
      const videoTracks = tracks.filter((track) => track.type === 'video');
      const audioTracks = tracks.filter((track) => track.type === 'audio');
      const otherTracks = tracks.filter((track) => !['video', 'audio'].includes(track.type));
      if (videoTracks.length !== 1)
        return {
          input,
          capability: unsupported('Physical trim requires exactly one MP4 video track.'),
        };
      if (audioTracks.length)
        return {
          input,
          capability: unsupported(
            'This MP4 contains audio. Physical trimming stays unavailable until audio timing is independently verified.',
          ),
        };
      if (otherTracks.length)
        return {
          input,
          capability: unsupported(
            'This MP4 contains additional tracks that the bounded physical trimmer cannot preserve.',
          ),
        };
      const video = videoTracks[0];
      const codec = await video.getCodec();
      if (codec !== 'avc')
        return {
          input,
          capability: unsupported(
            `Physical trim supports AVC/H.264 video only; this MP4 uses ${codec || 'an unknown codec'}.`,
          ),
        };
      const [width, height, canDecode] = await Promise.all([
        video.getDisplayWidth(),
        video.getDisplayHeight(),
        video.canDecode(),
      ]);
      checkAbort(signal);
      if (width !== info.width || height !== info.height)
        return {
          input,
          capability: unsupported(
            'Mediabunny display dimensions differ from the browser-inspected source.',
          ),
        };
      if (!canDecode)
        return {
          input,
          capability: unsupported(
            'This browser cannot decode the source AVC video with WebCodecs.',
          ),
        };
      if (!(await media.canEncodeVideo('avc', { width, height })))
        return {
          input,
          capability: unsupported('This browser cannot encode AVC/H.264 video with WebCodecs.'),
        };
      checkAbort(signal);

      const target = new media.BufferTarget();
      const output = new media.Output({ format: new media.Mp4OutputFormat(), target });
      conversion = await media.Conversion.init({
        input,
        output,
        tracks: 'primary',
        video: {
          codec: 'avc',
          forceTranscode: true,
          keyFrameInterval: 2,
          allowTransformationMetadata: true,
        },
        audio: { discard: true },
        trim: { start: range.startSeconds, end: range.endSeconds },
        tags: {},
        showWarnings: false,
      });
      checkAbort(signal);
      if (
        !conversion.isValid ||
        conversion.discardedTracks.some((item) => item.reason !== 'discarded_by_user')
      )
        return {
          input,
          conversion,
          capability: unsupported(explainDiscarded(conversion.discardedTracks)),
        };
      return {
        input,
        conversion,
        target,
        capability: Object.freeze({
          supported: true,
          formats: Object.freeze([OUTPUT_MIME]),
          reason: '',
          detail: DETAIL,
        }),
      };
    } catch (error) {
      if (signal?.aborted) throw abortError();
      await conversion?.cancel();
      input.dispose();
      throw error;
    }
  }

  async function support(original, info, range, options = {}) {
    const prepared = await prepare(original, info, range, options);
    try {
      return prepared.capability;
    } finally {
      await prepared.conversion?.cancel();
      prepared.input?.dispose();
    }
  }

  async function trim(original, range, { signal } = {}) {
    const info = {
      mime: original.type,
      width: range.sourceWidth,
      height: range.sourceHeight,
    };
    // The boundary intentionally supplies only immutable range evidence to trim. Read dimensions
    // from the source again so trim never trusts extra, adapter-specific fields on that evidence.
    const media = await library();
    checkAbort(signal);
    const probe = new media.Input({ source: new media.BlobSource(original), formats: [media.MP4] });
    try {
      const video = await probe.getPrimaryVideoTrack();
      if (!video) throw new TypeError('Physical trim requires one MP4 video track.');
      info.width = await video.getDisplayWidth();
      info.height = await video.getDisplayHeight();
    } finally {
      probe.dispose();
    }
    const prepared = await prepare(original, info, range, { signal });
    if (!prepared.capability.supported) {
      await prepared.conversion?.cancel();
      prepared.input?.dispose();
      throw new TypeError(prepared.capability.reason);
    }
    const { conversion, target, input } = prepared;
    const cancel = () => void conversion.cancel();
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      await conversion.execute();
      checkAbort(signal);
      if (!(target.buffer instanceof ArrayBuffer) || target.buffer.byteLength === 0)
        throw new TypeError('Mediabunny produced no MP4 bytes.');
      return Object.freeze({
        blob: new Blob([target.buffer], { type: OUTPUT_MIME }),
        audioSync: Object.freeze({
          status: 'not-present',
          note: 'The inspected source contains no audio track; no audio was generated.',
        }),
      });
    } catch (error) {
      if (signal?.aborted) throw abortError();
      throw error;
    } finally {
      signal?.removeEventListener('abort', cancel);
      if (!['done', 'canceled'].includes(conversion.state)) await conversion.cancel();
      input.dispose();
    }
  }

  return Object.freeze({ support, trim, version: VERSION });
}

export const MEDIABUNNY_TRIM_VERSION = VERSION;
