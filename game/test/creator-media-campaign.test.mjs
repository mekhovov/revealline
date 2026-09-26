import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import {
  creatorMediaCampaignInput,
  creatorMediaSourceEditing,
  prepareCreatorMediaCampaign,
} from '../creator/media-campaign.mjs';
import {
  createCreatorDraftBackend,
  exportCreatorSource,
  importCreatorSource,
  prepareCreatorSource,
} from '../creator/drafts.mjs';
import { createCreatorStore } from '../creator/installed.mjs';
import { generateCreatorProject } from '../creator/templates.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';

const themes = JSON.parse(
  await readFile(new URL('../content-design/themes.json', import.meta.url)),
).themes;
const credits = {
  creator: 'Media campaign fixture creator',
  picture: 'Creator supplied posters',
  license: 'Permission to share granted by fixture author',
};
const hash = (blob) => blob.arrayBuffer().then(creatorSHA256);

async function fixture({ standalone = 0, paired = 0, videoOnly = 0 } = {}) {
  const items = [],
    stories = [],
    assets = [];
  let index = 0;
  const poster = async (label, sourceImageSha256 = null) => {
    const blob = new Blob([pngBytes(), label], { type: 'image/png' }),
      sha256 = await hash(blob);
    assets.push({ sha256, role: 'poster', blob });
    return {
      sha256,
      bytes: blob.size,
      mime: 'image/png',
      width: 1,
      height: 1,
      origin: sourceImageSha256
        ? { kind: 'supplied-image', sourceImageSha256 }
        : { kind: 'captured-frame' },
      ...(sourceImageSha256
        ? {}
        : {
            capture: {
              requestedTime: 5,
              observedMediaTime: 5,
              playheadTime: 5,
              timingEvidence: 'presented-frame',
              decodedFrame: { width: 1, height: 1 },
            },
          }),
    };
  };
  const imageItem = async (name, pairedImage = false) => {
    const original = new Blob([`original:${name}`], { type: 'image/png' }),
      assetSha256 = await hash(original),
      descriptor = await poster(`poster:${name}`, assetSha256),
      item = {
        index: index++,
        name,
        kind: 'image',
        normalizedStem: name.replace(/\..+$/, ''),
        assetSha256,
        poster: descriptor,
        pairing: null,
        video: null,
        errors: [],
      };
    assets.push({ sha256: assetSha256, role: 'source-image-original', blob: original });
    items.push(item);
    return pairedImage ? item : null;
  };
  const videoItem = async (name, pairedImage = null) => {
    const blob = new Blob([`complete:${name}`], { type: 'video/mp4' }),
      assetSha256 = await hash(blob),
      descriptor = pairedImage?.poster ?? (await poster(`frame:${name}`)),
      video = {
        sha256: assetSha256,
        bytes: blob.size,
        mime: 'video/mp4',
        width: 640,
        height: 360,
        durationSeconds: 10,
      },
      playbackRange = {
        startSeconds: 0,
        endSeconds: 10,
        retainsCompleteOriginal: true,
      };
    assets.push({ sha256: assetSha256, role: 'victory-video-original', blob });
    stories.push({ video, poster: descriptor, playbackRange });
    items.push({
      index: index++,
      name,
      kind: 'video',
      normalizedStem: name.replace(/\..+$/, ''),
      assetSha256,
      pairing: null,
      video: {
        video,
        playbackRange,
        posterCandidates: pairedImage ? [] : [descriptor],
        selectedPosterSha256: descriptor.sha256,
        selectedPairingAssetSha256: pairedImage?.assetSha256 ?? null,
      },
      errors: [],
    });
  };
  for (let count = 0; count < standalone; count++) await imageItem(`standalone-${count + 1}.png`);
  for (let count = 0; count < paired; count++) {
    const selected = await imageItem(`paired-${count + 1}.png`, true);
    await videoItem(`paired-${count + 1}.mp4`, selected);
  }
  for (let count = 0; count < videoOnly; count++) await videoItem(`video-${count + 1}.mp4`);
  return {
    format: 'revealline-creator-media-intake.v1',
    items,
    dependencies: {
      format: 'revealline-creator-media-dependencies.v1',
      stories,
    },
    assets,
  };
}

const settings = {
  draftId: 'mixed-production-campaign',
  collectionName: 'Mixed production campaign',
  seed: 937,
  themes,
  credits,
};

function assertSharedGameplay(input) {
  const compiled = compileContentProject(input.content.project);
  for (const provenance of Array.isArray(input.content.provenance)
    ? input.content.provenance
    : [input.content.provenance]) {
    const generated = generateCreatorProject({
      id: 'reference-project',
      name: 'Reference project',
      seed: provenance.generationSeed,
      templateId: provenance.templateId,
    });
    const actual = resolveMission(compiled, provenance.missionId, {
      mode: 'solo',
      difficulty: 'standard',
    });
    const expected = resolveMission(compileContentProject(generated.project), 'picture-1', {
      mode: 'solo',
      difficulty: 'standard',
    });
    assert.equal(actual.simulationIdentity, expected.simulationIdentity);
    assert.ok(actual.level.enemies.length > 0, 'shared creator layout supplies an enemy');
    assert.ok(
      actual.level.walls.length +
        actual.level.foundations.length +
        actual.level.classic.terrain.length >
        0,
      'shared creator layout supplies generated obstacles',
    );
  }
}

test('standalone images generate exact missions with shared threatened gameplay', async () => {
  const input = creatorMediaCampaignInput(await fixture({ standalone: 2 }), settings);
  assert.equal(input.content.project.missions.length, 2);
  assert.equal(Object.hasOwn(input.content, 'media'), false);
  assert.equal(input.bindings.length, 0);
  assert.equal(input.assets.length, 2);
  assertSharedGameplay(input);
});

test('a paired image and video collapse into one exact story mission', async () => {
  const intake = await fixture({ paired: 1 }),
    input = creatorMediaCampaignInput(intake, settings),
    story = input.content.media.stories[0],
    selectedVideo = intake.items.find((item) => item.kind === 'video');
  assert.equal(input.content.project.missions.length, 1);
  assert.equal(input.content.media.stories.length, 1);
  assert.equal(story.video.sha256, selectedVideo.assetSha256);
  assert.equal(story.missionId, input.content.project.missions[0].id);
  assert.equal(story.poster.origin.kind, 'supplied-image');
  assertSharedGameplay(input);
});

test('video-only input generates one mission from its captured poster without another decode', async () => {
  const intake = await fixture({ videoOnly: 1 }),
    input = creatorMediaCampaignInput(intake, settings),
    story = input.content.media.stories[0];
  assert.equal(input.content.project.missions.length, 1);
  assert.equal(story.poster.origin.kind, 'captured-frame');
  assert.equal(input.content.project.assets[0].sha256, story.poster.sha256);
  assert.equal(
    input.assets.find((asset) => asset.sha256 === story.poster.sha256)?.blob instanceof Blob,
    true,
  );
  assertSharedGameplay(input);
});

test('mixed campaigns bind stories by video hash while standalone images keep their own missions', async () => {
  const intake = await fixture({ standalone: 1, paired: 1, videoOnly: 1 }),
    input = creatorMediaCampaignInput(intake, settings),
    videoHashes = new Set(
      intake.items.filter((item) => item.kind === 'video').map((item) => item.assetSha256),
    );
  assert.equal(input.content.project.missions.length, 3);
  assert.equal(input.content.media.stories.length, 2);
  assert.deepEqual(new Set(input.bindings.map((binding) => binding.videoSha256)), videoHashes);
  assert.deepEqual(
    new Map(input.content.media.stories.map((story) => [story.video.sha256, story.missionId])),
    new Map(input.bindings.map((binding) => [binding.videoSha256, binding.missionId])),
  );
  assertSharedGameplay(input);
});

test('the production adapter prepares a playable video-only bundle through shared route verification', async () => {
  const posterBlob = new Blob([pngBytes()], { type: 'image/png' }),
    posterSha256 = await hash(posterBlob),
    videoBlob = new Blob(['verified complete video'], { type: 'video/mp4' }),
    videoSha256 = await hash(videoBlob),
    video = {
      sha256: videoSha256,
      bytes: videoBlob.size,
      mime: 'video/mp4',
      width: 640,
      height: 360,
      durationSeconds: 10,
    },
    poster = {
      sha256: posterSha256,
      bytes: posterBlob.size,
      mime: 'image/png',
      width: 1,
      height: 1,
      origin: { kind: 'captured-frame' },
      capture: {
        requestedTime: 5,
        observedMediaTime: 5,
        playheadTime: 5,
        timingEvidence: 'presented-frame',
        decodedFrame: { width: 1, height: 1 },
      },
    },
    playbackRange = {
      startSeconds: 0,
      endSeconds: 10,
      retainsCompleteOriginal: true,
    },
    intake = {
      format: 'revealline-creator-media-intake.v1',
      items: [
        {
          index: 0,
          name: 'celebration.mp4',
          kind: 'video',
          normalizedStem: 'celebration',
          assetSha256: videoSha256,
          pairing: null,
          video: {
            video,
            playbackRange,
            posterCandidates: [poster],
            selectedPosterSha256: posterSha256,
            selectedPairingAssetSha256: null,
          },
          errors: [],
        },
      ],
      dependencies: {
        format: 'revealline-creator-media-dependencies.v1',
        stories: [{ video, poster, playbackRange }],
      },
      assets: [
        { sha256: posterSha256, role: 'poster', blob: posterBlob },
        { sha256: videoSha256, role: 'victory-video-original', blob: videoBlob },
      ],
    },
    result = await prepareCreatorMediaCampaign(intake, settings, {
      decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }),
      inspectVideo: async () => ({ info: video, dispose() {} }),
    });
  assert.equal(result.prepared.review.missions, 1);
  assert.equal(result.prepared.review.stories, 1);
  assert.match(result.prepared.review.validation, /Automated route verified/);
  assertSharedGameplay(result);
});

test('private media source v2 roundtrips originals and exact choices through conflict-safe checkpoints', async () => {
  const intake = await fixture({ standalone: 1, paired: 1, videoOnly: 1 }),
    campaign = creatorMediaCampaignInput(intake, settings),
    sourceEditing = creatorMediaSourceEditing(intake),
    sourceHashes = new Set([
      ...campaign.assets.map((asset) => asset.sha256),
      ...sourceEditing.items.map((item) => item.source.sha256),
    ]),
    sourceAssets = intake.assets.filter((asset) => sourceHashes.has(asset.sha256)),
    source = await prepareCreatorSource(
      {
        draftId: settings.draftId,
        content: campaign.content,
        editing: { fit: 'contain', media: sourceEditing },
      },
      sourceAssets,
    );
  assert.equal(source.document.format, 'revealline-creator-source.v2');
  assert.equal(source.document.editing.media.items.length, 4);
  assert.equal(
    source.document.editing.media.items.find((item) => item.name === 'paired-1.mp4')
      .pairedImageSha256,
    intake.items.find((item) => item.name === 'paired-1.png').assetSha256,
  );
  assert.equal(
    source.document.editing.media.items.find((item) => item.name === 'video-1.mp4')
      .posterRequestedTime,
    5,
  );
  assert.deepEqual(
    source.document.editing.media.items.find((item) => item.name === 'video-1.mp4').playbackRange,
    { startSeconds: 0, endSeconds: 10, retainsCompleteOriginal: true },
  );
  const restored = await importCreatorSource(exportCreatorSource(source));
  assert.deepEqual(restored.document, source.document);
  for (const item of source.document.editing.media.items.filter((entry) => entry.source)) {
    assert.deepEqual(
      await restored.assets.find((asset) => asset.sha256 === item.source.sha256).blob.arrayBuffer(),
      await source.assets.find((asset) => asset.sha256 === item.source.sha256).blob.arrayBuffer(),
    );
  }

  const portableOnly = await prepareCreatorSource(
    { draftId: 'portable-media-draft', content: campaign.content, editing: { fit: 'contain' } },
    campaign.assets,
  );
  assert.equal(portableOnly.document.format, 'revealline-creator-source.v2');
  assert.equal(
    portableOnly.document.editing.media.items.find((item) => item.kind === 'image').source,
    null,
  );
  assert.ok(
    portableOnly.document.editing.media.items
      .filter((item) => item.kind === 'video')
      .every((item) => item.source && item.playbackRange.retainsCompleteOriginal),
  );

  const memory = memoryIndexedDB(),
    store = createCreatorStore({ indexedDB: memory.indexedDB }),
    backend = createCreatorDraftBackend(store);
  await backend.save(restored, null);
  const checkpoint = await backend.read(settings.draftId);
  assert.equal(checkpoint.revision, 1);
  assert.deepEqual(checkpoint.source.document, source.document);
  await assert.rejects(backend.save(source, null), /newer draft/);
  store.close();

  await assert.rejects(
    prepareCreatorSource(
      {
        draftId: settings.draftId,
        content: campaign.content,
        editing: { fit: 'contain', media: sourceEditing },
      },
      sourceAssets.slice(1),
    ),
    /source assets|closure|missing/i,
  );
});
