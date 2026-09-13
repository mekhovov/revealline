/** Separate discovery lists; every referenced pack retains its own bounded format. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { boundedJSON, canonicalJSON, exactKeys, required, stableId } from '../game/data-json.mjs';
import { preparePackCatalog } from '../game/content-launch.mjs';

export const PACK_INDEX_FILES = Object.freeze({
  active: 'game/content/packs/index.json',
  archive: 'game/content/packs/archive-index.json',
});
export const PACK_CATALOG_FILES = Object.freeze({
  active: 'game/content/packs/catalog.json',
  archive: 'game/content/packs/archive-catalog.json',
});

export async function readPackJSON(root, relative, maxBytes, { optional = false } = {}) {
  required(
    typeof relative === 'string' &&
      !path.isAbsolute(relative) &&
      !relative.includes('\\') &&
      !relative.includes('\0') &&
      relative.split('/').every((part) => part && part !== '.' && part !== '..'),
    'Unsafe pack source path.',
  );
  let file = path.resolve(root);
  const parts = relative.split('/');
  for (const [i, part] of parts.entries()) {
    file = path.join(file, part);
    let stat;
    try {
      stat = await fs.lstat(file);
    } catch (error) {
      if (optional && error.code === 'ENOENT') return null;
      throw error;
    }
    required(!stat.isSymbolicLink(), 'Pack sources cannot use symbolic links.');
    if (i < parts.length - 1) required(stat.isDirectory(), 'Invalid pack source directory.');
    else
      required(
        stat.isFile() && stat.size <= maxBytes,
        'Pack source must be a bounded regular file.',
      );
  }
  const bytes = await fs.readFile(file);
  required(bytes.length <= maxBytes, 'Pack source exceeds its byte budget.');
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

/** Archives are optional for older/tooling fixtures. A present archive is never ignored. */
export async function readPackIndexes(root) {
  const ids = new Set(),
    paths = new Set(),
    result = { active: [], archive: [] };
  let hasArchive = false;
  for (const [kind, file] of Object.entries(PACK_INDEX_FILES)) {
    const loaded = await readPackJSON(root, file, 65536, { optional: kind === 'archive' });
    if (loaded === null) continue;
    if (kind === 'archive') hasArchive = true;
    const index = boundedJSON(loaded.value, { maxBytes: 65536 });
    exactKeys(index, ['format', 'packs'], 'Pack index');
    required(
      index.format === 'xonix-pack-index.v1' && Array.isArray(index.packs),
      'Invalid pack index.',
    );
    required(index.packs.length <= 104, 'Pack index exceeds its entry budget.');
    for (const entry of index.packs) {
      exactKeys(entry, ['id', 'path'], 'Pack index entry');
      required(stableId(entry.id) && typeof entry.path === 'string', 'Invalid pack index entry.');
      required(
        /^[a-zA-Z0-9][a-zA-Z0-9._/-]*\.json$/.test(entry.path) &&
          entry.path.split('/').every((part) => part && part !== '.' && part !== '..'),
        'Unsafe pack index path.',
      );
      required(
        !ids.has(entry.id) && !paths.has(entry.path),
        'Pack indexes require unique paths and IDs across active and archive.',
      );
      ids.add(entry.id);
      paths.add(entry.path);
      result[kind].push(entry);
    }
  }
  if (!hasArchive)
    required(
      (await readPackJSON(root, PACK_CATALOG_FILES.archive, 512 * 1024, { optional: true })) ===
        null,
      'Archive catalog requires its archive index.',
    );
  required(ids.size <= 104, 'Combined pack index exceeds its entry budget.');
  return { ...result, all: [...result.active, ...result.archive], hasArchive };
}

export function packNavigationSummary(entry, pack) {
  required(pack.id === entry.id, `Pack index ID ${entry.id} does not match ${pack.id}.`);
  return {
    ...entry,
    name: pack.name,
    campaigns: pack.campaigns.map(({ id, revision, title, levels }) => ({
      id,
      revision,
      title,
      levels: levels.map(({ id: levelId, name }) => ({ id: levelId, name })),
    })),
  };
}

export function navigationCatalogs(indexes, summaries) {
  const result = {};
  for (const kind of ['active', 'archive']) {
    if (kind === 'archive' && !indexes.hasArchive) continue;
    result[kind] = {
      format: 'xonix-pack-catalog.v1',
      packs: indexes[kind].map((entry) => {
        const value = summaries.get(entry.id);
        required(value, `Missing catalog authority for ${entry.id}.`);
        return value;
      }),
    };
  }
  preparePackCatalog({
    format: 'xonix-pack-catalog.v1',
    packs: indexes.all.map((entry) => summaries.get(entry.id)),
  });
  return result;
}

/** Only metadata is combined; artwork-bearing packs are checked one at a time. */
export async function validateNavigationCatalogs(root, indexes, summaries) {
  const loaded = {};
  for (const [kind, file] of Object.entries(PACK_CATALOG_FILES)) {
    if (kind === 'archive' && !indexes.hasArchive) continue;
    const record = await readPackJSON(root, file, 512 * 1024, { optional: !indexes.hasArchive });
    if (record) loaded[kind] = record.value;
  }
  if (!Object.keys(loaded).length) return;
  const expected = navigationCatalogs(indexes, summaries);
  for (const [kind, value] of Object.entries(loaded))
    required(
      canonicalJSON(value) === canonicalJSON(expected[kind]),
      `${kind} pack catalog differs from its indexed pack authority.`,
    );
}
