import assert from 'node:assert/strict';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { buildFractureLines } from '../fracture-lines/build.mjs';
import {
  ROOT,
  IDS,
  SOURCE_PACK_SHA,
  SOURCE_PROOF,
  readPinned,
  digest,
} from '../fracture-lines-chapter/build.mjs';
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

export { ROOT, IDS, SOURCE_PACK_SHA, SOURCE_PROOF, readPinned, digest };
export const THEME_IDS = Object.freeze(['ukraine', 'retro', 'coupa']);
export const EDITIONS_FILE = 'authoring/library/fracture-theme-chapters/editions.json';
export const INPUTS = Object.freeze({
  'authoring/library/fracture-lines/build.mjs':
    '56cb05d183ce0406af2949506d6c3f6da78e9e275ce7302360a3d6742d72e59d',
  'authoring/library/fracture-lines/layouts.json':
    'af15577704ce673100f7c6d89ae92baffa25c5ebfdae2459ea4c720a9d7ab179',
  'authoring/library/fracture-lines/controls.mjs':
    'a1a1f027838affecc164e239c7f1bc259ba0040f65550be196b47ca9be2008f7',
  'authoring/library/fracture-lines/routes.json':
    '83f2eef3395a3a28070b25aa663e6e82db6626d8ab65ba5809aa798785231e67',
  'authoring/library/fracture-lines-chapter/build.mjs':
    '8390c51dbc6be52503f063612bb357dae0c8f1299d24ee22e0b4270c0e62706c',
  'game/content/themes.json': '93582f7d9ba53753106df7b63928f086820fc0f68357d3c08f26c0b89fb84774',
  'authoring/library/fracture-ukraine-art/provenance.json':
    'f8a0f11cc6facfb14b3b1e70de0c2ca3005ce46f2e3a197a15e50e0f2212fe2f',
  'authoring/library/fracture-retro-art/provenance.json':
    '0838b853611aa53f97336e8971b9ec429ec48c13b0b91c91df3a212d7cff2197',
  'authoring/library/fracture-coupa-art/provenance.json':
    '3709b1a56f5e88f2335c8fcd50b82c3f7efa4de8f89585db6b6af3325c7898d8',
});
export const artRoot = (themeId) => `authoring/library/fracture-${themeId}-art`;
// The source IDs and revision remain physical authority. Only these display fields differ.
export function physicalLevel(level) {
  const copy = structuredClone(level);
  for (const key of ['name', 'themeId']) delete copy[key];
  for (const key of ['title', 'description', 'rightsStatus']) delete copy.metadata[key];
  return copy;
}

/** Pure bounded metadata check; it grants no decoder or owner capability. */
export function validateFractureThemeEditions(value, provenances) {
  const doc = boundedJSON(value, {
    maxBytes: 32768,
    maxNodes: 2000,
    maxDepth: 8,
    maxArray: 16,
    maxString: 4096,
  });
  exactKeys(doc, ['format', 'editions'], 'Fracture theme editions');
  assert.equal(doc.format, 'revealline-fracture-theme-editions.v1');
  assert.deepEqual(
    doc.editions.map((e) => e.themeId),
    THEME_IDS,
  );
  assert.equal(provenances.length, 3);
  for (const [index, edition] of doc.editions.entries()) {
    exactKeys(
      edition,
      ['themeId', 'id', 'artRoot', 'provenanceSha256', 'images'],
      'Fracture theme',
    );
    const themeId = THEME_IDS[index],
      provenance = provenances[index];
    assert.equal(edition.id, `fracture-lines-${themeId}`);
    assert.equal(edition.artRoot, artRoot(themeId));
    assert.equal(edition.provenanceSha256, INPUTS[`${edition.artRoot}/provenance.json`]);
    assert.equal(provenance.format, 'revealline-source-art-provenance.v1');
    assert.equal(provenance.images.length, 3);
    assert.equal(edition.images.length, 3);
    for (const [i, picture] of edition.images.entries()) {
      exactKeys(
        picture,
        ['sourceCellId', 'sourceLevelId', 'path', 'sha256', 'title', 'description'],
        'Fracture theme picture',
      );
      const slot = IDS[i].replace('fracture-lines-', ''),
        original = provenance.images[i];
      assert.equal(picture.sourceCellId, `fracture-lines/${slot}/${themeId}`);
      assert.equal(picture.sourceLevelId, IDS[i]);
      assert.equal(picture.path, `originals/${slot}-${themeId}.png`);
      assert.equal(original.cellId, picture.sourceCellId);
      assert.equal(original.sourceLevelId, picture.sourceLevelId);
      assert.equal(original.themeId, themeId);
      assert.equal(original.missionSlot, slot);
      assert.equal(original.path, picture.path);
      assert.equal(original.sha256, picture.sha256);
      assert.equal(original.runtimeBinding, null);
      assert.deepEqual([original.width, original.height], [1774, 887]);
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

export async function buildFractureTheme(themeId) {
  assert.ok(THEME_IDS.includes(themeId), 'Choose ukraine, retro or coupa.');
  const inputPins = [];
  for (const [file, sha256] of Object.entries(INPUTS)) {
    const bytes = await readPinned(file, 2 * 1024 * 1024, sha256);
    inputPins.push({ path: file, bytes: bytes.length, sha256 });
  }
  const { pack: sourcePack } = await buildFractureLines();
  const sourceBytes = Buffer.from(JSON.stringify(sourcePack));
  assert.equal(digest(sourceBytes), SOURCE_PACK_SHA);
  const provenances = await Promise.all(
    THEME_IDS.map(async (theme) => {
      const file = `${artRoot(theme)}/provenance.json`;
      return JSON.parse(await readPinned(file, 65536, INPUTS[file]));
    }),
  );
  const editionBytes = await readPinned(EDITIONS_FILE, 32768);
  const editions = validateFractureThemeEditions(JSON.parse(editionBytes), provenances);
  inputPins.push({ path: EDITIONS_FILE, bytes: editionBytes.length, sha256: digest(editionBytes) });
  const edition = editions.editions.find((e) => e.themeId === themeId);
  const provenance = provenances[THEME_IDS.indexOf(themeId)],
    id = edition.id;
  const themes = JSON.parse(
    await readPinned('game/content/themes.json', 32768, INPUTS['game/content/themes.json']),
  );
  const theme = structuredClone(themes.themes.find((t) => t.id === themeId));
  assert.ok(theme);
  theme.subtitle = 'Fracture Lines · Arcade';
  const next = structuredClone(sourcePack);
  next.id = id;
  next.name = `${theme.name} · Fracture Lines — Arcade`;
  next.description =
    'Choose a gate, clear the branching bays, then keep a return through island lanes. Three original scenic rewards.';
  next.metadata.rightsStatus = `Original Fracture layouts and AI-assisted ${theme.name} scenery. Exact prompts and PNGs retained; fictional places and objects. Existing theme music; no new story, movie or track.`;
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
      'Exact Fracture layout; independent theme owner and original scenery. Painted routes are not collision geometry.';
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
    const record = provenance.images[i],
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

export async function writeFractureTheme(themeId, outputDirectory) {
  assert.ok(THEME_IDS.includes(themeId), 'Choose ukraine, retro or coupa.');
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
  const result = await buildFractureTheme(themeId);
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
  const result = await writeFractureTheme(process.argv[2], process.argv[3]);
  console.log(
    JSON.stringify({ output: path.resolve(process.argv[3]), ...result.descriptor }, null, 2),
  );
}
