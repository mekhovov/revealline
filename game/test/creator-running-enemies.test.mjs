import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { generateCreatorProject } from '../creator/templates.mjs';
import { creatorSHA256 } from '../creator/bytes.mjs';
import { prepareCreatorBundle } from '../creator/bundle.mjs';
import { createCreatorRuntime } from '../creator/runtime.mjs';
import { runningEnemyBaseLevel } from '../hunt/running-enemies.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { PNGImage } from './helpers/png-image.mjs';

async function edition() {
  const generated = generateCreatorProject({
    id: 'running-enemy-picture',
    name: 'Runner picture',
    seed: 8,
  });
  const project = structuredClone(generated.project);
  const blob = new Blob([pngBytes()], { type: 'image/png' });
  const sha256 = await creatorSHA256(await blob.arrayBuffer());
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
      alt: 'Original fixture picture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  ).themes;
  return prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: {
        creator: 'Test creator',
        picture: 'Original fixture',
        license: 'Permission to share granted by test author',
      },
    },
    [{ sha256, blob }],
    { decodeImage: async () => ({ naturalWidth: 1, naturalHeight: 1 }) },
  );
}
const decodeImage = async (url) => {
  const image = new PNGImage();
  image.src = url;
  await image.decode();
  return image;
};

test('Creator On and historical Off retain their exact accepted recipe across Continue and Retry', async () => {
  const pack = await edition();
  const runtime = createCreatorRuntime(pack, { decodeImage });
  const recovered = createCreatorRuntime(pack, { decodeImage });
  try {
    const off = await runtime.start();
    assert.equal(off.selection.runningEnemies, false);
    const legacy = runtime.suspend();
    assert.equal(legacy.format, 'revealline-creator-attempt.v1');
    assert.equal(Object.hasOwn(legacy, 'runningEnemies'), false);
    const restoredOff = await recovered.restore(legacy);
    assert.equal(restoredOff.selection.runningEnemies, false);
    assert.deepEqual((await recovered.start(restoredOff.selection)).run.level, off.run.level);

    const on = await runtime.start({ runningEnemies: true });
    assert.deepEqual(runningEnemyBaseLevel(on.run.level), off.run.level);
    assert.equal(on.manifest.simulationIdentity, off.manifest.simulationIdentity);
    for (let tick = 0; tick < 30; tick++) runtime.step({ direction: 'down' });
    const saved = runtime.suspend();
    assert.equal(saved.format, 'revealline-creator-attempt.v2');
    assert.equal(saved.runningEnemies, true);
    const restored = await recovered.restore(saved);
    assert.equal(restored.selection.runningEnemies, true);
    assert.equal(restored.run.tick, on.run.tick);
    assert.equal(recovered.runId(), runtime.runId());
    const continuedId = recovered.runId();
    const retry = await recovered.start(restored.selection);
    assert.deepEqual(retry.run.level, on.run.level);
    assert.equal(retry.selection.runningEnemies, true);
    assert.equal(retry.run.tick, 0);
    assert.notEqual(recovered.runId(), continuedId);
    assert.equal(
      (await recovered.start({ runningEnemies: false })).run.level.runningEnemies,
      undefined,
    );

    const mismatched = structuredClone(saved);
    mismatched.runningEnemies = false;
    await assert.rejects(recovered.restore(mismatched), /differs from this edition/);
    delete mismatched.runningEnemies;
    mismatched.format = 'revealline-creator-attempt.v1';
    await assert.rejects(recovered.restore(mismatched), /differs from this edition/);
    const omitted = structuredClone(saved);
    delete omitted.runningEnemies;
    await assert.rejects(recovered.restore(omitted), /running enemy choice/);
    await assert.rejects(runtime.start({ runningEnemies: 'yes' }), /whether to add/);
  } finally {
    runtime.dispose();
    recovered.dispose();
  }
});
