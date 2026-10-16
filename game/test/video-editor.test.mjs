import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AUDIO_TRACK_INSPECTION_FORMAT,
  createOptionalPhysicalTrimBoundary,
  inspectDecodedVisualTrim,
  isCompletePlaybackRange,
  preparePlaybackRange,
  prepareVideoTransform,
  seekDistinctPresentedFrame,
  VIDEO_EDIT_FORMAT,
  VISUAL_TRIM_INSPECTION_FORMAT,
} from '../video-editor.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceBytes = Buffer.from('complete source video');
const info = Object.freeze({
  mime: 'video/mp4',
  width: 640,
  height: 360,
  durationSeconds: 6,
  bytes: sourceBytes.length,
  sha256: digest(sourceBytes),
});
const exactAudioInspection =
  (audioTrackCount = 0, codecs = [], videoCodec) =>
  async (blob) => ({
    format: AUDIO_TRACK_INSPECTION_FORMAT,
    bytes: blob.size,
    sha256: digest(Buffer.from(await blob.arrayBuffer())),
    audioTrackCount,
    codecs,
    videoTrackCount: 1,
    videoCodecs: [videoCodec || (blob.type === 'video/webm' ? 'vp9' : 'avc')],
  });
const exactAacInspection =
  ({ outputBytes, outputDuration = 4, outputEndOffset = 0, outputRms = 0.2 } = {}) =>
  async (blob, { range } = {}) => {
    const bytes = Buffer.from(await blob.arrayBuffer()),
      output = outputBytes ? bytes.equals(outputBytes) : false,
      duration = output ? outputDuration : info.durationSeconds,
      selected = range ?? { startSeconds: 0, endSeconds: duration },
      windowDuration = Math.min(
        0.12,
        Math.max(0.04, (selected.endSeconds - selected.startSeconds) * 0.04),
      );
    return {
      format: AUDIO_TRACK_INSPECTION_FORMAT,
      bytes: blob.size,
      sha256: digest(bytes),
      audioTrackCount: 1,
      codecs: ['aac'],
      videoTrackCount: 1,
      videoCodecs: ['avc'],
      audioTimelines: [
        {
          codec: 'aac',
          sampleRate: 48_000,
          numberOfChannels: 1,
          canDecode: true,
          trackStartSeconds: 0,
          trackEndSeconds: duration + (output ? outputEndOffset : 0),
          inspectedRange: { ...selected },
          windows: [0.2, 0.5, 0.8].map((fraction) => {
            const center =
                selected.startSeconds + (selected.endSeconds - selected.startSeconds) * fraction,
              startSeconds = center - windowDuration / 2,
              endSeconds = center + windowDuration / 2;
            return {
              startSeconds,
              endSeconds,
              decodedStartSeconds: startSeconds,
              decodedEndSeconds: endSeconds,
              frameCount: Math.round(windowDuration * 48_000),
              channels: [{ rms: output ? outputRms : 0.2, meanAbsolute: 0.18, peak: 0.3 }],
            };
          }),
        },
      ],
    };
  };
const exactVisualInspection = async ({ sourceInfo, outputInfo, range }) => ({
  format: VISUAL_TRIM_INSPECTION_FORMAT,
  sourceSha256: sourceInfo.sha256,
  outputSha256: outputInfo.sha256,
  sourceRange: { startSeconds: range.startSeconds, endSeconds: range.endSeconds },
  decodedOutputDurationSeconds: outputInfo.durationSeconds,
  method: 'fresh-presented-frame-decoded-png-rgb-grid.v1',
  sampleWidth: 24,
  sampleHeight: 14,
  meanAbsoluteRgbLimit: 0.08,
  highErrorPixelFractionLimit: 0.15,
  ...Object.fromEntries(
    ['start', 'end'].map((edge, index) => [
      edge,
      {
        sourceRequestedTime: index ? range.endSeconds - 0.001 : range.startSeconds + 0.001,
        sourceObservedTime: index ? range.endSeconds - 0.001 : range.startSeconds + 0.001,
        sourcePosterSha256: String(index + 1).repeat(64),
        outputRequestedTime: index ? outputInfo.durationSeconds - 0.001 : 0.001,
        outputObservedTime: index ? outputInfo.durationSeconds - 0.001 : 0.001,
        outputPosterSha256: String(index + 3).repeat(64),
        meanAbsoluteRgbError: 0.003,
        highErrorPixelFraction: 0,
      },
    ]),
  ),
});

test('playback range retains complete original and rejects clamping or empty ranges', () => {
  const range = preparePlaybackRange(info, { startSeconds: 1.25, endSeconds: 5 });
  assert.deepEqual(range, {
    format: VIDEO_EDIT_FORMAT,
    operation: 'playback-range',
    sourceSha256: info.sha256,
    startSeconds: 1.25,
    endSeconds: 5,
    retainsCompleteOriginal: true,
  });
  assert.ok(Object.isFrozen(range));
  assert.equal(isCompletePlaybackRange(info, { startSeconds: 0, endSeconds: 6 }), true);
  for (const invalid of [
    { startSeconds: -1, endSeconds: 2 },
    { startSeconds: 2, endSeconds: 2 },
    { startSeconds: 2, endSeconds: 7 },
    { startSeconds: NaN, endSeconds: 4 },
  ])
    assert.throws(() => preparePlaybackRange(info, invalid), /Playback range/);
});

test('bounded video transform profiles preserve display aspect/orientation without upscaling', () => {
  const landscape = { ...info, width: 1920, height: 1080 },
    portrait = { ...info, width: 1080, height: 1920 };
  assert.deepEqual(prepareVideoTransform(landscape, 'balanced'), {
    format: VIDEO_EDIT_FORMAT,
    operation: 'video-transform',
    profile: 'balanced',
    sourceSha256: info.sha256,
    sourceWidth: 1920,
    sourceHeight: 1080,
    sourceDisplayOrientation: 'landscape',
    width: 1280,
    height: 720,
    outputDisplayOrientation: 'landscape',
    fit: 'contain',
    allowsUpscale: false,
    targetVideoBitrate: 2_500_000,
  });
  const compactPortrait = prepareVideoTransform(portrait, 'compact');
  assert.deepEqual([compactPortrait.width, compactPortrait.height], [202, 358]);
  assert.equal(compactPortrait.sourceDisplayOrientation, 'portrait');
  assert.equal(compactPortrait.outputDisplayOrientation, 'portrait');
  assert.ok(compactPortrait.width < compactPortrait.height);
  const rotatedDisplay = { ...info, width: 360, height: 640 };
  assert.deepEqual(
    [
      prepareVideoTransform(rotatedDisplay, 'source').width,
      prepareVideoTransform(rotatedDisplay, 'source').height,
    ],
    [360, 640],
  );
  assert.deepEqual(
    [
      prepareVideoTransform(rotatedDisplay, 'compact').width,
      prepareVideoTransform(rotatedDisplay, 'compact').height,
    ],
    [202, 358],
  );
  const small = prepareVideoTransform(info, 'balanced');
  assert.deepEqual([small.width, small.height], [640, 360]);
  assert.throws(() => prepareVideoTransform(info, 'unbounded'), /supported video size/);
});

test('Balanced and Compact derive an even bounded transform for every display orientation', () => {
  const cases = [
    {
      dimensions: [1920, 1080],
      orientation: 'landscape',
      balanced: [1280, 720],
      compact: [640, 360],
    },
    {
      dimensions: [1080, 1920],
      orientation: 'portrait',
      balanced: [404, 718],
      compact: [202, 358],
    },
    { dimensions: [1000, 1000], orientation: 'square', balanced: [720, 720], compact: [360, 360] },
    { dimensions: [853, 480], orientation: 'landscape', balanced: [852, 478], compact: [638, 358] },
  ];
  for (const {
    dimensions: [width, height],
    orientation,
    balanced,
    compact,
  } of cases) {
    const source = { ...info, width, height };
    for (const [profile, expected] of [
      ['balanced', balanced],
      ['compact', compact],
    ]) {
      const result = prepareVideoTransform(source, profile);
      assert.deepEqual([result.width, result.height], expected);
      assert.equal(result.sourceDisplayOrientation, orientation);
      assert.equal(result.outputDisplayOrientation, orientation);
      assert.equal(result.width % 2, 0);
      assert.equal(result.height % 2, 0);
      assert.ok(result.width <= width && result.height <= height, 'profiles never upscale');
      assert.ok(
        Math.abs(result.width / result.height / (width / height) - 1) <= 0.01,
        'even encoder dimensions remain within the reviewed aspect tolerance',
      );
    }
  }
});

test('decoded-frame step publishes only a distinct browser-presented timestamp', async () => {
  const requested = [];
  const source = {
    info,
    async capture(time) {
      requested.push(time);
      const observed = time - 2 < 1 / 60 ? 2 : 2.04;
      return {
        blob: new Blob(['png']),
        capture: {
          requestedTime: time,
          observedMediaTime: observed,
          timingEvidence: 'presented-frame',
        },
      };
    },
  };
  const current = {
    capture: { observedMediaTime: 2, timingEvidence: 'presented-frame' },
  };
  const result = await seekDistinctPresentedFrame(source, current, 1, {
    id: 'frame-step',
    provenance: { kind: 'original', credit: 'owner', source: 'test' },
  });
  assert.equal(result.fromObservedTime, 2);
  assert.equal(result.candidate.capture.observedMediaTime, 2.04);
  assert.ok(requested.length > 1, 'Repeated same-frame seeks remain private.');
  assert.ok(requested.every((value) => value > 2));
});

test('decoded-frame step is explicit when native presented-frame evidence is unavailable', async () => {
  const source = { info, capture: () => assert.fail('capture should not run') };
  await assert.rejects(
    seekDistinctPresentedFrame(
      source,
      { capture: { observedMediaTime: null, timingEvidence: 'playhead-estimate' } },
      1,
      {},
    ),
    /presented-frame timestamp/,
  );
});

function visualSource(sourceInfo, { changedEnd = false, estimateOnly = false } = {}) {
  return {
    info: sourceInfo,
    async capture(time, metadata) {
      const end = metadata.id.endsWith('end');
      const color = end ? (changedEnd ? [18, 30, 220] : [24, 170, 72]) : [190, 42, 28];
      const bytes = Buffer.from(JSON.stringify(color));
      const posterSha256 = digest(bytes);
      return {
        blob: new Blob([bytes], { type: 'image/png' }),
        asset: {
          width: 640,
          height: 360,
          bytes: bytes.length,
          sha256: posterSha256,
        },
        capture: {
          sourceSha256: sourceInfo.sha256,
          requestedTime: time,
          observedMediaTime: estimateOnly ? null : time,
          timingEvidence: estimateOnly ? 'playhead-estimate' : 'presented-frame',
          width: 640,
          height: 360,
          sha256: posterSha256,
        },
      };
    },
  };
}

async function decodeColorPoster(blob) {
  const color = JSON.parse(await blob.text()),
    pixels = new Uint8ClampedArray(24 * 14 * 4);
  for (let at = 0; at < pixels.length; at += 4) pixels.set([...color, 255], at);
  return { width: 24, height: 14, pixels };
}

test('decoded visual trim evidence binds aligned start and end pictures to exact videos', async () => {
  const outputBytes = Buffer.from('visual output video');
  const outputInfo = {
    ...info,
    durationSeconds: 4,
    bytes: outputBytes.length,
    sha256: digest(outputBytes),
  };
  const result = await inspectDecodedVisualTrim(
    {
      source: visualSource(info),
      output: visualSource(outputInfo),
      sourceInfo: info,
      outputInfo,
      range: { startSeconds: 1, endSeconds: 5 },
    },
    { decodePoster: decodeColorPoster },
  );
  assert.equal(result.format, VISUAL_TRIM_INSPECTION_FORMAT);
  assert.equal(result.sourceSha256, info.sha256);
  assert.equal(result.outputSha256, outputInfo.sha256);
  assert.equal(result.start.sourceObservedTime, 1.001);
  assert.equal(result.start.outputObservedTime, 0.001);
  assert.equal(result.end.sourceObservedTime, 4.999);
  assert.equal(result.end.outputObservedTime, 3.999);
  assert.equal(result.start.meanAbsoluteRgbError, 0);
  assert.equal(result.end.meanAbsoluteRgbError, 0);
});

test('decoded visual trim evidence fails closed for changed or estimate-only boundary pictures', async () => {
  const outputBytes = Buffer.from('visual mismatch output');
  const outputInfo = {
    ...info,
    durationSeconds: 4,
    bytes: outputBytes.length,
    sha256: digest(outputBytes),
  };
  const inspect = (output) =>
    inspectDecodedVisualTrim(
      {
        source: visualSource(info),
        output,
        sourceInfo: info,
        outputInfo,
        range: { startSeconds: 1, endSeconds: 5 },
      },
      { decodePoster: decodeColorPoster },
    );
  await assert.rejects(inspect(visualSource(outputInfo, { changedEnd: true })), /boundary picture/);
  await assert.rejects(
    inspect(visualSource(outputInfo, { estimateOnly: true })),
    /authenticate a presented frame/,
  );
});

test('physical trim boundary stays lazy and explicitly unsupported without an adapter', async () => {
  const boundary = createOptionalPhysicalTrimBoundary();
  assert.deepEqual(await boundary.support(info), {
    supported: false,
    formats: [],
    reason: 'No verified physical video converter is installed in this build.',
  });
  await assert.rejects(
    boundary.trim(new Blob([sourceBytes], { type: 'video/mp4' }), info, {
      startSeconds: 1,
      endSeconds: 5,
    }),
    /No verified physical video converter/,
  );
});

test('optional physical trim verifies changed bytes and decoded duration/orientation before return', async () => {
  const outputBytes = Buffer.from('physically transformed clip bytes');
  let loads = 0,
    trims = 0,
    inspections = 0,
    audioInspections = 0,
    disposed = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    async loadAdapter() {
      loads++;
      return {
        async support(original, source) {
          assert.ok(original === undefined || original instanceof Blob);
          assert.equal(source, info);
          return { supported: true, formats: ['video/mp4'] };
        },
        async trim(original, range) {
          trims++;
          assert.deepEqual(Buffer.from(await original.arrayBuffer()), sourceBytes);
          assert.equal(range.retainsCompleteOriginal, true);
          return {
            blob: new Blob([outputBytes], { type: 'video/mp4' }),
            audioSync: {
              status: 'verified',
              note: 'Fixture timestamps matched.',
            },
          };
        },
      };
    },
    async inspectVideo(blob) {
      inspections++;
      const bytes = Buffer.from(await blob.arrayBuffer());
      const isSource = bytes.equals(sourceBytes);
      return {
        info: Object.freeze({
          mime: blob.type,
          width: 640,
          height: 360,
          durationSeconds: isSource ? 6 : 4,
          bytes: bytes.length,
          sha256: digest(bytes),
        }),
        dispose() {
          disposed++;
        },
      };
    },
    async inspectAudio(blob) {
      audioInspections++;
      return exactAudioInspection()(blob);
    },
    inspectVisual: exactVisualInspection,
  });
  assert.equal(loads, 0);
  const original = new Blob([sourceBytes], { type: 'video/mp4' });
  assert.equal(
    (
      await boundary.support(info, {
        original,
        range: { startSeconds: 1, endSeconds: 5 },
      })
    ).supported,
    true,
  );
  assert.equal(loads, 1);
  const result = await boundary.trim(original, info, {
    startSeconds: 1,
    endSeconds: 5,
  });
  assert.equal(loads, 1, 'The lazy adapter is loaded once.');
  assert.equal(trims, 1);
  assert.equal(inspections, 2, 'Exact source and output bytes are independently reopened.');
  assert.equal(audioInspections, 3, 'Support and trim re-authenticate source and output audio.');
  assert.equal(disposed, 2);
  assert.equal(result.info.sha256, digest(outputBytes));
  assert.equal(result.evidence.outputSha256, digest(outputBytes));
  assert.equal(result.evidence.decodedDurationSeconds, 4);
  assert.deepEqual(
    [result.evidence.decodedWidth, result.evidence.decodedHeight],
    [info.width, info.height],
  );
  assert.equal(result.evidence.audioSync.status, 'not-present');
  assert.equal(result.evidence.audioSync.verification, 'authenticated-container-track-inventory');
  assert.deepEqual(result.evidence.videoCodec, {
    output: 'avc',
    verification: 'authenticated-container-track-inventory',
  });
  assert.doesNotMatch(result.evidence.audioSync.note, /Fixture timestamps matched/);
  assert.equal(result.evidence.visual.format, VISUAL_TRIM_INSPECTION_FORMAT);
  assert.equal(result.evidence.visual.start.meanAbsoluteRgbError, 0.003);
});

test('physical transform authenticates silent WebM input and publishes only verified AVC MP4', async () => {
  const webmBytes = Buffer.from('complete silent webm source'),
    outputBytes = Buffer.from('converted avc mp4 output'),
    webmInfo = Object.freeze({
      ...info,
      mime: 'video/webm',
      bytes: webmBytes.length,
      sha256: digest(webmBytes),
    });
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async (original, source) => {
        assert.equal(original.type, 'video/webm');
        assert.equal(source, webmInfo);
        return { supported: true, formats: ['video/mp4'] };
      },
      trim: async () => ({ blob: new Blob([outputBytes], { type: 'video/mp4' }) }),
    }),
    inspectVideo: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer()),
        source = bytes.equals(webmBytes);
      return {
        info: {
          mime: blob.type,
          width: 640,
          height: 360,
          durationSeconds: source ? 6 : 4,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        dispose() {},
      };
    },
    inspectAudio: exactAudioInspection(),
    inspectVisual: exactVisualInspection,
  });
  const result = await boundary.trim(new Blob([webmBytes], { type: 'video/webm' }), webmInfo, {
    startSeconds: 1,
    endSeconds: 5,
  });
  assert.equal(result.info.mime, 'video/mp4');
  assert.equal(result.evidence.sourceSha256, webmInfo.sha256);
  assert.equal(result.evidence.outputSha256, digest(outputBytes));
  assert.equal(result.evidence.audioSync.status, 'not-present');
  assert.deepEqual(result.evidence.videoCodec, {
    output: 'avc',
    verification: 'authenticated-container-track-inventory',
  });
});

test('resize/compression review binds exact decoded dimensions and a bounded bitrate observation', async () => {
  const largeSourceBytes = Buffer.from('large source video'),
    outputBytes = Buffer.alloc(100_000, 7),
    largeInfo = Object.freeze({
      ...info,
      width: 1920,
      height: 1080,
      durationSeconds: 4,
      bytes: largeSourceBytes.length,
      sha256: digest(largeSourceBytes),
    });
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async (_original, _source, _range, options) => {
        assert.deepEqual([options.transform.width, options.transform.height], [640, 360]);
        assert.equal(options.transform.targetVideoBitrate, 900_000);
        return { supported: true, formats: ['video/mp4'] };
      },
      trim: async (_original, _range, options) => {
        assert.equal(options.transform.profile, 'compact');
        return { blob: new Blob([outputBytes], { type: 'video/mp4' }) };
      },
    }),
    inspectVideo: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer()),
        source = bytes.equals(largeSourceBytes);
      return {
        info: {
          mime: 'video/mp4',
          width: source ? 1920 : 640,
          height: source ? 1080 : 360,
          durationSeconds: source ? 4 : 2,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        dispose() {},
      };
    },
    inspectAudio: exactAudioInspection(),
    inspectVisual: exactVisualInspection,
  });
  const result = await boundary.trim(
    new Blob([largeSourceBytes], { type: 'video/mp4' }),
    largeInfo,
    { startSeconds: 1, endSeconds: 3 },
    { transform: 'compact' },
  );
  assert.deepEqual([result.info.width, result.info.height], [640, 360]);
  assert.equal(result.evidence.transform.profile, 'compact');
  assert.equal(result.evidence.transform.targetVideoBitrate, 900_000);
  assert.equal(result.evidence.transform.observedContainerBitsPerSecond, 400_000);
  assert.equal(result.evidence.transform.bitrateReviewLimit, 2_056_000);
});

test('portrait display orientation survives profile derivation and exact output inspection', async () => {
  const portraitBytes = Buffer.from('rotated display-matrix source'),
    outputBytes = Buffer.alloc(50_000, 11),
    portraitInfo = Object.freeze({
      ...info,
      width: 360,
      height: 640,
      durationSeconds: 4,
      bytes: portraitBytes.length,
      sha256: digest(portraitBytes),
    });
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async (_original, source, _range, options) => {
        assert.deepEqual([source.width, source.height], [360, 640]);
        assert.deepEqual([options.transform.width, options.transform.height], [202, 358]);
        return { supported: true, formats: ['video/mp4'] };
      },
      trim: async (_original, _range, options) => {
        assert.deepEqual([options.transform.width, options.transform.height], [202, 358]);
        return { blob: new Blob([outputBytes], { type: 'video/mp4' }) };
      },
    }),
    inspectVideo: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer()),
        source = bytes.equals(portraitBytes);
      return {
        info: {
          mime: 'video/mp4',
          width: source ? 360 : 202,
          height: source ? 640 : 358,
          durationSeconds: 4,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        dispose() {},
      };
    },
    inspectAudio: exactAudioInspection(),
    inspectVisual: exactVisualInspection,
  });
  const original = new Blob([portraitBytes], { type: 'video/mp4' });
  assert.equal(
    (
      await boundary.support(portraitInfo, {
        original,
        range: { startSeconds: 0, endSeconds: 4 },
        transform: 'compact',
      })
    ).supported,
    true,
  );
  const result = await boundary.trim(
    original,
    portraitInfo,
    { startSeconds: 0, endSeconds: 4 },
    { transform: 'compact' },
  );
  assert.deepEqual([result.info.width, result.info.height], [202, 358]);
  assert.deepEqual(
    [result.evidence.transform.sourceWidth, result.evidence.transform.sourceHeight],
    [360, 640],
  );
  assert.equal(result.evidence.transform.sourceDisplayOrientation, 'portrait');
  assert.equal(result.evidence.transform.outputDisplayOrientation, 'portrait');
  assert.deepEqual([result.evidence.transform.width, result.evidence.transform.height], [202, 358]);
  assert.ok(result.info.width < result.info.height);
});

test('resize/compression withholds output on dimension or bitrate drift', async () => {
  const outputBytes = Buffer.alloc(600_000, 3);
  async function attempt({ width = 640, height = 360, bytes = outputBytes } = {}) {
    const boundary = createOptionalPhysicalTrimBoundary({
      loadAdapter: async () => ({
        support: async () => ({ supported: true, formats: ['video/mp4'] }),
        trim: async () => ({ blob: new Blob([bytes], { type: 'video/mp4' }) }),
      }),
      inspectVideo: async (blob) => {
        const source = blob.size === sourceBytes.length;
        return {
          info: {
            mime: 'video/mp4',
            width: source ? 640 : width,
            height: source ? 360 : height,
            durationSeconds: source ? 6 : 1,
            bytes: blob.size,
            sha256: digest(Buffer.from(await blob.arrayBuffer())),
          },
          dispose() {},
        };
      },
      inspectAudio: exactAudioInspection(),
      inspectVisual: exactVisualInspection,
    });
    return boundary.trim(
      new Blob([sourceBytes], { type: 'video/mp4' }),
      info,
      { startSeconds: 1, endSeconds: 2 },
      { transform: 'compact' },
    );
  }
  await assert.rejects(attempt({ width: 638 }), /dimensions differ/);
  await assert.rejects(attempt(), /bitrate review allowance/);
});

test('physical trim rejects unchanged bytes, decoded timing drift and orientation changes', async () => {
  async function rejects({ output = sourceBytes, durationSeconds = 4, width = 640, height = 360 }) {
    const boundary = createOptionalPhysicalTrimBoundary({
      loadAdapter: async () => ({
        support: async () => ({ supported: true, formats: ['video/mp4'] }),
        trim: async () => ({ blob: new Blob([output], { type: 'video/mp4' }) }),
      }),
      inspectVideo: async (blob) => ({
        info: {
          mime: 'video/mp4',
          width: Buffer.from(await blob.arrayBuffer()).equals(sourceBytes) ? 640 : width,
          height: Buffer.from(await blob.arrayBuffer()).equals(sourceBytes) ? 360 : height,
          durationSeconds: Buffer.from(await blob.arrayBuffer()).equals(sourceBytes)
            ? 6
            : durationSeconds,
          bytes: blob.size,
          sha256: digest(Buffer.from(await blob.arrayBuffer())),
        },
        dispose() {},
      }),
      inspectAudio: exactAudioInspection(),
      inspectVisual: exactVisualInspection,
    });
    return boundary.trim(new Blob([sourceBytes], { type: 'video/mp4' }), info, {
      startSeconds: 1,
      endSeconds: 5,
    });
  }
  await assert.rejects(rejects({}), /different output bytes/);
  await assert.rejects(
    rejects({ output: Buffer.from('different'), durationSeconds: 5 }),
    /duration/,
  );
  await assert.rejects(
    rejects({ output: Buffer.from('different'), width: 360, height: 640 }),
    /dimensions/,
  );
});

test('physical trim withholds output when visual evidence is absent or stale', async () => {
  const outputBytes = Buffer.from('visual-boundary-output');
  const opened = async (blob) => {
    const bytes = Buffer.from(await blob.arrayBuffer()),
      source = bytes.equals(sourceBytes);
    return {
      info: {
        mime: 'video/mp4',
        width: 640,
        height: 360,
        durationSeconds: source ? 6 : 4,
        bytes: bytes.length,
        sha256: digest(bytes),
      },
      dispose() {},
    };
  };
  const boundary = (inspectVisual) =>
    createOptionalPhysicalTrimBoundary({
      loadAdapter: async () => ({
        support: async () => ({ supported: true, formats: ['video/mp4'] }),
        trim: async () => ({ blob: new Blob([outputBytes], { type: 'video/mp4' }) }),
      }),
      inspectVideo: opened,
      inspectAudio: exactAudioInspection(),
      inspectVisual,
    });
  const original = new Blob([sourceBytes], { type: 'video/mp4' }),
    range = { startSeconds: 1, endSeconds: 5 };
  await assert.rejects(
    boundary(null).trim(original, info, range),
    /needs decoded start\/end visual inspection/,
  );
  await assert.rejects(
    boundary(async (input) => ({
      ...(await exactVisualInspection(input)),
      outputSha256: '0'.repeat(64),
    })).trim(original, info, range),
    /missing or stale/,
  );
});

test('physical trim authenticates the exact inspected source before loading transformed output', async () => {
  let trims = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => ({ supported: true, formats: ['video/mp4'] }),
      trim: async () => {
        trims++;
        return { blob: new Blob(['unused'], { type: 'video/mp4' }) };
      },
    }),
    inspectAudio: exactAudioInspection(),
  });
  const changed = Buffer.from(sourceBytes);
  changed[0] ^= 1;
  await assert.rejects(
    boundary.trim(new Blob([changed], { type: 'video/mp4' }), info, {
      startSeconds: 1,
      endSeconds: 5,
    }),
    /source hash/,
  );
  assert.equal(trims, 0);
});

test('physical trim fails closed without exact-byte audio-track inspection', async () => {
  let adapterSupport = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => {
        adapterSupport++;
        return { supported: true, formats: ['video/mp4'] };
      },
      trim: async () => assert.fail('trim should not run'),
    }),
  });
  const capability = await boundary.support(info, {
    original: new Blob([sourceBytes], { type: 'video/mp4' }),
    range: { startSeconds: 1, endSeconds: 5 },
  });
  assert.equal(capability.supported, false);
  assert.match(capability.reason, /no separate exact-byte audio-track inspector/i);
  assert.equal(adapterSupport, 0);
});

test('audio-bearing source without decoded timeline evidence is rejected before conversion', async () => {
  let adapterSupport = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => {
        adapterSupport++;
        return { supported: true, formats: ['video/mp4'] };
      },
      trim: async () => assert.fail('trim should not run'),
    }),
    inspectAudio: exactAudioInspection(1, ['aac']),
  });
  const capability = await boundary.support(info, {
    original: new Blob([sourceBytes], { type: 'video/mp4' }),
    range: { startSeconds: 1, endSeconds: 5 },
  });
  assert.equal(capability.supported, false);
  assert.match(capability.reason, /decoded AAC audio track/i);
  assert.equal(adapterSupport, 0);
});

test('audio-bearing output is withheld even when the adapter claims verified synchronization', async () => {
  const outputBytes = Buffer.from('adapter output with an audio track');
  let audioInspection = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => ({ supported: true, formats: ['video/mp4'] }),
      trim: async () => ({
        blob: new Blob([outputBytes], { type: 'video/mp4' }),
        audioSync: { status: 'verified', note: 'Trust the adapter.' },
      }),
    }),
    inspectVideo: async (blob) => ({
      info: {
        mime: blob.type,
        width: 640,
        height: 360,
        durationSeconds: 4,
        bytes: blob.size,
        sha256: digest(Buffer.from(await blob.arrayBuffer())),
      },
      dispose() {},
    }),
    inspectAudio: async (blob) => {
      const result = await exactAudioInspection(
        audioInspection++ === 0 ? 0 : 1,
        audioInspection === 1 ? [] : ['aac'],
      )(blob);
      return result;
    },
  });
  await assert.rejects(
    boundary.trim(new Blob([sourceBytes], { type: 'video/mp4' }), info, {
      startSeconds: 1,
      endSeconds: 5,
    }),
    /added an unexpected audio track/,
  );
});

test('AVC plus AAC trim publishes only after decoded PCM windows and A/V endpoints match', async () => {
  const outputBytes = Buffer.from('verified avc plus aac output'),
    inspectAudio = exactAacInspection({ outputBytes });
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => ({ supported: true, formats: ['video/mp4'] }),
      trim: async () => ({ blob: new Blob([outputBytes], { type: 'video/mp4' }) }),
    }),
    inspectVideo: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer()),
        output = bytes.equals(outputBytes);
      return {
        info: {
          mime: 'video/mp4',
          width: 640,
          height: 360,
          durationSeconds: output ? 4 : 6,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        dispose() {},
      };
    },
    inspectAudio,
    inspectVisual: exactVisualInspection,
  });
  const result = await boundary.trim(
    new Blob([sourceBytes], { type: 'video/mp4' }),
    info,
    { startSeconds: 1, endSeconds: 5 },
    { transform: 'compact' },
  );
  assert.equal(result.evidence.audioSync.status, 'verified');
  assert.equal(
    result.evidence.audioSync.verification,
    'exact-byte-container-and-decoded-pcm-windows.v1',
  );
  assert.equal(result.evidence.audioSync.source.windows.length, 3);
  assert.equal(result.evidence.audioSync.output.trackEndSeconds, 4);
});

test('AAC output is withheld on endpoint or decoded PCM fingerprint drift', async () => {
  for (const [inspectionOptions, message] of [
    [{ outputEndOffset: 0.5 }, /endpoints do not align/],
    [{ outputRms: 0.5 }, /fingerprint differs/],
  ]) {
    const outputBytes = Buffer.from(`bad audio ${JSON.stringify(inspectionOptions)}`),
      boundary = createOptionalPhysicalTrimBoundary({
        loadAdapter: async () => ({
          support: async () => ({ supported: true, formats: ['video/mp4'] }),
          trim: async () => ({ blob: new Blob([outputBytes], { type: 'video/mp4' }) }),
        }),
        inspectVideo: async (blob) => {
          const bytes = Buffer.from(await blob.arrayBuffer()),
            output = bytes.equals(outputBytes);
          return {
            info: {
              mime: 'video/mp4',
              width: 640,
              height: 360,
              durationSeconds: output ? 4 : 6,
              bytes: bytes.length,
              sha256: digest(bytes),
            },
            dispose() {},
          };
        },
        inspectAudio: exactAacInspection({ outputBytes, ...inspectionOptions }),
        inspectVisual: exactVisualInspection,
      });
    await assert.rejects(
      boundary.trim(new Blob([sourceBytes], { type: 'video/mp4' }), info, {
        startSeconds: 1,
        endSeconds: 5,
      }),
      message,
    );
  }
});

test('non-AVC output is withheld even when the adapter claims AVC conversion', async () => {
  const outputBytes = Buffer.from('adapter output with vp9 video');
  let inspection = 0;
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => ({ supported: true, formats: ['video/mp4'] }),
      trim: async () => ({ blob: new Blob([outputBytes], { type: 'video/mp4' }) }),
    }),
    inspectVideo: async (blob) => {
      const bytes = Buffer.from(await blob.arrayBuffer()),
        source = bytes.equals(sourceBytes);
      return {
        info: {
          mime: blob.type,
          width: 640,
          height: 360,
          durationSeconds: source ? 6 : 4,
          bytes: bytes.length,
          sha256: digest(bytes),
        },
        dispose() {},
      };
    },
    inspectAudio: async (blob) =>
      exactAudioInspection(0, [], inspection++ === 0 ? 'avc' : 'vp9')(blob),
  });
  await assert.rejects(
    boundary.trim(new Blob([sourceBytes], { type: 'video/mp4' }), info, {
      startSeconds: 1,
      endSeconds: 5,
    }),
    /not exactly one authenticated AVC\/H\.264 video track/,
  );
});

test('malformed or stale audio inspection identity cannot qualify physical trim', async () => {
  const boundary = createOptionalPhysicalTrimBoundary({
    loadAdapter: async () => ({
      support: async () => ({ supported: true, formats: ['video/mp4'] }),
      trim: async () => assert.fail('trim should not run'),
    }),
    inspectAudio: async (blob) => ({
      ...(await exactAudioInspection()(blob)),
      sha256: '0'.repeat(64),
    }),
  });
  await assert.rejects(
    boundary.support(info, {
      original: new Blob([sourceBytes], { type: 'video/mp4' }),
      range: { startSeconds: 1, endSeconds: 5 },
    }),
    /did not authenticate the exact bytes/,
  );
});
