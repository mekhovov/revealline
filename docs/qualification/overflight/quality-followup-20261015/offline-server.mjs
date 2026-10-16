import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  prepareBuildProject,
  readBuildConfig,
  PREVIEW_SECURITY_HEADERS,
} from '../../../../scripts/game-cli.mjs';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const port = Number(process.env.OVERFLIGHT_OFFLINE_PORT ?? 8935);
assert.ok(Number.isInteger(port) && port > 1024 && port < 65536);
const reportName = process.env.OVERFLIGHT_OFFLINE_REPORT ?? 'native-offline-build.json';
assert.match(reportName, /^[a-z0-9][a-z0-9.-]*\.json$/);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const observedCommit = execFileSync('git', ['rev-parse', 'HEAD'], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const sourceRoots = ['game', 'site', 'authoring', 'optional-practice', 'scripts', 'publishing'];
const requireFrozenSources = () => {
  const changed = execFileSync(
    'git',
    ['diff', '--name-only', observedCommit, '--', ...sourceRoots],
    { cwd: root, encoding: 'utf8' },
  ).trim();
  const untracked = execFileSync(
    'git',
    ['ls-files', '--others', '--exclude-standard', '--', ...sourceRoots],
    { cwd: root, encoding: 'utf8' },
  ).trim();
  assert.equal(
    changed,
    '',
    `Commit runtime changes before preparing the qualification build:\n${changed}`,
  );
  assert.equal(
    untracked,
    '',
    `Commit runtime additions before preparing the qualification build:\n${untracked}`,
  );
};
requireFrozenSources();
const { version } = await readBuildConfig(root);
assert.match(version, /^v?\d+\.\d+\.\d+$/, 'Use the installable production project version.');
console.log(
  'Preparing authentic production entries in memory; no expanded site or ZIP will be written.',
);
const prepared = await prepareBuildProject({
  root,
  version,
  sourceRevision: observedCommit,
  publicationProfile: 'main-pages',
});
requireFrozenSources();
const files = new Map(prepared.entries.map((entry) => [entry.name, entry.bytes]));
const offline = JSON.parse(files.get('offline-cache.json'));
for (const pin of offline.files) {
  const bytes = files.get(pin.path);
  assert.ok(
    bytes && bytes.length === pin.bytes && hash(bytes) === pin.sha256,
    `generated cache pin: ${pin.path}`,
  );
}
const required = [
  'game/overflight/play.html',
  'game/overflight/raid.html',
  'game/overflight/raid-mode.mjs',
  'game/overflight/riy-mode.mjs',
  'game/overflight/raid-variants.mjs',
  'game/overflight/battlefields.mjs',
  'game/overflight/survival-hud.mjs',
  'game/overflight/world-audio.mjs',
  'game/overflight/upgrade-preview.mjs',
  'game/overflight/motion.mjs',
  'game/overflight/coordinated-movement.mjs',
  'game/presentation/overflight-world-art-v2.mjs',
];
for (const path of required)
  assert.ok(
    offline.files.some((file) => file.path === path),
    `${path} is in the actual mandatory cache`,
  );
const report = {
  evidence:
    'Unmodified prepareBuildProject output served from memory. No handcrafted cache manifest, bypassed validation, ZIP or site staging. Browser qualification is separate and uses the ordinary installed-app UI. Origin-unavailable mode returns503 for every build resource; the control endpoint remains available only to this localhost test host.',
  createdAt: new Date().toISOString(),
  observedCommit,
  sourceRevision: prepared.sourceRevision,
  sourceChanges: execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' })
    .trim()
    .split('\n'),
  version: prepared.version,
  buildId: offline.buildId,
  offlineFiles: offline.files.length,
  offlineBytes: offline.files.reduce((sum, file) => sum + file.bytes, 0),
  hostedFiles: files.size,
  hostedBytes: prepared.entries.reduce((sum, entry) => sum + entry.bytes.length, 0),
  manifestSha256: hash(prepared.manifestBytes),
  required: offline.files.filter((file) => required.includes(file.path)),
  url: `http://127.0.0.1:${port}/game/overflight/play.html?lang=en`,
};
await writeFile(
  new URL(`./${reportName}`, import.meta.url),
  `${JSON.stringify(report, null, 2)}\n`,
);
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.zip': 'application/zip',
};
let online = true,
  requests = 0,
  rejected = 0;
const server = createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const send = (status, body, headers = {}) => {
    res.writeHead(status, { ...PREVIEW_SECURITY_HEADERS, 'Cache-Control': 'no-store', ...headers });
    res.end(req.method === 'HEAD' ? undefined : body);
  };
  if (url.pathname === '/_qualification/network' && req.method === 'POST') {
    if (!['online', 'offline'].includes(url.searchParams.get('state')))
      return send(400, 'Unknown state');
    online = url.searchParams.get('state') === 'online';
    console.log(
      `Origin resources ${online ? 'available' : 'unavailable'} for offline qualification.`,
    );
    return send(200, JSON.stringify({ online, requests, rejected }), {
      'Content-Type': 'application/json',
    });
  }
  if (url.pathname === '/_qualification/status')
    return send(200, JSON.stringify({ ...report, online, requests, rejected }), {
      'Content-Type': 'application/json',
    });
  requests++;
  if (!online) {
    rejected++;
    return send(503, 'Qualification origin unavailable');
  }
  if (!['GET', 'HEAD'].includes(req.method)) return send(405, 'Method not allowed');
  let path;
  try {
    path = decodeURIComponent(url.pathname);
  } catch {
    return send(400, 'Malformed URL');
  }
  if (path.includes('\\') || path.split('/').some((part) => part.startsWith('.')))
    return send(403, 'Unsafe path');
  path = path.replace(/^\//, '');
  if (!path || path.endsWith('/')) path += 'index.html';
  const bytes = files.get(path);
  if (!bytes) return send(404, 'Not in generated build');
  send(200, bytes, {
    'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
    'Content-Length': bytes.length,
    'Service-Worker-Allowed': '/',
  });
});
await new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(port, '127.0.0.1', resolve);
});
console.log(
  JSON.stringify(
    { ...report, required: undefined, sourceChanges: undefined, status: 'ready' },
    null,
    2,
  ),
);
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
