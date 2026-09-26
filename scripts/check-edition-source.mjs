import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validatePublicSourceEligibility } from '../publishing/edition-admission.mjs';

/** Path inventory is cheap; only declared brand originals are loaded into memory. */
export async function checkEditionSourceEligibility(root) {
  const catalogPath = path.join(root, 'game/editions/catalog.json');
  let catalog;
  try {
    catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
  } catch (error) {
    if (error.code === 'ENOENT') return { status: 'not-applicable' };
    throw error;
  }
  if (!Array.isArray(catalog.assets))
    throw new Error('Edition catalog has no asset eligibility ledger.');
  let shared = [];
  try {
    shared = JSON.parse(
      await fs.readFile(path.join(root, 'game/editions/runtime-assets.json'), 'utf8'),
    );
    if (!Array.isArray(shared)) throw new Error('Shared runtime asset ledger must be an array.');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const assets = [...catalog.assets, ...shared];
  const files = new Map(),
    ignored = new Set(['.git', '.cache', 'node_modules', 'dist', 'releases']);
  async function walk(directory, prefix = '') {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      if (!prefix && ignored.has(entry.name)) continue;
      const name = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), `${name}/`);
      else if (entry.isFile())
        files.set(
          name,
          name.endsWith('/.env.example')
            ? await fs.readFile(path.join(directory, entry.name))
            : new Uint8Array(),
        );
      else throw new Error(`Source eligibility rejects non-regular files: ${name}`);
    }
  }
  await walk(root);
  for (const asset of assets) {
    if (typeof asset.path !== 'string' || !files.has(asset.path))
      throw new Error('Declared edition original is missing from source.');
    const stat = await fs.stat(path.join(root, asset.path));
    if (
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes < 0 ||
      asset.bytes > 32 * 1024 * 1024 ||
      stat.size !== asset.bytes
    )
      throw new Error('Edition original exceeds its declared byte envelope.');
    files.set(asset.path, await fs.readFile(path.join(root, asset.path)));
  }
  return {
    status: 'verified',
    ...validatePublicSourceEligibility({ files, assets }),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
  console.log(JSON.stringify(await checkEditionSourceEligibility(root)));
}
