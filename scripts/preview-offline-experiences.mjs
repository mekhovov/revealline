import http from 'node:http';
import path from 'node:path';
import { prepareBuildProject } from './game-cli.mjs';
import { downloadFiles } from '../game/download-catalogue.mjs';

// Serve the exact prepared build without allocating a second ~1 GB tree/ZIP.
// This runs normal build validation; it is not a release or device qualification.
const publicationProfile = process.argv.includes('--main-pages') ? 'main-pages' : null;
const built = await prepareBuildProject({ root: process.cwd(), publicationProfile });
const entries = new Map(built.entries.map((entry) => [entry.name, entry.bytes]));
const catalogue = JSON.parse(entries.get('offline-content.json'));
const core = JSON.parse(entries.get('offline-cache.json'));
const coreBytes = core.files.reduce((sum, file) => sum + file.bytes, 0);
const experiences = catalogue.groups.filter((group) =>
  ['community', 'experience'].includes(group.category),
);
console.log(
  JSON.stringify(
    {
      version: built.version,
      publicationProfile,
      buildId: core.buildId,
      payloadBytes: built.manifest.totalBytes,
      coreBytes,
      experiences: experiences.map((group) => ({
        id: group.id,
        files: downloadFiles(catalogue, [group.id]).length,
        bytesWithCore:
          coreBytes +
          downloadFiles(catalogue, [group.id]).reduce((sum, file) => sum + file.bytes, 0),
      })),
    },
    null,
    2,
  ),
);
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
};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1');
  let name = decodeURIComponent(url.pathname).slice(1);
  if (!name || name.endsWith('/')) name += 'index.html';
  const bytes = entries.get(name);
  console.log(`${request.method} ${url.pathname} ${bytes ? 200 : 404}`);
  if (!bytes) {
    response.writeHead(404);
    response.end('Not in this build');
    return;
  }
  response.writeHead(200, {
    'Content-Type': mime[path.extname(name)] || 'application/octet-stream',
    'Content-Length': bytes.length,
    'Cache-Control': 'no-store',
    // No external host can supply a missing dependency during this preview.
    'Content-Security-Policy':
      "default-src 'self' blob: data:; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob:; media-src 'self' blob:; worker-src 'self' blob:; object-src 'none'",
  });
  response.end(request.method === 'HEAD' ? undefined : bytes);
});
server.listen(8894, '127.0.0.1', () =>
  console.log('Offline preview: http://127.0.0.1:8894/game/downloads.html'),
);
