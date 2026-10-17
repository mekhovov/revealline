import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { finalizeOfflineContent } from './offline-finalize.mjs';
import { addOfflineEntries, applyPublicationProfile } from './game-cli.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = fileURLToPath(new URL('../', import.meta.url));
const build = async (body = 'optional') => {
  const entries = [
    { name: 'game/offline.mjs', bytes: Buffer.from('export {};') },
    {
      name: 'game/index.html',
      bytes: Buffer.from('<html><head></head><body>main</body></html>'),
    },
    {
      name: 'game/tools/index.html',
      bytes: Buffer.from('<html><head></head><body>' + body + '</body></html>'),
    },
    { name: 'game/optional.json', bytes: Buffer.from('{"fixture":true}') },
  ];
  await addOfflineEntries(
    root,
    entries,
    { version: 'v1.0.0', sourceRevision: 'a'.repeat(40) },
    { optionalOffline: [] },
    [],
    ['game/tools/index.html', 'game/optional.json'],
  );
  return new Map(entries.map((entry) => [entry.name, entry.bytes]));
};

test('optional HTML descriptors bind final emitted bytes in catalogue, worker and core', async () => {
  const output = await build();
  const config = JSON.parse(output.get('offline-cache.json'));
  const catalogue = JSON.parse(output.get('offline-content.json'));
  const final = output.get('game/tools/index.html');
  assert.match(final.toString(), new RegExp(config.buildId));
  assert.ok(!config.files.some((file) => file.path === 'game/tools/index.html'));
  assert.equal(config.downloadFiles.length, 2);
  for (const file of config.downloadFiles) {
    const bytes = output.get(file.path);
    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, hash(bytes));
    assert.deepEqual(
      catalogue.files.find((row) => row.path === file.path),
      file,
    );
  }
  for (const file of config.files) {
    const bytes = output.get(file.path);
    assert.equal(file.bytes, bytes.length);
    assert.equal(file.sha256, hash(bytes));
  }
  const worker = output.get('service-worker.js').toString();
  const embedded = JSON.parse(worker.match(/const CONFIG = (\{[^\n]+\});/)[1]);
  assert.deepEqual(embedded, config);
  assert.deepEqual([...(await build())], [...output]);
  const changed = await build('changed optional HTML');
  assert.notEqual(JSON.parse(changed.get('offline-cache.json')).buildId, config.buildId);
});

test('finalization preserves ownership and soundtrack pins and rejects incomplete input atomically', () => {
  const bytes = Buffer.from('final HTML'),
    file = { path: 'game/tool.html', kind: 'gameplay', bytes: 1, sha256: 'old' };
  const music = {
    path: 'soundtrack:one',
    kind: 'soundtrack',
    bytes: 3,
    sha256: 'b'.repeat(64),
  };
  const catalogue = {
    files: [file, music],
    groups: [{ id: 'tooling:workshop', files: [file.path] }],
    originals: [],
  };
  const groups = structuredClone(catalogue.groups),
    soundtrack = structuredClone(music);
  const entries = [{ name: file.path, bytes }];
  assert.equal(finalizeOfflineContent(entries, catalogue), catalogue);
  assert.deepEqual(file, {
    path: file.path,
    kind: 'gameplay',
    bytes: bytes.length,
    sha256: hash(bytes),
  });
  assert.deepEqual(catalogue.groups, groups);
  assert.deepEqual(music, soundtrack);
  for (const invalid of [
    { entries: [...entries, ...entries], files: [file] },
    { entries, files: [file, file] },
    { entries, files: [{ ...file, path: 'missing' }] },
    { entries: [{ name: file.path, bytes: Buffer.alloc(0) }], files: [file] },
    { entries, files: [{ ...file, kind: 'unknown' }] },
    {
      entries: [{ name: 'offline-content.json', bytes }],
      files: [{ ...file, path: 'offline-content.json' }],
    },
  ])
    assert.throws(() => finalizeOfflineContent(invalid.entries, { files: invalid.files }));
  const stale = { ...file, bytes: 1, sha256: 'old' };
  assert.throws(() =>
    finalizeOfflineContent(entries, { files: [stale, { ...file, path: 'missing' }] }),
  );
  assert.equal(stale.sha256, 'old');
});

// This suite is explicitly selected by offline-final-bytes for game-cli changes.
// These main-only projections must never change complete release distributions.
const canonicalPaths = ['en', 'uk'].flatMap((language) =>
  [
    'common',
    'content',
    'controllerEditor',
    'demo',
    'errors',
    'gameplay',
    'interface',
    'tools',
    'website',
  ].map((namespace) => `game/locales/${language}/${namespace}.json`),
);
const canonicalFixture = () => ({
  entries: [
    ...[
      'game/live.json',
      'game/archive.json',
      'game/i18n/catalogs.mjs',
      'app/i18n/catalogs.mjs',
      'game/locales/en/future.json',
    ].map((name) => ({ name, bytes: Buffer.from(name) })),
    ...canonicalPaths.map((name) => ({ name, bytes: Buffer.from('{}') })),
  ],
  catalogue: {
    files: [
      { path: 'game/live.json', sha256: 'live' },
      { path: 'game/archive.json', sha256: 'archive' },
    ],
    groups: [
      { id: 'shared', category: 'shared', requires: [], files: ['game/live.json'] },
      { id: 'archive:old', category: 'archive', requires: [], files: ['game/archive.json'] },
    ],
    missions: [],
    originals: [],
  },
});

test('main-only canonical projection preserves runtime and unknown original bytes', () => {
  const { entries, catalogue } = canonicalFixture();
  const retained = entries.filter(
    (entry) => !canonicalPaths.includes(entry.name) && entry.name !== 'game/archive.json',
  );
  applyPublicationProfile(entries, catalogue, 'main-pages', null);
  assert.deepEqual(entries, retained);
  assert(!entries.some((entry) => canonicalPaths.includes(entry.name)));
});

test('complete release profile preserves every canonical original and all catalogue data', () => {
  const { entries, catalogue } = canonicalFixture();
  const before = JSON.stringify({ entries, catalogue });
  applyPublicationProfile(entries, catalogue, null, null);
  assert.equal(JSON.stringify({ entries, catalogue }), before);
});

for (const owner of ['file', 'group'])
  test(`canonical ${owner} dependency rejects main-only removal atomically`, () => {
    const { entries, catalogue } = canonicalFixture();
    if (owner === 'file') catalogue.files.push({ path: canonicalPaths[0], sha256: 'raw' });
    else catalogue.groups[0].files.push(canonicalPaths[0]);
    const before = JSON.stringify({ entries, catalogue });
    assert.throws(
      () => applyPublicationProfile(entries, catalogue, 'main-pages', null),
      /canonical.*dependency/i,
    );
    assert.equal(JSON.stringify({ entries, catalogue }), before);
  });

for (const absent of ['game/i18n/catalogs.mjs', 'app/i18n/catalogs.mjs', canonicalPaths[0]])
  test(`incomplete canonical projection rejects ${absent}`, () => {
    const { entries, catalogue } = canonicalFixture();
    entries.splice(
      entries.findIndex((entry) => entry.name === absent),
      1,
    );
    assert.throws(
      () => applyPublicationProfile(entries, catalogue, 'main-pages', null),
      /canonical.*(?:incomplete|catalogue)/i,
    );
  });

test('new browser canonical original consumer blocks the main-only projection', () => {
  const { entries, catalogue } = canonicalFixture();
  entries.push({
    name: 'game/new-consumer.mjs',
    bytes: Buffer.from("fetch('./locales/' + language + '/content.json')"),
  });
  assert.throws(
    () => applyPublicationProfile(entries, catalogue, 'main-pages', null),
    /canonical.*consumer/i,
  );
});

for (const name of ['game/i18n/catalogs.mjs', 'app/i18n/catalogs.mjs'])
  test(`empty duplicate compiled catalogue rejects atomically: ${name}`, () => {
    const { entries, catalogue } = canonicalFixture();
    entries.push({ name, bytes: Buffer.alloc(0) });
    const before = JSON.stringify({ entries, catalogue });
    assert.throws(
      () => applyPublicationProfile(entries, catalogue, 'main-pages', null),
      /canonical.*catalogue/i,
    );
    assert.equal(JSON.stringify({ entries, catalogue }), before);
  });
