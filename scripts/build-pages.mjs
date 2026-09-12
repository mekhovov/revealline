#!/usr/bin/env node
/** Build the GitHub Pages artifact and playable snapshots for every stable tag. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildProject, releaseSnapshot } from './game-cli.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const command = (args) => {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
  return result.stdout.trim();
};

const packageInfo = await readJSON(path.join(root, 'package.json'));
const version = packageInfo.version;
const revision = command(['rev-parse', 'HEAD']);
const tags = command(['tag', '--list', 'v*'])
  .split('\n')
  .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  .filter((tag) => tag !== `v${version}`);
const releasesRoot = path.join(root, 'releases');

await buildProject({ out: path.join(root, 'dist'), version, sourceRevision: revision });
await fs.writeFile(path.join(root, 'dist/.nojekyll'), '');
await fs.mkdir(releasesRoot, { recursive: true });

for (const tag of tags) {
  const destination = path.join(releasesRoot, tag);
  try {
    await fs.access(path.join(destination, 'release.json'));
  } catch {
    await releaseSnapshot({ root, ref: tag, version: tag });
  }
}

const pagesReleases = path.join(root, 'dist/releases');
await fs.rm(pagesReleases, { recursive: true, force: true });
await fs.mkdir(pagesReleases, { recursive: true });
for (const tag of tags) {
  const source = path.join(releasesRoot, tag);
  const target = path.join(pagesReleases, tag);
  await fs.mkdir(target, { recursive: true });
  await fs.cp(path.join(source, 'site'), path.join(target, 'site'), { recursive: true });
  await fs.copyFile(path.join(source, 'release.json'), path.join(target, 'release.json'));
}
for (const name of ['index.html', 'index.json']) {
  await fs.copyFile(path.join(releasesRoot, name), path.join(pagesReleases, name));
}

console.log(
  `GitHub Pages artifact ready: ${version} (${revision.slice(0, 7)}) + ${tags.length} archived releases`,
);
