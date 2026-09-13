import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  validateVictoryStory,
  prepareVictoryStory,
  requirePreparedVictoryStory,
  VICTORY_STORY_LIMITS,
} from '../victory-story.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { snapshotPictureChoice, createPresentationPins } from '../presentation-pins.mjs';
import { assetRecord, presentationRecord, deferred } from './helpers/media-fixtures.mjs';
import {
  createStoryFixture,
  inspectionEnvironment,
  prepareStoryFixture,
  videoBytes,
} from './helpers/victory-story-fixture.mjs';

const hash = (value) => createHash('sha256').update(Buffer.from(value)).digest('hex');
const copy = (value) => structuredClone(value);
function pausedInspection() {
  const env = inspectionEnvironment({ automatic: false }),
    ready = deferred();
  const create = env.options.createVideo;
  env.options.createVideo = () => {
    const video = create();
    ready.resolve(video);
    return video;
  };
  return { ...env, ready: ready.promise };
}

test('story authenticates complete owned MP4 bytes while metadata decoding is explicitly modeled', async () => {
  const f = await prepareStoryFixture();
  assert.equal(videoBytes.length, 75767);
  assert.equal(requirePreparedVictoryStory(f.prepared, f.pin), f.prepared);
  assert.deepEqual(Buffer.from(await f.prepared.original.arrayBuffer()), videoBytes);
  assert.equal(f.prepared.original.type, 'video/mp4');
  assert.equal(hash(await f.prepared.original.arrayBuffer()), f.descriptor.source.sha256);
  assert.ok(Object.isFrozen(f.prepared.descriptor.segment));
  assert.equal(f.inspection.urls.size, 0);
  assert.equal(f.inspection.revoked.length, 1);
  assert.equal(f.inspection.videos[0].src, '');
  assert.equal(f.inspection.videos[0].paused, true);
});

test('sidecar leaves strict still v1 and saved-picture v1 records unchanged', () => {
  const f = createStoryFixture(),
    original = JSON.stringify(f.library),
    pin = JSON.stringify(f.pin);
  const checked = validateVictoryStory(f.descriptor, f);
  assert.equal(checked.picturePin.sha256, f.pin.sha256);
  assert.equal(JSON.stringify(f.library), original);
  assert.equal(JSON.stringify(f.pin), pin);
  assert.equal(f.library.presentations[0].story, null);
  const embedded = copy(f.library);
  embedded.presentations[0].story = f.descriptor;
  assert.throws(() => validateMediaLibrary(embedded, f), /story:null/);
  assert.throws(() => snapshotPictureChoice({ ...f.pin, story: f.descriptor }));
});

test('historical poster A stays exact after current assignment B and never uses B for missing A', async () => {
  const f = createStoryFixture(),
    next = copy(f.library);
  next.assets.push({ ...assetRecord('picture-b'), sha256: 'b'.repeat(64) });
  next.presentations.push(presentationRecord(f.identity, 2, 'picture-b'));
  next.assignments[0].revision = 2;
  const library = validateMediaLibrary(next, { ...f, previous: f.library });
  const current = createPresentationPins({
    library,
    identityCatalog: f.identityCatalog,
    ...f.request(),
    themeIds: ['fpv'],
  }).choices[0];
  const env = inspectionEnvironment();
  const prepared = await prepareVictoryStory({ ...f, library }, env.options);
  assert.equal(requirePreparedVictoryStory(prepared, f.pin), prepared);
  assert.throws(() => requirePreparedVictoryStory(prepared, current), /different exact poster/);
  const missing = copy(next);
  missing.assets.shift();
  missing.presentations.shift();
  const withoutA = validateMediaLibrary(missing, f);
  assert.throws(
    () => validateVictoryStory(f.descriptor, { ...f, library: withoutA }),
    /historical poster/,
  );
});

test('foreign authored owner, theme, revision and hash cannot borrow a valid poster', () => {
  const f = createStoryFixture();
  const gentle = f.catalog.entries.find((e) => e.difficulty === 'gentle');
  for (const mutate of [
    (p) => {
      p.identity.baseCampaignKey = gentle.executionKey;
    },
    (p) => {
      p.identity.levelRevision = 'other-revision';
    },
    (p) => {
      p.identity.themeId = 'ukraine';
    },
    (p) => {
      p.presentationRevision = 2;
    },
    (p) => {
      p.assetId = 'another-picture';
    },
    (p) => {
      p.sha256 = 'c'.repeat(64);
    },
  ]) {
    const descriptor = copy(f.descriptor);
    mutate(descriptor.picturePin);
    assert.throws(() => validateVictoryStory(descriptor, f), /historical poster/);
  }
  assert.throws(
    () => validateVictoryStory(f.descriptor, { ...f, library: copy(f.library) }),
    /verified/,
  );
  assert.throws(
    () => validateVictoryStory(f.descriptor, { ...f, identityCatalog: { has: () => true } }),
    /verified/,
  );
});

test('serialized or shaped preparations cannot authenticate playback', async () => {
  const f = await prepareStoryFixture();
  for (const fake of [null, {}, { ...f.prepared }, JSON.parse(JSON.stringify(f.prepared))])
    assert.throws(() => requirePreparedVictoryStory(fake, f.pin), /authenticated preparation/);
});

test('preparation snapshots caller descriptor and Blob before suspended metadata resolves', async () => {
  const f = createStoryFixture(),
    env = pausedInspection(),
    request = { ...f, descriptor: copy(f.descriptor) };
  const expected = copy(request.descriptor);
  const pending = prepareVictoryStory(request, env.options);
  const video = await env.ready;
  request.descriptor.source.sha256 = 'd'.repeat(64);
  request.descriptor.segment.endSeconds = 100;
  request.blob = new Blob(['unrelated later source']);
  video.metadata();
  const prepared = await pending;
  assert.deepEqual(prepared.descriptor, expected);
  assert.deepEqual(Buffer.from(await prepared.original.arrayBuffer()), videoBytes);
  assert.equal(env.urls.size, 0);
});

test('native Blob ownership ignores overridden metadata and byte readers on Blob subclasses', async () => {
  const f = createStoryFixture(),
    env = inspectionEnvironment();
  class HostileBlob extends Blob {
    get size() {
      throw new Error('Caller size getter must not run');
    }
    get type() {
      throw new Error('Caller MIME getter must not run');
    }
    arrayBuffer() {
      throw new Error('Caller byte reader must not run');
    }
    slice() {
      throw new Error('Caller slice must not run');
    }
  }
  const prepared = await prepareVictoryStory(
    { ...f, blob: new HostileBlob([videoBytes]) },
    env.options,
  );
  assert.equal(hash(await prepared.original.arrayBuffer()), f.descriptor.source.sha256);
  await assert.rejects(
    prepareVictoryStory(
      { ...f, blob: { size: videoBytes.length, arrayBuffer: async () => videoBytes } },
      env.options,
    ),
    /Blob or File/,
  );
});

test('actual changed original and container MIME mismatches fail after real hashing with cleanup', async () => {
  const f = createStoryFixture(),
    changed = Buffer.from(videoBytes);
  changed[changed.length - 1] ^= 1;
  for (const request of [
    { ...f, blob: new Blob([changed], { type: 'video/mp4' }) },
    {
      ...f,
      descriptor: { ...f.descriptor, source: { ...f.descriptor.source, mime: 'video/webm' } },
    },
    {
      ...f,
      descriptor: {
        ...f.descriptor,
        source: { ...f.descriptor.source, bytes: videoBytes.length - 1 },
      },
    },
  ]) {
    const env = inspectionEnvironment();
    await assert.rejects(prepareVictoryStory(request, env.options), /Original video .* differs/);
    assert.equal(env.urls.size, 0);
    assert.equal(env.revoked.length, 1);
  }
});

test('descriptor bounds reject malformed source facts and unclamped segments before video allocation', async () => {
  const f = createStoryFixture();
  const edits = [
    (d) => {
      d.source.bytes = VICTORY_STORY_LIMITS.sourceBytes + 1;
    },
    (d) => {
      d.source.durationSeconds = 121;
    },
    (d) => {
      d.source.width = 1921;
    },
    (d) => {
      d.source.height = 1081;
    },
    (d) => {
      d.source.mime = 'image/gif';
    },
    (d) => {
      d.source.url = 'https://example.invalid/movie.mp4';
    },
    (d) => {
      d.segment.startSeconds = -1;
    },
    (d) => {
      d.segment.endSeconds = d.segment.startSeconds;
    },
    (d) => {
      d.segment.endSeconds = 6.01;
    },
    (d) => {
      d.segment.endSeconds = NaN;
    },
    (d) => {
      d.description = 'x'.repeat(8193);
    },
    (d) => {
      d.picturePin = { kind: 'legacy', identity: f.identity };
    },
  ];
  for (const mutate of edits) {
    const descriptor = copy(f.descriptor),
      env = inspectionEnvironment();
    mutate(descriptor);
    await assert.rejects(prepareVictoryStory({ ...f, descriptor }, env.options));
    assert.equal(env.videos.length, 0);
    assert.equal(env.urls.size, 0);
  }
});

test('actual source byte and container limits reject before modeled codec allocation', async () => {
  const f = createStoryFixture();
  for (const blob of [
    new Blob(),
    new Blob(['not an MP4'], { type: 'video/mp4' }),
    new Blob([new Uint8Array(VICTORY_STORY_LIMITS.sourceBytes + 1)]),
  ]) {
    const env = inspectionEnvironment();
    await assert.rejects(prepareVictoryStory({ ...f, blob }, env.options));
    assert.equal(env.videos.length, 0);
  }
});

test('decoded source dimensions and duration must match declared facts and existing acquisition bounds', async () => {
  const f = createStoryFixture();
  for (const facts of [
    { durationSeconds: 5 },
    { durationSeconds: 121 },
    { durationSeconds: Infinity },
    { width: 320 },
    { height: 1081 },
  ]) {
    const env = inspectionEnvironment({ facts });
    await assert.rejects(prepareVictoryStory(f, env.options));
    assert.equal(env.urls.size, 0);
    assert.equal(env.revoked.length, 1);
  }
});

test('aborted preparation allocates nothing; abort during metadata releases resources and rejects late success', async () => {
  const f = createStoryFixture(),
    early = new AbortController(),
    untouched = inspectionEnvironment();
  early.abort();
  await assert.rejects(prepareVictoryStory(f, { ...untouched.options, signal: early.signal }), {
    name: 'AbortError',
  });
  assert.equal(untouched.videos.length, 0);
  const env = pausedInspection(),
    controller = new AbortController();
  const pending = prepareVictoryStory(f, { ...env.options, signal: controller.signal });
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  const video = await env.ready;
  controller.abort();
  await rejected;
  video.metadata();
  assert.equal(env.urls.size, 0);
  assert.equal(video.src, '');
});

test('metadata timeout is bounded and cleans the original URL without inventing a playable story', async () => {
  const f = createStoryFixture(),
    env = pausedInspection();
  let expire,
    cleared = 0;
  const timers = {
    setTimeout(fn, ms) {
      assert.equal(ms, 15000);
      expire = fn;
      return 17;
    },
    clearTimeout(id) {
      assert.equal(id, 17);
      cleared++;
    },
  };
  const pending = prepareVictoryStory(f, { ...env.options, timers });
  const rejected = assert.rejects(pending, { name: 'TimeoutError' });
  await env.ready;
  expire();
  await rejected;
  assert.equal(cleared, 1);
  assert.equal(env.urls.size, 0);
  assert.equal(env.revoked.length, 1);
});
