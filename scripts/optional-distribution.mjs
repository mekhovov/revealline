import { readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  prepareOptionalCatalog,
  OPTIONAL_CATALOG_PATH,
  assertOptionalPack,
} from '../game/optional-chapters.mjs';
import { validatePack } from '../game/packs.mjs';
import { exactKeys, required } from '../game/data-json.mjs';

export function validateOptionalDistributionConfig(value) {
  exactKeys(value, ['format', 'catalog'], 'Optional distribution config');
  required(
    value.format === 'revealline-optional-distribution.v1' &&
      value.catalog === OPTIONAL_CATALOG_PATH,
    'Unsupported optional chapter distribution opt-in.',
  );
  return value;
}
async function ordinary(root, name, maximum) {
  let target = root;
  for (const part of name.split('/')) {
    target = path.join(target, part);
    required(
      !(await lstat(target)).isSymbolicLink(),
      'Optional distribution cannot use symbolic links.',
    );
  }
  const stat = await lstat(target);
  required(
    stat.isFile() && stat.size <= maximum,
    'Optional distribution file exceeds its byte budget.',
  );
  const bytes = await readFile(target);
  required(bytes.length <= maximum, 'Optional distribution grew during reading.');
  return bytes;
}
/** Opt-in only: cataloged complete JSON downloads join manifest/ZIP, never core cache.
 * Existing builds without this versioned config receive no additional entries.
 */
export async function readOptionalDistributionEntries(root, option) {
  if (option === undefined) return [];
  validateOptionalDistributionConfig(option);
  const catalog = prepareOptionalCatalog(JSON.parse(await ordinary(root, option.catalog, 65536)));
  const entries = [];
  for (const item of catalog.packs) {
    const bytes = await ordinary(root, item.path, item.bytes);
    required(
      bytes.length === item.bytes &&
        createHash('sha256').update(bytes).digest('hex') === item.sha256,
      `Optional chapter hash differs: ${item.id}`,
    );
    const pack = JSON.parse(bytes);
    required(
      Buffer.byteLength(JSON.stringify(pack)) === item.normalizedBytes,
      'Optional normalized pack size differs.',
    );
    required(
      createHash('sha256').update(JSON.stringify(pack)).digest('hex') === item.normalizedSha256,
      'Optional normalized pack hash differs.',
    );
    const checked = validatePack(pack);
    required(checked.valid, `Optional chapter validation failed: ${checked.errors.join('; ')}`);
    assertOptionalPack(pack, item);
    entries.push({ name: item.path, bytes });
  }
  return entries;
}
