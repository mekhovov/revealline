import test from 'node:test';
import assert from 'node:assert/strict';
import fs, { mkdtemp, mkdir, readFile, readdir, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import {
  buildUAFPVLocalPacks,
  assertUAFPVLocalPackDiskBudget,
  UA_FPV_LOCAL_DISK_RESERVE_BYTES,
} from './ua-fpv-local-pack.mjs';
import { inspectMP3 } from '../game/mp3.mjs';
import { emptySoundtrackLibrary, SOUNDTRACK_LIMITS } from '../game/soundtrack.mjs';
import { importSoundtrackBundle } from '../game/soundtrack-bundle.mjs';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../game/soundtrack-share.mjs';

const silence = await readFile(
  new URL('../game/test/fixtures/audio/silence-mpeg1-layer3.mp3', import.meta.url),
);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const structuralProbe = async (blob) => ({
  durationSeconds: (await inspectMP3(blob)).durationSeconds,
});
const tagged = (tag) =>
  Buffer.concat([
    Buffer.from([73, 68, 51, 4, 0, 0, 0, 0, 0, tag.length]),
    Buffer.from(tag),
    silence,
  ]);
async function fixture(t, entries) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'ua-local-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const sourceDirectory = path.join(root, 'originals'),
    outputDirectory = path.join(root, 'packs');
  await mkdir(sourceDirectory);
  for (const [name, bytes] of entries) await writeFile(path.join(sourceDirectory, name), bytes);
  return { root, sourceDirectory, outputDirectory };
}
async function importVolume(directory, volume) {
  const bytes = await readFile(path.join(directory, volume.file));
  assert.equal(bytes.length, volume.bytes);
  assert.equal(hash(bytes), volume.sha256);
  assert.equal(bytes.subarray(0, 8).toString(), 'RLSTB3\r\n');
  return importSoundtrackBundle(new Blob([bytes]), { probeMedia: structuralProbe });
}

test('private packs preserve exact Unicode filenames and original bytes, deduplicate aliases and merge without changing the listener', async (t) => {
  const original = tagged('original'),
    different = tagged('different');
  const names = [' Перша назва — ї.mp3', 'Alias.MP3', 'Інший запис.mp3'];
  const f = await fixture(t, [
    [names[0], original],
    [names[1], original],
    [names[2], different],
  ]);
  const report = await buildUAFPVLocalPacks(f);
  assert.equal(report.sourceFiles, 3);
  assert.equal(report.uniqueRecordings, 2);
  assert.equal(report.uniqueBytes, original.length + different.length);
  assert.equal(report.remainingUploadSlotsFromEmptyLibrary, 120);
  assert.equal(report.volumes.length, 1);
  assert.deepEqual(report.files.map((file) => file.fileName).sort(), names.toSorted());
  const incoming = await importVolume(f.outputDirectory, report.volumes[0]);
  assert.equal(incoming.library.playlists[0].trackIds.length, 2);
  assert.equal(incoming.library.playlists[0].order, 'shuffle');
  assert.equal(incoming.library.playlists[0].repeat, 'all');
  assert.equal(incoming.library.referenceOnlyTrackIds.length, 0);
  assert.equal(incoming.library.catalogTracks.length, 0);
  assert.ok(
    incoming.library.tracks.every(
      (track) =>
        track.rights.kind === 'personal' &&
        track.artist === '' &&
        track.rights.source === '' &&
        track.rights.license === '',
    ),
  );
  for (const track of incoming.library.tracks) {
    assert.deepEqual(
      Buffer.from(
        await incoming.assets
          .find((asset) => asset.sha256 === track.asset.sha256)
          .blob.arrayBuffer(),
      ),
      await readFile(path.join(f.sourceDirectory, track.fileName)),
    );
  }
  assert.throws(
    () => soundtrackPlaylistShare(incoming.library, incoming.library.playlists[0]),
    /permission/,
  );
  const before = {
    ...emptySoundtrackLibrary({ catalogue: true }),
    selection: { playlistId: 'builtin.default' },
    listening: { mode: 'metal', genres: ['metal'], recordingMode: false, installedOnly: true },
  };
  // Use the current, real built-in ID rather than inventing an identity.
  const { BUILTIN_SOUNDTRACK_PLAYLISTS } = await import('../game/soundtrack.mjs');
  before.selection.playlistId = BUILTIN_SOUNDTRACK_PLAYLISTS[0].id;
  const merged = mergeSoundtrackShare(before, [], incoming);
  assert.deepEqual(merged.library.selection, before.selection);
  assert.deepEqual(merged.library.listening, before.listening);
  assert.deepEqual(mergeSoundtrackShare(merged.library, merged.assets, incoming), merged);
  assert.deepEqual((await readdir(f.sourceDirectory)).sort(), names.toSorted());
});

test('volumes honor encoded-byte limits, keep aliases together, and are reproducible', async (t) => {
  const bodyA = tagged('A'),
    bodyB = tagged('B');
  const single = await fixture(t, [
    ['a.mp3', bodyA],
    ['alias.mp3', bodyA],
  ]);
  const one = await buildUAFPVLocalPacks(single);
  const f = await fixture(t, [
    ['a.mp3', bodyA],
    ['alias.mp3', bodyA],
    ['b.mp3', bodyB],
  ]);
  const report = await buildUAFPVLocalPacks({ ...f, volumeBytes: one.volumes[0].bytes });
  assert.equal(report.volumes.length, 2);
  assert.ok(report.volumes.every((volume) => volume.bytes <= one.volumes[0].bytes));
  assert.equal(
    new Set(report.files.filter((file) => file.sha256 === hash(bodyA)).map((file) => file.volume))
      .size,
    1,
  );
  let combined = { library: emptySoundtrackLibrary({ catalogue: true }), assets: [] };
  for (const volume of report.volumes)
    combined = mergeSoundtrackShare(
      combined.library,
      combined.assets,
      await importVolume(f.outputDirectory, volume),
    );
  assert.equal(combined.library.tracks.length, 3);
  assert.equal(combined.assets.length, 2);
  const outputDirectory = path.join(f.root, 'again');
  const again = await buildUAFPVLocalPacks({
    ...f,
    outputDirectory,
    volumeBytes: one.volumes[0].bytes,
  });
  assert.deepEqual(again, report);
  for (const volume of report.volumes)
    assert.deepEqual(
      await readFile(path.join(outputDirectory, volume.file)),
      await readFile(path.join(f.outputDirectory, volume.file)),
    );
});

test('rejects oversized volumes and exhausted upload capacity before writing outputs', async (t) => {
  const f = await fixture(t, [['one.mp3', silence]]);
  await assert.rejects(
    buildUAFPVLocalPacks({ ...f, volumeBytes: SOUNDTRACK_LIMITS.optionalBundleTargetBytes + 1 }),
    /64 MiB/,
  );
  await assert.rejects(buildUAFPVLocalPacks({ ...f, volumeBytes: 1 }), /fit one volume/);
  for (let n = 1; n <= SOUNDTRACK_LIMITS.customTracks; n++)
    await writeFile(path.join(f.sourceDirectory, `${n}.mp3`), silence);
  await assert.rejects(buildUAFPVLocalPacks(f), /123 MP3/);
  await assert.rejects(readdir(f.outputDirectory), { code: 'ENOENT' });
});

test('refuses malformed audio and symlinks instead of converting or silently skipping files', async (t) => {
  const bad = await fixture(t, [['bad.mp3', Buffer.from('not an MP3')]]);
  await assert.rejects(buildUAFPVLocalPacks(bad), /MPEG|MP3/);
  const f = await fixture(t, [['original.mp3', silence]]);
  await symlink(
    path.join(f.sourceDirectory, 'original.mp3'),
    path.join(f.sourceDirectory, 'alias.mp3'),
  );
  await assert.rejects(buildUAFPVLocalPacks(f), /ordinary files/);
  await assert.rejects(readdir(f.outputDirectory), { code: 'ENOENT' });
});

test('never overwrites originals or existing output, including symlinked source descendants', async (t) => {
  const f = await fixture(t, [['song.mp3', silence]]);
  await assert.rejects(
    buildUAFPVLocalPacks({ ...f, outputDirectory: path.join(f.sourceDirectory, 'packs') }),
    /outside the source/,
  );
  const link = path.join(f.root, 'source-link');
  await symlink(f.sourceDirectory, link);
  await assert.rejects(
    buildUAFPVLocalPacks({ ...f, outputDirectory: path.join(link, 'new') }),
    /source directory/,
  );
  assert.deepEqual(await readdir(f.sourceDirectory), ['song.mp3']);
  await mkdir(f.outputDirectory);
  await writeFile(path.join(f.outputDirectory, 'keep.txt'), 'preserve');
  await assert.rejects(buildUAFPVLocalPacks(f), /empty output directory/);
  assert.equal(await readFile(path.join(f.outputDirectory, 'keep.txt'), 'utf8'), 'preserve');
});

test('disk reserve accounts for the whole output rather than only the next volume', () => {
  const outputBytes = 215028271n + 100000n,
    reserve = BigInt(UA_FPV_LOCAL_DISK_RESERVE_BYTES);
  assert.doesNotThrow(() =>
    assertUAFPVLocalPackDiskBudget({ freeBytes: reserve + outputBytes, outputBytes }),
  );
  assert.throws(
    () => assertUAFPVLocalPackDiskBudget({ freeBytes: reserve + outputBytes - 1n, outputBytes }),
    /1 GiB/,
  );
  assert.throws(
    () => assertUAFPVLocalPackDiskBudget({ freeBytes: reserve + 65564765n, outputBytes }),
    /1 GiB/,
  );
});

test('insufficient space rejects the complete planned output before creating its directory', async (t) => {
  const f = await fixture(t, [
    ['a.mp3', tagged('A')],
    ['b.mp3', tagged('B')],
  ]);
  t.mock.method(fs, 'statfs', async () => ({
    bavail: BigInt(UA_FPV_LOCAL_DISK_RESERVE_BYTES),
    bsize: 1n,
  }));
  await assert.rejects(buildUAFPVLocalPacks(f), /1 GiB/);
  await assert.rejects(readdir(f.outputDirectory), { code: 'ENOENT' });
  assert.deepEqual((await readdir(f.sourceDirectory)).sort(), ['a.mp3', 'b.mp3']);
});

test('disk reserve is rechecked immediately before output when available space drops', async (t) => {
  const f = await fixture(t, [['a.mp3', tagged('A')]]);
  let calls = 0;
  t.mock.method(fs, 'statfs', async () => ({
    bavail: BigInt(UA_FPV_LOCAL_DISK_RESERVE_BYTES) + (++calls === 1 ? 10000000n : 0n),
    bsize: 1n,
  }));
  await assert.rejects(buildUAFPVLocalPacks(f), /1 GiB/);
  assert.equal(calls, 2);
  assert.deepEqual(await readdir(f.outputDirectory), []);
});
