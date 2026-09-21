import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import {
  compileUAFPVSoundtracks,
  inspectUAFPVArtwork,
} from '../authoring/library/ua-fpv/build.mjs';
import { silenceBytes } from '../game/test/helpers/soundtrack-fixtures.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const json = (value) => Buffer.from(JSON.stringify(value, null, 2) + '\n');
function artworkMP3() {
  const picture = Buffer.from('Synthetic test artwork frame, not a real cleared work'),
    frame = Buffer.alloc(10),
    header = Buffer.alloc(10);
  frame.write('APIC');
  frame.writeUInt32BE(picture.length, 4);
  header.write('ID3');
  header[3] = 3;
  const length = frame.length + picture.length;
  for (let i = 0; i < 4; i++) header[9 - i] = (length >> (7 * i)) & 127;
  return Buffer.concat([header, frame, picture, silenceBytes]);
}
async function fixture(t, { artwork = false } = {}) {
  const baseDirectory = await fs.realpath(
    await fs.mkdtemp(path.join(os.tmpdir(), 'ua-fpv-publication-')),
  );
  t.after(() => fs.rm(baseDirectory, { recursive: true, force: true }));
  const body = artwork ? artworkMP3() : Buffer.from(silenceBytes),
    sha256 = hash(body),
    aliases = ['Перша назва.mp3', 'Інший підпис того ж запису.mp3'],
    id = `builtin.catalog.ua-fpv.${sha256.slice(0, 24)}`,
    identityId = `ua-reference.${sha256.slice(0, 24)}`,
    policy = {
      id,
      sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'allowed',
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'unknown',
    },
    put = async (name, bytes) => {
      const file = path.join(baseDirectory, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, bytes);
      return { path: name, bytes: bytes.length, sha256: hash(bytes) };
    },
    evidence = await put(
      'evidence/fixture-grant.txt',
      Buffer.from('Synthetic test fixture evidence only; no rights approval of real recordings.'),
    ),
    approval = {
      sha256,
      file: await put('approved/source.mp3', body),
      title: 'Перевірена назва',
      artist: 'Тестовий композитор',
      fileName: aliases[0],
      filenameAliases: aliases,
      sourceURL: 'https://example.test/recording',
      credit: 'Test composer; test artwork credit',
      license: 'Fixture permission only',
      licenseURL: 'https://example.test/recording-license',
      policy,
    },
    review = {
      format: 'revealline-ua-fpv-review.v1',
      sha256,
      reviewedBy: 'Synthetic fixture reviewer',
      reviewedAt: '2026-09-21T12:00:00Z',
      identity: {
        title: approval.title,
        artist: approval.artist,
        sourceURL: approval.sourceURL,
        fileName: approval.fileName,
        filenameAliases: aliases,
        confirmed: true,
      },
      recordingRights: {
        rightsHolder: 'Synthetic fixture',
        license: approval.license,
        licenseURL: approval.licenseURL,
        attribution: approval.credit,
        policy,
        gameUse: 'allowed',
        composition: true,
        recording: true,
        performers: true,
        samples: true,
        gameContext: true,
        publicMP3: true,
        conditionsMet: true,
        evidence,
      },
      artworkRights: {
        status: artwork ? 'cleared' : 'none',
        frames: inspectUAFPVArtwork(body),
        attribution: artwork ? 'test artwork credit' : '',
        publicMP3: true,
        conditionsMet: true,
        evidence,
      },
      listening: {
        fullTrack: true,
        repeatedSession: true,
        inGameTransition: true,
        technicalDecode: true,
        ukrainianIdentity: true,
        lyricsAndContext: true,
        notes: 'Test schema only; no human listening claim.',
        evidence,
      },
    },
    inventory = {
      format: 'revealline-ua-fpv-reference-inventory.v1',
      sourceFolder: '/unavailable/private/never-read',
      identities: [
        {
          id: identityId,
          sha256,
          bytes: body.length,
          filenameAliases: aliases,
          permissionStatus: 'unknown',
          publicationAllowed: false,
        },
      ],
      files: aliases.map((filename) => ({ filename, sha256, bytes: body.length, identityId })),
    },
    publication = { format: 'revealline-ua-fpv-publication.v1', approved: [approval] },
    save = async () => {
      approval.review = await put('evidence/review.json', json(review));
      await put('inventory.json', json(inventory));
      await put('publication.json', json(publication));
    };
  await save();
  return {
    baseDirectory,
    body,
    approval,
    review,
    inventory,
    publication,
    put,
    save,
    options: { baseDirectory, edition: 'game-edition' },
  };
}

test('current UA-FPV publication has zero admissions and reads no private reference audio', async () => {
  assert.deepEqual(await compileUAFPVSoundtracks(), { tracks: [], files: [], receipts: [] });
});

test('empty publication requires no reference folder, inventory or approved audio', async (t) => {
  const f = await fixture(t);
  await f.put(
    'publication.json',
    json({ format: 'revealline-ua-fpv-publication.v1', approved: [] }),
  );
  await fs.rm(path.join(f.baseDirectory, 'approved'), { recursive: true });
  await fs.rm(path.join(f.baseDirectory, 'inventory.json'));
  assert.deepEqual(await compileUAFPVSoundtracks(f.options), {
    tracks: [],
    files: [],
    receipts: [],
  });
});

for (const artwork of [false, true])
  test(`portable cleared fixture ${artwork ? 'with reviewed artwork' : 'without artwork'} produces one exact Ukrainian FPV recording`, async (t) => {
    const f = await fixture(t, { artwork }),
      before = await fs.readFile(path.join(f.baseDirectory, 'publication.json')),
      result = await compileUAFPVSoundtracks(f.options),
      track = result.tracks[0];
    assert.equal(result.tracks.length, 1);
    assert.equal(result.files.length, 1);
    assert.deepEqual(result.files[0].bytes, f.body);
    assert.equal(track.asset.sha256, f.approval.sha256);
    assert.equal(track.id, `builtin.catalog.ua-fpv.${track.asset.sha256.slice(0, 24)}`);
    assert.equal(track.edition, 'game-edition');
    assert.equal(track.path, `optional/soundtracks/ua-fpv/${track.asset.sha256}.mp3`);
    assert.deepEqual(track.tags, {
      genres: ['ukrainian'],
      role: 'gameplay',
      energy: 3,
      themes: ['fpv'],
    });
    assert.equal(track.fileName, f.approval.fileName);
    assert.equal(track.rights.credit, f.approval.credit);
    assert.deepEqual(result.receipts[0].filenameAliases, f.approval.filenameAliases);
    assert.deepEqual(await fs.readFile(path.join(f.baseDirectory, 'publication.json')), before);
    assert.equal(
      (await fs.readdir(f.baseDirectory)).some((name) => name.startsWith('dist')),
      false,
    );
  });

for (const field of [
  'gameUse',
  'composition',
  'recording',
  'performers',
  'samples',
  'gameContext',
  'publicMP3',
  'conditionsMet',
])
  test(`uncleared ${field} refuses publication`, async (t) => {
    const f = await fixture(t);
    f.review.recordingRights[field] = field === 'gameUse' ? 'unknown' : false;
    await f.save();
    await assert.rejects(compileUAFPVSoundtracks(f.options), /rights are not fully cleared/);
  });

for (const field of [
  'fullTrack',
  'repeatedSession',
  'inGameTransition',
  'technicalDecode',
  'ukrainianIdentity',
  'lyricsAndContext',
])
  test(`missing ${field} review refuses publication`, async (t) => {
    const f = await fixture(t);
    f.review.listening[field] = false;
    await f.save();
    await assert.rejects(compileUAFPVSoundtracks(f.options), /review must pass/);
  });

test('restricted game-only permission cannot enter the public compiler', async (t) => {
  const f = await fixture(t);
  f.approval.policy.redistribute = 'denied';
  await f.save();
  await assert.rejects(compileUAFPVSoundtracks(f.options), /public MP3 redistribution/);
});

test('inventoried unknown rights and a source website alone are never approval', async (t) => {
  const f = await fixture(t);
  delete f.approval.review;
  await f.put('publication.json', json(f.publication));
  await assert.rejects(compileUAFPVSoundtracks(f.options));
});

for (const what of ['audio', 'review', 'grant'])
  test(`changed ${what} evidence bytes refuse before admission`, async (t) => {
    const f = await fixture(t),
      file =
        what === 'audio'
          ? f.approval.file.path
          : what === 'review'
            ? f.approval.review.path
            : f.review.recordingRights.evidence.path;
    await f.put(file, Buffer.from('changed exact bytes'));
    await assert.rejects(compileUAFPVSoundtracks(f.options), /differs from its approved hash/);
  });

test('renamed source, omitted duplicate alias, duplicate approval and mismatched identity all refuse', async (t) => {
  for (const change of [
    (f) => {
      f.approval.fileName = 'Invented name.mp3';
    },
    (f) => {
      f.approval.filenameAliases = [f.approval.fileName];
    },
    (f) => {
      f.publication.approved.push(f.approval);
    },
    (f) => {
      f.review.identity.artist = 'An unconfirmed uploader';
    },
    (f) => {
      f.inventory.files[1].bytes++;
    },
  ]) {
    const f = await fixture(t);
    change(f);
    await f.save();
    await assert.rejects(
      compileUAFPVSoundtracks(f.options),
      /filename|alias|Duplicate|identity|inventory/,
    );
  }
});

test('embedded artwork cannot be hidden, left uncleared or lose its attribution', async (t) => {
  for (const change of [
    (f) => {
      f.review.artworkRights.frames = [];
      f.review.artworkRights.status = 'none';
    },
    (f) => {
      f.review.artworkRights.publicMP3 = false;
    },
    (f) => {
      f.review.artworkRights.attribution = 'Missing public attribution';
    },
  ]) {
    const f = await fixture(t, { artwork: true });
    change(f);
    await f.save();
    await assert.rejects(compileUAFPVSoundtracks(f.options), /embedded artwork/);
  }
  const unsynchronized = artworkMP3();
  unsynchronized[5] = 128;
  assert.throws(() => inspectUAFPVArtwork(unsynchronized), /plain ID3v2/);
});

test('absolute/traversing paths, source hotlinks, foreign source bytes and symlinks cannot enter portable admission', async (t) => {
  for (const sourcePath of [
    '/private/recording.mp3',
    'approved/../../recording.mp3',
    'https://artist.test/file.mp3',
  ]) {
    const f = await fixture(t);
    f.approval.file.path = sourcePath;
    await f.save();
    await assert.rejects(compileUAFPVSoundtracks(f.options), /scope|Unsafe/);
  }
  const f = await fixture(t),
    outside = path.join(f.baseDirectory, 'borrowed.mp3');
  await fs.writeFile(outside, f.body);
  await fs.rm(path.join(f.baseDirectory, f.approval.file.path));
  await fs.symlink(outside, path.join(f.baseDirectory, f.approval.file.path));
  await assert.rejects(compileUAFPVSoundtracks(f.options), /symbolic links/);
});

test('source and license URLs must be safe recording-specific websites confirmed by review', async (t) => {
  for (const sourceURL of [
    'javascript:alert(1)',
    'file:///local/song.mp3',
    'https://user:pass@example.test/song',
  ]) {
    const f = await fixture(t);
    f.approval.sourceURL = sourceURL;
    await f.save();
    await assert.rejects(compileUAFPVSoundtracks(f.options), /HTTP\(S\)/);
  }
});
