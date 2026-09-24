import { required } from './data-json.mjs';
import { openVideoPosterSource, VIDEO_POSTER_LIMITS } from './video-poster.mjs';

export const VIDEO_EDIT_FORMAT = 'revealline-video-edit.v1';
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

/**
 * Lazy boundary for an optional maintained converter. The boundary owns output
 * verification; adapter claims alone never make bytes downloadable.
 */
export function createOptionalPhysicalTrimBoundary({ loadAdapter, inspectVideo } = {}) {
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

  async function support(info) {
    videoFacts(info);
    const loaded = await adapter();
    if (!loaded) return unsupported();
    const result = await loaded.support(info);
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
    });
  }

  async function trim(original, info, range, { signal } = {}) {
    videoFacts(info);
    required(original instanceof Blob, 'Physical trimming requires owned source bytes.');
    required(
      original.size === info.bytes,
      'Physical trim source size differs from inspected facts.',
    );
    const sourceSha256 = await sha(original);
    required(
      sourceSha256 === info.sha256,
      'Physical trim source bytes differ from the inspected source hash.',
    );
    const playback = preparePlaybackRange(info, range);
    required(
      !isCompletePlaybackRange(info, range),
      'Choose a shorter range before physically trimming the video.',
    );
    const capability = await support(info);
    required(capability.supported, capability.reason);
    if (signal?.aborted) throw new DOMException('Physical trim cancelled.', 'AbortError');
    const loaded = await adapter();
    const transformed = await loaded.trim(original, playback, { signal });
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
    const output = await inspect(transformed.blob, { signal });
    try {
      const expectedDuration = playback.endSeconds - playback.startSeconds;
      const tolerance = Math.min(0.25, Math.max(0.05, expectedDuration * 0.02));
      required(
        output.info.sha256 === outputSha256 &&
          output.info.bytes === transformed.blob.size &&
          output.info.mime === transformed.blob.type,
        'Decoded trim identity differs from its exported bytes.',
      );
      required(
        output.info.width === info.width && output.info.height === info.height,
        'Physical trim changed decoded picture orientation or dimensions.',
      );
      required(
        Math.abs(output.info.durationSeconds - expectedDuration) <= tolerance,
        'Decoded trim duration differs from the requested physical range.',
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
          audioSync: Object.freeze({
            status:
              transformed.audioSync?.status === 'verified' ? 'adapter-verified' : 'unverified',
            note:
              transformed.audioSync?.status === 'verified'
                ? String(
                    transformed.audioSync.note || 'Verified by the optional converter adapter.',
                  )
                : 'This browser boundary did not independently decode and compare audio timestamps.',
          }),
        }),
      });
    } finally {
      output.dispose();
    }
  }

  return Object.freeze({ support, trim });
}
