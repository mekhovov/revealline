import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  readPinnedPackageFile,
  publishedPackageReport,
} from './report-published-offline-packages.mjs';
import { packageReportMarkdown } from './report-offline-packages.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bytes = Buffer.from('complete verified metadata');
const pin = { bytes: bytes.length, sha256: digest(bytes) };
const url = 'https://example.invalid/offline-cache.json';

test('published metadata reader checks every byte and requests uncached, bounded responses', async () => {
  const read = await readPinnedPackageFile(url, pin, {
    fetchImpl: async (actual, options) => {
      assert.equal(actual, url);
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      return new Response(bytes);
    },
  });
  assert.deepEqual(read, bytes);
});

test('published metadata rejects corrupt, short, oversized and failed responses', async () => {
  for (const [body, expected] of [
    [Buffer.alloc(bytes.length), /hash differs/],
    [bytes.subarray(1), /size differs/],
    [Buffer.concat([bytes, bytes]), /exceeds pinned size/],
  ])
    await assert.rejects(
      readPinnedPackageFile(url, pin, {
        fetchImpl: async () => new Response(body),
      }),
      expected,
    );
  await assert.rejects(
    readPinnedPackageFile(url, pin, {
      fetchImpl: async () => new Response('missing', { status: 404 }),
    }),
    /Cannot read published metadata/,
  );
  await assert.rejects(
    readPinnedPackageFile(
      url,
      { ...pin, bytes: 17 * 1024 ** 2 },
      {
        fetchImpl: async () => assert.fail('An oversized pin must not start a transfer.'),
      },
    ),
  );
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-package-metadata-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const version = 'v0.1.0';
  const directory = path.join(root, 'publishing/pages-controller/metadata', version);
  await fs.mkdir(directory, { recursive: true });
  const picture = { path: 'art.png', sha256: 'picture', bytes: 100, kind: 'gameplay' };
  const music = { path: 'music.mp3', sha256: 'music', bytes: 1000, kind: 'soundtrack' };
  const catalogue = {
    format: 'revealline-offline-content.v2',
    version,
    files: [picture, music],
    missions: [{ missionId: 'opening', groups: ['solo:horizon-starter'] }],
    groups: [
      { id: 'base', kind: 'gameplay', requires: [], files: ['art.png'] },
      { id: 'music', kind: 'soundtrack', requires: [], files: ['music.mp3'] },
    ],
  };
  const bodies = new Map(
    Object.entries({
      'offline-content.json': JSON.stringify(catalogue),
      'offline-cache.json': JSON.stringify({
        version,
        buildId: 'build',
        files: [{ path: 'index.html', sha256: 'core', bytes: 10 }],
      }),
      'app/service-worker.js':
        'const CONFIG = {"files":[{"path":"app/index.html","sha256":"launcher","bytes":5}]};\n',
    }).map(([name, body]) => [name, Buffer.from(body)]),
  );
  const manifest = {
    version,
    sourceRevision: 'source',
    totalBytes: 1115,
    files: [...bodies].map(([name, body]) => ({
      path: name,
      bytes: body.length,
      sha256: digest(body),
    })),
  };
  const manifestBytes = JSON.stringify(manifest);
  const release = {
    version,
    sourceRevision: manifest.sourceRevision,
    manifestSha256: digest(manifestBytes),
    distributionSha256: 'archive-sha',
  };
  await fs.writeFile(path.join(directory, 'manifest.json'), manifestBytes);
  await fs.writeFile(path.join(directory, 'release.json'), JSON.stringify(release));
  await fs.writeFile(
    path.join(directory, 'distribution.zip.sha256'),
    'archive-sha  distribution.zip\n',
  );
  const fetched = [];
  return {
    root,
    version,
    directory,
    fetched,
    bodies,
    fetchImpl: async (url) => {
      fetched.push(url);
      const name = url.split('/site/')[1];
      assert.ok(bodies.has(name), 'Only pinned metadata may be downloaded.');
      return new Response(bodies.get(name));
    },
  };
}

test('frozen report measures game separately from music and binds the exact metadata pins', async (t) => {
  const f = await fixture(t);
  const report = await publishedPackageReport(f.version, f);
  assert.equal(f.fetched.length, 3);
  assert.equal(report.packages.starter.storedPayloadBytes, 115);
  assert.equal(report.packages.allCurrent.storedPayloadBytes, 115);
  assert.equal(report.packages.soundtracks.storedPayloadBytes, 1000);
  assert.deepEqual(report.currentGameplay.officialBytesByExtension, { '.png': 100 });
  assert.equal(report.currentGameplay.mp3Files, 0);
  assert.equal(report.evidence.verifiedFiles.length, 3);
  assert.equal(report.sourceRevision, 'source');
  const markdown = packageReportMarkdown(report, { command: 'repeat this measurement' });
  assert.ok(markdown.includes('repeat this measurement'));
  assert.ok(markdown.includes(report.evidence.scope));
  assert.ok(!markdown.includes('development build measurement'));
});

test('modified local frozen manifest fails before any network request', async (t) => {
  const f = await fixture(t);
  await fs.appendFile(path.join(f.directory, 'manifest.json'), ' ');
  await assert.rejects(publishedPackageReport(f.version, f), /Frozen manifest differs/);
  assert.equal(f.fetched.length, 0);
});

test('modified published catalogue fails instead of producing new size claims', async (t) => {
  const f = await fixture(t);
  const body = f.bodies.get('offline-content.json');
  const changed = Buffer.from(body);
  changed[0] ^= 1;
  f.bodies.set('offline-content.json', changed);
  await assert.rejects(publishedPackageReport(f.version, f), /hash differs/);
});
