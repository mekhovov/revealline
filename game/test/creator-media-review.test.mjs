import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
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
    capacity: make('p', 'media-capacity'),
    removeExcluded: make('button', 'media-remove-excluded'),
    split: make('button', 'media-split'),
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

test('mixed review preserves explicit order and lets a failed included item be excluded', async () => {
  const document = new Document(),
    controls = nodes(document),
    calls = [];
  const controller = createCreatorMediaReviewController({
    document,
    nodes: controls,
    prepareIntake: async (sources, options) => {
      calls.push({
        names: sources.map((source) => source.name),
        preserveOrder: options.preserveOrder,
      });
      return {
        format: 'revealline-creator-media-intake.v1',
        items: sources.map((source, index) => ({
          index,
          name: source.name,
          kind: source.kind,
          assetSha256: String(index + 1).repeat(64),
          pairing: null,
          video: null,
          errors: source.name.startsWith('bad')
            ? [{ code: 'video-inspection-failed', message: 'Codec failed.' }]
            : [],
        })),
        dependencies: { format: 'revealline-creator-media-dependencies.v1', stories: [] },
        assets: [],
      };
    },
  });
  controller.setFiles([
    file('clip10.mp4', 'video/mp4'),
    file('bad2.mp4', 'video/mp4'),
    file('clip1.png', 'image/png'),
  ]);
  assert.deepEqual(
    controller.snapshot().sources.map((source) => source.name),
    ['bad2.mp4', 'clip1.png', 'clip10.mp4'],
  );
  const last = controller.snapshot().sources[2];
  controls.list.children[2].querySelector('input[type="checkbox"]').focus();
  controller.move(last.id, -2);
  assert.equal(document.activeElement.dataset.itemId, last.id);
  assert.equal(document.activeElement.dataset.mediaAction, 'include');
  await controller.prepare();
  assert.deepEqual(calls[0], {
    names: ['clip10.mp4', 'bad2.mp4', 'clip1.png'],
    preserveOrder: true,
  });
  assert.match(controls.status.textContent, /need attention/);
  const failed = controller.snapshot().sources.find((source) => source.name === 'bad2.mp4');
  controller.setIncluded(failed.id, false);
  assert.equal(controls.removeExcluded.hidden, false);
  await controller.prepare();
  assert.deepEqual(calls[1].names, ['clip10.mp4', 'clip1.png']);
  assert.equal(controller.snapshot().ready, true);
  assert.equal(controls.list.querySelectorAll('.creator-media-card').length, 3);
});

test('media capacity overflow requires an explicit split or removal', () => {
  const document = new Document(),
    controls = nodes(document);
  let split = null;
  const controller = createCreatorMediaReviewController({
    document,
    nodes: controls,
    prepareIntake: async () => assert.fail('capacity review must work before inspection'),
    capacityFor: (sources) => ({
      estimatedBytes: sources.length * 200,
      stagingBytes: sources.length * 400,
      limitBytes: 256,
      maxPayloadBytes: 5,
      fits: sources.length < 2,
    }),
    onSplit: (chunks) => (split = chunks),
  });
  controller.setFiles([file('1.mp4', 'video/mp4'), file('2.mp4', 'video/mp4')]);
  assert.equal(controls.split.hidden, false);
  assert.match(controls.capacity.textContent, /Split it into smaller packs/);
  controls.split.onclick();
  assert.deepEqual(
    split.map((chunk) => chunk.length),
    [1, 1],
  );
  const excluded = controller.snapshot().sources[1];
  controller.setIncluded(excluded.id, false);
  assert.equal(controller.snapshot().capacity.fits, true);
  controls.removeExcluded.onclick();
  assert.equal(controller.snapshot().sources.length, 1);
});

test('creator page exposes media decisions and renders every generated mission review', async () => {
  const [html, script] = await Promise.all([
    readFile(new URL('../creator/index.html', import.meta.url), 'utf8'),
    readFile(new URL('../creator/studio.mjs', import.meta.url), 'utf8'),
  ]);
  for (const id of [
    'media-list',
    'media-capacity',
    'media-remove-excluded',
    'media-split',
    'media-split-results',
    'mission-review-list',
  ])
    assert.match(html, new RegExp(`id="${id}"`));
  assert.match(script, /for \(const \[index, provenance\] of provenances\.entries\(\)\)/);
  assert.match(script, /missionVictoryStory/);
  assert.match(script, /creator-mission-validation/);
});
