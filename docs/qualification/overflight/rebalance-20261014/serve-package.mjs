/** Canonical offline package preview; no expanded distribution is written. */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { prepareBuildProject } from '../../../../scripts/game-cli.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const port = Number(process.argv[2] || 8901);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error('Invalid preview port');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function inventory(directory) {
  const results = [];
  for (const entry of await readdir(path.join(root, directory), { withFileTypes: true })) {
    const name = path.posix.join(directory, entry.name);
    if (entry.isDirectory()) results.push(...(await inventory(name)));
    else if (entry.isFile())
      results.push({ path: name, sha256: sha256(await readFile(path.join(root, name))) });
  }
  return results;
}
async function sources() {
  const groups = await Promise.all(
    ['game/overflight', 'game/studio', 'game/community', 'game/i18n', 'game/locales'].map(
      inventory,
    ),
  );
  return groups.flat().sort((a, b) => a.path.localeCompare(b.path));
}
const before = await sources();
const prepared = await prepareBuildProject({
  root,
  publicationProfile: 'main-pages',
  sourceRevision: null,
});
const after = await sources();
const initialHashes = new Map(before.map((entry) => [entry.path, entry.sha256]));
const changedDuringPreparation = after
  .filter((entry) => initialHashes.get(entry.path) !== entry.sha256)
  .map((entry) => entry.path);
const entries = new Map(prepared.entries.map((entry) => [entry.name, entry.bytes]));
const cache = JSON.parse(entries.get('offline-cache.json'));
const receipt = {
  sourceRevision: null,
  baseRevision: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  note: 'Built with sourceRevision:null; manifest and runtime source hashes pin exact served bytes.',
  profile: 'main-pages',
  version: prepared.version,
  buildId: cache.buildId,
  origin: `http://127.0.0.1:${port}`,
  files: prepared.entries.length,
  totalBytes: prepared.manifest.totalBytes,
  coreFiles: cache.files.length,
  coreBytes: cache.files.reduce((sum, file) => sum + file.bytes, 0),
  changedDuringPreparation,
};
const receipts = new Map([
  ['build.json', Buffer.from(JSON.stringify(receipt, null, 2) + '\n')],
  ['build-manifest.json', prepared.manifestBytes],
  [
    'build-source.json',
    Buffer.from(
      JSON.stringify({ sourceRevision: null, before, after, changedDuringPreparation }, null, 2) +
        '\n',
    ),
  ],
]);
async function persistReceipts() {
  for (const [name, bytes] of receipts) {
    let attempts = 0;
    for (;;) {
      try {
        await writeFile(new URL('./' + name, import.meta.url), bytes);
        break;
      } catch (error) {
        if (error.code !== 'ENOSPC') throw error;
        if (attempts++ % 30 === 0)
          console.log(
            `Receipt awaiting disk capacity: ${name}; prepared package remains in memory and is served.`,
          );
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }
  console.log('All qualification receipts saved.');
}
const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};
const server = http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405);
    response.end();
    return;
  }
  let name;
  try {
    name = decodeURIComponent(new URL(request.url, receipt.origin).pathname).slice(1);
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  if (!name || name.endsWith('/')) name += 'index.html';
  const bytes = name.startsWith('__qualification__/')
    ? receipts.get(name.slice('__qualification__/'.length))
    : entries.get(name);
  if (!bytes) {
    console.log(`Missing from prepared package: ${name}`);
    response.writeHead(404);
    response.end('Not in this prepared build');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mime[path.extname(name)] || 'application/octet-stream',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    'Content-Security-Policy':
      "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'",
  });
  response.end(request.method === 'HEAD' ? undefined : bytes);
});
server.listen(port, '127.0.0.1', () => {
  console.log(JSON.stringify(receipt, null, 2));
  void persistReceipts().catch((error) =>
    console.error('Receipt error; package remains served:', error),
  );
});
process.on('SIGTERM', () => server.close(() => process.exit(0)));
process.on('SIGINT', () => server.close(() => process.exit(0)));
