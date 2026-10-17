#!/usr/bin/env node
/** Explicit simulator-only input for the unchanged native staging contract. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { safeVersion } from './game-cli.mjs';
import { verifySite } from './native-cli.mjs';

export const FPV_NATIVE_PACKAGES = Object.freeze(['civilian-fpv', 'fpv-worlds']);
export const FPV_NATIVE_LIMITS = Object.freeze({ files: 256, bytes: 32 * 1024 * 1024 });
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');

function launcher() {
  return Buffer.from(`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>FPV / LINE · Native qualification</title>
<style>body{margin:0;background:#091324;color:#edf2e8;font:18px/1.6 system-ui}main{max-width:760px;margin:5vh auto;padding:24px}a{color:#8edfff}nav{display:flex;gap:20px;flex-wrap:wrap}nav a{padding:12px;border:1px solid #607080;border-radius:8px}a:focus-visible{outline:3px solid #ffd56a;outline-offset:4px}</style>
</head><body><main><h1>FPV / LINE</h1>
<p>Simulator-only native qualification build. Academy and World, including the experimental Advanced practice arena, are bundled offline. This is not the complete game release or a device-qualification result. Imported worlds require their own files.</p>
<p lang="uk">Нативна збірка симулятора для перевірки. Академія, світи та експериментальна практика Advanced доступні офлайн. Це не повний випуск гри й не підтвердження перевірки пристрою. Імпортовані світи потребують власних файлів.</p>
<nav aria-label="Flight simulators">
<a href="../optional-practice/civilian-fpv/index.html?game-return=%2Fgame%2Findex.html&amp;lang=en">Academy · EN</a>
<a href="../optional-practice/fpv-worlds/index.html?game-return=%2Fgame%2Findex.html&amp;lang=en">World · EN</a>
<a lang="uk" href="../optional-practice/civilian-fpv/index.html?game-return=%2Fgame%2Findex.html&amp;lang=uk">Академія · УК</a>
<a lang="uk" href="../optional-practice/fpv-worlds/index.html?game-return=%2Fgame%2Findex.html&amp;lang=uk">Світи · УК</a>
</nav></main></body></html>\n`);
}

/** Every input still passes its existing package policy, vendor pins, executable
 * dependency closure, localization projection and package-size checks. Shared
 * files must agree byte-for-byte; never choose one package's conflicting copy.
 */
export async function buildFPVNative({
  root = projectRoot,
  version = 'fpv-native-qualification',
} = {}) {
  safeVersion(version);
  root = path.resolve(root);
  await noLinks(root);
  const entries = new Map();
  const packages = [];
  for (const packageId of FPV_NATIVE_PACKAGES) {
    const built = await buildOptionalPractice(root, { packageId });
    packages.push({
      id: packageId,
      revision: built.manifest.revision,
      files: built.manifest.files.length,
      bytes: built.manifest.files.reduce((sum, file) => sum + file.bytes, 0),
      manifestSha256: hash(
        built.entries.find((entry) => entry.name === 'optional-package.json').bytes,
      ),
    });
    for (const entry of built.entries) {
      const name =
        entry.name === 'optional-package.json'
          ? `native/source-packages/${packageId}.json`
          : entry.name;
      const previous = entries.get(name);
      if (previous && !previous.equals(entry.bytes))
        throw new Error(`Native FPV packages disagree on a shared dependency: ${name}`);
      entries.set(name, entry.bytes);
    }
  }
  entries.set('game/index.html', launcher());
  entries.set(
    'native/fpv-qualification.json',
    json({
      format: 'revealline-fpv-native-qualification.v1',
      scope: 'simulators-only',
      nativeRuntimeVerified: false,
      advancedScored: false,
      packages,
    }),
  );
  const files = [...entries]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, bytes]) => ({
      path: name,
      bytes: bytes.length,
      sha256: hash(bytes),
    }));
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (files.length > FPV_NATIVE_LIMITS.files || totalBytes > FPV_NATIVE_LIMITS.bytes)
    throw new Error('Native FPV qualification input exceeds its 256-file / 32 MiB limit');
  const manifest = {
    formatVersion: 1,
    version,
    sourceRevision: null,
    entry: 'game/index.html',
    qualification: 'simulators-only-development',
    totalBytes,
    files,
  };
  entries.set('manifest.json', json(manifest));
  return { manifest, entries: [...entries].map(([name, bytes]) => ({ name, bytes })), packages };
}

async function noLinks(directory) {
  let current = path.parse(directory).root;
  for (const part of directory.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    const info = await fs.lstat(current);
    if (!info.isDirectory() || info.isSymbolicLink())
      throw new Error('Native FPV requires ordinary source and output parent directories');
  }
}

/** Publish only a fully hash-verified new source directory. The full game source
 * and any existing native stage remain untouched. stageNative owns platform CSP
 * and bridge transformations after this step.
 */
export async function writeFPVNative({ out, ...options }) {
  if (!out) throw new Error('Choose a new --out directory');
  out = path.resolve(out);
  await noLinks(path.dirname(out));
  try {
    await fs.lstat(out);
    throw new Error('Native FPV output already exists; choose a new directory');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const built = await buildFPVNative(options);
  const temp = await fs.mkdtemp(path.join(path.dirname(out), '.fpv-native-'));
  try {
    for (const entry of built.entries) {
      const target = path.join(temp, entry.name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, entry.bytes);
    }
    await verifySite(temp);
    await fs.rename(temp, out);
  } finally {
    await fs.rm(temp, { recursive: true, force: true });
  }
  return {
    out,
    version: built.manifest.version,
    scope: 'simulators-only',
    files: built.manifest.files.length,
    bytes: built.manifest.totalBytes,
    nativeRuntimeVerified: false,
    packages: built.packages,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const options = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    if (
      !['--out', '--version'].includes(args[index]) ||
      !args[index + 1] ||
      args[index + 1].startsWith('--')
    )
      throw new Error(
        'Usage: node scripts/build-fpv-native.mjs --out <new-directory> [--version <label>]',
      );
    options[args[index].slice(2)] = args[index + 1];
  }
  console.log(JSON.stringify(await writeFPVNative(options), null, 2));
}
