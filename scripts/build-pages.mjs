#!/usr/bin/env node
/** Publish the exact latest tag; keep playable history, put redundant ZIPs on Releases. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseSnapshot } from './game-cli.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = async (file) => JSON.parse(await fs.readFile(file, 'utf8'));
const escapeHTML = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

export async function copyPlayableSite(source, destination) {
  await fs.cp(source, destination, {
    recursive: true,
    // ZIPs duplicate every playable byte and are not in the runtime manifest/cache.
    filter: (file) =>
      !['distribution.zip', 'distribution.zip.sha256'].includes(path.relative(source, file)),
  });
}

export function publishedReleaseIndex(records, repository, latest) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository.');
  const releases = records
    .map((record) => ({
      ...record,
      download: `https://github.com/${repository}/releases/download/${encodeURIComponent(record.version)}/distribution.zip`,
    }))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return {
    json: { formatVersion: 1, latest, releases },
    html: `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>RevealLine playable versions</title><style>body{color:#e4edff;background:#080e20;font:18px/1.6 system-ui;max-width:860px;margin:3rem auto;padding:1rem}a{color:#82e2ff;margin-right:1rem}li{margin:1.5rem 0}code{font-size:12px;overflow-wrap:anywhere}</style><h1>Playable versions</h1><p>Current: ${escapeHTML(latest)}. Each version retains its own gameplay and files. ZIP downloads are hosted on GitHub Releases.</p><ul>${releases.map((r) => `<li><strong>${escapeHTML(r.version)}</strong> <code>${escapeHTML(r.sourceRevision)}</code><p><a href="./${escapeHTML(r.play)}">Play</a><a href="${escapeHTML(r.download)}">Download ZIP</a><a href="./${escapeHTML(r.version)}/release.json">Manifest</a></p></li>`).join('')}</ul></html>\n`,
  };
}

export async function pagesBytes(directory) {
  let total = 0;
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Pages artifacts cannot contain symbolic links.');
    if (entry.isDirectory()) total += await pagesBytes(file);
    else if (entry.isFile()) total += (await fs.stat(file)).size;
    else throw new Error('Unexpected special file in Pages artifact.');
  }
  return total;
}

export async function buildPages({
  projectRoot = root,
  repository = process.env.GITHUB_REPOSITORY || 'mekhovov/revealline',
} = {}) {
  const command = (args) => {
    const result = spawnSync('git', args, { cwd: projectRoot, encoding: 'utf8' });
    if (result.status !== 0) throw new Error(result.stderr || `git ${args[0]} failed`);
    return result.stdout.trim();
  };
  const version = `v${(await readJSON(path.join(projectRoot, 'package.json'))).version}`;
  const tags = command(['tag', '--list', 'v*'])
    .split('\n')
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!tags.includes(version)) throw new Error(`Freeze and tag ${version} before building Pages.`);
  const releasesRoot = path.join(projectRoot, 'releases');
  const records = [];
  for (const tag of tags) {
    const destination = path.join(releasesRoot, tag);
    try {
      await fs.access(path.join(destination, 'release.json'));
    } catch {
      await releaseSnapshot({ root: projectRoot, ref: tag, version: tag });
    }
    const record = await readJSON(path.join(destination, 'release.json'));
    if (
      record.version !== tag ||
      record.sourceRevision !== command(['rev-parse', `${tag}^{commit}`])
    )
      throw new Error(`Archive does not match immutable tag ${tag}.`);
    records.push(record);
  }
  const dist = path.join(projectRoot, 'dist');
  await fs.rm(dist, { recursive: true, force: true });
  await copyPlayableSite(path.join(releasesRoot, version, 'site'), dist);
  await fs.writeFile(path.join(dist, '.nojekyll'), '');
  const pagesReleases = path.join(dist, 'releases');
  await fs.mkdir(pagesReleases, { recursive: true });
  for (const record of records) {
    const source = path.join(releasesRoot, record.version),
      target = path.join(pagesReleases, record.version);
    await copyPlayableSite(path.join(source, 'site'), path.join(target, 'site'));
    await fs.copyFile(path.join(source, 'release.json'), path.join(target, 'release.json'));
  }
  const index = publishedReleaseIndex(records, repository, version);
  await fs.writeFile(
    path.join(pagesReleases, 'index.json'),
    JSON.stringify(index.json, null, 2) + '\n',
  );
  await fs.writeFile(path.join(pagesReleases, 'index.html'), index.html);
  const latest = records.find((record) => record.version === version);
  await fs.writeFile(path.join(dist, 'release.json'), JSON.stringify(latest, null, 2) + '\n');
  const totalBytes = await pagesBytes(dist);
  if (totalBytes > 950_000_000)
    throw new Error(`Pages artifact is ${totalBytes} bytes; exceeds the 950 MB deployment budget.`);
  const report = {
    version,
    sourceRevision: latest.sourceRevision,
    totalBytes,
    playableVersions: records.length,
  };
  console.log(JSON.stringify(report));
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  await buildPages();
