import { createHash } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { validateRegionManifest, REGION_FORMAT, SPARSE_SCENERY_FORMAT } from './region-manifest.mjs';

const LIMIT = 64 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (ok, message) => {
  if (!ok) throw new Error(message);
};
const safePath = (value) =>
  typeof value === 'string' &&
  value.length <= 240 &&
  /^(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+\.(?:glb|json|png|jpg|jpeg)$/.test(value);
const identity = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]{0,63}$/.test(value);
const canonical = (value) =>
  JSON.stringify(value, (_, child) =>
    child && typeof child === 'object' && !Array.isArray(child)
      ? Object.fromEntries(
          Object.keys(child)
            .sort()
            .map((key) => [key, child[key]]),
        )
      : child,
  );

/** Copies a verified, closed pair into a NEW directory. Never rewrites source/output. */
export async function prepareRegionalDelivery({ source, output, id, revision, title }) {
  fail(identity(id) && identity(revision), 'Invalid delivery identity');
  const root = await realpath(source);
  const contents = new Map();
  let totalBytes = 0;
  async function read(relative, maxBytes = LIMIT) {
    fail(safePath(relative), `Unsafe delivery path: ${relative}`);
    const filename = path.resolve(root, relative);
    fail((await realpath(filename)) === filename, `Symlink is not a delivery source: ${relative}`);
    const info = await stat(filename);
    fail(info.isFile() && info.size > 0 && info.size <= maxBytes, `Invalid file size: ${relative}`);
    fail(totalBytes + info.size <= LIMIT, 'Delivery exceeds 64 MiB');
    const bytes = await readFile(filename);
    fail(bytes.length === info.size, `Source changed while reading: ${relative}`);
    totalBytes += bytes.length;
    const ref = { path: relative, bytes: bytes.length, sha256: hash(bytes) };
    contents.set(relative, { ref, bytes });
    return { ref, bytes };
  }
  const names = new Set();
  function reserve(relative) {
    fail(safePath(relative), `Unsafe delivery path: ${relative}`);
    const key = relative.toLowerCase();
    fail(!names.has(key), `Duplicate delivery path: ${relative}`);
    names.add(key);
    fail(names.size <= 8194, 'Too many delivery files');
  }
  const layers = {};
  for (const layer of ['terrain', 'scenery']) {
    const relative = `${layer}/region.json`;
    reserve(relative);
    const item = await read(relative, 8 * 1024 * 1024);
    const manifest = validateRegionManifest(
      new TextDecoder('utf-8', { fatal: true }).decode(item.bytes),
    );
    for (const asset of manifest.assets) {
      const assetPath = `${layer}/${asset.path}`;
      reserve(assetPath);
      const actual = await read(assetPath);
      fail(
        actual.ref.bytes === asset.bytes && actual.ref.sha256 === asset.sha256,
        `Manifest asset mismatch: ${assetPath}`,
      );
    }
    layers[layer] = { ref: item.ref, manifest };
  }
  const terrain = layers.terrain.manifest,
    scenery = layers.scenery.manifest;
  fail(terrain.format === REGION_FORMAT, 'Terrain requires the complete manifest profile');
  fail(
    terrain.id === scenery.id && terrain.revision === scenery.revision,
    'Terrain and scenery identities differ',
  );
  const sceneryChunks = new Map(scenery.chunks.map((chunk) => [chunk.id, chunk]));
  fail(
    terrain.chunks.every(
      (chunk) =>
        sceneryChunks.get(chunk.id)?.x === chunk.x && sceneryChunks.get(chunk.id)?.z === chunk.z,
    ),
    'Terrain and scenery cell identities differ',
  );
  fail(canonical(terrain.grid) === canonical(scenery.grid), 'Terrain and scenery grids differ');
  const spawns = (manifest) =>
    canonical([...manifest.spawns].sort((a, b) => a.id.localeCompare(b.id)));
  fail(
    spawns(layers.terrain.manifest) === spawns(layers.scenery.manifest),
    'Terrain and scenery spawns differ',
  );
  title ??= layers.terrain.manifest.title;
  fail(
    title &&
      Object.keys(title).length === 2 &&
      ['en', 'uk'].every(
        (locale) =>
          typeof title[locale] === 'string' && title[locale].trim() && title[locale].length <= 120,
      ),
    'Delivery requires EN/UK titles',
  );
  const files = [...contents.values()]
    .map((item) => item.ref)
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const descriptor = {
    format: scenery.format === SPARSE_SCENERY_FORMAT ? 'FPVRegionalDelivery.v2' : 'FPVRegionalDelivery.v1',
    id,
    revision,
    title,
    terrain: layers.terrain.ref,
    scenery: layers.scenery.ref,
    files,
    totalBytes,
  };
  const descriptorBytes = Buffer.from(`${JSON.stringify(descriptor, null, 2)}\n`);
  fail(descriptorBytes.length <= 1024 * 1024, 'Descriptor exceeds 1 MiB');
  // Validate everything before creating output. mkdir must fail for existing output.
  await mkdir(output);
  for (const { ref, bytes } of contents.values()) {
    const destination = path.join(output, ref.path);
    await mkdir(path.dirname(destination), { recursive: true });
    await writeFile(destination, bytes, { flag: 'wx' });
  }
  await writeFile(path.join(output, 'delivery.json'), descriptorBytes, { flag: 'wx' });
  return { descriptor, pin: { bytes: descriptorBytes.length, sha256: hash(descriptorBytes) } };
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const [source, output, id, revision] = process.argv.slice(2);
  if (!source || !output || !id || !revision) {
    throw new Error('Usage: node prepare-delivery.mjs SOURCE NEW_OUTPUT ID REVISION');
  }
  const result = await prepareRegionalDelivery({ source, output, id, revision });
  console.log(
    JSON.stringify(
      {
        ...result.pin,
        files: result.descriptor.files.length,
        totalBytes: result.descriptor.totalBytes,
        playerAdmission: false,
      },
      null,
      2,
    ),
  );
}
