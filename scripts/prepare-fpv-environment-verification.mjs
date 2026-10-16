#!/usr/bin/env node
/** Rebuild a manual browser qualification fixture without changing any Git state. */
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const HEAD = 'b49979e17d8add2518e989f42455619caea08017';
const EVIDENCE = path.join(ROOT, 'docs/evidence');
const MAX_FILE_BYTES = 6 * 1024 * 1024;
const MAX_TOTAL_BYTES = 16 * 1024 * 1024;
const PATHS = [
  'game/data-json.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/catalogs.mjs',
  'game/i18n/index.mjs',
  'game/vendor/i18next-26.4.2.min.js',
  'optional-practice/civilian-fpv/catalogue.mjs',
  'optional-practice/civilian-fpv/flight-sectors.mjs',
  'optional-practice/civilian-fpv/math.mjs',
  'optional-practice/civilian-fpv/model.mjs',
  'optional-practice/civilian-fpv/radio-profile.mjs',
  'optional-practice/civilian-fpv/renderer.mjs',
  'optional-practice/civilian-fpv/rotation-table.mjs',
  'optional-practice/civilian-fpv/vendor/LICENSE.txt',
  'optional-practice/civilian-fpv/vendor/addons/controls/TransformControls.js',
  'optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js',
  'optional-practice/civilian-fpv/vendor/addons/provenance.json',
  'optional-practice/civilian-fpv/vendor/addons/utils/BufferGeometryUtils.js',
  'optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js',
  'optional-practice/civilian-fpv/vendor/rapier/LICENSE',
  'optional-practice/civilian-fpv/vendor/rapier/provenance.json',
  'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
  'optional-practice/civilian-fpv/vendor/three.core.js',
  'optional-practice/civilian-fpv/vendor/three.module.js',
  'optional-practice/civilian-fpv/world-assets.mjs',
  'optional-practice/civilian-fpv/world-catalogue.mjs',
  'optional-practice/civilian-fpv/world-collision.mjs',
  'optional-practice/civilian-fpv/world-model.mjs',
  'optional-practice/civilian-fpv/world-themes.mjs',
  'optional-practice/civilian-fpv/world-visuals.mjs',
];
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = (message) => {
  throw new Error(message);
};
async function main() {
  const args = process.argv.slice(2);
  let output = 'dist/fpv-environment-verification';
  let verifyOnly = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--verify-only') verifyOnly = true;
    else if (args[index] === '--out' && args[index + 1]) output = args[++index];
    else if (args[index] === '--help') {
      console.log(
        'Usage: node scripts/prepare-fpv-environment-verification.mjs [--verify-only] [--out dist/fpv-environment-verification-NAME]\nExisting destinations are never overwritten. No fetching, checkout or Git writes occur.',
      );
      return;
    } else fail(`Unknown or incomplete option: ${args[index]}`);
  }
  if (!/^dist\/fpv-environment-verification(?:-[a-z0-9-]{1,64})?$/.test(output))
    fail('Output must be dist/fpv-environment-verification or a named sibling of that directory.');
  const manifest = JSON.parse(
    await fs.readFile(path.join(EVIDENCE, 'fpv-environment-browser-baseline.json'), 'utf8'),
  );
  if (
    manifest.format !== 'fpv-environment-browser-baseline.v1' ||
    manifest.head !== HEAD ||
    JSON.stringify(Object.keys(manifest.files).sort()) !== JSON.stringify([...PATHS].sort())
  )
    fail('The baseline manifest must contain the pinned commit and exact bounded file allowlist.');
  const blobs = new Map();
  let total = 0;
  for (const relative of PATHS) {
    const expected = manifest.files[relative];
    if (!/^[a-f0-9]{64}$/.test(expected)) fail(`Invalid baseline hash: ${relative}`);
    const result = spawnSync('git', ['--no-pager', 'show', `${HEAD}:${relative}`], {
      cwd: ROOT,
      encoding: null,
      maxBuffer: MAX_FILE_BYTES,
      timeout: 10000,
    });
    if (result.status !== 0 || result.error)
      fail(
        `Cannot read pinned baseline ${relative}. The local clone must contain ${HEAD}; this tool never fetches or switches branches.`,
      );
    const bytes = result.stdout;
    if (!bytes.length || bytes.length > MAX_FILE_BYTES || (total += bytes.length) > MAX_TOTAL_BYTES)
      fail('Frozen baseline exceeds the bounded fixture size.');
    if (digest(bytes) !== expected)
      fail(`Baseline bytes differ from recorded SHA-256: ${relative}`);
    blobs.set(relative, bytes);
  }
  // This fixed graph contains only literal relative module imports, including side effects.
  const imports = /(?:\bfrom\s*|\bimport\s*(?:\(\s*)?)['"]([^'"]+)['"]/g;
  for (const [relative, bytes] of blobs) {
    if (!/\.(?:mjs|js)$/.test(relative)) continue;
    for (const match of bytes.toString('utf8').matchAll(imports)) {
      if (!match[1].startsWith('.')) continue;
      const dependency = path.posix.normalize(
        path.posix.join(path.posix.dirname(relative), match[1]),
      );
      if (!blobs.has(dependency)) fail(`Missing frozen import: ${relative} → ${dependency}`);
    }
  }
  if (verifyOnly) {
    console.log(
      JSON.stringify({ verified: true, head: HEAD, files: blobs.size, bytes: total, writes: 0 }),
    );
    return;
  }
  const dist = path.join(ROOT, 'dist');
  const distStat = await fs.lstat(dist).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (distStat && (!distStat.isDirectory() || distStat.isSymbolicLink()))
    fail('dist must be a real directory.');
  if (!distStat) await fs.mkdir(dist);
  const destination = path.join(ROOT, output);
  const existing = await fs.lstat(destination).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
    return null;
  });
  if (existing)
    fail(
      `Destination already exists: ${output}. Keep any running fixture and receipts; select a fresh --out name.`,
    );
  const artifacts = await Promise.all(
    ['fpv-environment-browser-harness.html', 'fpv-environment-browser-harness.mjs'].map((name) =>
      fs.readFile(path.join(EVIDENCE, name)),
    ),
  );
  await fs.mkdir(destination);
  for (const [relative, bytes] of blobs) {
    const target = path.join(destination, 'before', relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  await fs.writeFile(
    path.join(destination, 'baseline.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    { flag: 'wx' },
  );
  await fs.writeFile(path.join(destination, 'index.html'), artifacts[0], { flag: 'wx' });
  await fs.writeFile(path.join(destination, 'fpv-environment-browser-harness.mjs'), artifacts[1], {
    flag: 'wx',
  });
  console.log(
    JSON.stringify({
      prepared: true,
      head: HEAD,
      files: blobs.size,
      bytes: total,
      url: `http://127.0.0.1:8789/${output}/index.html`,
      note: 'Open in a browser, click Run comparison, and keep the tab visible. This command does not qualify browser rendering.',
    }),
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
