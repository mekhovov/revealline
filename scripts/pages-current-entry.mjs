/** Mutable Pages entry points select one complete, immutable same-origin release graph. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { verifyFrozenSite } from './pages-archive.mjs';

export const CURRENT_ENTRY_METADATA = 'current-entry-routing.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => JSON.stringify(value, null, 2) + '\n';
const literal = (value) => JSON.stringify(value).replace(/</g, '\\u003c');
const html = (value) =>
  value.replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char],
  );

export function currentEntryRedirect({ canonicalTarget, relativeTarget, indexDirectory }) {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><meta name="color-scheme" content="dark"><title>Reveal / Line</title><link rel="canonical" href="${html(canonicalTarget)}"><style>body{margin:0;min-height:100svh;display:grid;place-items:center;background:#091324;color:#edf2e8;font:18px/1.5 ui-monospace,monospace}main{padding:24px}h1{font-size:clamp(24px,5vw,40px)}a{display:inline-block;box-sizing:border-box;min-height:44px;padding:10px 24px;border:1px solid #7fdbeb;border-radius:0;color:#7fdbeb;text-decoration:none}a:focus-visible{outline:3px solid #edf2e8;outline-offset:4px}</style><body><main><h1>Opening Reveal / Line…</h1><a href="${html(relativeTarget)}">Play</a></main><script>const current = new URL(location.href); const directory = ${literal(indexDirectory)}; if (directory && current.pathname.endsWith('/' + directory)) current.pathname += '/'; const target = new URL(${literal(relativeTarget)}, current); target.search = location.search; target.hash = location.hash; document.querySelector('a').href = target.href; location.replace(target.href);</script></html>\n`;
}

function retirementWorker(version, routes) {
  return `/* Mutable Pages entry retirement; immutable release workers and saved data are unchanged. */
'use strict';
const scope = new URL('./', self.location.href), target = new URL(${literal(`releases/${version}/site/`)}, scope);
const routes = new Map(${literal(routes)});
const matchingScope = () => self.registration.scope === scope.href && target.origin === scope.origin;
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    if (!matchingScope()) throw new Error('Current entry worker scope mismatch');
    await self.registration.unregister();
  })());
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || !matchingScope()) return;
  const url = new URL(event.request.url);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  const suffix = url.pathname.slice(scope.pathname.length);
  if (suffix === 'releases' || suffix.startsWith('releases/')) return;
  const relative = routes.get(suffix);
  if (relative === undefined) return;
  const destination = new URL(relative, target);
  if (destination.origin !== target.origin || !destination.pathname.startsWith(target.pathname)) return;
  destination.search = url.search; destination.hash = url.hash;
  event.respondWith(Response.redirect(destination.href, 302));
});
`;
}

// Read-only preparation is also used by the capacity inspector. No wall-clock fields:
// independent publication audits can reconstruct every replacement byte from frozen input.
export async function planCurrentEntries({ source, repository, record }) {
  if (
    !/^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/.test(repository) ||
    !/^v\d+\.\d+\.\d+$/.test(record.version)
  )
    throw new Error('Invalid current Pages entry identity.');
  const [owner, repo] = repository.split('/'),
    scope = new URL(`https://${owner}.github.io/${repo}/`).href,
    canonicalSite = `${scope}releases/${record.version}/site/`,
    originals = new Map();
  if (!(await fs.lstat(source)).isDirectory()) throw new Error('Expected ordinary frozen site.');
  await verifyFrozenSite(source, record);
  const walk = async (directory, prefix = '') => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const relative = prefix + entry.name,
        file = path.join(directory, entry.name);
      if (relative === CURRENT_ENTRY_METADATA || relative === 'releases' || relative.includes('\\'))
        throw new Error(`Reserved or unsafe current entry path: ${relative}`);
      if (entry.isDirectory()) await walk(file, relative + '/');
      else if (!entry.isFile())
        throw new Error('Current entries cannot contain symbolic links or special files.');
      else if (relative.endsWith('.html') || relative === 'service-worker.js')
        originals.set(relative, await fs.readFile(file));
    }
  };
  await walk(source);
  if (!originals.has('index.html')) throw new Error('Current Pages entry needs index.html.');
  const files = new Map(),
    entries = [],
    routes = [];
  for (const relative of [...originals.keys()].sort()) {
    if (!relative.endsWith('.html')) continue;
    const encoded = relative.split('/').map(encodeURIComponent).join('/'),
      target = canonicalSite + encoded,
      relativeTarget = `${'../'.repeat(relative.split('/').length - 1)}releases/${record.version}/site/${encoded}`,
      indexDirectory = relative.endsWith('/index.html')
        ? encoded.slice(0, -'/index.html'.length)
        : '';
    entries.push({ path: relative, target, relativeTarget });
    routes.push([encoded, encoded]);
    if (relative === 'index.html' || relative.endsWith('/index.html')) {
      const directory = encoded.slice(0, -'index.html'.length);
      routes.push([directory, directory]);
      if (directory) routes.push([directory.slice(0, -1), directory]);
    }
    files.set(
      relative,
      currentEntryRedirect({ canonicalTarget: target, relativeTarget, indexDirectory }),
    );
  }
  if (originals.has('service-worker.js'))
    files.set('service-worker.js', retirementWorker(record.version, routes));
  const overrides = [...files].map(([relative, bytes]) => ({
    path: relative,
    kind: relative === 'service-worker.js' ? 'worker-retirement' : 'html-alias',
    sourceBytes: originals.get(relative).length,
    sourceSha256: hash(originals.get(relative)),
    bytes: Buffer.byteLength(bytes),
    sha256: hash(bytes),
  }));
  const metadata = {
    formatVersion: 1,
    version: record.version,
    sourceRevision: record.sourceRevision,
    sourceRepository: repository,
    scope,
    canonicalSite,
    // Root manifest is preserved as frozen evidence, not a manifest of the aliases.
    frozenManifest: {
      path: 'manifest.json',
      sha256: record.manifestSha256,
      appliesTo: `releases/${record.version}/site/`,
    },
    htmlEntries: entries,
    navigationRoutes: routes.map(([from, to]) => ({ from, to })),
    rootOverrides: overrides,
  };
  files.set(CURRENT_ENTRY_METADATA, json(metadata));
  return {
    metadata,
    files,
    byteDelta:
      [...files.values()].reduce((sum, bytes) => sum + Buffer.byteLength(bytes), 0) -
      [...originals.values()].reduce((sum, bytes) => sum + bytes.length, 0),
  };
}

export async function writeCurrentEntries(plan, destination) {
  for (const [relative, bytes] of plan.files) {
    const file = path.join(destination, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, bytes);
  }
}
