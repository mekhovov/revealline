#!/usr/bin/env node
/** Re-render the existing 32px emblem; no source images or new design are involved.
 * Read-only by default. Only the five fixed asset paths below are writable.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { offlineIcons } from './game-cli.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const ICNS_SIZES = Object.freeze(
  [
    ['icp4', 16],
    ['icp5', 32],
    ['icp6', 64],
    ['ic07', 128],
    ['ic08', 256],
    ['ic09', 512],
    ['ic10', 1024],
  ].map(Object.freeze),
);
const ASSETS = 'platforms/ios/native/App/App/Assets.xcassets';
const PNG_MAGIC = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function makeICNS(pngs) {
  const chunks = ICNS_SIZES.map(([type, size]) => {
    const bytes = pngs.get(size);
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length < 33 ||
      !bytes.subarray(0, 8).equals(PNG_MAGIC) ||
      bytes.readUInt32BE(16) !== size ||
      bytes.readUInt32BE(20) !== size ||
      bytes[24] !== 8 ||
      bytes[25] !== 2
    )
      throw new TypeError(`ICNS ${type} needs the original ${size}px RGB PNG.`);
    const header = Buffer.alloc(8);
    header.write(type, 0, 4, 'ascii');
    header.writeUInt32BE(bytes.length + 8, 4);
    return Buffer.concat([header, bytes]);
  });
  const header = Buffer.alloc(8);
  header.write('icns', 0, 4, 'ascii');
  header.writeUInt32BE(8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0), 4);
  return Buffer.concat([header, ...chunks]);
}

export function nativeArt() {
  const rendered = new Map(
    offlineIcons([...ICNS_SIZES.map(([, size]) => size), 2732]).map((entry) => [
      entry.name,
      entry.bytes,
    ]),
  );
  const pngs = new Map(
    ICNS_SIZES.map(([, size]) => [size, rendered.get(`icons/icon-${size}.png`)]),
  );
  const splash = rendered.get('icons/icon-2732.png');
  return [
    { name: `${ASSETS}/AppIcon.appiconset/AppIcon-512@2x.png`, bytes: pngs.get(1024) },
    ...['splash-2732x2732-2.png', 'splash-2732x2732-1.png', 'splash-2732x2732.png'].map((name) => ({
      name: `${ASSETS}/Splash.imageset/${name}`,
      bytes: splash,
    })),
    { name: 'platforms/desktop/assets/revealline.icns', bytes: makeICNS(pngs) },
  ];
}

async function present(file) {
  try {
    return await fs.lstat(file);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
async function inspectPath(root, name) {
  let current = root;
  const rootInfo = await fs.lstat(root);
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory())
    throw new Error('Asset root must be a real directory.');
  const parts = name.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    const info = await present(current);
    if (!info) return null;
    if (info.isSymbolicLink()) throw new Error(`Refusing a linked asset path: ${name}`);
    if (index === parts.length - 1) {
      if (!info.isFile()) throw new Error(`Asset destination is not a regular file: ${name}`);
      if (info.size > 16 * 1024 * 1024)
        throw new Error(`Existing native asset exceeds its 16 MiB budget: ${name}`);
      return fs.readFile(current);
    }
    if (!info.isDirectory()) throw new Error(`Asset parent is not a directory: ${name}`);
  }
}

/** Preflight every destination before any write; individual files use rename replacement. */
export async function manageNativeArt({ root = ROOT, mode = 'verify', replace = false } = {}) {
  if (!['verify', 'write'].includes(mode) || (replace && mode !== 'write'))
    throw new TypeError('Use verify, write, or write with explicit replacement.');
  root = path.resolve(root);
  const entries = nativeArt();
  const inspected = [];
  for (const entry of entries) {
    const before = await inspectPath(root, entry.name);
    const matches = before?.equals(entry.bytes) ?? false;
    if (mode === 'verify' && !matches)
      throw new Error(
        `Native asset is missing or differs from the original renderer: ${entry.name}`,
      );
    if (mode === 'write' && before && !matches && !replace)
      throw new Error(
        `Refusing to overwrite ${entry.name}; use --write --replace for these designated assets.`,
      );
    inspected.push({ ...entry, before, matches });
  }
  const files = [];
  for (const entry of inspected) {
    const target = path.join(root, entry.name);
    if (mode === 'write' && !entry.matches) {
      await fs.mkdir(path.dirname(target), { recursive: true });
      const current = await inspectPath(root, entry.name);
      if (current === null ? entry.before !== null : !entry.before?.equals(current))
        throw new Error(`Asset changed during preparation: ${entry.name}`);
      const temporary = `${target}.native-art-${randomUUID()}`;
      let handle,
        created = false;
      try {
        handle = await fs.open(temporary, 'wx');
        created = true;
        await handle.writeFile(entry.bytes);
        await handle.close();
        handle = null;
        await fs.rename(temporary, target);
      } finally {
        await handle?.close();
        if (created) await fs.rm(temporary, { force: true });
      }
    }
    files.push({
      name: entry.name,
      bytes: entry.bytes.length,
      sha256: createHash('sha256').update(entry.bytes).digest('hex'),
      status: mode === 'verify' ? 'verified' : entry.matches ? 'unchanged' : 'written',
    });
  }
  return { format: 'revealline-native-art.v1', mode, files };
}

export function parseArtArgs(args) {
  if (args.length === 1 && args[0] === '--help') return { help: true };
  if (
    new Set(args).size !== args.length ||
    args.some((arg) => !['--verify', '--write', '--replace'].includes(arg)) ||
    (args.includes('--verify') && args.includes('--write')) ||
    (args.includes('--replace') && !args.includes('--write'))
  )
    throw new TypeError('Usage: node scripts/native-art.mjs [--verify | --write [--replace]]');
  return {
    mode: args.includes('--write') ? 'write' : 'verify',
    replace: args.includes('--replace'),
  };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArtArgs(process.argv.slice(2));
    if (options.help)
      console.log(
        'Render the existing original emblem at fixed native asset paths.\n  --verify (default): check bytes without writing\n  --write: create missing assets; preserve differing files\n  --write --replace: replace only the five designated native assets',
      );
    else console.log(JSON.stringify(await manageNativeArt(options), null, 2));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
