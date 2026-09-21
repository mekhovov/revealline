import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { importSoundtrackBundle } from '../game/soundtrack-bundle.mjs';
import { structuralProbe } from '../game/test/helpers/soundtrack-fixtures.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const verifiedStatus = 'primary creator submission license declaration verified';
async function fixture(
  t,
  license = 'CC BY 4.0 International',
  licenseURL = 'https://creativecommons.org/licenses/by/4.0/',
) {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'licensed-audio-build-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const folder = path.join(dir, 'authoring/library/licensed-audio');
  await mkdir(path.join(folder, 'originals'), { recursive: true });
  await mkdir(path.join(folder, 'provenance'));
  // Only imported runtime modules are linked; all mutable fixture data is ordinary local files.
  await symlink(path.join(root, 'game'), path.join(dir, 'game'));
  await writeFile(
    path.join(folder, 'build.mjs'),
    await readFile(path.join(root, 'authoring/library/licensed-audio/build.mjs')),
  );
  const bytes = await readFile(
    path.join(root, 'game/test/fixtures/audio/silence-mpeg1-layer3.mp3'),
  );
  const pin = { path: 'originals/recording.mp3', bytes: bytes.length, sha256: digest(bytes) };
  const source = {
    format: 'revealline-licensed-audio-source.v1',
    encoder: {},
    tracks: [
      {
        id: 'test.creator-recording',
        title: 'Synthetic compiler fixture',
        artist: 'Test author',
        albumId: 'test.creator-album',
        source: 'https://example.test/creator/recording',
        credit: 'Test author — synthetic compiler fixture',
        license,
        original: { ...pin },
        runtime: { ...pin },
        derivative: null,
        fileName: 'creator-original.mp3',
        tags: { genres: ['chiptune'], role: 'any', energy: 4, themes: ['retro'] },
        websites: [{ label: 'Creator recording', url: 'https://example.test/creator/recording' }],
      },
    ],
    albums: [
      {
        id: 'test.creator-album',
        title: 'Test creator album',
        genre: 'Metal',
        description: 'A synthetic licensed-source compiler fixture.',
        credit: 'Test author',
        source: 'https://example.test/creator/recording',
        trackIds: ['test.creator-recording'],
      },
    ],
  };
  const evidence = {
    sources: [
      { source: source.tracks[0].source, selectedLicenseURL: licenseURL, status: verifiedStatus },
    ],
  };
  const put = (name, value) => writeFile(path.join(folder, name), JSON.stringify(value));
  await writeFile(path.join(folder, pin.path), bytes);
  await put('provenance/derivatives.json', { encoder: {}, tracks: [] });
  await put('provenance/additional-derivatives.json', { tracks: [] });
  const save = async () => {
    await put('sources.json', source);
    await put('provenance/license-revalidation.json', evidence);
  };
  await save();
  const { buildSoundtrackAlbums } = await import(pathToFileURL(path.join(folder, 'build.mjs')));
  return { folder, bytes, source, evidence, save, build: buildSoundtrackAlbums };
}

for (const [license, licenseURL] of [
  ['CC0 1.0 Universal', 'https://creativecommons.org/publicdomain/zero/1.0/'],
  ['CC BY 3.0 Unported', 'https://creativecommons.org/licenses/by/3.0/'],
  ['CC BY 4.0 International', 'https://creativecommons.org/licenses/by/4.0/'],
]) {
  test(`${license} compiles only with matching source evidence and preserves exact recording bytes and credit`, async (t) => {
    const f = await fixture(t, license, licenseURL);
    const result = await f.build();
    assert.equal(result.catalog.albums.length, 1);
    assert.equal(result.bundles.length, 1);
    const album = result.catalog.albums[0];
    assert.equal(album.sha256, digest(result.bundles[0].bytes));
    assert.equal(album.bytes, result.bundles[0].bytes.length);
    const restored = await importSoundtrackBundle(new Blob([result.bundles[0].bytes]), {
      probeMedia: structuralProbe,
    });
    const track = restored.library.tracks[0];
    assert.deepEqual(track.rights, {
      kind: 'licensed',
      credit: f.source.tracks[0].credit,
      license,
      source: f.source.tracks[0].source,
    });
    assert.equal(track.asset.sha256, digest(f.bytes));
    assert.deepEqual(Buffer.from(await restored.assets[0].blob.arrayBuffer()), f.bytes);
    assert.deepEqual(restored.library.playlists[0].trackIds, [track.id]);
    assert.equal(restored.library.playlists[0].order, 'shuffle');
    assert.equal(restored.library.playlists[0].repeat, 'all');
    assert.deepEqual(restored.library.tags[track.id], f.source.tracks[0].tags);
    assert.equal(track.fileName, 'creator-original.mp3');
  });
}

test('CC BY 4.0 still refuses missing, different-source, different-version and unverified license evidence', async (t) => {
  const f = await fixture(t);
  const valid = structuredClone(f.evidence.sources[0]);
  for (const sources of [
    [],
    [{ ...valid, source: 'https://example.test/other-recording' }],
    [{ ...valid, selectedLicenseURL: 'https://creativecommons.org/licenses/by/3.0/' }],
    [{ ...valid, status: 'pending' }],
  ]) {
    f.evidence.sources = sources;
    await f.save();
    await assert.rejects(f.build(), /matching reviewed open recording license/);
  }
});

test('expansion derivatives require the same retained encoder settings as the prior CoreAudio batch', async (t) => {
  const f = await fixture(t);
  await writeFile(
    path.join(f.folder, 'provenance/expansion-derivatives.json'),
    JSON.stringify({ encoder: { package: 'unrecorded-encoder' }, tracks: [] }),
  );
  await assert.rejects(f.build(), /Expansion encoder provenance differs/);
});

test('noncommercial, no-derivatives and ShareAlike labels do not enter the explicit license allowlist', async (t) => {
  const f = await fixture(t);
  for (const [license, selectedLicenseURL] of [
    ['CC BY-NC 4.0 International', 'https://creativecommons.org/licenses/by-nc/4.0/'],
    ['CC BY-ND 4.0 International', 'https://creativecommons.org/licenses/by-nd/4.0/'],
    ['CC BY-SA 4.0 International', 'https://creativecommons.org/licenses/by-sa/4.0/'],
  ]) {
    f.source.tracks[0].license = license;
    f.evidence.sources[0].selectedLicenseURL = selectedLicenseURL;
    await f.save();
    await assert.rejects(f.build(), /matching reviewed open recording license/);
  }
});

test('CC BY 4.0 cannot bypass source hashes, runtime pins, derivative provenance or album ownership', async (t) => {
  const f = await fixture(t);
  const track = structuredClone(f.source.tracks[0]);
  for (const change of [
    { original: { ...track.original, sha256: '0'.repeat(64) } },
    { original: { ...track.original, bytes: track.original.bytes + 1 } },
    { runtime: { ...track.runtime, sha256: '0'.repeat(64) } },
    { derivative: { sourceSha256: track.original.sha256 } },
    { albumId: 'test.unowned' },
  ]) {
    f.source.tracks[0] = { ...track, ...change };
    await f.save();
    await assert.rejects(
      f.build(),
      /original differs|inspection differs|exact MP3 original|ownership differs/,
    );
  }
  f.source.tracks[0] = track;
  await f.save();
  await writeFile(path.join(f.folder, track.original.path), new Uint8Array(f.bytes.length));
  await assert.rejects(f.build(), /original differs/);
});

test('CC BY 4.0 cannot authorize linked source audio', async (t) => {
  const f = await fixture(t);
  const audio = path.join(f.folder, f.source.tracks[0].original.path);
  const target = path.join(f.folder, 'retained.mp3');
  await writeFile(target, f.bytes);
  await rm(audio);
  await symlink(target, audio);
  await assert.rejects(f.build(), /source links are not accepted/);
});
