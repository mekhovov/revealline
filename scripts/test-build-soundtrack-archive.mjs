import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  buildSoundtrackArchive,
  assertSoundtrackArchiveBudget,
} from './build-soundtrack-archive.mjs';
import { compilePublishedSoundtracks } from './soundtrack-distribution.mjs';
import {
  resolveSoundtrackArchiveInventory,
  resolveSoundtrackArchives,
} from '../game/soundtrack-archive.mjs';
import { fixture as audioFixture } from '../game/test/helpers/soundtrack-fixtures.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url)),
  cli = fileURLToPath(new URL('./build-soundtrack-archive.mjs', import.meta.url)),
  execute = promisify(execFile),
  hash = (bytes) => createHash('sha256').update(bytes).digest('hex'),
  admission = {
    archiveId: 'soundtracks.1',
    baseURL: 'https://mekhovov.github.io/revealline-soundtracks-1/',
  };

async function fixture(t, { approved = true } = {}) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'soundtrack-archive-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const audio = await audioFixture('archive-test'),
    body = Buffer.from(await audio.blob.arrayBuffer()),
    source = {
      id: 'test.free',
      title: 'A [fixture] <recording>',
      artist: 'Archive QA',
      asset: { ...audio.track.asset },
      runtime: { path: 'originals/fixture.mp3' },
      source: 'https://example.test/source',
      credit: 'Fixture composer; structural test only.',
      license: 'CC0 1.0',
      policy: {
        id: 'test.free',
        sha256: audio.track.asset.sha256,
        webPlayback: 'allowed',
        offlineCache: 'allowed',
        redistribute: 'allowed',
        modify: 'allowed',
        gameplayVideo: 'allowed',
        contentId: 'unknown',
      },
      websites: [{ label: 'Licence', url: 'https://creativecommons.org/publicdomain/zero/1.0/' }],
      tags: { genres: ['synth90s'], role: 'any', energy: 3, themes: ['retro'] },
    },
    approvals = {
      format: 'revealline-licensed-publication.v1',
      approved: approved
        ? [
            {
              id: source.id,
              sha256: source.asset.sha256,
              reviewedBy: 'Test fixture only',
              reviewEvidence: 'reviews/fixture.md',
              fullTrack: true,
              repeatedSession: true,
              inGameTransition: true,
            },
          ]
        : [],
    },
    put = async (name, bytes) => {
      const target = path.join(root, name);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bytes);
    };
  for (const name of [
    'game/soundtrack.mjs',
    'game/soundtrack-rights.mjs',
    'game/mp3.mjs',
    'game/data-json.mjs',
    'game/ui/music.mjs',
  ])
    await put(name, await fs.readFile(path.join(projectRoot, name)));
  // The copied model imports generated collections; this isolated source has no
  // shipped catalogue or archive authority beyond its explicit fixture records.
  await put(
    'game/content/soundtrack-catalogue.mjs',
    `export const SOUNDTRACK_CATALOGUE = {format: 'revealline-soundtrack-catalogue.v2', edition: 'archive-test', tracks: []}; export const SOUNDTRACK_ARCHIVES = []; export const SOUNDTRACK_COLLECTIONS = [];`,
  );
  await put(
    'authoring/library/licensed-audio/production-register.json',
    JSON.stringify({ tracks: [source] }),
  );
  await put('authoring/library/licensed-audio/publication.json', JSON.stringify(approvals));
  await put('authoring/library/licensed-audio/originals/fixture.mp3', body);
  await put(
    'authoring/library/licensed-audio/reviews/fixture.md',
    'Test fixture only, not a real listening approval.',
  );
  await put(
    'authoring/library/revealline-original-soundtrack/build.mjs',
    `import {readFile} from 'node:fs/promises'; export async function buildOriginalSoundtrackCatalogue() { return JSON.parse(await readFile(new URL('./empty.json', import.meta.url))); }`,
  );
  await put(
    'authoring/library/revealline-original-soundtrack/empty.json',
    JSON.stringify({
      catalogue: {
        format: 'revealline-soundtrack-catalogue.v2',
        edition: 'archive-test',
        tracks: [],
      },
      files: [],
    }),
  );
  return {
    root,
    source,
    approvals,
    put,
    body,
    options: { ...admission, root, outputDirectory: '.cache/archive-1' },
    target: path.join(root, '.cache/archive-1'),
    save: async () => {
      await put(
        'authoring/library/licensed-audio/production-register.json',
        JSON.stringify({ tracks: [source] }),
      );
      await put('authoring/library/licensed-audio/publication.json', JSON.stringify(approvals));
    },
  };
}

test('zero approved recordings creates no output directory or placeholder archive', async (t) => {
  const f = await fixture(t, { approved: false }),
    result = await buildSoundtrackArchive(f.options);
  assert.equal(result.status, 'empty');
  assert.equal(result.outputDirectory, null);
  await assert.rejects(fs.lstat(path.join(f.root, '.cache')), { code: 'ENOENT' });
});

test('approved exact MP3 is staged once with pinned runtime inventory, reproducible catalogue candidate and credits', async (t) => {
  const f = await fixture(t),
    before = await fs.readFile(
      path.join(f.root, 'authoring/library/licensed-audio/publication.json'),
    ),
    result = await buildSoundtrackArchive(f.options),
    inventoryBytes = await fs.readFile(path.join(f.target, 'inventory.json')),
    inventory = resolveSoundtrackArchiveInventory(inventoryBytes.toString(), result.archive),
    candidateBytes = await fs.readFile(path.join(f.target, 'archive-candidate.json')),
    candidate = JSON.parse(candidateBytes),
    object = inventory.files[0];
  assert.equal(result.status, 'staged');
  assert.equal(result.files, 1);
  assert.equal(result.archive.inventorySha256, hash(inventoryBytes));
  assert.equal(result.candidate.sha256, hash(candidateBytes));
  resolveSoundtrackArchives([candidate.archive]);
  assert.deepEqual(await fs.readFile(path.join(f.target, object.path)), f.body);
  assert.equal(candidate.catalogue.tracks[0].archiveId, admission.archiveId);
  assert.equal(candidate.catalogue.tracks[0].path, object.path);
  assert.equal(candidate.status, 'staged-unpublished');
  for (const item of candidate.payload) {
    const bytes = await fs.readFile(path.join(f.target, item.path));
    assert.equal(bytes.length, item.bytes);
    assert.equal(hash(bytes), item.sha256);
  }
  const readme = await fs.readFile(path.join(f.target, 'README.md'), 'utf8');
  assert.match(readme, /Fixture composer; structural test only/);
  assert.match(readme, /CC0 1.0/);
  assert.match(readme, /https:\/\/example\.test\/source/);
  assert(readme.includes(new URL(object.path, admission.baseURL).href));
  assert(readme.includes('A \\[fixture\\] \\<recording\\>'));
  assert.equal((await fs.readFile(path.join(f.target, '.nojekyll'))).length, 0);
  assert.deepEqual(
    await fs.readFile(path.join(f.root, 'authoring/library/licensed-audio/publication.json')),
    before,
  );
  const second = await buildSoundtrackArchive({
    ...f.options,
    outputDirectory: '.cache/archive-2',
  });
  assert.equal(second.candidate.sha256, result.candidate.sha256);
  assert.deepEqual(
    await fs.readFile(path.join(second.outputDirectory, 'archive-candidate.json')),
    candidateBytes,
  );
});

test('identical approved recording bytes are deduplicated while both track credits remain pinned', async (t) => {
  const f = await fixture(t),
    alias = {
      ...f.source,
      id: 'test.alias',
      title: 'Another credited entry',
      policy: { ...f.source.policy, id: 'test.alias' },
    };
  f.approvals.approved.push({ ...f.approvals.approved[0], id: alias.id });
  await f.put('authoring/library/licensed-audio/publication.json', JSON.stringify(f.approvals));
  await f.put(
    'authoring/library/licensed-audio/production-register.json',
    JSON.stringify({ tracks: [f.source, alias] }),
  );
  const result = await buildSoundtrackArchive(f.options),
    candidate = JSON.parse(await fs.readFile(path.join(f.target, 'archive-candidate.json')));
  assert.equal(result.approvedTracks, 2);
  assert.equal(result.files, 1);
  assert.equal(candidate.catalogue.tracks.length, 2);
  assert.equal(new Set(candidate.catalogue.tracks.map((track) => track.path)).size, 1);
  assert.match(
    await fs.readFile(path.join(f.target, 'README.md'), 'utf8'),
    /Another credited entry/,
  );
});

test('archive restaging reads approved source delivery after hosted admission removes the local runtime payload', async (t) => {
  const f = await fixture(t),
    staged = await buildSoundtrackArchive(f.options),
    inventoryBytes = await fs.readFile(path.join(f.target, 'inventory.json')),
    inventory = JSON.parse(inventoryBytes),
    candidate = JSON.parse(await fs.readFile(path.join(f.target, 'archive-candidate.json'))),
    inventoryPath = 'authoring/library/archives/fixture/inventory.json',
    verificationPath = 'authoring/library/archives/fixture/verification.json';
  await f.put(inventoryPath, inventoryBytes);
  await f.put(
    verificationPath,
    JSON.stringify({
      format: 'revealline-soundtrack-host-verification.v1',
      checkedAt: '2026-09-21T12:00:00Z',
      baseURL: staged.archive.baseURL,
      inventorySha256: staged.archive.inventorySha256,
      objects: inventory.files,
    }),
  );
  await f.put(
    'authoring/library/soundtrack-archive-admissions.json',
    JSON.stringify({
      format: 'revealline-soundtrack-archive-admissions.v1',
      archives: [
        {
          admission: staged.archive,
          inventory: inventoryPath,
          verification: verificationPath,
          trackIds: candidate.catalogue.tracks.map((track) => track.id),
        },
      ],
    }),
  );
  const runtime = await compilePublishedSoundtracks(f.root);
  assert.deepEqual(runtime.files, []);
  assert.equal(runtime.catalogue.tracks[0].archiveId, staged.archive.id);
  const restaged = await buildSoundtrackArchive({
    ...f.options,
    outputDirectory: '.cache/restaged',
  });
  assert.equal(restaged.files, 1);
  assert.equal(restaged.candidate.sha256, staged.candidate.sha256);
  assert.deepEqual(
    await fs.readFile(path.join(restaged.outputDirectory, inventory.files[0].path)),
    f.body,
  );
});

test('an allowed recording alias cannot stage audio narrowed by another trusted same-hash entry', async (t) => {
  const f = await fixture(t),
    id = 'builtin.catalog.restricted-alias';
  await f.put(
    'authoring/library/revealline-original-soundtrack/empty.json',
    JSON.stringify({
      catalogue: {
        format: 'revealline-soundtrack-catalogue.v2',
        edition: 'archive-test',
        tracks: [
          {
            format: 'revealline-audio-track.v1',
            id,
            kind: 'mp3',
            title: 'Restricted alias',
            artist: f.source.artist,
            asset: f.source.asset,
            rights: {
              kind: 'licensed',
              credit: f.source.credit,
              license: f.source.license,
              source: f.source.source,
            },
            edition: 'archive-test',
            path: `optional/soundtracks/${f.source.asset.sha256}.mp3`,
            tags: f.source.tags,
            policy: { ...f.source.policy, id, redistribute: 'denied' },
          },
        ],
      },
      files: [],
    }),
  );
  await assert.rejects(buildSoundtrackArchive(f.options), /redistribut|permission|restrict/i);
  await assert.rejects(fs.lstat(path.join(f.root, '.cache')), { code: 'ENOENT' });
});

for (const fault of ['unreviewed', 'restricted', 'changed bytes', 'wrong MP3 metadata'])
  test(`refuses ${fault} before copying any MP3`, async (t) => {
    const f = await fixture(t);
    if (fault === 'unreviewed') f.approvals.approved[0].fullTrack = false;
    if (fault === 'restricted') f.source.policy.redistribute = 'denied';
    if (fault === 'changed bytes')
      await f.put(
        'authoring/library/licensed-audio/originals/fixture.mp3',
        Buffer.from('not reviewed bytes'),
      );
    if (fault === 'wrong MP3 metadata') {
      f.source.asset.frames++;
      f.source.asset.durationSeconds = (f.source.asset.frames * 1152) / f.source.asset.sampleRate;
    }
    await f.save();
    await assert.rejects(
      buildSoundtrackArchive(f.options),
      /listening|redistributable|reviewed bytes|MP3 structure/,
    );
    await assert.rejects(fs.lstat(path.join(f.root, '.cache')), { code: 'ENOENT' });
  });

test('existing output is never replaced, even for an empty publication', async (t) => {
  const f = await fixture(t, { approved: false });
  await f.put('.cache/archive-1/keep.txt', 'preserve');
  await assert.rejects(buildSoundtrackArchive(f.options), /already exists/);
  assert.equal(await fs.readFile(path.join(f.target, 'keep.txt'), 'utf8'), 'preserve');
});

test('output rejects cache-root, traversal and symlink escapes', async (t) => {
  const f = await fixture(t);
  for (const outputDirectory of ['.cache', '../outside', 'dist/archive'])
    await assert.rejects(
      buildSoundtrackArchive({ ...f.options, outputDirectory }),
      /fresh directory/,
    );
  await fs.mkdir(path.join(f.root, '.cache'));
  const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'archive-outside-'));
  t.after(() => fs.rm(outside, { recursive: true, force: true }));
  await fs.symlink(outside, path.join(f.root, '.cache/escape'));
  await assert.rejects(
    buildSoundtrackArchive({ ...f.options, outputDirectory: '.cache/escape/new' }),
    /symbolic links/,
  );
  assert.deepEqual(await fs.readdir(outside), []);
});

for (const baseURL of [
  'https://other.github.io/revealline-soundtracks-1/',
  'https://mekhovov.github.io/other-1/',
  'https://mekhovov.github.io/revealline-soundtracks-1/?q=x',
  'http://mekhovov.github.io/revealline-soundtracks-1/',
])
  test(`admission refuses non-project archive ${baseURL}`, async (t) => {
    const f = await fixture(t);
    await assert.rejects(buildSoundtrackArchive({ ...f.options, baseURL }), /admitted GitHub/);
  });

test('hard bounds include all payload files and reserve 1 GiB', () => {
  assertSoundtrackArchiveBudget({
    files: 512,
    bytes: 800000000,
    freeBytes: BigInt(800000000 + 1024 ** 3),
  });
  assert.throws(
    () => assertSoundtrackArchiveBudget({ files: 513, bytes: 10, freeBytes: 10n ** 12n }),
    /512/,
  );
  assert.throws(
    () => assertSoundtrackArchiveBudget({ files: 1, bytes: 800000001, freeBytes: 10n ** 12n }),
    /800 MB/,
  );
  assert.throws(
    () => assertSoundtrackArchiveBudget({ files: 1, bytes: 10, freeBytes: BigInt(1024 ** 3 + 9) }),
    /1 GiB/,
  );
});

test('low free-space preflight creates no output', async (t) => {
  const f = await fixture(t);
  t.mock.method(fs, 'statfs', async () => ({ bavail: 1024n ** 3n, bsize: 1n }));
  await assert.rejects(buildSoundtrackArchive(f.options), /1 GiB/);
  await assert.rejects(fs.lstat(path.join(f.root, '.cache')), { code: 'ENOENT' });
});

test('a failed write removes only its own new staging directory', async (t) => {
  const f = await fixture(t),
    write = fs.writeFile;
  await f.put('.cache/preserve.txt', 'unrelated');
  t.mock.method(fs, 'writeFile', async (target, ...args) => {
    if (target === path.join(f.target, 'inventory.json'))
      throw new Error('simulated write failure');
    return write(target, ...args);
  });
  await assert.rejects(buildSoundtrackArchive(f.options), /simulated write failure/);
  await assert.rejects(fs.lstat(f.target), { code: 'ENOENT' });
  assert.equal(await fs.readFile(path.join(f.root, '.cache/preserve.txt'), 'utf8'), 'unrelated');
});

test('CLI help and empty-publication staging are read-only and never invoke publication', async (t) => {
  const f = await fixture(t, { approved: false });
  assert.match(
    (await execute(process.execPath, [cli, '--help'])).stdout,
    /Does not create or publish/,
  );
  const result = await execute(process.execPath, [
    cli,
    '--root',
    f.root,
    '--archive-id',
    admission.archiveId,
    '--base-url',
    admission.baseURL,
    '--out',
    '.cache/archive-1',
  ]);
  assert.equal(JSON.parse(result.stdout).status, 'empty');
  await assert.rejects(fs.lstat(path.join(f.root, '.cache')), { code: 'ENOENT' });
  await assert.rejects(
    execute(process.execPath, [cli, '--constructor', 'bad']),
    /Unknown, duplicate or missing/,
  );
});
