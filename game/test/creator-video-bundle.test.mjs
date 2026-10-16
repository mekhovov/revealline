import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateCreatorProject } from '../creator/templates.mjs';
import { assembleCreatorBatchProject, prepareCreatorBatch } from '../creator/batch.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { prepareCreatorMediaIntake } from '../creator/media-intake.mjs';
import { creatorMediaBundleInput } from '../creator/media-bundle.mjs';
import {
  approveCreatorBundle,
  exportCreatorBundle,
  importCreatorBundle,
  prepareCreatorBundle,
} from '../creator/bundle.mjs';
import {
  createCreatorStore,
  installPreparedCreatorBundle,
  loadInstalledCreatorBundle,
  reviewCreatorInstallation,
} from '../creator/installed.mjs';
import { createCreatorRuntime } from '../creator/runtime.mjs';
import { requirePreparedVictoryStory } from '../victory-story.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
const decodeArtwork = async (dataUrl) => {
  const image = new PNGImage();
  image.src = dataUrl;
  await image.decode();
  return image;
};
const hash = (blob) => blob.arrayBuffer().then(creatorSHA256);
const image = (name, bytes = pngBytes()) => ({
  name,
  kind: 'image',
  blob: new Blob([bytes], { type: 'image/png' }),
});
const video = (name, text = name) => ({
  name,
  kind: 'video',
  blob: new Blob([text], { type: 'video/mp4' }),
});

function mediaFactories({ reject = false } = {}) {
  return {
    async prepareImage(blob) {
      const originalSha256 = await hash(blob),
        runtime = new Blob([pngBytes()], { type: 'image/png' });
      return {
        original: { sha256: originalSha256 },
        runtime: { blob: runtime, sha256: await hash(runtime) },
        asset: { width: 1, height: 1 },
      };
    },
    async inspectVideo(blob) {
      if (reject) throw new TypeError('Unsupported creator test codec.');
      const info = {
        sha256: await hash(blob),
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
          const poster = new Blob([pngBytes()], { type: 'image/png' }),
            sha256 = await hash(poster);
          return {
            asset: {
              format: 'revealline-still-asset.v1',
              id: 'captured-poster',
              sha256,
              bytes: poster.size,
              mime: 'image/png',
              width: 1,
              height: 1,
              provenance: {
                kind: 'user-supplied',
                credit: 'Creator test video',
                source: 'Captured fixture frame',
              },
            },
            blob: poster,
            capture: {
              sourceSha256: info.sha256,
              requestedTime,
              observedMediaTime: requestedTime + 0.025,
              playheadTime: requestedTime,
              timingEvidence: 'presented-frame',
              decodedFrame: { width: 1, height: 1 },
              width: 1,
              height: 1,
              mime: 'image/png',
              sha256,
            },
          };
        },
        dispose() {},
      };
    },
  };
}

async function prepareBatchImage(blob, options) {
  const originalSha256 = await hash(blob),
    runtime = new Blob([pngBytes()], { type: 'image/png' }),
    sha256 = await hash(runtime);
  return {
    asset: {
      format: 'AssetRevisionV1',
      id: 'creator-picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: runtime.size,
      width: 1,
      height: 1,
      alt: options.alt,
      review: 'candidate',
    },
    runtime: { blob: runtime, sha256 },
    thumbnail: { blob: runtime, sha256 },
    original: { blob, sha256: originalSha256, mime: 'image/png' },
    editing: { fit: options.fit },
  };
}

async function videoFixture({ paired = true, title = 'Video campaign', range } = {}) {
  const factories = mediaFactories(),
    selectedVideo = video('celebration.mp4', 'complete original video bytes'),
    intake = await prepareCreatorMediaIntake(
      paired ? [image('celebration.png'), selectedVideo] : [selectedVideo],
      {
        ...factories,
        ...(range ? { playbackRangeFor: () => range } : {}),
      },
    ),
    generated = generateCreatorProject({ id: 'video-campaign', name: title, seed: 37 }),
    missionId = generated.provenance.missionId,
    bound = creatorMediaBundleInput(intake, [missionId], {
      descriptionFor: () => 'The full creator video is an optional win celebration.',
    }),
    story = bound.media.stories[0],
    project = structuredClone(generated.project);
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'video-poster',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${story.poster.sha256}.png`,
      sha256: story.poster.sha256,
      bytes: story.poster.bytes,
      width: story.poster.width,
      height: story.poster.height,
      alt: 'Creator video poster',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'video-poster';
  return {
    content: {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: {
        creator: 'Fixture creator',
        picture: 'Fixture poster',
        license: 'Permission to share granted by fixture author',
      },
      media: bound.media,
    },
    assets: bound.assets,
    inspectVideo: factories.inspectVideo,
    original: selectedVideo.blob,
  };
}

async function preparedVideo(options) {
  const fixture = await videoFixture(options);
  return {
    fixture,
    pack: await prepareCreatorBundle(fixture.content, fixture.assets, {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    }),
  };
}

test('paired and video-only media become exact portable stories with poster provenance', async () => {
  for (const paired of [true, false]) {
    const { fixture, pack } = await preparedVideo({
      paired,
      range: { startSeconds: 1.25, endSeconds: 8.75 },
    });
    const story = pack.manifest.content.media.stories[0];
    assert.equal(pack.manifest.content.compatibility.format, 'revealline-creator-runtime.v3');
    assert.deepEqual(pack.manifest.content.compatibility.modes, ['solo', 'versus']);
    assert.equal(story.poster.origin.kind, paired ? 'supplied-image' : 'captured-frame');
    if (!paired) {
      assert.equal(story.poster.capture.requestedTime, 5);
      assert.equal(story.poster.capture.observedMediaTime, 5.025);
    }
    assert.deepEqual(story.playbackRange, {
      startSeconds: 1.25,
      endSeconds: 8.75,
      retainsCompleteOriginal: true,
    });
    assert.equal(pack.review.stories, 1);
    const file = exportCreatorBundle(pack, approveCreatorBundle(pack));
    const restored = await importCreatorBundle(file, {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    });
    assert.deepEqual(restored.manifest, pack.manifest);
    const original = restored.assets.find((asset) => asset.sha256 === story.video.sha256).blob;
    assert.equal(await original.text(), await fixture.original.text());
  }
});

test('one intake can bind naturally ordered exact dependencies to many missions', async () => {
  const factories = mediaFactories(),
    intake = await prepareCreatorMediaIntake(
      [video('2.mp4', 'second'), video('1.mp4', 'first')],
      factories,
    ),
    bound = creatorMediaBundleInput(intake, ['mission-one', 'mission-two']);
  assert.deepEqual(
    bound.media.stories.map((story) => story.missionId),
    ['mission-one', 'mission-two'],
  );
  assert.equal(bound.assets.length, 3); // The identical generated poster bytes are de-duplicated.
  assert.ok(bound.media.stories.every((story) => story.playbackRange.retainsCompleteOriginal));
});

test('a multi-mission campaign packages and reopens every scoped story dependency', async () => {
  const one = image('1.png'),
    two = image('2.png'),
    batch = await prepareCreatorBatch(
      [one, two],
      { draftId: 'video-batch', name: 'Video batch', seed: 91, fit: 'contain' },
      { prepareImage: prepareBatchImage },
    ),
    assembled = assembleCreatorBatchProject(batch),
    factories = mediaFactories(),
    intake = await prepareCreatorMediaIntake(
      [
        two,
        video('2.mp4', 'second complete original'),
        one,
        video('1.mp4', 'first complete original'),
      ],
      factories,
    ),
    missionIds = assembled.provenance.map((entry) => entry.missionId),
    bound = creatorMediaBundleInput(intake, missionIds),
    byHash = new Map(
      [
        ...batch.items.map((item) => ({
          sha256: item.image.runtime.sha256,
          blob: item.image.runtime.blob,
        })),
        ...bound.assets,
      ].map((asset) => [asset.sha256, asset]),
    ),
    pack = await prepareCreatorBundle(
      {
        project: assembled.project,
        packId: assembled.packId,
        themes,
        provenance: assembled.provenance,
        credits: {
          creator: 'Fixture creator',
          picture: 'Fixture posters',
          license: 'Permission to share granted by fixture author',
        },
        media: bound.media,
      },
      [...byHash.values()],
      { decodeImage, inspectVideo: factories.inspectVideo },
    );
  assert.equal(pack.review.missions, 2);
  assert.equal(pack.review.stories, 2);
  assert.deepEqual(
    pack.manifest.content.media.stories.map((story) => story.missionId),
    missionIds,
  );
  const restored = await importCreatorBundle(
    exportCreatorBundle(pack, approveCreatorBundle(pack)),
    { decodeImage, inspectVideo: factories.inspectVideo },
  );
  assert.deepEqual(restored.manifest, pack.manifest);
});

test('missing, corrupt and unsupported story assets fail before approval', async () => {
  const fixture = await videoFixture({ paired: false });
  await assert.rejects(
    prepareCreatorBundle(fixture.content, fixture.assets.slice(0, 1), {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    }),
    /missing/,
  );
  const corrupt = fixture.assets.map((asset) =>
    asset.sha256 === fixture.content.media.stories[0].video.sha256
      ? { ...asset, blob: new Blob(['corrupt original'], { type: 'video/mp4' }) }
      : asset,
  );
  await assert.rejects(
    prepareCreatorBundle(fixture.content, corrupt, {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    }),
    /bytes differ/,
  );
  await assert.rejects(
    prepareCreatorBundle(fixture.content, fixture.assets, {
      decodeImage,
      inspectVideo: mediaFactories({ reject: true }).inspectVideo,
    }),
    /Unsupported creator test codec/,
  );
  const pack = await prepareCreatorBundle(fixture.content, fixture.assets, {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    }),
    file = exportCreatorBundle(pack, approveCreatorBundle(pack)),
    changed = new Uint8Array(await file.arrayBuffer());
  changed[changed.length - 1] ^= 1;
  await assert.rejects(
    importCreatorBundle(new Blob([changed]), {
      decodeImage,
      inspectVideo: fixture.inspectVideo,
    }),
    /bytes differ/,
  );
  await assert.rejects(
    importCreatorBundle(file, {
      decodeImage,
      inspectVideo: mediaFactories({ reject: true }).inspectVideo,
    }),
    /Unsupported creator test codec/,
  );
});

test('installed story editions reopen from a fresh store and immutable updates coexist', async () => {
  const first = await preparedVideo({ title: 'First video edition' }),
    second = await preparedVideo({ title: 'Second video edition' });
  assert.notEqual(first.pack.editionId, second.pack.editionId);
  const memory = memoryIndexedDB(),
    store = createCreatorStore({ indexedDB: memory.indexedDB });
  for (const entry of [first, second]) {
    const approval = approveCreatorBundle(entry.pack);
    await installPreparedCreatorBundle(
      store,
      entry.pack,
      approval,
      await reviewCreatorInstallation(store, entry.pack, approval),
      { decodeImage },
    );
  }
  store.close();
  const reopened = createCreatorStore({ indexedDB: memory.indexedDB });
  for (const entry of [first, second]) {
    const restored = await loadInstalledCreatorBundle(reopened, entry.pack.editionId, {
      decodeImage,
      inspectVideo: entry.fixture.inspectVideo,
    });
    assert.equal(restored.editionId, entry.pack.editionId);
    assert.equal(restored.manifest.content.media.stories.length, 1);
  }
  reopened.close();
});

test('a verified legal completion authenticates only its exact installed story and poster pin', async () => {
  const { fixture, pack } = await preparedVideo({ paired: true }),
    runtime = createCreatorRuntime(pack, { decodeImage: decodeArtwork }),
    attempt = await runtime.start();
  for (let i = 0; i < 2400 && attempt.run.status !== 'won'; i++)
    runtime.step({ direction: 'down' });
  const receipt = await runtime.completion(),
    nextBefore = runtime.nextMissionId(receipt.missionId),
    story = await runtime.prepareVictoryStory(receipt, {
      inspectVideo: fixture.inspectVideo,
    });
  assert.equal(story.picturePin.sha256, story.poster.sha256);
  assert.equal(requirePreparedVictoryStory(story.prepared, story.picturePin), story.prepared);
  assert.throws(
    () =>
      requirePreparedVictoryStory(story.prepared, { ...story.picturePin, sha256: '0'.repeat(64) }),
    /different exact poster/,
  );
  assert.equal(runtime.current().run.status, 'won');
  assert.equal(runtime.nextMissionId(receipt.missionId), nextBefore);
  await assert.rejects(
    runtime.prepareVictoryStory({ ...receipt }, { inspectVideo: fixture.inspectVideo }),
    /verified legal completion/,
  );
  runtime.dispose();
});

test('legacy image-only .rlpack manifests retain their exact v1 shape', async () => {
  const generated = generateCreatorProject({ id: 'legacy-image', name: 'Legacy image', seed: 8 }),
    project = structuredClone(generated.project),
    blob = new Blob([pngBytes()], { type: 'image/png' }),
    sha256 = await hash(blob);
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Legacy fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].modes = ['solo'];
  project.missions[0].actors = [];
  project.missions[0].design.counterplay =
    'There are no enemies in this retained creator template.';
  project.missions[0].design.difficulty.threatDensity = 0;
  project.missions[0].presentation.backgroundAssetId = 'picture';
  project.missions[0].modes = ['solo'];
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: {
        ...generated.provenance,
        templateVersion: 'creator-layouts.v2',
      },
      credits: {
        creator: 'Fixture creator',
        picture: 'Legacy fixture',
        license: 'Permission to share granted by fixture author',
      },
    },
    [{ sha256, blob }],
    { decodeImage },
  );
  assert.equal(Object.hasOwn(pack.manifest.content, 'media'), false);
  assert.equal(pack.manifest.content.compatibility.format, 'revealline-creator-runtime.v1');
  assert.deepEqual(Object.keys(pack.manifest.assets[0]).sort(), ['bytes', 'mime', 'sha256']);
  const restored = await importCreatorBundle(
    exportCreatorBundle(pack, approveCreatorBundle(pack)),
    { decodeImage },
  );
  assert.deepEqual(restored.manifest, pack.manifest);
});
