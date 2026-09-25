import test from 'node:test';
import assert from 'node:assert/strict';
import { createCreatorMediaReviewController } from '../creator/media-review.mjs';
import { Document } from './helpers/couch-dom.mjs';

const imageHash = 'a'.repeat(64);
const videoHash = 'b'.repeat(64);
const posterHashes = ['c'.repeat(64), 'd'.repeat(64), 'e'.repeat(64), 'f'.repeat(64)];

function file(name, type, bytes = name) {
  const blob = new Blob([bytes], { type });
  Object.defineProperty(blob, 'name', { value: name });
  return blob;
}

function nodes(document) {
  const make = (tag, id) => {
    const element = document.createElement(tag);
    element.id = id;
    document.body.append(element);
    return element;
  };
  return {
    surface: make('section', 'media-review'),
    list: make('div', 'media-list'),
    status: make('p', 'media-status'),
    apply: make('button', 'media-apply'),
    cancel: make('button', 'media-cancel'),
    intake: make('input', 'media-intake'),
    drop: make('div', 'media-drop'),
  };
}

function result({
  resolved = false,
  selectedTime = 5,
  range = { startSeconds: 0, endSeconds: 10 },
} = {}) {
  const captures = [1, ...(selectedTime === 3.25 ? [3.25] : []), 5, 9].map((time, index) => ({
    sha256: posterHashes[index],
    capture: {
      requestedTime: time,
      playheadTime: time,
      observedMediaTime: time,
    },
  }));
  const selected = captures.find((candidate) => candidate.capture.requestedTime === selectedTime);
  return {
    items: [
      {
        name: 'clip.png',
        kind: 'image',
        assetSha256: imageHash,
        errors: resolved ? [] : [{ code: 'ambiguous-pairing', message: 'Choose exact media.' }],
      },
      {
        name: 'clip.mp4',
        kind: 'video',
        assetSha256: videoHash,
        pairing: {
          status: 'ambiguous',
          candidateAssetSha256s: [imageHash],
        },
        video: resolved
          ? {
              video: { width: 640, height: 360, durationSeconds: 10 },
              playbackRange: { ...range, retainsCompleteOriginal: true },
              posterCandidates: captures,
              selectedPosterSha256: selected.sha256,
              selectedPairingAssetSha256: null,
            }
          : null,
        errors: resolved ? [] : [{ code: 'ambiguous-pairing', message: 'Choose exact media.' }],
      },
    ],
    dependencies: { stories: resolved ? [{}] : [] },
    assets: captures.map((candidate) => ({
      sha256: candidate.sha256,
      blob: new Blob([candidate.sha256]),
    })),
  };
}

test('mixed review corrects an ambiguous pair, captures an exact frame, and retains full-video wording', async () => {
  const document = new Document(),
    controls = nodes(document),
    calls = [],
    revoked = [],
    prepared = [];
  const controller = createCreatorMediaReviewController({
    document,
    nodes: controls,
    createObjectURL: (blob) => `blob:${blob.size}:${calls.length}`,
    revokeObjectURL: (url) => revoked.push(url),
    onPrepared: (value) => prepared.push(value),
    prepareIntake: async (_sources, options) => {
      const pairing = options.pairingFor({ assetSha256: videoHash });
      const posterTime = options.posterTimeFor({
        assetSha256: videoHash,
        video: { durationSeconds: 10 },
      });
      const range = options.playbackRangeFor({
        assetSha256: videoHash,
        video: { durationSeconds: 10 },
      });
      calls.push({ pairing, posterTime, range });
      return pairing === undefined
        ? result()
        : result({ resolved: true, selectedTime: posterTime, range });
    },
  });
  controls.intake.files = [file('clip.mp4', 'video/mp4'), file('clip.png', 'image/png')];
  controls.intake.emit('change');
  assert.equal(controls.intake.multiple, true);
  assert.match(controls.intake.accept, /video\/mp4/);
  assert.match(controls.status.textContent, /1 image and 1 video selected/);
  await controller.prepare();
  assert.match(controls.status.textContent, /need attention/);
  const card = controls.list.querySelector('.creator-media-card');
  const pair = card.querySelector('select');
  assert.equal(pair.value, '');
  pair.value = imageHash;
  pair.emit('change');
  assert.equal(controller.snapshot().dirty, true);
  await controller.prepare();
  assert.equal(calls[1].pairing, imageHash);
  assert.equal(controller.snapshot().ready, true);

  const numberInputs = controls.list.querySelectorAll('input[type="number"]');
  assert.equal(numberInputs.length, 3);
  numberInputs[0].value = '3.25';
  numberInputs[0].emit('change');
  numberInputs[1].value = '1.5';
  numberInputs[2].value = '7.75';
  numberInputs[2].emit('change');
  assert.match(controls.status.textContent, /choices changed/);
  assert.match(controls.list.textContent, /complete original video remains/);
  await controller.prepare();
  assert.equal(calls[2].posterTime, 3.25);
  assert.deepEqual(calls[2].range, {
    startSeconds: 1.5,
    endSeconds: 7.75,
    retainsCompleteOriginal: true,
  });
  assert.equal(prepared.length, 3);
  assert.ok(revoked.length > 0, 'rerendering revokes poster object URLs');
  controller.destroy();
});

test('unsupported intake fails before media inspection', () => {
  const document = new Document();
  const controller = createCreatorMediaReviewController({
    document,
    nodes: nodes(document),
    prepareIntake: async () => assert.fail('unsupported media must not reach inspection'),
  });
  assert.throws(
    () => controller.setFiles([file('movie.avi', 'video/x-msvideo')]),
    /not a supported PNG, JPEG, WebP, MP4 or WebM/,
  );
});
