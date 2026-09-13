/** Publishing-only routing. Frozen sites are copied, never rewritten. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

export const ARCHIVE_BUDGET_BYTES = 800_000_000;
export const MAIN_PAGES_BUDGET_BYTES = 950_000_000;
export function assertPagesBudget(bytes, archive = false) {
  const limit = archive ? ARCHIVE_BUDGET_BYTES : MAIN_PAGES_BUDGET_BYTES;
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > limit)
    throw new Error(
      `Pages artifact is ${bytes} bytes; exceeds or invalidates the ${limit} byte deployment budget.`,
    );
  return limit;
}
const versionPattern = /^v\d+\.\d+\.\d+$/;
const repositoryPattern = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;
const html = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );
const literal = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') === [...keys].sort().join(',');

export async function verifyFrozenSite(source, record) {
  const read = async (relative) => {
    const file = path.join(source, relative);
    if (!(await fs.lstat(file)).isFile()) throw new Error(`Non-ordinary frozen asset: ${relative}`);
    return fs.readFile(file);
  };
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex'),
    raw = await read('manifest.json'),
    manifest = JSON.parse(raw);
  if (
    digest(raw) !== record.manifestSha256 ||
    manifest.version !== record.version ||
    manifest.sourceRevision !== record.sourceRevision ||
    !Array.isArray(manifest.files)
  )
    throw new Error(`Frozen manifest does not match ${record.version}.`);
  const seen = new Set();
  let total = 0;
  for (const asset of manifest.files) {
    if (
      !asset ||
      typeof asset.path !== 'string' ||
      asset.path.startsWith('/') ||
      asset.path.includes('\\') ||
      asset.path.split('/').some((part) => !part || part === '.' || part === '..') ||
      seen.has(asset.path) ||
      !Number.isSafeInteger(asset.bytes) ||
      asset.bytes < 0 ||
      !/^[0-9a-f]{64}$/.test(asset.sha256)
    )
      throw new Error('Invalid frozen asset descriptor.');
    seen.add(asset.path);
    const bytes = await read(asset.path);
    if (bytes.length !== asset.bytes || digest(bytes) !== asset.sha256)
      throw new Error(`Frozen asset mismatch: ${record.version}/${asset.path}`);
    total += bytes.length;
    if (!Number.isSafeInteger(total)) throw new Error('Invalid frozen asset total.');
  }
  if (total !== manifest.totalBytes) throw new Error('Frozen manifest byte total mismatch.');
}

export function validateArchivePlan(plan, records, repository, latest) {
  if (!repositoryPattern.test(repository)) throw new Error('Invalid source repository.');
  if (
    !exact(plan, ['formatVersion', 'shards']) ||
    plan.formatVersion !== 1 ||
    !Array.isArray(plan.shards) ||
    plan.shards.length > 64
  )
    throw new Error('Invalid Pages archive plan.');
  const available = new Set(records.map((record) => record.version)),
    owner = repository.split('/')[0],
    ids = new Set(),
    repositories = new Set(),
    mapped = new Set();
  return plan.shards.map((shard) => {
    if (
      !exact(shard, ['id', 'repository', 'versions']) ||
      typeof shard.id !== 'string' ||
      !/^[a-z0-9][a-z0-9-]{0,63}$/.test(shard.id) ||
      ids.has(shard.id)
    )
      throw new Error('Invalid or duplicate archive ID.');
    if (
      typeof shard.repository !== 'string' ||
      !repositoryPattern.test(shard.repository) ||
      shard.repository.split('/')[0] !== owner ||
      shard.repository === repository ||
      repositories.has(shard.repository)
    )
      throw new Error('Archive must use a distinct repository on the same GitHub account.');
    if (!Array.isArray(shard.versions) || !shard.versions.length || shard.versions.length > 1024)
      throw new Error('Archive needs a bounded explicit version list.');
    ids.add(shard.id);
    repositories.add(shard.repository);
    const versions = [];
    for (const version of shard.versions) {
      if (
        typeof version !== 'string' ||
        !versionPattern.test(version) ||
        !available.has(version) ||
        mapped.has(version) ||
        version === latest
      )
        throw new Error(`Unknown, duplicate or current archive version: ${version}`);
      mapped.add(version);
      versions.push(version);
    }
    return Object.freeze({
      id: shard.id,
      repository: shard.repository,
      baseURL: `https://${owner}.github.io/${shard.repository.split('/')[1]}/`,
      budgetBytes: ARCHIVE_BUDGET_BYTES,
      versions: Object.freeze(
        versions.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      ),
    });
  });
}

export function canonicalArchiveSite(shard, version) {
  if (!shard.versions.includes(version))
    throw new Error('Version does not belong to this archive.');
  return `${shard.baseURL}releases/${version}/site/`;
}

export function archiveRedirect(target) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Open archived RevealLine</title><link rel="canonical" href="${html(target)}"><p>This exact game version is now in the playable archive. <a href="${html(target)}">Continue to the archived version</a>.</p><script>const target = new URL(${literal(target)}); target.search = location.search; target.hash = location.hash; document.querySelector('a').href = target.href; location.replace(target.href);</script></html>\n`;
}

// Replaces only the OLD public worker delivery URL. Normal activation waits for existing
// controlled tabs; it neither takes them over nor clears their cache/profile/IDB data.
export function archiveRetirementWorker(canonicalSite) {
  return `/* Pages archive migration; the canonical release worker is unchanged. */
'use strict';
const target = new URL(${literal(canonicalSite)});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const scope = new URL(self.registration.scope);
    if (scope.origin !== target.origin) throw new Error('Archive must remain on the same origin');
    await self.registration.unregister();
  })());
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url), scope = new URL(self.registration.scope);
  if (event.request.mode !== 'navigate' || url.origin !== scope.origin || target.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const destination = new URL(url.pathname.slice(scope.pathname.length), target);
  if (destination.origin !== target.origin || !destination.pathname.startsWith(target.pathname)) return;
  destination.search = url.search; destination.hash = url.hash;
  event.respondWith(Response.redirect(destination.href, 302));
});
`;
}

export async function writeArchiveBridges(source, destination, canonicalSite) {
  let htmlFiles = 0;
  const walk = async (directory, relative = '') => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const next = relative ? `${relative}/${entry.name}` : entry.name,
        file = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(file, next);
      else if (entry.isFile()) {
        if (next.endsWith('.html')) {
          const output = path.join(destination, next),
            target = canonicalSite + next.split('/').map(encodeURIComponent).join('/');
          await fs.mkdir(path.dirname(output), { recursive: true });
          await fs.writeFile(output, archiveRedirect(target));
          htmlFiles++;
        } else if (next === 'distribution.zip.sha256' || next === 'manifest.json') {
          await fs.mkdir(destination, { recursive: true });
          await fs.copyFile(file, path.join(destination, next));
        }
      } else throw new Error('Archive bridges cannot contain symbolic links or special files.');
    }
  };
  if (!(await fs.lstat(source)).isDirectory()) throw new Error('Expected ordinary frozen site.');
  await walk(source);
  try {
    const worker = await fs.lstat(path.join(source, 'service-worker.js'));
    if (!worker.isFile()) throw new Error('Expected ordinary frozen worker.');
    await fs.mkdir(destination, { recursive: true });
    await fs.writeFile(
      path.join(destination, 'service-worker.js'),
      archiveRetirementWorker(canonicalSite),
    );
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return { htmlFiles };
}
