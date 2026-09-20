import { readFile, lstat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { exactKeys, required } from '../game/data-json.mjs';
import { compileAssetRevision } from '../game/content-design/assets.mjs';
import { inspectImageDataUrl } from '../game/content.mjs';
import { CONTENT_PROJECT_ITEM_LIMITS } from '../game/content-design/limits.mjs';

export function validateOptionalArtworkConfig(value) {
  exactKeys(value, ['format', 'catalog'], 'Optional artwork config');
  required(
    value.format === 'revealline-optional-artwork.v1' &&
      ['game/content-design/horizon-art.mjs', 'game/content-design/journey-art.mjs'].includes(
        value.catalog,
      ),
    'Unsupported optional artwork distribution opt-in.',
  );
  return value;
}

async function ordinaryTree(root, relative) {
  const target = path.join(root, relative),
    stat = await lstat(target);
  required(!stat.isSymbolicLink(), 'Optional artwork cannot use symbolic links.');
  if (stat.isDirectory()) {
    for (const name of await readdir(target)) await ordinaryTree(root, `${relative}/${name}`);
  } else required(stat.isFile(), 'Optional artwork needs ordinary source files.');
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

export function verifyOptionalArtworkEntries(artwork, entries) {
  if (!artwork) return;
  for (const pin of artwork.files) {
    const matches = entries.filter((entry) => entry.name === pin.path);
    required(
      matches.length === 1 &&
        matches[0].bytes.length === pin.bytes &&
        sha256(matches[0].bytes) === pin.sha256,
      'Optional artwork changed between validation and packaging.',
    );
  }
}

/** The authored registry is the only pin source. Validate exact selected-tree
 * bytes before excluding any image from the core cache. Loose/ZIP files remain
 * unchanged. This opt-in does not implement or promise offline artwork storage. */
export async function readOptionalArtwork(root, option, included) {
  if (option === undefined) return null;
  validateOptionalArtworkConfig(option);
  required(included.includes(option.catalog), 'Optional artwork registry must be shipped.');
  // Check the complete local import tree before executing selected-source code.
  // Build inputs already have the same no-symlink rule; standalone callers do too.
  await ordinaryTree(root, 'game');
  const source = await readFile(path.join(root, option.catalog));
  required(source.length <= 65536, 'Optional artwork registry exceeds its byte budget.');
  const moduleURL = pathToFileURL(path.join(root, option.catalog));
  moduleURL.searchParams.set('source', sha256(source));
  const registry = await import(moduleURL.href);
  const raw =
    option.catalog === 'game/content-design/horizon-art.mjs'
      ? registry.HORIZON_ART_CANDIDATES
      : registry.JOURNEY_ART_CANDIDATES;
  required(
    Array.isArray(raw) && raw.length > 0 && raw.length <= CONTENT_PROJECT_ITEM_LIMITS.assets,
    `Optional artwork requires between one and ${CONTENT_PROJECT_ITEM_LIMITS.assets} authored revisions.`,
  );
  const assets = raw.map(compileAssetRevision),
    files = [],
    paths = new Set(),
    ids = new Set();
  for (const asset of assets) {
    const name = `game/${asset.path}`,
      id = `${asset.id}@${asset.revision}`;
    required(!paths.has(name) && !ids.has(id), 'Duplicate optional artwork revision or path.');
    paths.add(name);
    ids.add(id);
    required(included.includes(name), 'Optional artwork original must be shipped.');
    const file = path.join(root, name),
      stat = await lstat(file);
    required(stat.isFile() && stat.size === asset.bytes, 'Optional artwork byte length differs.');
    const bytes = await readFile(file);
    required(
      bytes.length === asset.bytes && sha256(bytes) === asset.sha256,
      'Optional artwork bytes differ from the authored revision.',
    );
    const image = inspectImageDataUrl(`data:image/png;base64,${bytes.toString('base64')}`);
    required(
      image.valid && image.width === asset.width && image.height === asset.height,
      'Optional artwork dimensions differ from the authored revision.',
    );
    files.push({ path: name, bytes: asset.bytes, sha256: asset.sha256 });
  }
  return {
    name:
      option.catalog === 'game/content-design/horizon-art.mjs'
        ? 'Opening Journey artwork'
        : 'Journey candidate artwork',
    availability: 'online-only',
    count: files.length,
    bytes: files.reduce((total, file) => total + file.bytes, 0),
    files,
  };
}
