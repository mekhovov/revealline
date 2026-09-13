#!/usr/bin/env node
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import { preparePack, resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { campaignKey } from '../../../game/library.mjs';
import { prepareStillAsset } from '../../../game/media-still.mjs';
import { prepareStoredStillMedia } from '../../../game/media-storage-record.mjs';
import { exportMediaBundle } from '../../../game/media-bundle.mjs';
import {
  EXTERNAL_CHAPTER_FORMAT,
  externalChapterHash,
  prepareExternalChapter,
} from '../../../game/external-chapter.mjs';
import { decodeOriginalPNG } from '../four-worlds-chapters/verify-images.mjs';

export const SOURCE = 'authoring/library/four-worlds-chapters/packs/original-fpv-pressure.json';
export const SOURCE_SHA = 'dc7b29694ec409c629e4006f11b96a2834937bf0f846e9dd9f29c5981aa5daa9';
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url));
export async function decodePilotImage(value) {
  const bytes =
    typeof value === 'string'
      ? Buffer.from(value.split(',')[1], 'base64')
      : Buffer.from(await value.arrayBuffer());
  const { naturalWidth, naturalHeight } = decodeOriginalPNG(
    `data:image/png;base64,${bytes.toString('base64')}`,
  );
  return { naturalWidth, naturalHeight };
}
/** One reproducible new edition. No resampling, registration, default change or old-pack migration. */
export async function buildExternalPilot() {
  const source = await readFile(path.join(ROOT, SOURCE));
  assert.equal(await externalChapterHash(source), SOURCE_SHA);
  const { pack: prior } = await preparePack(source.toString('utf8'), {
    decodeImage: decodePilotImage,
  });
  const next = structuredClone(prior);
  next.id = 'original-fpv-pressure-external';
  next.name = 'Pressure Pictures · external-original pilot';
  next.description =
    'Source pilot: three existing Pressure Pictures layouts with exact original PNGs in the paired media file. Gameplay JSON alone is not a complete original backup. No host adoption or existing-edition migration.';
  next.campaigns[0].id += '-external';
  next.campaigns[0].title = next.name;
  for (const level of next.campaigns[0].levels) level.id += '-external';
  next.visualOverrides = {};
  next.levelVisuals = [];
  const { pack } = await preparePack(next, { decodeImage: decodePilotImage });
  const resolved = resolvePackCampaign(pack, pack.campaigns[0].id),
    executionCatalog = createExecutionCatalog([resolved]),
    baseCampaignKey = campaignKey(resolved.campaign),
    themeId = pack.themes[0].id;
  const library = {
      format: 'revealline-media-library.v1',
      assets: [],
      presentations: [],
      assignments: [],
    },
    assets = [],
    originals = [];
  for (let i = 0; i < prior.levelVisuals.length; i++) {
    const sourceVisual = prior.levelVisuals[i].visualOverrides.background;
    const level = pack.campaigns[0].levels[i],
      id = `external-fpv-poster-${i + 1}`;
    assert.equal(prior.levelVisuals[i].levelId + '-external', level.id);
    const bytes = Buffer.from(sourceVisual.dataUrl.split(',')[1], 'base64');
    const asset = await prepareStillAsset(
      new Blob([bytes]),
      {
        id,
        provenance: {
          kind: 'original',
          credit: sourceVisual.metadata.author,
          source: `${SOURCE} SHA-256 ${SOURCE_SHA}; ${sourceVisual.metadata.rightsStatus}`,
        },
      },
      { decodeImage: decodePilotImage },
    );
    const identity = { baseCampaignKey, levelId: level.id, levelRevision: level.revision, themeId },
      presentationId = `${id}-presentation`;
    library.assets.push(asset.asset);
    library.presentations.push({
      format: 'revealline-media-presentation.v1',
      id: presentationId,
      revision: 1,
      identity,
      poster: { assetId: id, fit: 'contain', sampling: 'nearest' },
      story: null,
      description: sourceVisual.metadata.description,
    });
    library.assignments.push({ identity, presentationId, revision: 1 });
    assets.push({ sha256: asset.asset.sha256, blob: asset.blob });
    originals.push({
      assetId: id,
      presentationId,
      levelId: level.id,
      levelRevision: level.revision,
      ...Object.fromEntries(
        ['sha256', 'bytes', 'mime', 'width', 'height'].map((k) => [k, asset.asset[k]]),
      ),
    });
  }
  const media = await prepareStoredStillMedia(library, assets, {
    executionCatalog,
    decodeImage: decodePilotImage,
  });
  const mediaBlob = await exportMediaBundle(media.library, media.assets, {
    decodeImage: decodePilotImage,
  });
  const packBytes = new TextEncoder().encode(JSON.stringify(pack));
  const descriptor = {
    format: EXTERNAL_CHAPTER_FORMAT,
    id: pack.id,
    revision: 1,
    source: { id: prior.id, bytes: source.length, sha256: SOURCE_SHA },
    pack: { bytes: packBytes.length, sha256: await externalChapterHash(packBytes) },
    media: {
      bytes: mediaBlob.size,
      sha256: await externalChapterHash(await mediaBlob.arrayBuffer()),
    },
    campaignKey: baseCampaignKey,
    themeId,
    originals,
  };
  const payloads = { pack: new Blob([packBytes], { type: 'application/json' }), media: mediaBlob };
  const prepared = await prepareExternalChapter(descriptor, payloads, {
    decodeImage: decodePilotImage,
  });
  return { descriptor, payloads, prepared, prior };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 3, 'Use build.mjs NEW_OUTPUT_DIRECTORY');
  const output = path.resolve(process.argv[2]);
  const result = await buildExternalPilot();
  await mkdir(output); // Exclusive; never replaces prior evidence or original bytes.
  await writeFile(
    path.join(output, 'descriptor.json'),
    JSON.stringify(result.descriptor, null, 2) + '\n',
    { flag: 'wx' },
  );
  await writeFile(
    path.join(output, 'pack.json'),
    Buffer.from(await result.payloads.pack.arrayBuffer()),
    { flag: 'wx' },
  );
  await writeFile(
    path.join(output, 'media.rlmedia'),
    Buffer.from(await result.payloads.media.arrayBuffer()),
    { flag: 'wx' },
  );
  console.log(
    JSON.stringify(
      {
        output,
        ...result.descriptor,
        originalBytes: result.descriptor.originals.reduce((n, a) => n + a.bytes, 0),
      },
      null,
      2,
    ),
  );
}
