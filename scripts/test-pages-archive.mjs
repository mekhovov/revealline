import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { buildPages, pagesBytes } from './build-pages.mjs';
import { inspectPagesCapacity, PAGES_BUDGET_BYTES } from './pages-capacity.mjs';
import { planCurrentEntries } from './pages-current-entry.mjs';
import {
  MAX_ARCHIVE_SHARDS,
  validateArchivePlan,
  archiveRedirect,
  archiveRetirementWorker,
  assertPagesBudget,
} from './pages-archive.mjs';

const repository = 'owner/game',
  plan = {
    formatVersion: 1,
    shards: [{ id: 'archive-01', repository: 'owner/game-archive-01', versions: ['v0.1.0'] }],
  },
  canonical = 'https://owner.github.io/game-archive-01/releases/v0.1.0/site/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function files(directory, prefix = '') {
  const values = {};
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = prefix + entry.name,
      file = path.join(directory, entry.name);
    if (entry.isDirectory()) Object.assign(values, await files(file, name + '/'));
    else values[name] = hash(await fs.readFile(file));
  }
  return values;
}
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-pages-'));
  t.after(() => fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '--quiet');
  await fs.writeFile(path.join(root, 'package.json'), '{"version":"0.2.0"}\n');
  git('add', 'package.json');
  git(
    '-c',
    'user.name=Pages test',
    '-c',
    'user.email=pages@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'Fixture',
  );
  const revision = git('rev-parse', 'HEAD');
  const records = [];
  for (const version of ['v0.1.0', 'v0.2.0']) {
    git('tag', version);
    const directory = path.join(root, 'releases', version),
      site = path.join(directory, 'site');
    const assets = {
      'index.html': `<a href="game/">${version}</a>`,
      'game/index.html': `<script src="app.mjs" type="module"></script><p>${version}</p>`,
      'game/couch/index.html': '<a href="../">Solo</a>',
      'game/playground/index.html': '<a href="../">Practice</a>',
      'authoring/lab/index.html': '<a href="../../game/">Game</a>',
      'credits.html': 'Exact credits',
      'game/app.mjs': `export const version = '${version}';`,
      'game/art.bin': Buffer.from([0, 128, 255, version.length]),
      'service-worker.js': `/* exact ${version} worker */`,
    };
    for (const [relative, content] of Object.entries(assets)) {
      await fs.mkdir(path.dirname(path.join(site, relative)), { recursive: true });
      await fs.writeFile(path.join(site, relative), content);
    }
    const manifest = JSON.stringify({
      version,
      sourceRevision: revision,
      totalBytes: Object.values(assets).reduce(
        (sum, content) => sum + Buffer.byteLength(content),
        0,
      ),
      files: Object.entries(assets).map(([name, content]) => ({
        path: name,
        bytes: Buffer.byteLength(content),
        sha256: hash(content),
      })),
    });
    await fs.writeFile(path.join(site, 'manifest.json'), manifest);
    await fs.writeFile(path.join(site, 'distribution.zip'), 'Frozen ZIP; never replaced');
    await fs.writeFile(path.join(site, 'distribution.zip.sha256'), 'Exact ZIP checksum\n');
    const record = {
      formatVersion: 1,
      version,
      sourceRevision: revision,
      manifestSha256: hash(manifest),
      play: `${version}/site/game/`,
      download: `${version}/site/distribution.zip`,
    };
    await fs.writeFile(
      path.join(directory, 'release.json'),
      JSON.stringify(record, null, 2) + '\n',
    );
    records.push(record);
  }
  return { root, records, revision, git, options: { projectRoot: root, repository } };
}

test('read-only capacity matches the immutable-entry default build and cannot certify a hypothetical fit', async (t) => {
  const f = await fixture(t),
    before = await files(path.join(f.root, 'releases'));
  const measured = await inspectPagesCapacity({ ...f.options, nextPlayableBytes: 1_000_000_000 });
  const built = await buildPages(f.options);
  assert.equal(measured.totalBytes, built.totalBytes);
  assert.equal(measured.totalBytes, await pagesBytes(path.join(f.root, 'dist')));
  assert.equal(measured.files, Object.keys(await files(path.join(f.root, 'dist'))).length);
  assert.equal(measured.nextRelease.verdict, 'cannot-fit');
  assert.equal(
    measured.nextRelease.payloadOnlyMinimumBytes,
    measured.historicalPlayableBytes + 1_000_000_000,
  );
  assert.equal(measured.budgetBytes, PAGES_BUDGET_BYTES);
  const small = await inspectPagesCapacity({ ...f.options, nextPlayableBytes: 1 });
  assert.equal(small.nextRelease.verdict, 'requires-exact-build');
  assert.deepEqual(await files(path.join(f.root, 'releases')), before);
  for (const invalid of [0, -1, Infinity, '68', Number.MAX_SAFE_INTEGER])
    await assert.rejects(inspectPagesCapacity({ ...f.options, nextPlayableBytes: invalid }));
});

test('main routing declares every current override and preserves latest versioned bytes, old bridges and Release downloads', async (t) => {
  const f = await fixture(t),
    before = await files(path.join(f.root, 'releases')),
    tags = f.git('show-ref', '--tags');
  const report = await buildPages({ ...f.options, archivePlan: plan });
  assert.equal(report.target, 'main');
  assert.equal(report.redirectedHTMLFiles, 6);
  assert.equal(report.copiedVersions, 1);
  const old = path.join(f.root, 'releases/v0.1.0/site'),
    output = path.join(f.root, 'dist');
  const originalFiles = await files(old);
  for (const name of Object.keys(originalFiles).filter((name) => name.endsWith('.html'))) {
    const bridge = await fs.readFile(path.join(output, 'releases/v0.1.0/site', name), 'utf8');
    assert.ok(bridge.includes(canonical + name));
    assert.ok(bridge.includes('location.replace'));
  }
  for (const name of ['manifest.json', 'distribution.zip.sha256'])
    assert.equal(
      hash(await fs.readFile(path.join(output, 'releases/v0.1.0/site', name))),
      originalFiles[name],
    );
  await assert.rejects(fs.access(path.join(output, 'releases/v0.1.0/site/game/app.mjs')));
  const latest = await files(path.join(f.root, 'releases/v0.2.0/site'));
  const current = await planCurrentEntries({
    source: path.join(f.root, 'releases/v0.2.0/site'),
    repository,
    record: f.records[1],
  });
  const overrides = new Map(current.metadata.rootOverrides.map((entry) => [entry.path, entry]));
  assert.equal(report.currentHTMLAliases, 6);
  assert.equal(overrides.size, 7);
  assert.deepEqual(
    JSON.parse(await fs.readFile(path.join(output, 'current-entry-routing.json'))),
    current.metadata,
  );
  for (const [name, sha] of Object.entries(latest)) {
    if (name.startsWith('distribution.zip')) continue;
    const override = overrides.get(name);
    assert.equal(hash(await fs.readFile(path.join(output, name))), override?.sha256 || sha);
    if (override) assert.equal(override.sourceSha256, sha);
    assert.equal(hash(await fs.readFile(path.join(output, 'releases/v0.2.0/site', name))), sha);
  }
  const index = JSON.parse(await fs.readFile(path.join(output, 'releases/index.json')));
  assert.equal(index.releases[1].canonicalPlay, canonical + 'game/');
  assert.equal(index.releases[1].play, 'v0.1.0/site/game/');
  assert.equal(
    index.releases[1].download,
    'https://github.com/owner/game/releases/download/v0.1.0/distribution.zip',
  );
  assert.deepEqual(await files(path.join(f.root, 'releases')), before);
  assert.equal(f.git('show-ref', '--tags'), tags);
});

test('archive mode copies every canonical payload exactly, including original workers and checksums', async (t) => {
  const f = await fixture(t),
    before = await files(path.join(f.root, 'releases'));
  const report = await buildPages({ ...f.options, archivePlan: plan, archiveId: 'archive-01' });
  assert.equal(report.budgetBytes, 800_000_000);
  assert.equal(report.copiedVersions, 1);
  assert.equal(report.playableVersions, 1);
  assert.equal(report.catalogVersions, 2);
  assert.equal(report.latestHostedVersion, 'v0.1.0');
  const source = await files(path.join(f.root, 'releases/v0.1.0/site')),
    copied = await files(path.join(f.root, 'dist/releases/v0.1.0/site'));
  delete source['distribution.zip'];
  assert.deepEqual(copied, source);
  assert.deepEqual(
    await fs.readFile(path.join(f.root, 'dist/releases/v0.1.0/release.json')),
    await fs.readFile(path.join(f.root, 'releases/v0.1.0/release.json')),
  );
  await assert.rejects(fs.access(path.join(f.root, 'dist/releases/v0.2.0')));
  await assert.rejects(fs.access(path.join(f.root, 'dist/current-entry-routing.json')));
  assert.deepEqual(await files(path.join(f.root, 'releases')), before);
});

test('archive ownership rejects unknown/current/duplicate/cross-origin plans without changing published output', async (t) => {
  const f = await fixture(t);
  await buildPages(f.options);
  const before = await files(path.join(f.root, 'dist'));
  for (const change of [
    (p) => p.shards[0].versions.push('v0.2.0'),
    (p) => p.shards[0].versions.push('v0.9.0'),
    (p) => p.shards[0].versions.push('v0.1.0'),
    (p) => p.shards.push(structuredClone(p.shards[0])),
    (p) => (p.shards[0].repository = 'outsider/archive'),
    (p) => (p.shards[0].repository = repository),
    (p) => (p.shards[0].baseURL = 'https://outsider.invalid/'),
    (p) => (p.shards[0].budgetBytes = 2_000_000_000),
  ]) {
    const changed = structuredClone(plan);
    change(changed);
    assert.throws(() => validateArchivePlan(changed, f.records, repository, 'v0.2.0'));
    await assert.rejects(buildPages({ ...f.options, archivePlan: changed }));
  }
  await assert.rejects(buildPages({ ...f.options, archivePlan: plan, archiveId: 'missing' }));
  assert.deepEqual(await files(path.join(f.root, 'dist')), before);
});

test('redirects preserve encoded query and fragment and offer a native fallback link', () => {
  const target = canonical + 'game/playground/index.html',
    page = archiveRedirect(target),
    link = {};
  let destination;
  vm.runInNewContext(page.match(/<script>([\s\S]*?)<\/script>/)[1], {
    URL,
    location: {
      search: '?pack=Night+Shift&value=%3C%2Fscript%3E',
      hash: '#saved%20attempt',
      replace: (url) => (destination = url),
    },
    document: { querySelector: () => link },
  });
  assert.equal(destination, `${target}?pack=Night+Shift&value=%3C%2Fscript%3E#saved%20attempt`);
  assert.equal(link.href, destination);
  assert.ok(page.includes(`<a href="${target}">`));
});

test('retirement worker confines navigation and only unregisters after normal activation', async () => {
  const handlers = {},
    scope = 'https://owner.github.io/game/releases/v0.1.0/site/';
  let unregistered = 0;
  vm.runInNewContext(archiveRetirementWorker(canonical), {
    URL,
    Response,
    self: {
      registration: {
        scope,
        unregister: async () => {
          unregistered++;
        },
      },
      addEventListener: (type, handler) => (handlers[type] = handler),
    },
  });
  assert.deepEqual(Object.keys(handlers), ['activate', 'fetch']);
  assert.equal(unregistered, 0);
  let activation;
  handlers.activate({ waitUntil: (work) => (activation = work) });
  await activation;
  assert.equal(unregistered, 1);
  for (const [url, mode] of [
    [scope + 'game/app.mjs', 'cors'],
    ['https://outsider.invalid/game/', 'navigate'],
    ['https://owner.github.io/game/', 'navigate'],
    [scope + '//outsider.invalid/game-archive-01/releases/v0.1.0/site/game/', 'navigate'],
    [scope + 'https://outsider.invalid/game-archive-01/releases/v0.1.0/site/game/', 'navigate'],
  ])
    handlers.fetch({
      request: { url, mode },
      respondWith: () => assert.fail('Unrelated request intercepted'),
    });
  let response;
  handlers.fetch({
    request: { url: scope + 'game/?pack=old#view', mode: 'navigate' },
    respondWith: (value) => (response = value),
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), canonical + 'game/?pack=old#view');
});

test('stale tags and a late symlink failure retain the prior dist and frozen source', async (t) => {
  const f = await fixture(t);
  await buildPages(f.options);
  const before = await files(path.join(f.root, 'dist')),
    recordFile = path.join(f.root, 'releases/v0.1.0/release.json'),
    original = await fs.readFile(recordFile);
  await fs.writeFile(
    recordFile,
    JSON.stringify({ ...f.records[0], sourceRevision: '0'.repeat(40) }),
  );
  await assert.rejects(inspectPagesCapacity(f.options), /immutable tag/);
  await assert.rejects(buildPages({ ...f.options, archivePlan: plan }), /immutable tag/);
  await fs.writeFile(recordFile, original);
  await fs.symlink('app.mjs', path.join(f.root, 'releases/v0.1.0/site/game/link.mjs'));
  await assert.rejects(buildPages({ ...f.options, archivePlan: plan }), /symbolic links/);
  assert.deepEqual(await files(path.join(f.root, 'dist')), before);
  assert.deepEqual(await fs.readFile(recordFile), original);
  assert.ok(!(await fs.readdir(f.root)).some((name) => name.startsWith('.pages-staging-')));
  await assert.rejects(inspectPagesCapacity(f.options), /ordinary files/);
  await assert.rejects(
    buildPages({ ...f.options, outputDirectory: path.join(f.root, 'releases') }),
    /output/,
  );
});

test('main and archive byte budgets fail closed at their distinct fixed limits', () => {
  assert.equal(assertPagesBudget(950_000_000), 950_000_000);
  assert.equal(assertPagesBudget(800_000_000, true), 800_000_000);
  assert.throws(() => assertPagesBudget(950_000_001));
  assert.throws(() => assertPagesBudget(800_000_001, true));
  for (const value of [NaN, Infinity, -1, '1', 0.5]) assert.throws(() => assertPagesBudget(value));
});

test('a corrupted canonical payload fails its frozen manifest before replacing the last published tree', async (t) => {
  const f = await fixture(t);
  await buildPages({ ...f.options, archivePlan: plan });
  const before = await files(path.join(f.root, 'dist'));
  await fs.writeFile(path.join(f.root, 'releases/v0.1.0/site/game/art.bin'), 'corrupted');
  await assert.rejects(buildPages({ ...f.options, archivePlan: plan }), /Frozen asset mismatch/);
  assert.deepEqual(await files(path.join(f.root, 'dist')), before);
});

test('a reserved current-entry source path fails atomically without altering prior output or release tags', async (t) => {
  const f = await fixture(t);
  await buildPages(f.options);
  const before = await files(path.join(f.root, 'dist')),
    tags = f.git('show-ref', '--tags');
  await fs.writeFile(path.join(f.root, 'releases/v0.2.0/site/current-entry-routing.json'), '{}');
  await assert.rejects(buildPages(f.options), /Reserved or unsafe current entry/);
  assert.deepEqual(await files(path.join(f.root, 'dist')), before);
  assert.equal(f.git('show-ref', '--tags'), tags);
});

test('archive routing accepts 64, 65 and 96 distinct shards but refuses a 97th', () => {
  assert.equal(MAX_ARCHIVE_SHARDS, 96);
  const records = Array.from({ length: 98 }, (_, i) => ({ version: `v0.${i + 1}.0` }));
  const shards = records.slice(0, 97).map(({ version }, i) => ({
    id: `archive-${i + 1}`,
    repository: `owner/game-archive-${i + 1}`,
    versions: [version],
  }));
  for (const count of [64, 65, 96]) {
    const input = { formatVersion: 1, shards: shards.slice(0, count) };
    const original = structuredClone(input);
    const accepted = validateArchivePlan(input, records, repository, 'v0.98.0');
    assert.equal(accepted.length, count);
    assert.deepEqual(
      accepted.map((shard) => shard.versions[0]),
      records.slice(0, count).map((row) => row.version),
    );
    assert.ok(accepted.every((shard) => shard.budgetBytes === 800_000_000));
    assert.deepEqual(input, original);
  }
  assert.throws(
    () => validateArchivePlan({ formatVersion: 1, shards }, records, repository, 'v0.98.0'),
    /Invalid Pages archive plan/,
  );
  for (const [mutate, message] of [
    [(last) => (last.id = shards[0].id), /duplicate archive ID/],
    [(last) => (last.repository = 'another/game-archive-96'), /same GitHub account/],
    [(last) => (last.repository = shards[0].repository), /distinct repository/],
    [(last) => (last.versions = shards[0].versions), /duplicate or current archive version/],
    [(last) => (last.versions = ['v0.98.0']), /duplicate or current archive version/],
    [(last) => (last.versions = ['v0.999.0']), /Unknown/],
  ]) {
    const input = { formatVersion: 1, shards: structuredClone(shards.slice(0, 96)) };
    mutate(input.shards.at(-1));
    assert.throws(() => validateArchivePlan(input, records, repository, 'v0.98.0'), message);
  }
});
