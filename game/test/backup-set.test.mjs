import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepareBackupSet } from '../backup-set.mjs';
import { exportBackup } from '../backup.mjs';
import { exportMediaBundle } from '../media-bundle.mjs';
import { exportStoryBundle } from '../story-bundle.mjs';
import { exportSoundtrackBundle } from '../soundtrack-bundle.mjs';
import { backupSetFixture } from './helpers/backup-set-fixture.mjs';
import { deferred, pngBytes } from './helpers/media-fixtures.mjs';
const bytes = async (blob) => Buffer.from(await blob.arrayBuffer());
const hash = (b) => createHash('sha256').update(b).digest('hex');

test('one sequential stable set retains exact existing JSON, PNG/poster, video and MP3 formats', async () => {
  const f = await backupSetFixture(),
    before = structuredClone(f.contents),
    set = await prepareBackupSet(f.source),
    expected = [
      new Blob([await exportBackup(f.contents, { campaigns: [f.f.campaign] })]),
      await exportMediaBundle(f.still.library, f.still.assets, {
        decodeImage: f.source.decodeImage,
      }),
      await exportStoryBundle(f.story, [{ sha256: f.f.descriptor.source.sha256, blob: f.f.blob }], {
        still: f.still.library,
      }),
      await exportSoundtrackBundle(f.audio.library, f.audio.assets),
    ];
  assert.deepEqual(f.calls, ['media', 'story', 'audio']);
  assert.deepEqual(
    set.files.map((file) => file.id),
    ['game', 'media', 'story', 'audio', 'coverage'],
  );
  for (const [i, file] of set.files.entries()) {
    const b = await bytes(file.blob);
    assert.equal(file.bytes, b.length);
    assert.equal(file.sha256, hash(b));
    if (i < expected.length) assert.deepEqual(b, await bytes(expected[i]));
  }
  assert.deepEqual(JSON.parse(await set.files[4].blob.text()), set.coverage);
  assert.deepEqual(set.coverage.generations, f.metadata);
  assert.deepEqual(
    set.coverage.domains.map((row) => row.originals),
    [1, 1, 1],
  );
  assert.deepEqual(set.coverage.detachedStories, []);
  assert.equal(
    set.coverage.files.every((row) => row.status === 'Prepared'),
    true,
  );
  assert.deepEqual(f.contents, before);
  f.changeGame();
  assert.throws(set.assertGameCurrent, /Game data changed/);
});

for (const domain of ['media', 'story', 'audio'])
  test(`a ${domain} generation change after reading invalidates the entire set`, async () => {
    const f = await backupSetFixture(),
      read = f.source.readAudio;
    f.source.readAudio = async (options) => {
      const result = await read(options);
      f.metadata[domain]++;
      return result;
    };
    await assert.rejects(prepareBackupSet(f.source), /changed/);
  });

test('changed game contents with an unchanged lightweight identity still refuses final preparation', async () => {
  const f = await backupSetFixture(),
    read = f.source.readGame;
  let reads = 0;
  f.source.readGame = async (options) => {
    if (++reads === 2) f.contents.library.preferences.musicEnabled = true;
    return read(options);
  };
  await assert.rejects(prepareBackupSet(f.source), /Game data changed/);
});

for (const domain of ['media', 'story', 'audio'])
  test(`missing or corrupt ${domain} bytes cannot hide behind successful other components`, async () => {
    const f = await backupSetFixture(),
      key = { media: 'readStill', story: 'readStory', audio: 'readAudio' }[domain],
      read = f.source[key];
    f.source[key] = async (options) => {
      const value = await read(options);
      return {
        ...value,
        assets: domain === 'audio' ? [{ ...value.assets[0], blob: new Blob(['corrupt MP3']) }] : [],
      };
    };
    await assert.rejects(prepareBackupSet(f.source));
  });

test('detached descriptors remain an explicitly incomplete set with the missing source identity', async () => {
  const f = await backupSetFixture();
  f.story.originals = [];
  f.source.readStory = async () => ({
    generation: f.metadata.story,
    document: f.story,
    assets: [],
  });
  const set = await prepareBackupSet(f.source);
  assert.match(set.coverage.coverage, /incomplete/);
  assert.deepEqual(set.coverage.detachedStories, [
    { id: f.f.descriptor.id, sha256: f.f.descriptor.source.sha256 },
  ]);
  assert.equal(set.coverage.domains.find((row) => row.id === 'story').originals, 0);
});

test('cancellation while one read settles never starts later domains or produces a set', async () => {
  const f = await backupSetFixture(),
    held = deferred(),
    entered = deferred(),
    controller = new AbortController(),
    read = f.source.readStill;
  f.source.readStill = async (options) => {
    entered.resolve();
    await held.promise;
    return read(options);
  };
  const operation = prepareBackupSet(f.source, { signal: controller.signal });
  await entered.promise;
  controller.abort();
  held.resolve();
  await assert.rejects(operation, { name: 'AbortError' });
  assert.equal(f.calls.includes('audio'), false);
});

test('a smaller host preparation budget refuses rather than returning partial files', async () => {
  const f = await backupSetFixture();
  await assert.rejects(prepareBackupSet(f.source, { maxBytes: 128 }), /budget/);
  assert.deepEqual(f.calls, []);
});

test('the old invalid-CRC embedded PNG is a corrupt-original negative, never the positive backup fixture', async () => {
  const f = await backupSetFixture(),
    read = f.source.readStill;
  f.source.readStill = async (options) => {
    const value = await read(options);
    return { ...value, assets: [{ ...value.assets[0], blob: new Blob([pngBytes()]) }] };
  };
  await assert.rejects(prepareBackupSet(f.source));
});

test('preparations within the same millisecond have distinct safe common filenames and exact report references', async (t) => {
  const fixture = await backupSetFixture();
  t.mock.method(Date.prototype, 'toISOString', () => '2026-09-15T12:34:56.789Z');
  const first = await prepareBackupSet(fixture.source),
    second = await prepareBackupSet(fixture.source);
  const suffixes = {
    game: 'game-data.json',
    media: 'originals.rlmedia',
    story: 'stories.rlstory',
    audio: 'soundtrack.rlsound',
    coverage: 'coverage.json',
  };
  const prefixes = [];
  for (const set of [first, second]) {
    assert.equal(set.coverage.preparedAt, '2026-09-15T12:34:56.789Z');
    const setPrefixes = new Set();
    for (const file of set.files) {
      const suffix = '-' + suffixes[file.id],
        prefix = file.filename.slice(0, -suffix.length);
      assert.equal(file.filename.endsWith(suffix), true);
      assert.match(prefix, /^RevealLine-backup-20260915T123456789Z-[a-f0-9]{32}$/);
      assert.match(file.filename, /^[A-Za-z0-9._-]+$/);
      assert.ok(file.filename.length <= 128);
      setPrefixes.add(prefix);
    }
    assert.equal(
      setPrefixes.size,
      1,
      'All five download names share exactly one preparation prefix.',
    );
    prefixes.push([...setPrefixes][0]);
    assert.deepEqual(
      set.coverage.files.map((row) => row.filename),
      set.files.filter((file) => file.id !== 'coverage').map((file) => file.filename),
    );
    assert.deepEqual(
      JSON.parse(await set.files.find((file) => file.id === 'coverage').blob.text()),
      set.coverage,
    );
  }
  assert.notEqual(prefixes[0], prefixes[1], 'The timestamp alone must not identify a set.');
  assert.equal(new Set([...first.files, ...second.files].map((file) => file.filename)).size, 10);
});
