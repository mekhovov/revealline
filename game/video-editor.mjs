import { required } from './data-json.mjs';
import { openVideoPosterSource, VIDEO_POSTER_LIMITS } from './video-poster.mjs';
import {
  authenticateVisualTrimInspection,
  inspectDecodedVisualTrim,
  VISUAL_TRIM_INSPECTION_FORMAT,
} from './video-trim-visual.mjs';

export { inspectDecodedVisualTrim, VISUAL_TRIM_INSPECTION_FORMAT };

export const VIDEO_EDIT_FORMAT = 'revealline-video-edit.v1';
export const MEDIA_TRACK_INSPECTION_FORMAT = 'revealline-media-track-inspection.v1';
export const AUDIO_TRACK_INSPECTION_FORMAT = MEDIA_TRACK_INSPECTION_FORMAT;
export const VIDEO_TRANSFORM_PROFILES = Object.freeze({
  source: Object.freeze({ label: 'Keep source size · encoder default' }),
  balanced: Object.freeze({
    label: 'Fit within 1280 × 720 · 2.5 Mbit/s AVC target',
    maxWidth: 1280,
    maxHeight: 720,
    targetVideoBitrate: 2_500_000,
  }),
  compact: Object.freeze({
    label: 'Fit within 640 × 360 · 0.9 Mbit/s AVC target',
    maxWidth: 640,
    maxHeight: 360,
    targetVideoBitrate: 900_000,
  }),
});
const BITRATE_TOLERANCE_FACTOR = 2;
const BITRATE_TOLERANCE_BITS_PER_SECOND = 256_000;
const fail = (message) => new TypeError(message);
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const sha = async (blob) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');

function videoFacts(info) {
  required(
    info &&
      ['video/mp4', 'video/webm'].includes(info.mime) &&
      Number.isInteger(info.width) &&
      info.width > 0 &&
      Number.isInteger(info.height) &&
      info.height > 0 &&
      finite(info.durationSeconds) &&
      info.durationSeconds > 0 &&
      Number.isInteger(info.bytes) &&
      info.bytes > 0 &&
      typeof info.sha256 === 'string' &&
      /^[a-f0-9]{64}$/.test(info.sha256),
    'Video editing needs verified source facts.',
  );
  return info;
}

const evenFloor = (value) => Math.max(2, Math.floor(value / 2) * 2);
const displayOrientation = (width, height) =>
  width === height ? 'square' : width < height ? 'portrait' : 'landscape';

export function prepareVideoTransform(info, profile = 'source') {
  videoFacts(info);
  required(
    typeof profile === 'string' && Object.hasOwn(VIDEO_TRANSFORM_PROFILES, profile),
    'Choose a supported video size and compression profile.',
  );
  const selected = VIDEO_TRANSFORM_PROFILES[profile];
  let width = info.width,
    height = info.height;
  if (selected.maxWidth) {
    const scale = Math.min(1, selected.maxWidth / info.width, selected.maxHeight / info.height);
    width = evenFloor(info.width * scale);
    height = evenFloor((width * info.height) / info.width);
    if (height > selected.maxHeight) {
      height = evenFloor(selected.maxHeight);
      width = evenFloor((height * info.width) / info.height);
    }
    required(
      width <= info.width && height <= info.height,
      'The selected transform cannot resize this source without upscaling.',
    );
    const sourceAspect = info.width / info.height,
      outputAspect = width / height;
    required(
      Math.abs(outputAspect / sourceAspect - 1) <= 0.01 &&
        Math.sign(info.width - info.height) === Math.sign(width - height),
      'The selected transform cannot preserve this video’s display aspect and orientation.',
    );
  }
  return Object.freeze({
    format: VIDEO_EDIT_FORMAT,
    operation: 'video-transform',
    profile,
    sourceSha256: info.sha256,
    sourceWidth: info.width,
    sourceHeight: info.height,
    sourceDisplayOrientation: displayOrientation(info.width, info.height),
    width,
    height,
    outputDisplayOrientation: displayOrientation(width, height),
    fit: 'contain',
    allowsUpscale: false,
    targetVideoBitrate: selected.targetVideoBitrate ?? null,
  });
}

export function preparePlaybackRange(info, range) {
  videoFacts(info);
  required(
    range && finite(range.startSeconds) && finite(range.endSeconds),
    'Playback range needs finite start and end times.',
  );
  required(
    range.startSeconds >= 0 &&
      range.endSeconds > range.startSeconds &&
      range.endSeconds <= info.durationSeconds,
    'Playback range must be inside the complete video and have a positive duration.',
  );
  return Object.freeze({
    format: VIDEO_EDIT_FORMAT,
    operation: 'playback-range',
    sourceSha256: info.sha256,
    startSeconds: range.startSeconds,
    endSeconds: range.endSeconds,
    retainsCompleteOriginal: true,
  });
}

export function isCompletePlaybackRange(info, range) {
  const prepared = preparePlaybackRange(info, range);
  return prepared.startSeconds === 0 && prepared.endSeconds === info.durationSeconds;
}

/**
 * Seeks until the browser reports a distinct presented-frame timestamp in the requested direction.
 * This never substitutes a nominal frame rate for decoded-frame evidence.
 */
export async function seekDistinctPresentedFrame(
  source,
  current,
  direction,
  metadata,
  { signal } = {},
) {
  videoFacts(source?.info);
  required(direction === -1 || direction === 1, 'Frame direction must be -1 or 1.');
  const capture = current?.capture;
  required(
    capture?.timingEvidence === 'presented-frame' && finite(capture.observedMediaTime),
    'Decoded-frame stepping needs a browser presented-frame timestamp.',
  );
  const origin = capture.observedMediaTime;
  if ((direction < 0 && origin === 0) || (direction > 0 && origin === source.info.durationSeconds))
    throw new RangeError('The selected frame is already at this edge of the video.');

  // Start below one 240 fps frame, then expand. Every accepted result is based
  // on the browser's observed mediaTime, never the requested decimal alone.
  for (const delta of [1 / 480, 1 / 240, 1 / 120, 1 / 60, 1 / 30, 1 / 15, 0.125, 0.25]) {
    if (signal?.aborted) throw new DOMException('Frame seek cancelled.', 'AbortError');
    const requested = Math.min(
      source.info.durationSeconds,
      Math.max(0, origin + direction * delta),
    );
    if (requested === origin) continue;
    const candidate = await source.capture(requested, metadata, { signal });
    const observed = candidate?.capture?.observedMediaTime;
    if (
      candidate?.capture?.timingEvidence === 'presented-frame' &&
      finite(observed) &&
      (direction < 0 ? observed < origin : observed > origin)
    )
      return Object.freeze({ candidate, direction, fromObservedTime: origin, requested });
  }
  throw fail(
    'The browser did not expose a distinct decoded frame in that direction. Enter a different time instead.',
  );
}

function unsupported(reason = 'No verified physical video converter is installed in this build.') {
  return Object.freeze({ supported: false, formats: Object.freeze([]), reason });
}

async function authenticateSource(original, info) {
  required(original instanceof Blob, 'Physical trimming requires owned source bytes.');
  required(original.size === info.bytes, 'Physical trim source size differs from inspected facts.');
  const sourceSha256 = await sha(original);
  required(
    sourceSha256 === info.sha256,
    'Physical trim source bytes differ from the inspected source hash.',
  );
}

async function inspectAuthenticatedAudio(
  blob,
  expectedSha256,
  inspectAudio,
  { signal, label, range },
) {
  required(
    typeof inspectAudio === 'function',
    'Physical trim needs a separate exact-byte audio-track inspector before it can publish bytes.',
  );
  if (signal?.aborted) throw new DOMException('Physical trim cancelled.', 'AbortError');
  const result = await inspectAudio(blob, { signal, range });
  required(
    result?.format === AUDIO_TRACK_INSPECTION_FORMAT &&
      result.bytes === blob.size &&
      result.sha256 === expectedSha256 &&
      Number.isInteger(result.audioTrackCount) &&
      result.audioTrackCount >= 0 &&
      Array.isArray(result.codecs) &&
      result.codecs.length === result.audioTrackCount &&
      result.codecs.every((codec) => typeof codec === 'string' && codec.length > 0) &&
      Number.isInteger(result.videoTrackCount) &&
      result.videoTrackCount >= 0 &&
      Array.isArray(result.videoCodecs) &&
      result.videoCodecs.length === result.videoTrackCount &&
      result.videoCodecs.every((codec) => typeof codec === 'string' && codec.length > 0),
    `Physical trim ${label} audio inspection did not authenticate the exact bytes.`,
  );
  return result;
}

function authenticateDecodedAacTimeline(inspection, range, label) {
  required(
    inspection.audioTrackCount === 1 &&
      inspection.codecs[0] === 'aac' &&
      Array.isArray(inspection.audioTimelines) &&
      inspection.audioTimelines.length === 1,
    `Physical trim ${label} must contain exactly one decoded AAC audio track.`,
  );
  const timeline = inspection.audioTimelines[0];
  required(
    timeline?.codec === 'aac' &&
      timeline.canDecode === true &&
      Number.isInteger(timeline.sampleRate) &&
      timeline.sampleRate > 0 &&
      Number.isInteger(timeline.numberOfChannels) &&
      timeline.numberOfChannels > 0 &&
      finite(timeline.trackStartSeconds) &&
      finite(timeline.trackEndSeconds) &&
      timeline.trackEndSeconds > timeline.trackStartSeconds &&
      timeline.inspectedRange?.startSeconds === range.startSeconds &&
      timeline.inspectedRange?.endSeconds === range.endSeconds &&
      Array.isArray(timeline.windows) &&
      timeline.windows.length === 3,
    `Physical trim ${label} AAC timeline is missing decoded synchronization evidence.`,
  );
  for (const window of timeline.windows) {
    const frameTolerance = 1 / timeline.sampleRate;
    required(
      finite(window?.startSeconds) &&
        finite(window?.endSeconds) &&
        window.endSeconds > window.startSeconds &&
        Number.isInteger(window.frameCount) &&
        window.frameCount > 0 &&
        finite(window.decodedStartSeconds) &&
        finite(window.decodedEndSeconds) &&
        window.decodedStartSeconds <= window.startSeconds + frameTolerance &&
        window.decodedEndSeconds >= window.endSeconds - frameTolerance &&
        Array.isArray(window.channels) &&
        window.channels.length === timeline.numberOfChannels &&
        window.channels.every(
          (channel) =>
            finite(channel?.rms) &&
            channel.rms >= 0 &&
            finite(channel?.meanAbsolute) &&
            channel.meanAbsolute >= 0 &&
            finite(channel?.peak) &&
            channel.peak >= 0 &&
            channel.peak <= 1.01,
        ),
      `Physical trim ${label} AAC fingerprint is incomplete.`,
    );
  }
  return timeline;
}

function authenticateAudioSynchronization(
  sourceInspection,
  outputInspection,
  sourceRange,
  outputInfo,
) {
  const source = authenticateDecodedAacTimeline(sourceInspection, sourceRange, 'source'),
    selectedDuration = sourceRange.endSeconds - sourceRange.startSeconds,
    outputRange = Object.freeze({ startSeconds: 0, endSeconds: selectedDuration }),
    output = authenticateDecodedAacTimeline(outputInspection, outputRange, 'output'),
    endpointTolerance = Math.min(0.12, Math.max(0.05, outputInfo.durationSeconds * 0.02));
  required(
    sourceInspection.videoCodecs[0] === 'avc' && outputInspection.videoCodecs[0] === 'avc',
    'Audio-bearing physical trim is limited to authenticated AVC/H.264 video.',
  );
  required(
    source.trackStartSeconds <= sourceRange.startSeconds + endpointTolerance &&
      source.trackEndSeconds >= sourceRange.endSeconds - endpointTolerance,
    'Source AAC does not cover the reviewed video trim boundaries.',
  );
  required(
    Math.abs(output.trackStartSeconds) <= endpointTolerance &&
      Math.abs(output.trackEndSeconds - outputInfo.durationSeconds) <= endpointTolerance,
    'Output AAC endpoints do not align with the decoded video endpoints.',
  );
  required(
    output.sampleRate === source.sampleRate && output.numberOfChannels === source.numberOfChannels,
    'Output AAC sample rate or channel layout differs from the authenticated source.',
  );
  for (let windowIndex = 0; windowIndex < source.windows.length; windowIndex++) {
    for (let channelIndex = 0; channelIndex < source.numberOfChannels; channelIndex++) {
      const before = source.windows[windowIndex].channels[channelIndex],
        after = output.windows[windowIndex].channels[channelIndex];
      for (const metric of ['rms', 'meanAbsolute'])
        required(
          Math.abs(after[metric] - before[metric]) <= Math.max(0.015, before[metric] * 0.35),
          'Output AAC decoded fingerprint differs from the selected source audio.',
        );
    }
  }
  return Object.freeze({
    status: 'verified',
    verification: 'exact-byte-container-and-decoded-pcm-windows.v1',
    note: `One AAC track (${source.numberOfChannels} channel${source.numberOfChannels === 1 ? '' : 's'}, ${source.sampleRate} Hz) covers both video endpoints and matches three decoded PCM windows.`,
    source: Object.freeze({
      trackStartSeconds: source.trackStartSeconds,
      trackEndSeconds: source.trackEndSeconds,
      windows: source.windows,
    }),
    output: Object.freeze({
      trackStartSeconds: output.trackStartSeconds,
      trackEndSeconds: output.trackEndSeconds,
      windows: output.windows,
    }),
    endpointToleranceSeconds: endpointTolerance,
  });
}

/**
 * Lazy boundary for an optional maintained converter. The boundary owns output
 * verification; adapter claims alone never make bytes downloadable.
 */
export function createOptionalPhysicalTrimBoundary({
  loadAdapter,
  inspectVideo,
  inspectAudio,
  inspectVisual = inspectDecodedVisualTrim,
  decodePoster,
} = {}) {
  let adapterPromise = null;
  const adapter = async () => {
    if (!loadAdapter) return null;
    adapterPromise ??= Promise.resolve().then(loadAdapter);
    const loaded = await adapterPromise;
    required(
      loaded && typeof loaded.support === 'function' && typeof loaded.trim === 'function',
      'Physical trim adapter has an invalid interface.',
    );
    return loaded;
  };

  async function support(info, { original, range, transform = 'source', signal } = {}) {
    videoFacts(info);
    const plannedTransform = prepareVideoTransform(info, transform);
    const loaded = await adapter();
    if (!loaded) return unsupported();
    if (!(original instanceof Blob))
      return unsupported(
        'Choose the owned source again so its audio tracks can be inspected from the exact bytes.',
      );
    if (typeof inspectAudio !== 'function')
      return unsupported(
        'This build has no separate exact-byte audio-track inspector. Physical trim stays unavailable.',
      );
    await authenticateSource(original, info);
    if (signal?.aborted) throw new DOMException('Physical trim cancelled.', 'AbortError');
    const playback = range ? preparePlaybackRange(info, range) : null;
    const sourceAudio = await inspectAuthenticatedAudio(original, info.sha256, inspectAudio, {
      signal,
      label: 'source',
      range: playback,
    });
    if (sourceAudio.videoTrackCount !== 1)
      return unsupported(
        'Physical trim conversion requires exactly one authenticated video track.',
      );
    if (sourceAudio.audioTrackCount > 1)
      return unsupported('Physical trim supports at most one authenticated audio track.');
    if (sourceAudio.audioTrackCount === 1) {
      if (!playback)
        return unsupported('Choose a reviewed playback range before checking AAC conversion.');
      if (info.mime !== 'video/mp4' || sourceAudio.videoCodecs[0] !== 'avc')
        return unsupported(
          'Audio conversion is limited to one AVC/H.264 video track plus one AAC audio track in MP4.',
        );
      try {
        authenticateDecodedAacTimeline(sourceAudio, playback, 'source');
      } catch (error) {
        return unsupported(error instanceof Error ? error.message : String(error));
      }
    }
    const result = await loaded.support(original, info, playback, {
      signal,
      transform: plannedTransform,
    });
    if (!result?.supported)
      return unsupported(result?.reason || 'The optional converter does not support this source.');
    required(
      Array.isArray(result.formats) &&
        result.formats.length > 0 &&
        result.formats.every((mime) => ['video/mp4', 'video/webm'].includes(mime)),
      'Physical trim adapter returned invalid format support.',
    );
    return Object.freeze({
      supported: true,
      formats: Object.freeze([...new Set(result.formats)]),
      reason: '',
      detail: typeof result.detail === 'string' ? result.detail : '',
      transform: plannedTransform,
      sourceAudio,
    });
  }

  async function trim(original, info, range, { transform = 'source', signal } = {}) {
    videoFacts(info);
    const playback = preparePlaybackRange(info, range);
    const plannedTransform = prepareVideoTransform(info, transform);
    required(
      !isCompletePlaybackRange(info, range) || plannedTransform.profile !== 'source',
      'Choose a shorter range or a resize/compression profile before transforming the video.',
    );
    const capability = await support(info, { original, range, transform, signal });
    required(capability.supported, capability.reason);
    if (signal?.aborted) throw new DOMException('Physical trim cancelled.', 'AbortError');
    const loaded = await adapter();
    const transformed = await loaded.trim(original, playback, {
      signal,
      transform: plannedTransform,
    });
    required(transformed?.blob instanceof Blob, 'Physical trim adapter returned no video bytes.');
    required(
      transformed.blob.size > 0 &&
        transformed.blob.size <= VIDEO_POSTER_LIMITS.sourceBytes &&
        capability.formats.includes(transformed.blob.type),
      'Physical trim adapter returned an unsupported or empty video.',
    );
    const outputSha256 = await sha(transformed.blob);
    required(outputSha256 !== info.sha256, 'Physical trim did not produce different output bytes.');

    const inspect = inspectVideo ?? openVideoPosterSource;
    let source = null,
      output = null;
    try {
      source = await inspect(original, { signal });
      output = await inspect(transformed.blob, { signal });
      const expectedDuration = playback.endSeconds - playback.startSeconds;
      const tolerance = Math.min(0.25, Math.max(0.05, expectedDuration * 0.02));
      required(
        output.info.sha256 === outputSha256 &&
          output.info.bytes === transformed.blob.size &&
          output.info.mime === transformed.blob.type,
        'Decoded trim identity differs from its exported bytes.',
      );
      required(
        output.info.width === plannedTransform.width &&
          output.info.height === plannedTransform.height,
        'Physical transform decoded dimensions differ from the reviewed output plan.',
      );
      required(
        Math.abs(output.info.durationSeconds - expectedDuration) <= tolerance,
        'Decoded trim duration differs from the requested physical range.',
      );
      const observedContainerBitsPerSecond = Math.ceil(
        (transformed.blob.size * 8) / output.info.durationSeconds,
      );
      if (plannedTransform.targetVideoBitrate !== null)
        required(
          observedContainerBitsPerSecond <=
            plannedTransform.targetVideoBitrate * BITRATE_TOLERANCE_FACTOR +
              BITRATE_TOLERANCE_BITS_PER_SECOND,
          'Physical transform output exceeds the bounded bitrate review allowance.',
        );
      const outputAudio = await inspectAuthenticatedAudio(
        transformed.blob,
        outputSha256,
        inspectAudio,
        {
          signal,
          label: 'output',
          range: Object.freeze({
            startSeconds: 0,
            endSeconds: playback.endSeconds - playback.startSeconds,
          }),
        },
      );
      required(
        outputAudio.videoTrackCount === 1 && outputAudio.videoCodecs[0] === 'avc',
        'Physical trim output is not exactly one authenticated AVC/H.264 video track.',
      );
      const audioSync =
        capability.sourceAudio.audioTrackCount === 0
          ? (() => {
              required(
                outputAudio.audioTrackCount === 0,
                'Physical trim added an unexpected audio track.',
              );
              return Object.freeze({
                status: 'not-present',
                verification: 'authenticated-container-track-inventory',
                note: 'Separate exact-byte inspections found zero audio tracks in the source and output. No audio synchronization claim applies.',
              });
            })()
          : authenticateAudioSynchronization(
              capability.sourceAudio,
              outputAudio,
              playback,
              output.info,
            );
      required(
        source.info.sha256 === info.sha256 &&
          source.info.bytes === original.size &&
          source.info.mime === info.mime &&
          source.info.width === info.width &&
          source.info.height === info.height &&
          source.info.durationSeconds === info.durationSeconds,
        'Reopened physical trim source differs from the inspected source facts.',
      );
      required(
        typeof inspectVisual === 'function',
        'Physical trim needs decoded start/end visual inspection before it can publish bytes.',
      );
      const visual = authenticateVisualTrimInspection(
        await inspectVisual(
          {
            source,
            output,
            sourceInfo: source.info,
            outputInfo: output.info,
            range: playback,
          },
          { signal, ...(decodePoster ? { decodePoster } : {}) },
        ),
        source.info,
        output.info,
        playback,
      );
      return Object.freeze({
        blob: transformed.blob,
        info: output.info,
        evidence: Object.freeze({
          format: VIDEO_EDIT_FORMAT,
          operation: 'physical-trim',
          sourceSha256: info.sha256,
          outputSha256,
          sourceRange: Object.freeze({
            startSeconds: playback.startSeconds,
            endSeconds: playback.endSeconds,
          }),
          decodedDurationSeconds: output.info.durationSeconds,
          decodedWidth: output.info.width,
          decodedHeight: output.info.height,
          transform: Object.freeze({
            ...plannedTransform,
            observedContainerBitsPerSecond,
            bitrateReviewLimit:
              plannedTransform.targetVideoBitrate === null
                ? null
                : plannedTransform.targetVideoBitrate * BITRATE_TOLERANCE_FACTOR +
                  BITRATE_TOLERANCE_BITS_PER_SECOND,
          }),
          audioSync,
          videoCodec: Object.freeze({
            output: outputAudio.videoCodecs[0],
            verification: 'authenticated-container-track-inventory',
          }),
          visual,
        }),
      });
    } finally {
      source?.dispose();
      output?.dispose();
    }
  }

  return Object.freeze({ support, trim });
}
