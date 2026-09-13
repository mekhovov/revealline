import assert from 'node:assert/strict';
import { lstat, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { ROOT, ordinaryFile, digest } from '../sentinel-circuit/files.mjs';
import { buildFractureLines, IDS } from '../fracture-lines/build.mjs';
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
export const ID = 'fracture-lines-fpv';
export const SOURCE_PROOF = 'authoring/library/fracture-lines/routes.json';
export const SOURCE_PACK_SHA = 'c52a0f2996ea57229b9686f6ba65edb6de8a1628f5fc7609418c706fbfd39421';
export const EDITION_FILE = 'authoring/library/fracture-lines-chapter/edition.json';
const ART = 'authoring/library/fracture-lines-art';
// Final source and art metadata are immutable inputs; no current-owner fallback.
export const INPUTS = Object.freeze({
  'authoring/library/fracture-lines/build.mjs':
    '56cb05d183ce0406af2949506d6c3f6da78e9e275ce7302360a3d6742d72e59d',
  'authoring/library/fracture-lines/layouts.json':
    'af15577704ce673100f7c6d89ae92baffa25c5ebfdae2459ea4c720a9d7ab179',
  'authoring/library/fracture-lines/controls.mjs':
    'a1a1f027838affecc164e239c7f1bc259ba0040f65550be196b47ca9be2008f7',
  'authoring/library/fracture-lines/routes.json':
    '83f2eef3395a3a28070b25aa663e6e82db6626d8ab65ba5809aa798785231e67',
  'authoring/library/fracture-lines-art/split-ring-fpv.json':
    '0783f15583901347b39070c6a30890b502d1a5cae7a1aec23c6eb559717e9ba9',
  'authoring/library/fracture-lines-art/fault-fan-fpv.json':
    '3af3532a160f27cc37796bd36b480d71f0409974732aeea02346bf6454e7e898',
  'authoring/library/fracture-lines-art/frayed-causeway-fpv.json':
    'ac48d1abe7269c13e73f158fe4d0125a17be1499e9f884eb4666f4f68a0c7e21',
});
export async function readPinned(file, limit, expected) {
  const bytes = await ordinaryFile(path.join(ROOT, file), limit);
  if (expected !== undefined) assert.equal(digest(bytes), expected, `Exact source: ${file}`);
  return bytes;
}
/** Authoring metadata validation only; decoded bytes and ownership are prepared below. */
export function validateFractureEdition(value, records) {
  const doc = boundedJSON(value, {
    maxBytes: 16384,
    maxNodes: 1000,
    maxDepth: 8,
    maxArray: 8,
    maxString: 2048,
  });
  exactKeys(doc, ['format', 'id', 'themeId', 'images'], 'Fracture edition');
  assert.equal(doc.format, 'revealline-fracture-chapter-edition.v1');
  assert.equal(doc.id, ID);
  assert.equal(doc.themeId, 'fpv');
  assert.equal(doc.images.length, 3);
  assert.equal(records.length, 3);
  for (const [i, picture] of doc.images.entries()) {
    exactKeys(
      picture,
      ['sourceLevelId', 'metadataPath', 'path', 'assetId', 'sha256'],
      'Fracture image',
    );
    const slot = IDS[i].replace('fracture-lines-', ''),
      record = records[i];
    assert.equal(picture.sourceLevelId, IDS[i]);
    assert.equal(picture.metadataPath, `${ART}/${slot}-fpv.json`);
    assert.equal(picture.path, `${ART}/originals/${slot}-fpv.png`);
    assert.equal(picture.assetId, `${IDS[i]}-fpv`);
    assert.equal(record.format, 'revealline-generated-source-art.v1');
    assert.equal(record.mode, 'built-in-image_gen');
    assert.equal(record.assetId, picture.assetId);
    assert.equal(`${ART}/${record.workspacePath}`, picture.path);
    assert.equal(record.sha256, picture.sha256);
    assert.match(record.sha256, /^[0-9a-f]{64}$/);
    assert.ok(
      Number.isSafeInteger(record.bytes) && record.bytes > 0 && record.bytes <= 4 * 1024 * 1024,
    );
    assert.equal(record.width, 1774);
    assert.equal(record.height, 887);
    assert.ok(typeof record.prompt === 'string' && record.prompt.length > 0);
  }
  return doc;
}

export async function buildFractureChapter() {
  const inputPins = [];
  for (const [file, sha256] of Object.entries(INPUTS)) {
    const bytes = await readPinned(file, 2 * 1024 * 1024, sha256);
    inputPins.push({ path: file, bytes: bytes.length, sha256 });
  }
  const source = await buildFractureLines(),
    sourcePack = source.pack;
  const sourceBytes = Buffer.from(JSON.stringify(sourcePack));
  assert.equal(digest(sourceBytes), SOURCE_PACK_SHA);
  const records = await Promise.all(
    IDS.map(async (id) => {
      const file = `${ART}/${id.replace('fracture-lines-', '')}-fpv.json`;
      return JSON.parse(await readPinned(file, 16384, INPUTS[file]));
    }),
  );
  const editionBytes = await readPinned(EDITION_FILE, 16384);
  const edition = validateFractureEdition(JSON.parse(editionBytes), records);
  inputPins.push({ path: EDITION_FILE, bytes: editionBytes.length, sha256: digest(editionBytes) });
  const next = structuredClone(sourcePack);
  next.id = ID;
  next.name = 'FPV Front · Fracture Lines — Arcade';
  next.description =
    'Choose a gate in the broken ring, clear the branching bays, then maintain a return through island lanes. Three original FPV reward panoramas.';
  next.metadata.rightsStatus =
    'Original Fracture layouts and AI-assisted fictional Ukrainian FPV scenery; exact prompts and PNGs retained. Painted scenery defines no collision or real operational location. No new story, animation or music.';
  next.campaigns[0].id = ID;
  next.campaigns[0].title = next.name;
  const { pack } = await preparePack(next);
  // A new authored campaign owns the pictures; every level/recipe byte stays exact.
  assert.deepEqual(pack.campaigns[0].levels, sourcePack.campaigns[0].levels);
  for (const field of ['themes', 'classRecipes', 'music', 'levelVisuals', 'visualOverrides'])
    assert.deepEqual(pack[field], sourcePack[field]);
  const resolved = resolvePackCampaign(pack, ID),
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
  const library = {
    format: 'revealline-media-library.v1',
    assets: [],
    presentations: [],
    assignments: [],
  };
  const assets = [],
    originals = [];
  for (const [i, picture] of edition.images.entries()) {
    const record = records[i],
      bytes = await readPinned(picture.path, 4 * 1024 * 1024, picture.sha256);
    assert.equal(bytes.length, record.bytes);
    const id = picture.assetId,
      presentationId = `${id}-presentation`;
    const prepared = await prepareStillAsset(
      new Blob([bytes]),
      {
        id,
        provenance: {
          kind: 'original',
          credit: 'RevealLine · AI-assisted original artwork',
          source: `${picture.metadataPath}; prompt SHA256 ${digest(record.prompt)}; exact original PNG`,
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
        themeId: 'fpv',
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
        ['sha256', 'bytes', 'mime', 'width', 'height'].map((key) => [key, prepared.asset[key]]),
      ),
    });
    inputPins.push({ path: picture.path, bytes: bytes.length, sha256: picture.sha256 });
  }
  assert.equal(new Set(originals.map((o) => o.sha256)).size, 3);
  const media = await prepareStoredStillMedia(library, assets, { executionCatalog, decodeImage });
  const mediaBlob = await exportMediaBundle(media.library, media.assets, { decodeImage });
  const packBytes = Buffer.from(JSON.stringify(pack));
  const descriptor = {
    format: EXTERNAL_CHAPTER_FORMAT,
    id: ID,
    revision: 1,
    source: { id: sourcePack.id, bytes: sourceBytes.length, sha256: SOURCE_PACK_SHA },
    pack: { bytes: packBytes.length, sha256: digest(packBytes) },
    media: { bytes: mediaBlob.size, sha256: digest(Buffer.from(await mediaBlob.arrayBuffer())) },
    campaignKey: baseCampaignKey,
    themeId: 'fpv',
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

export async function writeFractureChapter(outputDirectory) {
  assert.equal(typeof outputDirectory, 'string');
  const output = path.resolve(outputDirectory),
    relative = path.relative(ROOT, output);
  assert.ok(
    relative.startsWith('.cache/') &&
      relative.split('/').every((p) => p && p !== '.' && p !== '..'),
    'Write only to a new worktree cache directory.',
  );
  let parent = ROOT;
  for (const part of relative.split('/').slice(0, -1)) {
    parent = path.join(parent, part);
    const info = await lstat(parent);
    assert.ok(info.isDirectory() && !info.isSymbolicLink(), 'Ordinary cache parents required.');
  }
  await assert.rejects(lstat(output), { code: 'ENOENT' });
  const result = await buildFractureChapter();
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
  assert.equal(process.argv.length, 3, 'Use build.mjs NEW_CACHE_OUTPUT_DIRECTORY');
  const result = await writeFractureChapter(process.argv[2]);
  console.log(
    JSON.stringify({ output: path.resolve(process.argv[2]), ...result.descriptor }, null, 2),
  );
}
