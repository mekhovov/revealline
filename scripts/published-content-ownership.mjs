import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEditionRuntimeCatalog } from '../game/editions/model.mjs';

/** Published community media must belong to the explicit edition catalog. */
export function assertPublishedEditionAssets(files, source) {
  const catalog = validateEditionRuntimeCatalog(source);
  const published = new Set(files);
  const declared = new Set(catalog.assets.map(({ path }) => path));
  const extras = files.filter((name) => name.startsWith('game/editions/assets/') && !declared.has(name));
  if (extras.length) throw new Error(`Unowned published edition assets: ${extras.join(', ')}`);
  const missing = [...declared].filter((name) => !published.has(name));
  if (missing.length) throw new Error(`Missing declared edition assets: ${missing.join(', ')}`);
  return { registeredBrands: catalog.brands.length, ownedEditionAssets: declared.size };
}

export async function validatePublishedContentOwnership(root, files) {
  const catalogPath = 'game/editions/catalog.json';
  if (!files.includes(catalogPath)) return {};
  const source = await readFile(path.join(root, catalogPath), 'utf8');
  return assertPublishedEditionAssets(files, source);
}
