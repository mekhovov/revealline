#!/usr/bin/env node
import { publishOfflineLauncher } from '../publishing/pages-controller/launcher.mjs';
/** Publish the exact latest tag; keep playable history, put redundant ZIPs on Releases. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { releaseSnapshot } from './game-cli.mjs';
import { planCurrentEntries, writeCurrentEntries } from './pages-current-entry.mjs';
import { copyCatalogPresentation, catalogShell } from './release-catalog.mjs';
import {
  validateArchivePlan,
  canonicalArchiveSite,
  writeArchiveBridges,
  assertPagesBudget,
  verifyFrozenSite,
} from './pages-archive.mjs';

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

export function publishedReleaseIndex(
  records,
  repository,
  latest,
  canonicalSites = {},
  options = {},
) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository)) throw new Error('Invalid GitHub repository.');
  const releases = records
    .map((record) => ({
      ...record,
      download: `https://github.com/${repository}/releases/download/${encodeURIComponent(record.version)}/distribution.zip`,
      ...(canonicalSites[record.version]
        ? { canonicalPlay: `${canonicalSites[record.version]}game/` }
        : {}),
    }))
    .sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true }));
  return {
    json: { formatVersion: 1, latest, releases },
    html: catalogShell(
      'Reveal Line · Playable versions',
      `<p class="field-kit-eyebrow">Reveal Line / Release archive</p><h1>Playable versions</h1><p>Current: ${escapeHTML(latest)}. Every edition keeps its original gameplay, saves and artwork.</p><ul class="release-list">${releases.map((r) => `<li class="release-card" data-current="${r.version === latest}"><h2>${escapeHTML(r.version)}${r.version === latest ? ' · Current' : ''}</h2><code>${escapeHTML(r.sourceRevision)}</code><nav aria-label="${escapeHTML(r.version)} actions"><a class="button primary" href="${escapeHTML(r.canonicalPlay || `./${r.play}`)}">Play</a><a class="button" href="${escapeHTML(r.download)}">Download ZIP</a><a class="button" href="./${escapeHTML(r.version)}/release.json">Manifest</a></nav></li>`).join('')}</ul>`,
      options,
    ),
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
  archivePlan,
  archiveId,
  outputDirectory = path.join(projectRoot, 'dist'),
} = {}) {
  const relativeOutput = path.relative(path.resolve(projectRoot), path.resolve(outputDirectory));
  if (relativeOutput !== 'dist' && !relativeOutput.startsWith(`.cache${path.sep}`))
    throw new Error('Pages output must be dist or a directory inside the project .cache.');
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
  const shards = archivePlan ? validateArchivePlan(archivePlan, records, repository, version) : [];
  const selected = archiveId ? shards.find((shard) => shard.id === archiveId) : null;
  if (archiveId && !selected) throw new Error(`Unknown Pages archive: ${archiveId}`);
  const canonicalSites = Object.fromEntries(
    shards.flatMap((shard) => shard.versions.map((tag) => [tag, canonicalArchiveSite(shard, tag)])),
  );
  const latest = records.find((record) => record.version === version),
    currentEntries = selected
      ? null
      : await planCurrentEntries({
          source: path.join(releasesRoot, version, 'site'),
          repository,
          record: latest,
        });
  const distTarget = path.resolve(outputDirectory);
  await fs.mkdir(path.dirname(distTarget), { recursive: true });
  const dist = await fs.mkdtemp(path.join(path.dirname(distTarget), '.pages-staging-'));
  try {
    if (!selected) await copyPlayableSite(path.join(releasesRoot, version, 'site'), dist);
    const catalogPresentation = await copyCatalogPresentation(projectRoot, dist);
    await fs.writeFile(path.join(dist, '.nojekyll'), '');
    const pagesReleases = path.join(dist, 'releases');
    await fs.mkdir(pagesReleases, { recursive: true });
    const publishedRecords = selected
      ? records.filter((record) => selected.versions.includes(record.version))
      : records;
    let redirectedHTMLFiles = 0;
    for (const record of publishedRecords) {
      const source = path.join(releasesRoot, record.version),
        target = path.join(pagesReleases, record.version);
      if (archivePlan) await verifyFrozenSite(path.join(source, 'site'), record);
      if (!selected && canonicalSites[record.version]) {
        const bridges = await writeArchiveBridges(
          path.join(source, 'site'),
          path.join(target, 'site'),
          canonicalSites[record.version],
        );
        redirectedHTMLFiles += bridges.htmlFiles;
      } else {
        await copyPlayableSite(path.join(source, 'site'), path.join(target, 'site'));
        if (archivePlan) {
          // Checksum is tiny and remains byte-identical; the ZIP stays on its original Release.
          await fs.copyFile(
            path.join(source, 'site', 'distribution.zip.sha256'),
            path.join(target, 'site', 'distribution.zip.sha256'),
          );
        }
      }
      await fs.copyFile(path.join(source, 'release.json'), path.join(target, 'release.json'));
    }
    const index = publishedReleaseIndex(
      publishedRecords,
      repository,
      selected ? selected.versions.at(-1) : version,
      selected ? {} : canonicalSites,
      { presentation: Boolean(catalogPresentation) },
    );
    await fs.writeFile(
      path.join(pagesReleases, 'index.json'),
      JSON.stringify(index.json, null, 2) + '\n',
    );
    await fs.writeFile(path.join(pagesReleases, 'index.html'), index.html);
    if (selected) {
      await fs.writeFile(
        path.join(dist, 'index.html'),
        catalogShell(
          'Reveal Line · Archive',
          '<p class="field-kit-eyebrow">Reveal Line / Archive</p><h1>Return to a flight</h1><p>Play the original editions with their own artwork and progress.</p><nav aria-label="Archive"><a class="button primary" href="./releases/">Browse archived versions</a></nav>',
          { presentation: Boolean(catalogPresentation), prefix: './' },
        ),
      );
    } else {
      await fs.writeFile(path.join(dist, 'release.json'), JSON.stringify(latest, null, 2) + '\n');
      await writeCurrentEntries(currentEntries, dist);
      await publishOfflineLauncher(path.join(releasesRoot, version, 'site'), dist, version);
    }
    if (archivePlan)
      await fs.writeFile(
        path.join(dist, 'archive-routing.json'),
        JSON.stringify(
          {
            formatVersion: 1,
            sourceRepository: repository,
            target: selected?.id || 'main',
            canonicalSites,
            releases: records.map(({ version, sourceRevision, manifestSha256 }) => ({
              version,
              sourceRevision,
              manifestSha256,
            })),
          },
          null,
          2,
        ) + '\n',
      );
    const totalBytes = await pagesBytes(dist);
    const budgetBytes = assertPagesBudget(totalBytes, Boolean(selected));
    const report = {
      version,
      sourceRevision: latest.sourceRevision,
      totalBytes,
      playableVersions: publishedRecords.length,
      ...(catalogPresentation ? { catalogPresentation } : {}),
      ...(currentEntries
        ? {
            currentEntryMetadata: 'current-entry-routing.json',
            currentCanonicalSite: currentEntries.metadata.canonicalSite,
            currentHTMLAliases: currentEntries.metadata.htmlEntries.length,
          }
        : {}),
      ...(archivePlan
        ? {
            target: selected?.id || 'main',
            catalogVersions: records.length,
            latestHostedVersion: index.json.latest,
            budgetBytes,
            copiedVersions: selected
              ? publishedRecords.length
              : records.length - Object.keys(canonicalSites).length,
            archivedVersions: Object.keys(canonicalSites).length,
            redirectedHTMLFiles,
          }
        : {}),
    };
    // Keep the last good artifact on any preparation failure. Promotion is local only.
    const backup = `${dist}.previous`;
    let existed = false;
    try {
      await fs.rename(distTarget, backup);
      existed = true;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    try {
      await fs.rename(dist, distTarget);
    } catch (error) {
      if (existed) await fs.rename(backup, distTarget);
      throw error;
    }
    if (existed) await fs.rm(backup, { recursive: true, force: true });
    console.log(JSON.stringify(report));
    return report;
  } finally {
    await fs.rm(dist, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2),
    options = {};
  while (args.length) {
    const key = args.shift(),
      value = args.shift();
    if (!value || !['--archive-plan', '--archive', '--source-repository'].includes(key))
      throw new Error(
        'Usage: build-pages.mjs [--archive-plan file] [--archive id] [--source-repository owner/repo]',
      );
    if (key === '--archive-plan') options.archivePlan = await readJSON(path.resolve(value));
    if (key === '--archive') options.archiveId = value;
    if (key === '--source-repository') options.repository = value;
  }
  await buildPages(options);
}
