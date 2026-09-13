import assert from 'node:assert/strict';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildSentinelCircuit } from '../sentinel-circuit/build.mjs';
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
import { canonicalJSON, boundedJSON, exactKeys } from '../../../game/data-json.mjs';

import {
  ROOT,
  SOURCE_LEVEL_IDS,
  SOURCE_PACK_SHA,
  SOURCE_PROOF,
  SOURCE_PROOF_SHA,
  boundedFile,
} from '../sentinel-circuit-external/build.mjs';
export { ROOT, SOURCE_LEVEL_IDS, SOURCE_PACK_SHA, SOURCE_PROOF, SOURCE_PROOF_SHA, boundedFile };
export const THEME_IDS = Object.freeze(['ukraine', 'retro', 'coupa']);
export const EDITIONS_FILE = 'authoring/library/sentinel-theme-chapters/editions.json';
const ART = 'authoring/library/sentinel-theme-art';
const IMAGES = ['listening-court', 'switchyard-gates', 'open-the-circuit'];
const INPUTS = Object.freeze({
  'authoring/library/sentinel-circuit/build.mjs':
    'e76f204cbe240bdedac79f2d92c85ab767846be32cfae50cd76ef983340c4d41',
  'authoring/library/sentinel-circuit-external/build.mjs':
    'ee481bcaef80d86778fdda295f8660d0bfa2d6e0950bd24fddc59e051d463e88',
  'authoring/library/sentinel-circuit/routes.json':
    'eb235f9bc26ea3670137f3f7d7ac86ac5e8c4b56b98502b8ef61f0ad98d95e70',
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'authoring/library/sentinel-theme-art/provenance.json':
    '48cfad28a7454317d4f16dbdbd0c593ee6ad0bf5aa2a94152a7f27be9ef5e948',
});
export const physicalLevel = (level) => {
  const copy = structuredClone(level);
  for (const key of ['id', 'name', 'themeId']) delete copy[key];
  for (const key of ['title', 'description', 'rightsStatus']) delete copy.metadata[key];
  return copy;
};
/** Pure metadata validation; it grants no decoded-media or owner capability. */
export function validateSentinelThemeEditions(value, provenance) {
  const doc = boundedJSON(value, {
    maxBytes: 32768,
    maxNodes: 2000,
    maxDepth: 8,
    maxArray: 16,
    maxString: 4096,
  });
  exactKeys(doc, ['format', 'artRoot', 'provenanceSha256', 'editions'], 'Sentinel editions');
  assert.equal(doc.format, 'revealline-sentinel-theme-editions.v1');
  assert.equal(doc.artRoot, ART);
  assert.equal(doc.provenanceSha256, INPUTS[`${ART}/provenance.json`]);
  assert.equal(provenance.format, 'revealline-source-art-provenance.v1');
  assert.equal(provenance.images.length, 9);
  assert.deepEqual(
    doc.editions.map((e) => e.themeId),
    THEME_IDS,
  );
  for (const edition of doc.editions) {
    exactKeys(edition, ['themeId', 'id', 'images'], 'Sentinel theme');
    assert.equal(edition.id, `sentinel-circuit-${edition.themeId}`);
    assert.equal(edition.images.length, 3);
    for (const [i, picture] of edition.images.entries()) {
      exactKeys(
        picture,
        ['sourceCellId', 'sourceLevelId', 'path', 'sha256', 'title', 'description'],
        'Sentinel picture',
      );
      assert.equal(picture.sourceCellId, `sentinel-circuit/${IMAGES[i]}/${edition.themeId}`);
      assert.equal(picture.sourceLevelId, SOURCE_LEVEL_IDS[i]);
      assert.equal(picture.path, `${edition.themeId}/originals/${IMAGES[i]}.png`);
      const original = provenance.images.find((p) => p.cellId === picture.sourceCellId);
      assert.ok(original);
      assert.equal(original.themeId, edition.themeId);
      assert.equal(original.missionSlot, IMAGES[i]);
      assert.equal(original.path, picture.path);
      assert.equal(picture.sha256, original.sha256);
      assert.equal(original.runtimeBinding, null);
      for (const [key, limit] of [
        ['title', 160],
        ['description', 2048],
      ])
        assert.ok(
          typeof picture[key] === 'string' &&
            picture[key].length > 0 &&
            picture[key].length <= limit,
        );
    }
  }
  return doc;
}
export async function buildSentinelTheme(themeId) {
  assert.ok(THEME_IDS.includes(themeId), 'Choose ukraine, retro or coupa.');

  const inputPins = [];
  for (const [file, hash] of Object.entries(INPUTS)) {
    const bytes = await boundedFile(file, 2 * 1024 * 1024, hash);
    inputPins.push({ path: file, bytes: bytes.length, sha256: hash });
  }
  const { pack: sourcePack } = await buildSentinelCircuit();
  const sourceBytes = new TextEncoder().encode(JSON.stringify(sourcePack));
  assert.equal(await externalChapterHash(sourceBytes), SOURCE_PACK_SHA);
  const provenance = JSON.parse(
    await boundedFile(`${ART}/provenance.json`, 65536, INPUTS[`${ART}/provenance.json`]),
  );
  const editionBytes = await boundedFile(EDITIONS_FILE, 32768);
  const editions = validateSentinelThemeEditions(JSON.parse(editionBytes), provenance);
  inputPins.push({
    path: EDITIONS_FILE,
    bytes: editionBytes.length,
    sha256: await externalChapterHash(editionBytes),
  });
  const edition = editions.editions.find((e) => e.themeId === themeId),
    ID = edition.id;
  const themes = JSON.parse(
    await boundedFile('game/content/themes.json', 32768, INPUTS['game/content/themes.json']),
  );
  const theme = structuredClone(themes.themes.find((t) => t.id === themeId));
  assert.ok(theme);
  theme.subtitle = 'Sentinel Circuit · Tactical';
  const next = structuredClone(sourcePack);
  next.id = ID;
  next.name = `${theme.name} · Sentinel Circuit — Tactical`;
  next.description =
    'Three Tactical missions with original reward pictures: read the courtyards, time a crossing, then complete a two-stage encounter.';
  next.metadata.rightsStatus = `Existing abstract Sentinel layouts and AI-assisted original ${theme.name} scenery. Exact prompts and original PNGs retained; fictional geography, emblems and objects, no historical or product-UI authenticity claim. Existing theme music; no new track or story movie.`;
  next.themes = [theme];
  next.visualOverrides = {};
  next.levelVisuals = [];
  const campaign = next.campaigns[0];
  campaign.id = ID;
  campaign.title = next.name;
  campaign.themeId = themeId;
  for (const [i, level] of campaign.levels.entries()) {
    assert.equal(level.id, edition.images[i].sourceLevelId);
    level.id = level.id.replace('sentinel-circuit-', `${ID}-`);
    level.name = edition.images[i].title;
    level.themeId = themeId;
    level.metadata.title = level.name;
    level.metadata.description = edition.images[i].description;
    level.metadata.rightsStatus =
      'Exact Sentinel layout, independent theme owner and original scenic reward. Fictional setting; scenery does not define collision geometry.';
  }
  const decoded = new Map();
  const decodeImage = async (value) => {
    const bytes =
      typeof value === 'string'
        ? Buffer.from(value.split(',')[1], 'base64')
        : Buffer.from(await value.arrayBuffer());
    const hash = await externalChapterHash(bytes);
    if (!decoded.has(hash))
      decoded.set(hash, decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`));
    const { naturalWidth, naturalHeight } = decoded.get(hash);
    return { naturalWidth, naturalHeight };
  };
  const { pack } = await preparePack(next, { decodeImage });
  for (const [i, level] of pack.campaigns[0].levels.entries())
    assert.deepEqual(physicalLevel(level), physicalLevel(sourcePack.campaigns[0].levels[i]));
  assert.deepEqual(pack.classRecipes, sourcePack.classRecipes);
  assert.deepEqual(pack.themes, [theme]);
  assert.deepEqual(pack.music, sourcePack.music);
  const resolved = resolvePackCampaign(pack, ID),
    executionCatalog = createExecutionCatalog([resolved]);
  const baseCampaignKey = campaignKey(resolved.campaign);
  const library = {
    format: 'revealline-media-library.v1',
    assets: [],
    presentations: [],
    assignments: [],
  };
  const assets = [],
    originals = [];
  for (const [i, picture] of edition.images.entries()) {
    const record = provenance.images.find((p) => p.cellId === picture.sourceCellId);
    assert.equal(record.path, `${themeId}/originals/${IMAGES[i]}.png`);
    const file = `${ART}/${record.path}`,
      bytes = await boundedFile(file, 4 * 1024 * 1024, record.sha256);
    assert.equal(bytes.length, record.bytes);
    const id = `${ID}-poster-${i + 1}`,
      presentationId = `${id}-presentation`;
    const prepared = await prepareStillAsset(
      new Blob([bytes]),
      {
        id,
        provenance: {
          kind: 'original',
          credit: 'RevealLine · AI-assisted original artwork',
          source: `${file}; exact original PNG; ${ART}/provenance.json`,
        },
      },
      { decodeImage },
    );
    assert.equal(prepared.asset.width, record.width);
    assert.equal(prepared.asset.height, record.height);
    const level = pack.campaigns[0].levels[i],
      identity = {
        baseCampaignKey,
        levelId: level.id,
        levelRevision: level.revision,
        themeId,
      };
    library.assets.push(prepared.asset);
    library.presentations.push({
      format: 'revealline-media-presentation.v1',
      id: presentationId,
      revision: 1,
      identity,
      poster: { assetId: id, fit: 'contain', sampling: 'nearest' },
      story: null,
      description: level.name,
    });
    library.assignments.push({ identity, presentationId, revision: 1 });
    assets.push({ sha256: prepared.asset.sha256, blob: prepared.blob });
    originals.push({
      assetId: id,
      presentationId,
      levelId: level.id,
      levelRevision: level.revision,
      ...Object.fromEntries(
        ['sha256', 'bytes', 'mime', 'width', 'height'].map((k) => [k, prepared.asset[k]]),
      ),
    });
    inputPins.push({ path: file, bytes: bytes.length, sha256: record.sha256 });
  }
  assert.equal(new Set(originals.map((o) => o.sha256)).size, 3);
  const media = await prepareStoredStillMedia(library, assets, { executionCatalog, decodeImage });
  const mediaBlob = await exportMediaBundle(media.library, media.assets, { decodeImage });
  const packBytes = new TextEncoder().encode(JSON.stringify(pack));
  const descriptor = {
    format: EXTERNAL_CHAPTER_FORMAT,
    id: ID,
    revision: 1,
    source: { id: sourcePack.id, bytes: sourceBytes.length, sha256: SOURCE_PACK_SHA },
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
  const prepared = await prepareExternalChapter(descriptor, payloads, { decodeImage });
  assert.equal(canonicalJSON(prepared.descriptor), canonicalJSON(descriptor));
  return {
    descriptor,
    payloads,
    prepared,
    sourcePack,
    inputPins,
    imageProofs: originals.map((o) => ({
      levelId: o.levelId,
      sha256: o.sha256,
      bytes: o.bytes,
      fit: 'contain',
      ...decoded.get(o.sha256),
    })),
  };
}
export async function writeSentinelTheme(themeId, outputDirectory) {
  assert.equal(typeof outputDirectory, 'string', 'Choose a new cache output directory.');
  const output = path.resolve(outputDirectory),
    relative = path.relative(ROOT, output);
  assert.ok(
    relative.startsWith('.cache/') &&
      relative.split('/').every((p) => p && p !== '.' && p !== '..'),
    'Write paired payloads only to a new worktree cache directory.',
  );
  let parent = ROOT;
  for (const part of relative.split('/').slice(0, -1)) {
    parent = path.join(parent, part);
    const info = await lstat(parent);
    assert.ok(
      info.isDirectory() && !info.isSymbolicLink(),
      'Cache parents must be ordinary directories.',
    );
  }
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  const result = await buildSentinelTheme(themeId);
  await mkdir(output);
  for (const [name, bytes] of [
    ['descriptor.json', Buffer.from(JSON.stringify(result.descriptor, null, 2) + '\n')],
    ['pack.json', Buffer.from(await result.payloads.pack.arrayBuffer())],
    ['media.rlmedia', Buffer.from(await result.payloads.media.arrayBuffer())],
    ['inputs.json', Buffer.from(JSON.stringify(result.inputPins, null, 2) + '\n')],
  ])
    await writeFile(path.join(output, name), bytes, { flag: 'wx' });
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  assert.equal(process.argv.length, 4, 'Use build.mjs THEME NEW_CACHE_OUTPUT_DIRECTORY');
  const result = await writeSentinelTheme(process.argv[2], process.argv[3]);
  console.log(
    JSON.stringify({ output: path.resolve(process.argv[3]), ...result.descriptor }, null, 2),
  );
}
