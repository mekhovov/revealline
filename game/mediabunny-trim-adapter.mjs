const VERSION = '1.59.1';
const OUTPUT_MIME = 'video/mp4';
const INPUT_MIMES = Object.freeze(['video/mp4', 'video/webm']);
const MEDIA_TRACK_INSPECTION_FORMAT = 'revealline-media-track-inspection.v1';
const unsupported = (reason) => Object.freeze({ supported: false, formats: [], reason });
const abortError = () => new DOMException('Physical trim cancelled.', 'AbortError');

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

async function defaultLibrary() {
  return import('./vendor/mediabunny-1.59.1.min.mjs');
}

function inputFormat(media, mime) {
  if (mime === 'video/mp4') return media.MP4;
  if (mime === 'video/webm') return media.WEBM;
  return null;
}

function codecLabel(codec) {
  return (
    {
      av1: 'AV1',
      avc: 'AVC/H.264',
      hevc: 'HEVC/H.265',
      vp8: 'VP8',
      vp9: 'VP9',
    }[codec] ||
    codec ||
    'video'
  );
}

function expectedTransform(info, profile) {
  const policy = {
    source: { targetVideoBitrate: null },
    balanced: { maxWidth: 1280, maxHeight: 720, targetVideoBitrate: 2_500_000 },
    compact: { maxWidth: 640, maxHeight: 360, targetVideoBitrate: 900_000 },
  }[profile];
  if (!policy) return null;
  let width = info.width,
    height = info.height;
  if (policy.maxWidth) {
    const scale = Math.min(1, policy.maxWidth / width, policy.maxHeight / height);
    width = Math.max(2, Math.floor((width * scale) / 2) * 2);
    height = Math.max(2, Math.floor((width * info.height) / info.width / 2) * 2);
    if (height > policy.maxHeight) {
      height = Math.max(2, Math.floor(policy.maxHeight / 2) * 2);
      width = Math.max(2, Math.floor((height * info.width) / info.height / 2) * 2);
    }
  }
  return { width, height, targetVideoBitrate: policy.targetVideoBitrate };
}

function transformPlan(info, transform) {
  const planned = transform ?? {
    profile: 'source',
    width: info.width,
    height: info.height,
    targetVideoBitrate: null,
  };
  const sourceAspect = info.width / info.height,
    outputAspect = planned.width / planned.height,
    expected = expectedTransform(info, planned.profile);
  if (
    !expected ||
    !Number.isInteger(planned.width) ||
    planned.width < 2 ||
    planned.width > info.width ||
    !Number.isInteger(planned.height) ||
    planned.height < 2 ||
    planned.height > info.height ||
    Math.abs(outputAspect / sourceAspect - 1) > 0.01 ||
    Math.sign(info.width - info.height) !== Math.sign(planned.width - planned.height) ||
    planned.width !== expected.width ||
    planned.height !== expected.height ||
    planned.targetVideoBitrate !== expected.targetVideoBitrate ||
    (planned.targetVideoBitrate !== null &&
      (!Number.isInteger(planned.targetVideoBitrate) ||
        planned.targetVideoBitrate < 500_000 ||
        planned.targetVideoBitrate > 8_000_000))
  )
    throw new TypeError('Physical transform plan is outside the bounded size/bitrate policy.');
  return planned;
}

const sha = async (blob) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');

/**
 * Reopens exact MP4 or WebM bytes and inventories their media tracks. Audio track absence and the
 * output video codec are container facts; this deliberately does not claim decoded audio timing or
 * synchronization for an audio-bearing file.
 */
export async function inspectMediabunnyAudioTracks(
  blob,
  { signal, loadLibrary = defaultLibrary } = {},
) {
  checkAbort(signal);
  if (!(blob instanceof Blob) || !INPUT_MIMES.includes(blob.type))
    throw new TypeError('Audio-track inspection requires owned MP4 or WebM bytes.');
  const media = await loadLibrary();
  checkAbort(signal);
  const input = new media.Input({
    source: new media.BlobSource(blob),
    formats: [inputFormat(media, blob.type)],
  });
  try {
    const [tracks, sha256] = await Promise.all([input.getTracks(), sha(blob)]);
    checkAbort(signal);
    const audioTracks = tracks.filter((track) => track.type === 'audio'),
      videoTracks = tracks.filter((track) => track.type === 'video'),
      [audioCodecs, videoCodecs] = await Promise.all([
        Promise.all(
          audioTracks.map(async (track) => String((await track.getCodec()) || 'unknown')),
        ),
        Promise.all(
          videoTracks.map(async (track) => String((await track.getCodec()) || 'unknown')),
        ),
      ]);
    checkAbort(signal);
    return Object.freeze({
      format: MEDIA_TRACK_INSPECTION_FORMAT,
      bytes: blob.size,
      sha256,
      audioTrackCount: audioTracks.length,
      codecs: Object.freeze(audioCodecs),
      videoTrackCount: videoTracks.length,
      videoCodecs: Object.freeze(videoCodecs),
    });
  } finally {
    input.dispose();
  }
}

function explainDiscarded(discarded) {
  const reason = discarded?.[0]?.reason;
  return reason
    ? `The browser could not preserve the video track (${reason.replaceAll('_', ' ')}).`
    : 'The browser could not build a verified AVC conversion.';
}

/**
 * Browser-only, intentionally narrow production adapter. It accepts one browser-decodable video
 * track in a silent MP4 or WebM container and always re-encodes it as AVC MP4. Audio-bearing files
 * stay unsupported until decoded audio timing can be independently checked after conversion.
 */
export function createMediabunnyTrimAdapter({ loadLibrary = defaultLibrary } = {}) {
  let libraryPromise = null;
  const library = () => (libraryPromise ??= Promise.resolve().then(loadLibrary));

  async function prepare(original, info, range, { signal, transform } = {}) {
    checkAbort(signal);
    if (!(original instanceof Blob))
      return { capability: unsupported('Choose the owned source again.') };
    if (!INPUT_MIMES.includes(info?.mime) || original.type !== info.mime)
      return {
        capability: unsupported(
          'Physical trim conversion requires owned MP4 or WebM bytes matching the inspected source.',
        ),
      };
    if (!range || !(range.endSeconds > range.startSeconds))
      return { capability: unsupported('Choose a shorter playback range before checking trim.') };

    const plannedTransform = transformPlan(info, transform),
      media = await library();
    checkAbort(signal);
    const input = new media.Input({
      source: new media.BlobSource(original),
      formats: [inputFormat(media, original.type)],
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
          capability: unsupported('Physical trim requires exactly one video track.'),
        };
      if (audioTracks.length)
        return {
          input,
          capability: unsupported(
            'This video contains audio. Physical trimming stays unavailable until audio timing is independently verified.',
          ),
        };
      if (otherTracks.length)
        return {
          input,
          capability: unsupported(
            'This video contains additional tracks that the bounded physical trimmer cannot preserve.',
          ),
        };
      const video = videoTracks[0];
      const codec = await video.getCodec();
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
            `This browser cannot decode the source ${codecLabel(codec)} track with WebCodecs.`,
          ),
        };
      const encodeProbe = {
        width: plannedTransform.width,
        height: plannedTransform.height,
        ...(plannedTransform.targetVideoBitrate === null
          ? {}
          : { bitrate: plannedTransform.targetVideoBitrate }),
      };
      if (!(await media.canEncodeVideo('avc', encodeProbe)))
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
          width: plannedTransform.width,
          height: plannedTransform.height,
          fit: 'contain',
          ...(plannedTransform.targetVideoBitrate === null
            ? {}
            : { bitrate: plannedTransform.targetVideoBitrate }),
          forceTranscode: true,
          keyFrameInterval: 2,
          allowTransformationMetadata: plannedTransform.profile === 'source',
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
          detail: `Mediabunny ${VERSION} can decode this silent ${codecLabel(codec)} ${info.mime === 'video/webm' ? 'WebM' : 'MP4'} and re-encode it as ${plannedTransform.width} × ${plannedTransform.height} AVC MP4${plannedTransform.targetVideoBitrate === null ? '' : ` with a ${(plannedTransform.targetVideoBitrate / 1_000_000).toFixed(1)} Mbit/s target`} in this browser.`,
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

  async function trim(original, range, { signal, transform } = {}) {
    const info = {
      mime: original.type,
      width: range.sourceWidth,
      height: range.sourceHeight,
    };
    // The boundary intentionally supplies only immutable range evidence to trim. Read dimensions
    // from the source again so trim never trusts extra, adapter-specific fields on that evidence.
    const media = await library();
    checkAbort(signal);
    const probe = new media.Input({
      source: new media.BlobSource(original),
      formats: [inputFormat(media, original.type)],
    });
    try {
      const video = await probe.getPrimaryVideoTrack();
      if (!video) throw new TypeError('Physical trim requires one video track.');
      info.width = await video.getDisplayWidth();
      info.height = await video.getDisplayHeight();
    } finally {
      probe.dispose();
    }
    const prepared = await prepare(original, info, range, { signal, transform });
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
