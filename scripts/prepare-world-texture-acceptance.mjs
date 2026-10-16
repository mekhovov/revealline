#!/usr/bin/env node
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { buildOptionalPractice } from './build-optional-practice.mjs';
import { acceptanceDependencies } from './prepare-sim-appearance-acceptance.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const fixtureRoot = 'authoring/fpv-worlds/industrial-markings/';
const extras = ['runtime.html', 'runtime.mjs', 'r1/markings.glb', 'r1/manifest.json'];
const chromeRoots = [
  'game/presentation/theme-bootstrap.mjs',
  'game/presentation/industrial-workshop.css',
  'game/ui/fonts/departure-mono/LICENSE',
  'game/ui/fonts/departure-mono/provenance.json',
  'game/ui/fonts/field-kit/Handjet-OFL.txt',
  'game/ui/fonts/field-kit/Exo2-OFL.txt',
  'game/ui/fonts/field-kit/IBMPlexMono-OFL.txt',
  'game/ui/fonts/field-kit/provenance.json',
];
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Actual optional-package output plus an isolated inspection page and its exact
 * original test asset. No full-game build, ZIP copy, installed art or CSP change. */
export async function prepareWorldTextureAcceptance({
  name = 'current',
  verifyOnly = false,
  sourceRoot = root,
} = {}) {
  if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(name)) throw Error('Use a short lowercase snapshot name.');
  const built = await buildOptionalPractice(sourceRoot, { packageId: 'fpv-worlds' });
  const files = new Map(built.entries.map(({ name, bytes }) => [name, bytes]));
  for (const name of extras)
    files.set(fixtureRoot + name, await fs.readFile(path.join(sourceRoot, fixtureRoot, name)));
  // Inspection chrome is a bounded authoring addition, never admitted to the
  // optional package or counted as evidence of its runtime dependency closure.
  const chrome = new Set(),
    pending = [...chromeRoots];
  let chromeBytes = 0;
  const realRoot = await fs.realpath(sourceRoot);
  while (pending.length) {
    const name = pending.pop();
    if (chrome.has(name)) continue;
    if (chrome.size >= 24 || (!chromeRoots.includes(name) && !name.startsWith('game/ui/')))
      throw Error('Inspection chrome exceeds its bounded shared-style closure.');
    const target = await fs.realpath(path.join(sourceRoot, name));
    if (!target.startsWith(realRoot + path.sep) || (await fs.stat(target)).size > 512 * 1024)
      throw Error('Inspection chrome path or file exceeds its bound.');
    const bytes = await fs.readFile(target);
    chromeBytes += bytes.length;
    if (chromeBytes > 2 * 1024 * 1024) throw Error('Inspection chrome exceeds 2 MiB.');
    chrome.add(name);
    if (files.has(name) && !files.get(name).equals(bytes))
      throw Error('Inspection chrome conflicts with package bytes.');
    files.set(name, bytes);
    if (/\.(?:m?js|css)$/.test(name)) pending.push(...acceptanceDependencies(name, bytes));
  }
  for (const name of ['runtime.html', 'runtime.mjs'])
    for (const dependency of acceptanceDependencies(
      fixtureRoot + name,
      files.get(fixtureRoot + name),
    ))
      if (!files.has(dependency))
        throw Error(`Fixture dependency is absent from the actual package: ${dependency}`);
  const kit = JSON.parse(files.get(fixtureRoot + 'r1/manifest.json'));
  const glb = files.get(fixtureRoot + 'r1/markings.glb'),
    pin = kit.files.find((item) => item.path === 'markings.glb');
  if (glb.length !== pin.bytes || sha(glb) !== pin.sha256)
    throw Error('Retained GLB differs from its production receipt.');
  const manifest = {
    format: 'WorldTextureAcceptance.v1',
    sourceRevision: execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: sourceRoot,
      encoding: 'utf8',
    }).trim(),
    includesWorkingTreeChanges:
      execFileSync(
        'git',
        [
          'status',
          '--porcelain',
          '--',
          ...built.inputs.keys(),
          ...extras.map((name) => fixtureRoot + name),
          ...chrome,
        ],
        { cwd: sourceRoot, encoding: 'utf8' },
      ).trim().length > 0,
    packageRevision: built.manifest.revision,
    packageQualification: built.manifest.qualification,
    packageFiles: built.entries.length,
    packageBytes: built.entries.reduce((sum, item) => sum + item.bytes.length, 0),
    inspectionChromeFiles: chrome.size,
    inspectionChromeBytes: chromeBytes,
    limits: built.manifest.limits,
    inspectionEntry: fixtureRoot + 'runtime.html',
    packageEntry: built.manifest.entry,
    files: [...files]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, bytes]) => ({ path, bytes: bytes.length, sha256: sha(bytes) })),
    note: 'Actual development optional-package bytes plus an authoring-only test route. No asset adoption, player preferences, authored-course mutation, flight proof, or release qualification.',
  };
  if (verifyOnly) return { ...manifest, writes: 0 };
  const dist = path.join(sourceRoot, 'dist');
  await fs.mkdir(dist, { recursive: true });
  if ((await fs.lstat(dist)).isSymbolicLink()) throw Error('dist must not be a symlink.');
  const destination = path.join(dist, `world-texture-acceptance-${name}`);
  await fs.mkdir(destination, { recursive: false });
  for (const [name, bytes] of files) {
    const target = path.join(destination, name);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, bytes, { flag: 'wx' });
  }
  await fs.writeFile(
    path.join(destination, 'texture-source-manifest.json'),
    JSON.stringify(manifest, null, 2) + '\n',
    { flag: 'wx' },
  );
  return {
    destination,
    entry: `${destination}/${manifest.inspectionEntry}`,
    sourceRevision: manifest.sourceRevision,
    packageRevision: manifest.packageRevision,
    packageFiles: manifest.packageFiles,
    packageBytes: manifest.packageBytes,
    limits: manifest.limits,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  let name = 'current',
    verifyOnly = false;
  for (let i = 0; i < args.length; i++)
    if (args[i] === '--name' && args[i + 1]) name = args[++i];
    else if (args[i] === '--verify-only') verifyOnly = true;
    else
      throw Error(
        'Usage: node scripts/prepare-world-texture-acceptance.mjs [--name UNIQUE] [--verify-only]',
      );
  console.log(JSON.stringify(await prepareWorldTextureAcceptance({ name, verifyOnly }), null, 2));
}
