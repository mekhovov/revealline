import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  normalizeCreatorMediaStem,
  prepareCreatorMediaIntake,
  validateCreatorMediaDependencies,
  validateCreatorPlaybackRange,
} from '../creator/media-intake.mjs';

const hash = (blob) =>
  blob.arrayBuffer().then((bytes) => createHash('sha256').update(Buffer.from(bytes)).digest('hex'));
const image = (name, text = name) => ({ name, kind: 'image', blob: new Blob([text]) });
const video = (name, text = name) => ({ name, kind: 'video', blob: new Blob([text]) });
const capturedBlob = (label) => new Blob([`poster:${label}`], { type: 'image/png' });

function factories({ failVideo, pause, observedOffset = 0 } = {}) {
  let active = 0,
    peak = 0,
    inspected = 0,
    disposed = 0,
    captured = 0,
    release;
  const gate = pause
    ? new Promise((resolve) => {
        release = resolve;
      })
    : null;
  return {
    state: () => ({ active, peak, inspected, disposed, captured }),
    release: () => release?.(),
    async prepareImage(blob) {
      const sha256 = await hash(blob),
        runtime = new Blob([`runtime:${sha256}`], { type: 'image/png' });
      return {
        original: { sha256 },
        runtime: { blob: runtime, sha256: await hash(runtime) },
        asset: { width: 1280, height: 640 },
      };
    },
    async inspectVideo(blob, { signal }) {
      active++;
      peak = Math.max(peak, active);
      inspected++;
      try {
        if (gate)
          await Promise.race([
            gate,
            new Promise((_, reject) =>
              signal?.addEventListener(
                'abort',
                () => reject(new DOMException('cancelled', 'AbortError')),
                { once: true },
              ),
            ),
          ]);
      } finally {
        active--;
      }
      if (failVideo) throw new TypeError('Browser could not decode this video container or codec.');
      const sha256 = await hash(blob),
        info = {
          sha256,
          bytes: blob.size,
          mime: 'video/mp4',
          width: 640,
          height: 360,
          durationSeconds: 10,
        };
      return {
        info,
        original: blob,
        async capture(requestedTime) {
          captured++;
          const poster = capturedBlob(requestedTime),
            posterHash = await hash(poster);
          return {
            asset: {
              format: 'revealline-still-asset.v1',
              id: `poster-${captured}`,
              sha256: posterHash,
              bytes: poster.size,
              mime: 'image/png',
              width: 640,
              height: 360,
              provenance: {
                kind: 'user-supplied',
                credit: 'Creator supplied video',
                source: 'Captured test frame',
              },
            },
            blob: poster,
            capture: {
              sourceSha256: sha256,
              requestedTime,
              observedMediaTime: requestedTime + observedOffset,
              playheadTime: requestedTime,
              timingEvidence: 'presented-frame',
              decodedFrame: { width: 640, height: 360 },
              width: 640,
              height: 360,
              mime: 'image/png',
              sha256: posterHash,
            },
          };
        },
        dispose() {
          disposed++;
        },
      };
    },
  };
}

test('normalized stems suggest one exact image/video pair while hashes remain authority', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake(
      [video('Trip 01.MP4', 'movie'), image('trip_01.PNG', 'picture')],
      f,
    ),
    movie = prepared.items.find((item) => item.kind === 'video'),
    picture = prepared.items.find((item) => item.kind === 'image'),
    story = prepared.dependencies.stories[0];
  assert.equal(normalizeCreatorMediaStem('folder\\TRIP_01.final.MP4'), 'trip-01-final');
  assert.equal(movie.pairing.status, 'suggested');
  assert.deepEqual(movie.pairing.candidateAssetSha256s, [picture.assetSha256]);
  assert.equal(story.poster.origin.kind, 'supplied-image');
  assert.equal(story.poster.origin.sourceImageSha256, picture.assetSha256);
  assert.equal(story.video.sha256, movie.assetSha256);
  const retainedOriginal = prepared.assets.find(
    (asset) => asset.sha256 === picture.assetSha256 && asset.role === 'source-image-original',
  );
  assert.equal(await retainedOriginal.blob.text(), 'picture');
  assert.deepEqual(f.state(), { active: 0, peak: 1, inspected: 1, disposed: 1, captured: 0 });
});

test('ambiguous normalized stems are reported per video and never auto-selected', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake(
      [image('clip.jpg', 'a'), image('CLIP.PNG', 'b'), video('clip.mp4', 'movie')],
      f,
    ),
    movie = prepared.items.find((item) => item.kind === 'video');
  assert.equal(movie.pairing.status, 'ambiguous');
  assert.equal(movie.pairing.candidateAssetSha256s.length, 2);
  assert.ok(prepared.items.every((item) => item.errors[0].code === 'ambiguous-pairing'));
  assert.equal(movie.errors[0].code, 'ambiguous-pairing');
  assert.match(movie.errors[0].message, /Choose the exact poster\/video pairing/);
  assert.equal(prepared.dependencies.stories.length, 0);
  assert.equal(f.state().captured, 0);
});

test('an ambiguous filename hint can be corrected with an exact image hash', async () => {
  const selected = image('clip.jpg', 'chosen'),
    alternative = image('CLIP.PNG', 'other'),
    movie = video('clip.mp4', 'movie'),
    selectedHash = await hash(selected.blob),
    f = factories(),
    prepared = await prepareCreatorMediaIntake([alternative, movie, selected], {
      ...f,
      pairingFor: ({ assetSha256 }) => (assetSha256 === undefined ? undefined : selectedHash),
    }),
    story = prepared.dependencies.stories[0],
    videoItem = prepared.items.find((item) => item.kind === 'video');
  assert.equal(story.poster.origin.kind, 'supplied-image');
  assert.equal(story.poster.origin.sourceImageSha256, selectedHash);
  assert.equal(videoItem.video.selectedPairingAssetSha256, selectedHash);
  assert.ok(prepared.items.every((item) => item.errors.length === 0));
  assert.equal(f.state().captured, 0);
});

test('same-stem videos without an image remain independent video-only items', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake(
      [video('repeat.mp4', 'first'), video('REPEAT.webm', 'second')],
      f,
    );
  assert.equal(prepared.dependencies.stories.length, 2);
  assert.ok(prepared.items.every((item) => item.pairing.status === 'none'));
  assert.ok(prepared.items.every((item) => item.errors.length === 0));
  assert.equal(f.state().captured, 6);
  assert.equal(f.state().peak, 1);
});

test('video-only input captures 10/50/90 percent candidates and defaults to midpoint', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake([video('solo.mp4', 'movie')], f),
    movie = prepared.items[0],
    candidates = movie.video.posterCandidates;
  assert.deepEqual(
    candidates.map((item) => item.capture.requestedTime),
    [1, 5, 9],
  );
  assert.equal(movie.video.selectedPosterSha256, candidates[1].sha256);
  assert.equal(prepared.dependencies.stories[0].poster.sha256, candidates[1].sha256);
  assert.equal(prepared.dependencies.stories[0].playbackRange.retainsCompleteOriginal, true);
  assert.equal(prepared.assets.filter((item) => item.role.startsWith('poster')).length, 3);
  assert.equal(prepared.assets.find((item) => item.role === 'victory-video-original').blob.size, 5);
});

test('an exact custom poster time joins the three suggestions and becomes the sole poster', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake([video('custom.mp4', 'movie')], {
      ...f,
      posterTimeFor: () => 3.25,
      playbackRangeFor: () => ({ startSeconds: 1.5, endSeconds: 7.75 }),
    }),
    movie = prepared.items[0],
    selected = movie.video.posterCandidates.find(
      (candidate) => candidate.sha256 === movie.video.selectedPosterSha256,
    );
  assert.deepEqual(
    movie.video.posterCandidates.map((candidate) => candidate.capture.requestedTime),
    [1, 3.25, 5, 9],
  );
  assert.equal(selected.capture.requestedTime, 3.25);
  assert.equal(prepared.assets.filter((asset) => asset.role === 'poster').length, 1);
  assert.deepEqual(prepared.dependencies.stories[0].playbackRange, {
    startSeconds: 1.5,
    endSeconds: 7.75,
    retainsCompleteOriginal: true,
  });
});

test('captured dependency preserves requested and observed timestamps separately', async () => {
  const f = factories({ observedOffset: 0.04 }),
    prepared = await prepareCreatorMediaIntake([video('timing.mp4', 'movie')], f),
    poster = prepared.dependencies.stories[0].poster;
  assert.equal(poster.capture.requestedTime, 5);
  assert.equal(poster.capture.observedMediaTime, 5.04);
  assert.notEqual(poster.capture.requestedTime, poster.capture.observedMediaTime);
  assert.deepEqual(validateCreatorMediaDependencies(prepared.dependencies), prepared.dependencies);
});

test('playhead fallback records that no presented-frame timestamp was available', async () => {
  const f = factories(),
    inspectVideo = async (...args) => {
      const opened = await f.inspectVideo(...args),
        capture = opened.capture;
      opened.capture = async (...captureArgs) => {
        const result = await capture(...captureArgs);
        return {
          ...result,
          capture: {
            ...result.capture,
            observedMediaTime: null,
            timingEvidence: 'playhead-estimate',
            decodedFrame: null,
          },
        };
      };
      return opened;
    },
    prepared = await prepareCreatorMediaIntake([video('fallback.mp4', 'movie')], {
      ...f,
      inspectVideo,
    }),
    capture = prepared.dependencies.stories[0].poster.capture;
  assert.equal(capture.requestedTime, 5);
  assert.equal(capture.observedMediaTime, null);
  assert.equal(capture.playheadTime, 5);
  assert.equal(capture.timingEvidence, 'playhead-estimate');
});

test('playback range is validated without changing or trimming the original', async () => {
  const f = factories(),
    prepared = await prepareCreatorMediaIntake([video('range.mp4', '0123456789')], {
      ...f,
      playbackRangeFor: () => ({ startSeconds: 2, endSeconds: 8 }),
    }),
    story = prepared.dependencies.stories[0],
    original = prepared.assets.find((asset) => asset.role === 'victory-video-original');
  assert.deepEqual(story.playbackRange, {
    startSeconds: 2,
    endSeconds: 8,
    retainsCompleteOriginal: true,
  });
  assert.equal(original.blob.size, 10);
  for (const range of [
    { startSeconds: -1, endSeconds: 8 },
    { startSeconds: 2, endSeconds: 2 },
    { startSeconds: 2, endSeconds: 11 },
  ])
    assert.throws(() => validateCreatorPlaybackRange(story.video, range), /never clamped/);
});

test('codec inspection failure and missing originals stay attached to their items', async () => {
  const failed = factories({ failVideo: true }),
    missing = { name: 'lost.mp4', kind: 'video', blob: null },
    prepared = await prepareCreatorMediaIntake([video('bad.mp4'), missing], failed);
  assert.deepEqual(prepared.items.map((item) => item.errors[0].code).sort(), [
    'missing-original',
    'video-inspection-failed',
  ]);
  assert.match(
    prepared.items.find((item) => item.name === 'bad.mp4').errors[0].message,
    /could not decode/,
  );
  assert.equal(prepared.dependencies.stories.length, 0);
});

test('inspection is sequential and cancellation stops current work without starting another', async () => {
  const f = factories({ pause: true }),
    controller = new AbortController(),
    pending = prepareCreatorMediaIntake([video('one.mp4', 'one'), video('two.mp4', 'two')], {
      ...f,
      signal: controller.signal,
    });
  for (let i = 0; i < 20 && f.state().inspected === 0; i++)
    await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(f.state(), { active: 1, peak: 1, inspected: 1, disposed: 0, captured: 0 });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.state().inspected, 1);
  assert.equal(f.state().peak, 1);
  assert.equal(f.state().active, 0);
});

test('renaming inputs changes suggestions but never byte-backed asset identities', async () => {
  const bytes = 'same exact movie bytes',
    first = factories(),
    second = factories(),
    a = await prepareCreatorMediaIntake([video('holiday-001.mp4', bytes)], first),
    b = await prepareCreatorMediaIntake([video('renamed final.mp4', bytes)], second);
  assert.equal(a.items[0].assetSha256, b.items[0].assetSha256);
  assert.equal(a.dependencies.stories[0].video.sha256, b.dependencies.stories[0].video.sha256);
  assert.equal(a.dependencies.stories[0].poster.sha256, b.dependencies.stories[0].poster.sha256);
  assert.notEqual(a.items[0].normalizedStem, b.items[0].normalizedStem);
});
