import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { format, resolveConfig } from 'prettier';
import { boundedJSON, canonicalJSON, required } from '../game/data-json.mjs';
import { compileAssetRevision } from '../game/content-design/assets.mjs';
import { COMPANY_MISSIONS } from '../game/company-campaigns/catalog.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
export const COMPANY_ART_TARGET_BYTES = 1024 * 1024;

/** Register reviewed generation receipts without altering existing media or gameplay.
 * Selected derivatives are public inputs; source masters stay outside player packets. */
export async function importCompanyArt({
  receipts,
  assets,
  artwork,
  sources,
  read,
  missions = COMPANY_MISSIONS,
}) {
  const nextAssets = structuredClone(assets),
    nextArt = structuredClone(artwork),
    nextSources = structuredClone(sources),
    imported = [];
  const seen = new Set();
  for (const input of receipts) {
    const receipt = boundedJSON(input, { maxBytes: 1024 * 1024, maxNodes: 50000 });
    required(
      receipt.tool === 'image_gen.imagegen' && Array.isArray(receipt.assets),
      'Expected a built-in image generation receipt.',
    );
    for (const record of receipt.assets) {
      const missionId = record.missionId ?? record.id,
        mission = missions.find((item) => item.id === missionId),
        selected = record.selected,
        original = record.original;
      required(mission && !seen.has(missionId), 'Unknown or repeated artwork mission.');
      seen.add(missionId);
      required(
        typeof record.prompt === 'string' &&
          record.prompt.trim().length >= 40 &&
          typeof record.alt === 'string' &&
          record.alt.trim() &&
          record.derivation?.kind === 'mechanical-resize' &&
          Array.isArray(record.derivation.command) &&
          record.derivation.command.length > 1 &&
          record.derivation.command.every((part) => typeof part === 'string' && part.trim()) &&
          record.derivation.opaque === true &&
          record.review?.status === 'candidate' &&
          typeof record.review.original === 'string' &&
          record.review.original.trim() &&
          typeof record.review.selected === 'string' &&
          record.review.selected.trim(),
        'Artwork needs a prompt, description and reproducible derivation.',
      );
      required(
        original &&
          hash(original.sha256) &&
          Number.isSafeInteger(original.bytes) &&
          original.bytes > 0 &&
          typeof original.path === 'string' &&
          original.path.startsWith('$CODEX_HOME/generated_images/') &&
          !original.path.split('/').includes('..'),
        'Original generation provenance must use a portable, exact master reference.',
      );
      required(
        selected &&
          typeof selected.path === 'string' &&
          /^game\/editions\/assets\/[a-z0-9/_-]+\.png$/.test(selected.path) &&
          !selected.path.includes('//') &&
          hash(selected.sha256) &&
          Number.isSafeInteger(selected.bytes) &&
          selected.bytes > 0 &&
          selected.bytes <= COMPANY_ART_TARGET_BYTES &&
          selected.width === selected.height * 2,
        'Selected artwork must be a local 2:1 PNG within the 1 MiB production budget.',
      );
      const bytes = await read(selected.path);
      required(
        bytes.length === selected.bytes &&
          digest(bytes) === selected.sha256 &&
          bytes.subarray(0, 8).toString('hex') === '89504e470d0a1a0a' &&
          bytes.length >= 33 &&
          bytes.readUInt32BE(16) === selected.width &&
          bytes.readUInt32BE(20) === selected.height,
        'Selected PNG differs from its generation receipt.',
      );
      const decoded = decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`);
      required(
        decoded.naturalWidth === selected.width && decoded.naturalHeight === selected.height,
        'Selected artwork must decode completely as its pinned opaque RGB PNG.',
      );
      const assetId = `${missionId}-reveal-v1`;
      const asset = {
        id: assetId,
        path: selected.path,
        sha256: selected.sha256,
        bytes: selected.bytes,
        publication: 'public',
        approved: true,
        dependencies: [],
      };
      const picture = compileAssetRevision({
        format: 'AssetRevisionV1',
        id: `${missionId}-picture`,
        revision: '1',
        kind: 'reveal-background',
        path: selected.path.slice(5),
        sha256: selected.sha256,
        bytes: selected.bytes,
        width: selected.width,
        height: selected.height,
        alt: record.alt,
        review: 'candidate',
      });
      const source = {
        id: assetId,
        path: selected.path,
        revision: 1,
        sha256: selected.sha256,
        bytes: selected.bytes,
        rights: 'generated-derivative',
        source: receipt.tool,
        publication: 'public',
        review:
          'candidate-public-bytes; generated master and selected derivative inspected; final artifact artwork approval pending',
        derivation: structuredClone(record.derivation),
        original: structuredClone(original),
        prompt: record.prompt,
      };
      for (const [list, value] of [
        [nextAssets, asset],
        [nextArt, picture],
        [nextSources.assets, source],
      ]) {
        const existing = list.find((entry) => entry.id === value.id);
        required(
          !existing || canonicalJSON(existing) === canonicalJSON(value),
          'Artwork registration would replace an existing revision.',
        );
        required(
          !list.some((entry) => entry.id !== value.id && entry.path === value.path),
          'Artwork path is already registered under another identity.',
        );
        if (!existing) list.push(value);
      }
      imported.push({ missionId, assetId, bytes: selected.bytes });
    }
  }
  return { assets: nextAssets, artwork: nextArt, sources: nextSources, imported };
}

async function main(args) {
  const write = args.includes('--write'),
    receiptPaths = args.filter((arg) => arg !== '--write');
  required(
    receiptPaths.length && receiptPaths.every((arg) => !arg.startsWith('-')),
    'Usage: node scripts/import-company-art.mjs RECEIPT.json ... [--write]',
  );
  const root = fileURLToPath(new URL('../', import.meta.url));
  const read = (name) => fs.readFile(path.join(root, name));
  const json = async (name) => JSON.parse(await read(name));
  const [assets, artwork, sources, ...receipts] = await Promise.all(
    [
      'game/editions/assets.json',
      'game/editions/artwork.json',
      'game/editions/asset-sources.json',
      ...receiptPaths,
    ].map(json),
  );
  const result = await importCompanyArt({ receipts, assets, artwork, sources, read });
  if (write) {
    const config = await resolveConfig(fileURLToPath(import.meta.url));
    for (const [name, value] of [
      ['assets', result.assets],
      ['artwork', result.artwork],
      ['asset-sources', result.sources],
    ])
      await fs.writeFile(
        path.join(root, `game/editions/${name}.json`),
        await format(JSON.stringify(value), { ...config, parser: 'json' }),
      );
  }
  console.log(
    JSON.stringify({
      mode: write ? 'registered' : 'validated',
      count: result.imported.length,
      bytes: result.imported.reduce((sum, record) => sum + record.bytes, 0),
      next: 'Retain the previous presentations, advance affected edition revisions, then regenerate company content.',
    }),
  );
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href)
  main(process.argv.slice(2)).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
