#!/usr/bin/env node
// Manual qualification only; the production host does not import this fixture.
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const opts = {},
  args = process.argv.slice(2);
for (let i = 0; i < args.length; i += 2) {
  assert(['--player', '--out', '--admitted'].includes(args[i]) && args[i + 1]);
  opts[args[i].slice(2)] = args[i + 1];
}
assert(opts.player && opts.out);
const player = await fs.realpath(opts.player),
  out = path.resolve(opts.out);
assert(!(await fs.stat(out).catch(() => null)), 'Never replace a frozen fixture');
const hash = (b) => createHash('sha256').update(b).digest('hex');
const descriptor = await fs.readFile(path.join(player, 'optional-package.json'));
const manifest = JSON.parse(descriptor);
assert.equal(manifest.id, 'fpv-worlds');
assert.equal(manifest.engineCommit, opts.admitted ?? '248b8d9af1b082c283a2cbd9501ea8d906f83374');
const files = [
  ...manifest.files,
  { path: 'optional-package.json', bytes: descriptor.length, sha256: hash(descriptor) },
];
assert.equal(files.length, 102);
const overlays = new Map();
if (!opts.admitted)
  for (const name of ['world-app.mjs', 'world-reaction-runtime.mjs']) {
    const file = 'optional-practice/civilian-fpv/' + name;
    overlays.set(file, await fs.readFile(path.join(root, file)));
  }
const staged = [];
for (const f of files) {
  assert(!path.isAbsolute(f.path) && !f.path.split('/').includes('..'));
  const source = await fs.realpath(path.join(player, f.path)),
    bytes = await fs.readFile(source);
  assert(source.startsWith(player + path.sep));
  assert(bytes.length === f.bytes && hash(bytes) === f.sha256, f.path);
  staged.push({ ...f, source });
}
await fs.mkdir(out);
for (const f of staged) {
  const target = path.join(out, 'player', f.path);
  await fs.mkdir(path.dirname(target), { recursive: true });
  if (overlays.has(f.path)) await fs.writeFile(target, overlays.get(f.path), { flag: 'wx' });
  else await fs.link(f.source, target);
}
const asset = {
  id: 'creator-industrial-split-level',
  title: ['Industrial starter · Split level', 'Промисловий початок · Два рівні'],
  revision: 'r1',
  commit: '1120b649456b2f20f134558a4f736fe515484f4c',
  path: 'authoring/fpv-worlds/library/fixtures/industrial-split-level.r1.rlpack',
  sha256: '311b04890037f6b5681dd1fd0067f72292a888bfd2e8cb5b605e8de707aa8711',
  bytes: 17072,
  courses: 1,
};
const setup = await fs.readFile(new URL('host-setup.js', import.meta.url), 'utf8');
const html = (await fs.readFile(path.join(player, manifest.entry), 'utf8')).replace(
  '<head>',
  `<head><script>${setup}</script><script type="module">window.fixtureModules=Promise.all(['world-content.mjs','world-store.mjs'].map(x=>import('../civilian-fpv/'+x)));</script>`,
);
const hostPath = 'player/optional-practice/fpv-worlds/fixture-host.html';
await fs.writeFile(path.join(out, hostPath), html, { flag: 'wx' });
for (const file of ['index.html', 'browser-harness.mjs'])
  await fs.copyFile(
    new URL(file, import.meta.url),
    path.join(out, file),
    fs.constants.COPYFILE_EXCL,
  );
const pack = await fs.readFile(path.join(root, asset.path));
assert(pack.length === asset.bytes && hash(pack) === asset.sha256);
await fs.writeFile(path.join(out, 'pack.rlpack'), pack, { flag: 'wx' });
const fixture = {
  format: 'FPVWorldLibraryFixture.v1',
  kind: opts.admitted ? 'admitted-package' : 'source-overlay',
  head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  admittedSource: manifest.engineCommit,
  packageRevision: manifest.revision,
  files,
  overlays: [...overlays].map(([path, b]) => ({ path, bytes: b.length, sha256: hash(b) })),
  asset,
  browserSources: await Promise.all(
    ['index.html', 'browser-harness.mjs', hostPath, 'pack.rlpack'].map(async (p) => {
      const b = await fs.readFile(path.join(out, p));
      return { path: p, bytes: b.length, sha256: hash(b) };
    }),
  ),
  limits: [
    'Actual native host/IndexedDB and unchanged production clock. Only named catalogue/network fault responses and isolated storage names are injected.',
    'Successful pack download uses the actual immutable first-party HTTPS URL. The production catalogue remains empty.',
    'Timeout callback is explicitly injected, not a claim of two-minute wall-clock endurance. No offline, finished-world, flight-completion or FPS claim.',
  ],
};
await fs.writeFile(path.join(out, 'fixture.json'), JSON.stringify(fixture, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    output: out,
    kind: fixture.kind,
    files: files.length,
    overlays: fixture.overlays,
    asset,
  }),
);
