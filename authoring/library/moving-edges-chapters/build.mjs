import assert from 'node:assert/strict';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildMovingEdges } from '../moving-edges/build.mjs';
import { ROOT, ordinaryFile, digest } from '../sentinel-circuit/files.mjs';
import { IDS } from '../moving-edges/build.mjs';
import { preparePack, resolvePackCampaign } from '../../../game/packs.mjs';
import { createExecutionCatalog } from '../../../game/campaign-contexts.mjs';
import { campaignKey } from '../../../game/library.mjs';
import { prepareStillAsset } from '../../../game/media-still.mjs';
import { prepareStoredStillMedia } from '../../../game/media-storage-record.mjs';
import { exportMediaBundle } from '../../../game/media-bundle.mjs';
import {
  EXTERNAL_CHAPTER_FORMAT,
  prepareExternalChapter,
} from '../../../game/external-chapter.mjs';
import { decodeOriginalPNG } from '../four-worlds-chapters/verify-images.mjs';
import { boundedJSON, exactKeys } from '../../../game/data-json.mjs';

export { ROOT, IDS, digest };
export const SOURCE_PROOF = 'authoring/library/moving-edges/routes.json';
export const SOURCE_PACK_SHA = '048100f48c2406949639b86b540d17e26e5660e59879707dc913f52ac74fc33c';
export async function readPinned(file, limit, expected) {
  const bytes = await ordinaryFile(path.join(ROOT, file), limit);
  if (expected !== undefined) assert.equal(digest(bytes), expected, `Exact source: ${file}`);
  return bytes;
}
export const THEME_IDS = Object.freeze(['fpv', 'ukraine', 'retro', 'coupa']);
export const EDITIONS_FILE = 'authoring/library/moving-edges-chapters/editions.json';
export const INPUTS = Object.freeze({
  'authoring/library/moving-edges/build.mjs':
    '7ea4a077d333b7a10c91315b8ea55902e6ff103122f2e47ffa8838be57e8846e',
  'authoring/library/moving-edges/layouts.json':
    'f9f15bd2d88d23d88922d90b41b4639c62347b8f26e46b99c66c6328b4bbc82c',
  'authoring/library/moving-edges/controls.mjs':
    '1f24e0fd094383d5a47c0430652ed3b64caa362244d8d63e03c7f078baae7ce3',
  'authoring/library/moving-edges/verify.mjs':
    '67f39a5efbf54ca5e5d7a0102cf7c1a56f44f30f88d69e33e5c73d23ad753068',
  'authoring/library/moving-edges/routes.json':
    '19d9be49c5db2b1b5235213896b0f100e6cc48988a00566aea68a65ef7e152a6',
  'authoring/library/moving-edges/mechanics.mjs':
    'f595e09dc4434bbbe5557b6655c13caaa5b0a29feeb8cd9b5d79443bf7e417c8',
  'authoring/library/moving-edges/mechanic-cases.json':
    '94bb30067811a3c85b6053ff6f1fd575f4886ffc8b8e883d447aaead496fbbbe',
  'authoring/library/moving-edges/mechanics-proof.json':
    '511c10e633421367ea0e221a9e65094517f5699f24e4ccec81c0c34b4d654965',
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'authoring/library/moving-edges-art/provenance.json':
    'bdaac5fc8776c83a9e2201f36409b576478b835c708e97e335c8c2d7ee9006e1',
  'authoring/library/moving-edges-art/manifest.json':
    'c16bfec962cc8afa7e8717f4e39e1719b3ec9caa7911d54d409c067bdbb601e1',
});
export const MECHANICS_PROOF = 'authoring/library/moving-edges/mechanics-proof.json';
export const MECHANIC_CASES = 'authoring/library/moving-edges/mechanic-cases.json';
export function originalDimensions(cellId) {
  return [cellId === 'moving-edges/survey-wheel/ukraine' ? 1773 : 1774, 887];
}
export const artRoot = () => 'authoring/library/moving-edges-art';
// The source IDs and revision remain physical authority. Only these display fields differ.
export function physicalLevel(level) {
  const copy = structuredClone(level);
  for (const key of ['name', 'themeId']) delete copy[key];
  for (const key of ['title', 'description', 'rightsStatus']) delete copy.metadata[key];
  return copy;
}

/** Pure bounded metadata check; it grants no decoder or owner capability. */
export function validateMovingEdgesThemeEditions(value, provenances) {
  const doc = boundedJSON(value, {
    maxBytes: 32768,
    maxNodes: 2000,
    maxDepth: 8,
    maxArray: 16,
    maxString: 4096,
  });
  exactKeys(doc, ['format', 'editions'], 'Moving Edges theme editions');
  assert.equal(doc.format, 'revealline-moving-edges-editions.v1');
  assert.deepEqual(
    doc.editions.map((e) => e.themeId),
    THEME_IDS,
  );
  assert.equal(provenances.length, 4);
  for (const [index, edition] of doc.editions.entries()) {
    exactKeys(
      edition,
      ['themeId', 'id', 'artRoot', 'provenanceSha256', 'images'],
      'Moving Edges theme',
    );
    const themeId = THEME_IDS[index],
      provenance = provenances[index];
    assert.equal(edition.id, `moving-edges-${themeId}`);
    assert.equal(edition.artRoot, artRoot(themeId));
    assert.equal(edition.provenanceSha256, INPUTS[`${edition.artRoot}/provenance.json`]);
    assert.equal(provenance.format, 'revealline-source-art-provenance.v1');
    assert.equal(provenance.images.length, 12);
    assert.equal(edition.images.length, 3);
    for (const [i, picture] of edition.images.entries()) {
      exactKeys(
        picture,
        ['sourceCellId', 'sourceLevelId', 'path', 'sha256', 'title', 'description'],
        'Moving Edges theme picture',
      );
      const slot = IDS[i].replace('moving-edges-', ''),
        original = provenance.images.filter((image) => image.themeId === themeId)[i];
      assert.equal(picture.sourceCellId, `moving-edges/${slot}/${themeId}`);
      assert.equal(picture.sourceLevelId, IDS[i]);
      assert.equal(picture.path, `originals/${slot}-${themeId}.png`);
      assert.equal(original.cellId, picture.sourceCellId);
      assert.equal(original.sourceLevelId, picture.sourceLevelId);
      assert.equal(original.themeId, themeId);
      assert.equal(original.missionSlot, slot);
      assert.equal(original.path, picture.path);
      assert.equal(original.sha256, picture.sha256);
      assert.equal(original.runtimeBinding, null);
      assert.deepEqual([original.width, original.height], originalDimensions(original.cellId));
      assert.ok(
        Number.isSafeInteger(original.bytes) &&
          original.bytes > 0 &&
          original.bytes <= 4 * 1024 * 1024,
      );
      for (const [key, maximum] of [
        ['title', 160],
        ['description', 2048],
      ])
        assert.ok(
          typeof picture[key] === 'string' && picture[key].trim() && picture[key].length <= maximum,
        );
    }
  }
  return doc;
}

export async function buildMovingEdgesTheme(themeId) {
  assert.ok(THEME_IDS.includes(themeId), 'Choose fpv, ukraine, retro or coupa.');
  const inputPins = [];
  for (const [file, sha256] of Object.entries(INPUTS)) {
    const bytes = await readPinned(file, 4 * 1024 * 1024, sha256);
    inputPins.push({ path: file, bytes: bytes.length, sha256 });
  }
  const { pack: sourcePack } = await buildMovingEdges();
  const sourceBytes = Buffer.from(JSON.stringify(sourcePack));
  assert.equal(digest(sourceBytes), SOURCE_PACK_SHA);
  const provenances = await Promise.all(
    THEME_IDS.map(async (theme) => {
      const file = `${artRoot(theme)}/provenance.json`;
      return JSON.parse(await readPinned(file, 65536, INPUTS[file]));
    }),
  );
  const manifest = JSON.parse(
    await readPinned(`${artRoot()}/manifest.json`, 65536, INPUTS[`${artRoot()}/manifest.json`]),
  );
  assert.equal(manifest.format, 'revealline-source-art-manifest.v1');
  assert.equal(manifest.images.length, 12);
  for (const [i, listed] of manifest.images.entries()) {
    const original = provenances[0].images[i];
    assert.ok(original);
    assert.deepEqual(
      Object.fromEntries(Object.keys(listed).map((key) => [key, original[key]])),
      listed,
    );
    assert.equal(original.sourceBytesEqual, true);
  }
  const editionBytes = await readPinned(EDITIONS_FILE, 32768);
  const editions = validateMovingEdgesThemeEditions(JSON.parse(editionBytes), provenances);
  inputPins.push({ path: EDITIONS_FILE, bytes: editionBytes.length, sha256: digest(editionBytes) });
  const edition = editions.editions.find((e) => e.themeId === themeId);
  const provenance = provenances[THEME_IDS.indexOf(themeId)],
    id = edition.id;
  const themes = JSON.parse(
    await readPinned('game/content/themes.json', 32768, INPUTS['game/content/themes.json']),
  );
  const theme = structuredClone(themes.themes.find((t) => t.id === themeId));
  assert.ok(theme);
  theme.subtitle = 'Moving Edges · Arcade';
  const next = structuredClone(sourcePack);
  next.id = id;
  next.name = `${theme.name} · Moving Edges — Arcade`;
  next.description =
    'Stitch the terraces, choose a sector around the survey hub, and keep a return through the breakwaters. Three original scenic rewards.';
  next.metadata.rightsStatus = `Original Moving Edges layouts and AI-assisted ${theme.name} scenery. Exact prompts and PNGs retained; fictional places and objects. Existing theme music; no new story, movie or track.`;
  next.themes = [theme];
  next.visualOverrides = {};
  next.levelVisuals = [];
  const campaign = next.campaigns[0];
  campaign.id = id;
  campaign.title = next.name;
  campaign.themeId = themeId;
  for (const [i, level] of campaign.levels.entries()) {
    assert.equal(level.id, IDS[i]);
    level.name = edition.images[i].title;
    level.themeId = themeId;
    level.metadata.title = level.name;
    level.metadata.description = edition.images[i].description;
    level.metadata.rightsStatus =
      'Exact Moving Edges layout; independent theme owner and original scenery. Painted routes are not collision geometry.';
  }
  const decoded = new Map();
  const decodeImage = async (value) => {
    const bytes =
      typeof value === 'string'
        ? Buffer.from(value.split(',')[1], 'base64')
        : Buffer.from(await value.arrayBuffer());
    const hash = digest(bytes);
    if (!decoded.has(hash))
      decoded.set(hash, decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`));
    const { naturalWidth, naturalHeight } = decoded.get(hash);
    return { naturalWidth, naturalHeight };
  };
  const { pack } = await preparePack(next, { decodeImage });
  for (const [i, level] of pack.campaigns[0].levels.entries()) {
    assert.deepEqual(physicalLevel(level), physicalLevel(sourcePack.campaigns[0].levels[i]));
    assert.equal(level.themeId, themeId);
    assert.equal(level.name, edition.images[i].title);
    assert.equal(level.metadata.title, level.name);
    assert.equal(level.metadata.description, edition.images[i].description);
  }
  assert.deepEqual(pack.classRecipes, sourcePack.classRecipes);
  assert.deepEqual(pack.themes, [theme]);
  assert.deepEqual(pack.music, sourcePack.music);
  const resolved = resolvePackCampaign(pack, id),
    executionCatalog = createExecutionCatalog([resolved]);
  const baseCampaignKey = campaignKey(resolved.campaign);
  assert.notEqual(
    baseCampaignKey,
    campaignKey(resolvePackCampaign(sourcePack, sourcePack.id).campaign),
  );
  assert.deepEqual(
    executionCatalog.entries.map((e) => e.difficulty),
    ['standard', 'gentle'],
  );
  const library = {
    format: 'revealline-media-library.v1',
    assets: [],
    presentations: [],
    assignments: [],
  };
  const assets = [],
    originals = [];
  for (const [i, picture] of edition.images.entries()) {
    const record = provenance.images.filter((image) => image.themeId === themeId)[i],
      file = `${edition.artRoot}/${record.path}`;
    const bytes = await readPinned(file, 4 * 1024 * 1024, picture.sha256);
    assert.equal(bytes.length, record.bytes);
    const assetId = `${id}-poster-${i + 1}`,
      presentationId = `${assetId}-presentation`;
    const prepared = await prepareStillAsset(
      new Blob([bytes]),
      {
        id: assetId,
        provenance: {
          kind: 'original',
          credit: 'RevealLine · AI-assisted original artwork',
          source: `${file}; exact original PNG; ${edition.artRoot}/provenance.json`,
        },
      },
      { decodeImage },
    );
    assert.deepEqual([prepared.asset.width, prepared.asset.height], [record.width, record.height]);
    const level = pack.campaigns[0].levels[i];
    const identity = { baseCampaignKey, levelId: level.id, levelRevision: level.revision, themeId };
    library.assets.push(prepared.asset);
    library.presentations.push({
      format: 'revealline-media-presentation.v1',
      id: presentationId,
      revision: 1,
      identity,
      poster: { assetId, fit: 'contain', sampling: 'nearest' },
      story: null,
      description: level.name,
    });
    library.assignments.push({ identity, presentationId, revision: 1 });
    assets.push({ sha256: prepared.asset.sha256, blob: prepared.blob });
    originals.push({
      assetId,
      presentationId,
      levelId: level.id,
      levelRevision: level.revision,
      ...Object.fromEntries(
        ['sha256', 'bytes', 'mime', 'width', 'height'].map((key) => [key, prepared.asset[key]]),
      ),
    });
    inputPins.push({ path: file, bytes: bytes.length, sha256: record.sha256 });
  }
  assert.equal(new Set(originals.map((o) => o.sha256)).size, 3);
  const media = await prepareStoredStillMedia(library, assets, { executionCatalog, decodeImage });
  const mediaBlob = await exportMediaBundle(media.library, media.assets, { decodeImage });
  const packBytes = Buffer.from(JSON.stringify(pack));
  const descriptor = {
    format: EXTERNAL_CHAPTER_FORMAT,
    id,
    revision: 1,
    source: { id: sourcePack.id, bytes: sourceBytes.length, sha256: SOURCE_PACK_SHA },
    pack: { bytes: packBytes.length, sha256: digest(packBytes) },
    media: { bytes: mediaBlob.size, sha256: digest(Buffer.from(await mediaBlob.arrayBuffer())) },
    campaignKey: baseCampaignKey,
    themeId,
    originals,
  };
  const payloads = { pack: new Blob([packBytes], { type: 'application/json' }), media: mediaBlob };
  const prepared = await prepareExternalChapter(descriptor, payloads, { decodeImage });
  assert.deepEqual(prepared.descriptor, descriptor);
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

export async function writeMovingEdgesTheme(themeId, outputDirectory) {
  assert.ok(THEME_IDS.includes(themeId), 'Choose fpv, ukraine, retro or coupa.');
  assert.equal(typeof outputDirectory, 'string');
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
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Ordinary cache parents required.');
  }
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  const result = await buildMovingEdgesTheme(themeId);
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
  const result = await writeMovingEdgesTheme(process.argv[2], process.argv[3]);
  console.log(
    JSON.stringify({ output: path.resolve(process.argv[3]), ...result.descriptor }, null, 2),
  );
}
