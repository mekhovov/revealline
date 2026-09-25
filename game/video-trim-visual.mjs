import { required } from './data-json.mjs';

export const VISUAL_TRIM_INSPECTION_FORMAT = 'revealline-visual-trim-inspection.v1';
const WIDTH = 24;
const HEIGHT = 14;
const MEAN_RGB_LIMIT = 0.08;
const HIGH_ERROR_LIMIT = 0.15;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const sha = async (blob) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer())),
    (value) => value.toString(16).padStart(2, '0'),
  ).join('');
const aborted = (signal) => {
  if (signal?.aborted) throw new DOMException('Physical trim cancelled.', 'AbortError');
};

async function decodePoster(blob, { signal } = {}) {
  aborted(signal);
  required(
    typeof globalThis.createImageBitmap === 'function',
    'Decoded visual trim inspection needs browser image decoding.',
  );
  const bitmap = await globalThis.createImageBitmap(blob);
  let canvas;
  try {
    aborted(signal);
    canvas =
      typeof globalThis.OffscreenCanvas === 'function'
        ? new globalThis.OffscreenCanvas(WIDTH, HEIGHT)
        : globalThis.document?.createElement?.('canvas');
    required(
      canvas && typeof canvas.getContext === 'function',
      'Visual sampling canvas is unavailable.',
    );
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    required(
      context && typeof context.getImageData === 'function',
      'Visual pixel sampling is unavailable.',
    );
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, 0, 0, WIDTH, HEIGHT);
    return Object.freeze({
      width: WIDTH,
      height: HEIGHT,
      pixels: new Uint8ClampedArray(context.getImageData(0, 0, WIDTH, HEIGHT).data),
    });
  } finally {
    bitmap.close?.();
    if (canvas) canvas.width = canvas.height = 0;
  }
}

async function capture(source, time, id, expectedSha256, decode, { signal } = {}) {
  aborted(signal);
  const candidate = await source.capture(
    time,
    {
      id,
      provenance: {
        kind: 'original',
        credit: 'Local video owner',
        source: 'Ephemeral physical-trim boundary inspection; picture is not retained.',
      },
    },
    { signal },
  );
  aborted(signal);
  required(
    candidate?.blob instanceof Blob &&
      candidate.capture?.sourceSha256 === expectedSha256 &&
      candidate.capture?.timingEvidence === 'presented-frame' &&
      finite(candidate.capture.observedMediaTime) &&
      candidate.capture?.sha256 === candidate.asset?.sha256 &&
      candidate.capture?.width === candidate.asset?.width &&
      candidate.capture?.height === candidate.asset?.height,
    'Decoded visual trim inspection did not authenticate a presented frame.',
  );
  const posterSha256 = await sha(candidate.blob);
  required(
    posterSha256 === candidate.asset.sha256 && candidate.blob.size === candidate.asset.bytes,
    'Decoded visual trim poster bytes differ from their captured identity.',
  );
  const sample = await decode(candidate.blob, { signal });
  required(
    sample?.width === WIDTH &&
      sample?.height === HEIGHT &&
      sample?.pixels instanceof Uint8ClampedArray &&
      sample.pixels.length === WIDTH * HEIGHT * 4,
    'Decoded visual trim sampler returned invalid pixels.',
  );
  return Object.freeze({
    requestedTime: time,
    observedTime: candidate.capture.observedMediaTime,
    posterSha256,
    pixels: sample.pixels,
  });
}

function compare(source, output) {
  let difference = 0,
    highErrorPixels = 0;
  const pixelCount = source.pixels.length / 4;
  for (let at = 0; at < source.pixels.length; at += 4) {
    let pixelDifference = 0;
    for (let channel = 0; channel < 3; channel++)
      pixelDifference += Math.abs(source.pixels[at + channel] - output.pixels[at + channel]);
    difference += pixelDifference;
    if (pixelDifference / (3 * 255) > 0.2) highErrorPixels++;
  }
  const meanAbsoluteRgbError = difference / (pixelCount * 3 * 255),
    highErrorPixelFraction = highErrorPixels / pixelCount;
  required(
    meanAbsoluteRgbError <= MEAN_RGB_LIMIT && highErrorPixelFraction <= HIGH_ERROR_LIMIT,
    'Decoded physical-trim boundary picture differs from the selected source frame.',
  );
  return Object.freeze({
    meanAbsoluteRgbError: Number(meanAbsoluteRgbError.toFixed(6)),
    highErrorPixelFraction: Number(highErrorPixelFraction.toFixed(6)),
  });
}

/** Compare fresh presented-frame decodes at both physical trim boundaries. */
export async function inspectDecodedVisualTrim(
  { source, output, sourceInfo, outputInfo, range },
  { signal, decodePoster: decode = decodePoster } = {},
) {
  required(
    source &&
      output &&
      typeof source.capture === 'function' &&
      typeof output.capture === 'function',
    'Decoded visual trim inspection needs reopened video sources.',
  );
  required(
    typeof decode === 'function' &&
      /^[a-f0-9]{64}$/.test(sourceInfo?.sha256) &&
      /^[a-f0-9]{64}$/.test(outputInfo?.sha256) &&
      finite(sourceInfo.durationSeconds) &&
      finite(outputInfo.durationSeconds) &&
      finite(range?.startSeconds) &&
      finite(range?.endSeconds) &&
      range.startSeconds >= 0 &&
      range.endSeconds > range.startSeconds &&
      range.endSeconds <= sourceInfo.durationSeconds,
    'Decoded visual trim inspection needs verified video facts and range.',
  );
  const duration = range.endSeconds - range.startSeconds,
    edgeInset = Math.min(0.001, duration / 1000),
    timestampTolerance = Math.min(0.25, Math.max(0.05, duration * 0.02));
  required(
    outputInfo.durationSeconds > edgeInset,
    'Decoded visual trim inspection needs a positive output duration.',
  );
  const requests = {
      // Probe one millisecond inside both edges. A paused browser may not emit a presented-frame
      // callback for its already-loaded time zero, while an explicit bounded seek does.
      start: { source: range.startSeconds + edgeInset, output: edgeInset },
      end: {
        source: range.endSeconds - edgeInset,
        output: outputInfo.durationSeconds - edgeInset,
      },
    },
    edges = {};
  for (const edge of ['start', 'end']) {
    aborted(signal);
    const [sourceFrame, outputFrame] = await Promise.all([
      capture(source, requests[edge].source, `trim-source-${edge}`, sourceInfo.sha256, decode, {
        signal,
      }),
      capture(output, requests[edge].output, `trim-output-${edge}`, outputInfo.sha256, decode, {
        signal,
      }),
    ]);
    required(
      Math.abs(sourceFrame.observedTime - range.startSeconds - outputFrame.observedTime) <=
        timestampTolerance,
      `Decoded physical-trim ${edge} timestamps do not align with the selected source range.`,
    );
    edges[edge] = Object.freeze({
      sourceRequestedTime: sourceFrame.requestedTime,
      sourceObservedTime: sourceFrame.observedTime,
      sourcePosterSha256: sourceFrame.posterSha256,
      outputRequestedTime: outputFrame.requestedTime,
      outputObservedTime: outputFrame.observedTime,
      outputPosterSha256: outputFrame.posterSha256,
      ...compare(sourceFrame, outputFrame),
    });
  }
  return Object.freeze({
    format: VISUAL_TRIM_INSPECTION_FORMAT,
    sourceSha256: sourceInfo.sha256,
    outputSha256: outputInfo.sha256,
    sourceRange: Object.freeze({
      startSeconds: range.startSeconds,
      endSeconds: range.endSeconds,
    }),
    decodedOutputDurationSeconds: outputInfo.durationSeconds,
    method: 'fresh-presented-frame-decoded-png-rgb-grid.v1',
    sampleWidth: WIDTH,
    sampleHeight: HEIGHT,
    meanAbsoluteRgbLimit: MEAN_RGB_LIMIT,
    highErrorPixelFractionLimit: HIGH_ERROR_LIMIT,
    start: edges.start,
    end: edges.end,
  });
}

export function authenticateVisualTrimInspection(result, sourceInfo, outputInfo, range) {
  const duration = range.endSeconds - range.startSeconds,
    edgeInset = Math.min(0.001, duration / 1000),
    timestampTolerance = Math.min(0.25, Math.max(0.05, duration * 0.02)),
    requests = {
      start: { source: range.startSeconds + edgeInset, output: edgeInset },
      end: {
        source: range.endSeconds - edgeInset,
        output: outputInfo.durationSeconds - edgeInset,
      },
    };
  required(
    result?.format === VISUAL_TRIM_INSPECTION_FORMAT &&
      result.sourceSha256 === sourceInfo.sha256 &&
      result.outputSha256 === outputInfo.sha256 &&
      result.sourceRange?.startSeconds === range.startSeconds &&
      result.sourceRange?.endSeconds === range.endSeconds &&
      result.decodedOutputDurationSeconds === outputInfo.durationSeconds &&
      result.method === 'fresh-presented-frame-decoded-png-rgb-grid.v1' &&
      result.sampleWidth === WIDTH &&
      result.sampleHeight === HEIGHT &&
      result.meanAbsoluteRgbLimit === MEAN_RGB_LIMIT &&
      result.highErrorPixelFractionLimit === HIGH_ERROR_LIMIT &&
      ['start', 'end'].every(
        (edge) =>
          result[edge] &&
          finite(result[edge].sourceRequestedTime) &&
          result[edge].sourceRequestedTime === requests[edge].source &&
          finite(result[edge].sourceObservedTime) &&
          /^[a-f0-9]{64}$/.test(result[edge].sourcePosterSha256) &&
          finite(result[edge].outputRequestedTime) &&
          result[edge].outputRequestedTime === requests[edge].output &&
          finite(result[edge].outputObservedTime) &&
          Math.abs(
            result[edge].sourceObservedTime - range.startSeconds - result[edge].outputObservedTime,
          ) <= timestampTolerance &&
          /^[a-f0-9]{64}$/.test(result[edge].outputPosterSha256) &&
          finite(result[edge].meanAbsoluteRgbError) &&
          result[edge].meanAbsoluteRgbError >= 0 &&
          result[edge].meanAbsoluteRgbError <= MEAN_RGB_LIMIT &&
          finite(result[edge].highErrorPixelFraction) &&
          result[edge].highErrorPixelFraction >= 0 &&
          result[edge].highErrorPixelFraction <= HIGH_ERROR_LIMIT,
      ),
    'Physical trim visual inspection is missing or stale for these exact bytes and boundaries.',
  );
  return result;
}
