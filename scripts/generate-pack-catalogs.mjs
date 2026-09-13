#!/usr/bin/env node
/** Rebuild navigation metadata only. Pack recipes and artwork are never rewritten. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACK_LIMITS, validatePack } from '../game/packs.mjs';
import { required } from '../game/data-json.mjs';
import {
  PACK_CATALOG_FILES,
  readPackIndexes,
  readPackJSON,
  packNavigationSummary,
  navigationCatalogs,
} from './pack-indexes.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export async function generatePackCatalogs({ root = ROOT, write = false } = {}) {
  const indexes = await readPackIndexes(root),
    summaries = new Map();
  for (const entry of indexes.all) {
    const { value: pack } = await readPackJSON(
      root,
      `game/content/packs/${entry.path}`,
      PACK_LIMITS.maxBytes,
    );
    const checked = validatePack(pack);
    required(checked.valid, `Invalid indexed pack: ${checked.errors.join('; ')}`);
    summaries.set(entry.id, packNavigationSummary(entry, pack));
  }
  const catalogs = navigationCatalogs(indexes, summaries);
  // Validate all recipes and outputs before publishing either navigation file.
  if (write)
    for (const kind of Object.keys(catalogs))
      await readPackJSON(root, PACK_CATALOG_FILES[kind], 512 * 1024, { optional: true });
  for (const [kind, catalog] of Object.entries(catalogs)) {
    const file = PACK_CATALOG_FILES[kind],
      text = `${JSON.stringify(catalog, null, 2)}\n`;
    if (write) {
      await fs.writeFile(path.join(root, file), text);
    } else {
      const current = await readPackJSON(root, file, 512 * 1024);
      required(current.bytes.equals(Buffer.from(text)), `${file} needs generation.`);
    }
  }
  return {
    active: indexes.active.length,
    archive: indexes.archive.length,
    total: indexes.all.length,
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  required(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Use --write or no arguments.',
  );
  console.log(JSON.stringify(await generatePackCatalogs({ write: args.includes('--write') })));
}
