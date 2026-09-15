#!/usr/bin/env node
/** Read-only HTTP audit. Output logs are the only writes; run only after archive-10 deployment. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = "/Users/oleksandr.mekhovov/work/my_projects/go_test/.cache/worktrees/archive10-v051-extension";
const TOOL = path.dirname(fileURLToPath(import.meta.url));
const APPROVED_BASE = 'https://mekhovov.github.io/revealline-archive-10/';
const APPROVED_AUTHORITY = path.join(ROOT, '.cache/extension051/public-authority');
let INVENTORY_SHA256;
const usage =
  'node audit-public.mjs --authority .cache/extension051/public-authority --base https://mekhovov.github.io/revealline-archive-10/ --commit FULL_COMMIT --inventory-sha SHA256 [--out NEW_CACHE_DIRECTORY | --check]';
const args = process.argv.slice(2),
  options = {};
while (args.length) {
  const key = args.shift();
  if (key === '--check' && !options[key]) {
    options[key] = true;
    continue;
  }
  const value = args.shift();
  if (
    !['--authority', '--out', '--base', '--inventory-sha', '--commit'].includes(key) ||
    !value ||
    options[key]
  )
    throw new Error(usage);
  options[key] = value;
}
if (
  !options['--authority'] ||
  !options['--base'] ||
  !/^[0-9a-f]{64}$/.test(options['--inventory-sha'] || '') ||
  !/^[0-9a-f]{40}$/.test(options['--commit'] || '') ||
  options['--commit'] !== 'adacdfbe15359bfd73e96ce03695b369b5097bc8' ||
  (!options['--check'] && !options['--out']) ||
  (options['--check'] && options['--out'])
)
  throw new Error(usage);
INVENTORY_SHA256 = options['--inventory-sha'];
if (INVENTORY_SHA256 !== '98e50fd1c31d9b3b50bbff006c651c63320335b075c29e5a48e605323d18241a') throw new Error('Unapproved archive inventory pin.');
const authority = path.resolve(options['--authority']);
const output = options['--out'] ? path.resolve(options['--out']) : null;
const base = new URL(options['--base']);
if (base.href !== APPROVED_BASE)
  throw new Error('This audit is confined to the approved archive-10 public origin/prefix.');
if (authority !== APPROVED_AUTHORITY)
  throw new Error('This audit requires the exact prepared archive-10 metadata authority directory.');
if (
  output &&
  (!output.startsWith(path.join(ROOT, '.cache/extension051') + path.sep) ||
    output === authority ||
    output.startsWith(authority + path.sep) ||
    output === TOOL ||
    output.startsWith(TOOL + path.sep))
)
  throw new Error(
    'Use a new audit directory under .cache/extension051, outside the authority and helper.',
  );
if (output) await fs.mkdir(output); // Exclusive: preserve every prior run/failure.
const startedAt = new Date().toISOString(),
  inventory = [],
  skipped = [];

const hashFile = async (file) => {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
};
async function readPinned(file, bytes, sha256) {
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.size !== bytes) throw new Error(`Changed ordinary authority: ${file}`);
  const raw = await fs.readFile(file);
  if (raw.length !== bytes || createHash('sha256').update(raw).digest('hex') !== sha256)
    throw new Error(`Changed authority hash: ${file}`);
  return raw;
}
async function loadAuthority(target = inventory) {
  // Exact selected expectations, independently reproduced by the completed hosted job.
  const canonicalRows = [];
  {
    const raw = await readPinned(path.join(authority, 'v0.42.0-canonical-inventory.json'), 67935, 'cc8699cee4e57bcdef0eec39d557ca2090e0922fff4ed8b74e6fbf03eb5a2e18');
    const selected = JSON.parse(raw);
    if (selected.version !== 'v0.42.0' || selected.files.length !== 353 ||
        selected.files.reduce((n, r) => n + r.bytes, 0) !== 310496669 ||
        selected.files.some((r) => !r.path.startsWith('releases/v0.42.0/')))
      throw new Error('Pinned v0.42.0 canonical expectation differs.');
    canonicalRows.push(...selected.files);
  }
  {
    const raw = await readPinned(path.join(authority, 'v0.51.0-canonical-inventory.json'), 128255, '275802bc19ae73dd86b9afb1d0a14ef4e9c9c4241331fdc7278c615b033f730e');
    const selected = JSON.parse(raw);
    if (selected.version !== 'v0.51.0' || selected.files.length !== 618 ||
        selected.files.reduce((n, r) => n + r.bytes, 0) !== 323016788 ||
        selected.files.some((r) => !r.path.startsWith('releases/v0.51.0/')))
      throw new Error('Pinned v0.51.0 canonical expectation differs.');
    canonicalRows.push(...selected.files);
  }
  const globals = [
  {
    "path": ".nojekyll",
    "bytes": 0,
    "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  {
    "path": "archive-routing.json",
    "bytes": 16543,
    "sha256": "3583ea8888ff218ac3220057909fe3617f71fcf9fe9205117c0f302537d2eadf"
  },
  {
    "path": "index.html",
    "bytes": 144,
    "sha256": "20514a86c4a483d992f9a4feeda2ca0298d0c123b5428a3d209d6b77cd1ebdfb"
  },
  {
    "path": "releases/index.html",
    "bytes": 1099,
    "sha256": "3925c439c223d309dbe4facbdb2df8a1c5d81c568e3ef232d6406c9b913497e4"
  },
  {
    "path": "releases/index.json",
    "bytes": 1184,
    "sha256": "27653cef341794fcb94535336e80973de586777a6950587d646af13774ca8954"
  }
];
  for (const row of globals) await readPinned(path.join(authority, row.path), row.bytes, row.sha256);
  const rows = [...canonicalRows, ...globals].sort((a,b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const seen = new Set();
  for (const row of rows) {
    const parts = row.path.split('/');
    if (!row.path || row.path.includes('\\') || parts.some((p) => !p || p === '.' || p === '..') ||
        /[\x00-\x1f]/.test(row.path) || seen.has(row.path) ||
        !Number.isSafeInteger(row.bytes) || row.bytes < 0 || row.bytes > 256 * 1024 * 1024 ||
        !/^[a-f0-9]{64}$/.test(row.sha256)) throw new Error('Unsafe or duplicate canonical authority row.');
    seen.add(row.path);
  }
  const hidden = rows.filter((r) => r.path.split('/').some((p) => p.startsWith('.'))).map((r) => r.path);
  if (JSON.stringify(hidden) !== JSON.stringify([".nojekyll", "releases/v0.42.0/site/.xonix-build.json", "releases/v0.51.0/site/.xonix-build.json"]))
    throw new Error('Hidden canonical authority differs.');
  target.push(...rows);
}

function expectedTypes(file) {
  const extension = path.extname(file).toLowerCase();
  if (['.nojekyll', '_headers'].includes(path.basename(file)))
    return ['application/octet-stream', 'text/plain'];
  const types = {
    '.html': ['text/html'],
    '.css': ['text/css'],
    '.js': ['text/javascript', 'application/javascript'],
    '.mjs': ['text/javascript', 'application/javascript'],
    '.json': ['application/json'],
    '.webmanifest': ['application/manifest+json', 'application/json'],
    '.png': ['image/png'],
    '.jpg': ['image/jpeg'],
    '.jpeg': ['image/jpeg'],
    '.svg': ['image/svg+xml'],
    '.woff': ['font/woff', 'application/font-woff'],
    '.woff2': ['font/woff2'],
    '.mp3': ['audio/mpeg'],
    '.wav': ['audio/wav', 'audio/x-wav'],
    '.mp4': ['video/mp4'],
    '.webm': ['video/webm'],
    '.ttf': ['font/ttf', 'application/x-font-ttf', 'application/font-sfnt'],
    '.md': ['text/markdown', 'text/plain'],
    '.txt': ['text/plain'],
    '.pb': ['application/octet-stream'],
    '.rlmedia': ['application/octet-stream'],
    '.rlstory': ['application/octet-stream'],
    '.sha256': ['application/octet-stream', 'text/plain'],
  }[extension];
  if (!types) throw new Error(`Unreviewed artifact Content-Type category: ${file}`);
  return types;
}

let completed = 0,
  verifiedBytes = 0,
  lastProgress = 0;
const results = [],
  attempts = [];
let chain = Promise.resolve();
const append = (file, value) => {
  chain = chain.then(() => fs.appendFile(path.join(output, file), JSON.stringify(value) + '\n'));
  return chain;
};
function progress() {
  if (Date.now() - lastProgress < 2000 && completed !== inventory.length) return;
  lastProgress = Date.now();
  process.stderr.write(
    `${new Date().toISOString()} ${completed}/${inventory.length} files; ${verifiedBytes} verified bytes; ${results.filter((r) => !r.ok).length} final failures\n`,
  );
}
async function inspect(file, attempt) {
  const url = new URL(file.path.split('/').map(encodeURIComponent).join('/'), base).href;
  const row = {
    path: file.path,
    url,
    attempt,
    expectedBytes: file.bytes,
    expectedSha256: file.sha256,
    startedAt: new Date().toISOString(),
  };
  let response, reader;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(90_000),
    });
    row.status = response.status;
    row.contentType = response.headers.get('content-type');
    row.contentEncoding = response.headers.get('content-encoding');
    row.etag = response.headers.get('etag');
    row.retryAfter = response.headers.get('retry-after');
    if (response.status !== 200 || response.redirected || response.type === 'opaque') {
      await response.body?.cancel();
      throw new Error(`Expected direct HTTP 200, received ${response.status}`);
    }
    const allowed = expectedTypes(file.path),
      type = (row.contentType || '').split(';')[0].trim().toLowerCase();
    const hash = createHash('sha256');
    let length = 0;
    if (response.body) {
      reader = response.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > file.bytes)
          throw new Error(`Decoded body exceeds expected ${file.bytes} bytes`);
        hash.update(value);
      }
    }
    row.bytes = length;
    row.sha256 = hash.digest('hex');
    row.bytesMatch = length === file.bytes;
    row.hashMatch = row.sha256 === file.sha256;
    row.contentTypeAccepted = allowed.includes(type);
    row.ok = row.bytesMatch && row.hashMatch && row.contentTypeAccepted !== false;
    if (!row.ok) row.error = 'Body size/hash or required runtime Content-Type mismatch';
  } catch (error) {
    row.ok = false;
    row.error = `${error.name}: ${error.message}`;
    row.transportError =
      !response || ['AbortError', 'TimeoutError', 'TypeError'].includes(error.name);
    try {
      if (reader) await reader.cancel();
      else await response?.body?.cancel();
    } catch {}
  } finally {
    reader?.releaseLock();
  }
  row.finishedAt = new Date().toISOString();
  return row;
}

try {
  const runnerSha256 = await hashFile(fileURLToPath(import.meta.url));
  await loadAuthority();
  if (!inventory.length) throw new Error('Empty authority');
  const expectedBytes = inventory.reduce((sum, file) => sum + file.bytes, 0);
  const expectedRaw = await fs.readFile(path.join(TOOL, 'expected-inventory.json'));
  if (createHash('sha256').update(expectedRaw).digest('hex') !== INVENTORY_SHA256)
    throw new Error('Prepared inventory pin differs.');
  const expected = JSON.parse(expectedRaw);
  const actualFiles = inventory
    .map(({ path, bytes, sha256 }) => ({ path, bytes, sha256 }))
    .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  const expectedFiles = [...expected.files].sort((a, b) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
  );
  if (
    expected.base !== APPROVED_BASE ||
    expected.format !== 'revealline-archive-inventory.v1' ||
    expected.sourceInventorySha256 !== '7f0a982e8c1c8ea84e8b1bbf2d83d5705be399a2c28116471f1961128f85c62f' ||
    expected.fileCount !== 976 ||
    expected.totalBytes !== 633532427 ||
    expected.sourceCommit !== options['--commit'] ||
    JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles) ||
    expected.fileCount !== inventory.length ||
    expected.totalBytes !== expectedBytes
  )
    throw new Error('Accepted inventory-derived authority differs from the exact prepared archive-10 canonical inventory.');
  for (const file of inventory) expectedTypes(file.path); // Every file has a reviewed MIME rule.
  if (options['--check']) {
    process.stdout.write(
      JSON.stringify(
        {
          status: 'PREPARED_AUTHORITY_ONLY',
          localArtifactBuild: false,
          base: base.href,
          authority,
          files: inventory.length,
          expectedBytes,
          inventorySha256: INVENTORY_SHA256,
          hiddenFiles: inventory
            .filter((f) => f.path.split('/').some((p) => p.startsWith('.')))
            .map((f) => f.path),
          networkRequests: 0,
        },
        null,
        2,
      ) + '\n',
    );
  } else {
    await fs.writeFile(
      path.join(output, 'inventory.json'),
      JSON.stringify(
        {
          authority,
          base: base.href,
          startedAt,
          concurrency: 8,
          expectedBytes,
          files: inventory,
          skipped,
        },
        null,
        2,
      ) + '\n',
    );
    let next = 0;
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        for (;;) {
          const index = next++;
          if (index >= inventory.length) return;
          const file = inventory[index];
          let row;
          for (let attempt = 1; attempt <= 3; attempt++) {
            row = await inspect(file, attempt);
            attempts.push(row);
            await append('attempts.jsonl', row);
            // Retry only transient transport/server failures; retain every attempt. Hash/MIME/404 failures never retry.
            const transient = row.transportError || row.status === 429 || row.status >= 500;
            if (row.ok || !transient || attempt === 3) break;
            const serverDelay = /^\d+$/.test(row.retryAfter || '')
              ? Number(row.retryAfter) * 1000
              : 0;
            await new Promise((resolve) =>
              setTimeout(resolve, Math.min(60_000, Math.max(attempt * 2000, serverDelay))),
            );
          }
          results.push(row);
          if (row.ok) verifiedBytes += file.bytes;
          completed++;
          await append('results.jsonl', row);
          progress();
        }
      }),
    );
    await chain;
    const after = [];
    await loadAuthority(after);
    const beforeByPath = new Map(inventory.map((file) => [file.path, file]));
    const afterByPath = new Map(after.map((file) => [file.path, file]));
    const localAuthorityChanges = [...new Set([...beforeByPath.keys(), ...afterByPath.keys()])].filter(
      (name) => JSON.stringify(beforeByPath.get(name)) !== JSON.stringify(afterByPath.get(name)),
    );
    const inventoryPinUnchanged =
      (await hashFile(path.join(TOOL, 'expected-inventory.json'))) === INVENTORY_SHA256;
    const runnerUnchanged = (await hashFile(fileURLToPath(import.meta.url))) === runnerSha256;
    const failed = results.filter((row) => !row.ok),
      ok =
        failed.length === 0 &&
        localAuthorityChanges.length === 0 &&
        inventoryPinUnchanged &&
        runnerUnchanged;
    const report = {
      status: ok ? 'PASS' : 'FAIL',
      startedAt,
      finishedAt: new Date().toISOString(),
      base: base.href,
      authority,
      selectedVersions: ['v0.42.0', 'v0.51.0'],
      sourceCommit: expected.sourceCommit,
      expectedInventorySha256: INVENTORY_SHA256,
      localArtifactBuild: false,
      authorityMode: 'Two pinned canonical inventories plus five exact generated globals; hosted original-source and artifact reproduction passed separately.',
      originalCanonicalWorkerBytesIncluded: true,
      mainBridgeBytesIncluded: false,
      concurrency: 8,
      files: inventory.length,
      expectedBytes,
      verifiedBytes,
      failedFiles: failed.length,
      retries: attempts.length - inventory.length,
      skipped,
      localAuthorityChanges,
      preparedInventoryPinUnchanged: inventoryPinUnchanged,
      runnerSha256,
      runnerUnchanged,
      allocationSha256: '7f6f8f80efa3e85e7487555a46f11aa2645d69da005f59c4d84152937e6f3313',
      failures: failed,
      boundaries:
        'Exact decoded HTTP bodies and runtime MIME only. No browser execution, offline migration, storage, physical-device or release-readiness certification.',
    };
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    if (!ok) process.exitCode = 1;
  }
} catch (error) {
  await chain.catch(() => {});
  if (output)
    await fs.writeFile(
      path.join(output, 'fatal.json'),
      JSON.stringify(
        {
          status: 'FAIL',
          startedAt,
          finishedAt: new Date().toISOString(),
          error: `${error.name}: ${error.message}`,
          completed,
        },
        null,
        2,
      ) + '\n',
    );
  throw error;
}
