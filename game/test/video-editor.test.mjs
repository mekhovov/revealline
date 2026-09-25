import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  AUDIO_TRACK_INSPECTION_FORMAT,
  createOptionalPhysicalTrimBoundary,
  isCompletePlaybackRange,
  preparePlaybackRange,
  seekDistinctPresentedFrame,
  VIDEO_EDIT_FORMAT,
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
  (audioTrackCount = 0, codecs = []) =>
  async (blob) => ({
    format: AUDIO_TRACK_INSPECTION_FORMAT,
    bytes: blob.size,
    sha256: digest(Buffer.from(await blob.arrayBuffer())),
    audioTrackCount,
    codecs,
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
      return {
        info: Object.freeze({
          mime: blob.type,
          width: 640,
          height: 360,
          durationSeconds: 4,
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
  assert.equal(inspections, 1);
  assert.equal(audioInspections, 3, 'Support and trim re-authenticate source and output audio.');
  assert.equal(disposed, 1);
  assert.equal(result.info.sha256, digest(outputBytes));
  assert.equal(result.evidence.outputSha256, digest(outputBytes));
  assert.equal(result.evidence.decodedDurationSeconds, 4);
  assert.deepEqual(
    [result.evidence.decodedWidth, result.evidence.decodedHeight],
    [info.width, info.height],
  );
  assert.equal(result.evidence.audioSync.status, 'not-present');
  assert.equal(result.evidence.audioSync.verification, 'authenticated-container-track-inventory');
  assert.doesNotMatch(result.evidence.audioSync.note, /Fixture timestamps matched/);
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
          width,
          height,
          durationSeconds,
          bytes: blob.size,
          sha256: digest(Buffer.from(await blob.arrayBuffer())),
        },
        dispose() {},
      }),
      inspectAudio: exactAudioInspection(),
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
    /orientation/,
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

test('audio-bearing source is rejected before adapter capability or conversion', async () => {
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
  assert.match(capability.reason, /contains audio.*timing and synchronization/i);
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
    /output contains audio without decoded timing and synchronization evidence/,
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
