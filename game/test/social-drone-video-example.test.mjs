import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { importCreatorBundle, prepareCreatorBundle } from '../creator/bundle.mjs';
import {
  prepareCreatorSource,
  exportCreatorSource,
  importCreatorSource,
  creatorBundleAssets,
} from '../creator/drafts.mjs';
import { createCreatorRuntime } from '../creator/runtime.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';

// Real exported pack and core/replay verification; native decoders are modeled here.
// Actual upload, decode, win, playback and replay are qualified in the browser receipt.
test('Social Drone video pack survives source backup and produces its exact story after a legal win', async () => {
  const bytes = await readFile(
    new URL('../creator/examples/social-drone-sky-watch.rlpack', import.meta.url),
  );
  const decodeImage = async () => ({ naturalWidth: 1280, naturalHeight: 640 });
  const inspectVideo = async (original) => ({
    original,
    info: {
      sha256: await creatorSHA256(await original.arrayBuffer()),
      bytes: original.size,
      mime: 'video/mp4',
      width: 1280,
      height: 720,
      durationSeconds: 9.476133,
    },
    dispose() {},
  });
  const pack = await importCreatorBundle(new Blob([bytes]), { decodeImage, inspectVideo });
  assert.equal(pack.manifest.content.project.name, 'Social Drone · Sky Watch');
  assert.equal(pack.manifest.content.project.missions.length, 1);
  const story = pack.manifest.content.media.stories[0];
  assert.equal(
    story.video.sha256,
    'ea033ebd2b205098b4b06567394f07d16887143b92f608030b1b1ddfde1fa656',
  );
  assert.equal(
    story.poster.origin.sourceImageSha256,
    'b731f135fd42400dc1b3217a9deb5fb511b09815b77743dd48024f5f468e3b53',
  );
  const { compatibility: _compatibility, ...content } = pack.manifest.content;
  const source = await prepareCreatorSource(
    { draftId: 'social-drone-sky-watch', content, editing: { fit: 'contain' } },
    pack.assets,
  );
  const restored = await importCreatorSource(exportCreatorSource(source));
  const reopened = await prepareCreatorBundle(
    restored.document.content,
    creatorBundleAssets(restored.assets),
    { decodeImage, inspectVideo },
  );
  assert.equal(reopened.editionId, pack.editionId);
  const runtime = createCreatorRuntime(reopened, {
    decodeImage: async () => ({ width: 1280, height: 640 }),
  });
  try {
    const attempt = await runtime.start();
    for (
      let tick = 0;
      tick < 2400 && attempt.run.status !== 'won' && attempt.run.status !== 'lost';
      tick++
    )
      runtime.step({ direction: 'down' });
    assert.equal(attempt.run.status, 'won');
    const receipt = await runtime.completion();
    const earned = await runtime.prepareVictoryStory(receipt, { inspectVideo });
    assert.equal(earned.prepared.descriptor.source.sha256, story.video.sha256);
    assert.equal(earned.picturePin.sha256, story.poster.sha256);
    assert.equal(earned.prepared.original.size, 2467021);
    assert.equal(runtime.nextMissionId(receipt.missionId), null);
  } finally {
    runtime.dispose();
  }
});
