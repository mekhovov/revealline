import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  SOUNDTRACK_CATALOGUE,
  SOUNDTRACK_ARCHIVES,
} from '../game/content/soundtrack-catalogue.mjs';
import { REACTION_VOICE_PILOT } from '../game/audio/reactions/pilot.mjs';
import {
  emptySoundtrackLibrary,
  resolveSoundtrackLibrary,
  setCatalogueTracks,
} from '../game/soundtrack.mjs';
import { exportSoundtrackBundle } from '../game/soundtrack-bundle.mjs';

export const AUDIO_FIXTURE_FORMAT = 'SoloQualificationAudioFixturesV1';
export const AUDIO_PLAYLIST_ID = 'qualification-recorded-music';
export const AUDIO_BUNDLE_FILE = 'recorded-music.rlsound';
export const AUDIO_RECORDINGS = Object.freeze([
  Object.freeze({
    id: 'builtin.catalog.joth.party-sector',
    sha256: '77e1ad0bd0a7c5625a12eaa1c8099408ede6959b2ee2dbf5bace85d09a602ada',
    bytes: 1925141,
  }),
  Object.freeze({
    id: 'builtin.catalog.joth.bossa-nova',
    sha256: '0ee835fd279ac5fa15f9346744cbafc2ba800c1c0671b78ca9abe2b4353402f7',
    bytes: 1196325,
  }),
]);
export const AUDIO_SPEECH = Object.freeze({
  lineId: 'journey-incidental.v1/guide/capture/0',
  locale: 'en',
  sha256: '8cec12f5da013e765a6b056384ff520a9ec82244060e962f4f515fbb4e32419c',
  bytes: 16018,
});
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function verifyAudioFixtureBytes(bytes, pin) {
  assert.equal(bytes.length, pin.bytes, `${pin.id ?? pin.lineId}: original byte count differs`);
  assert.equal(hash(bytes), pin.sha256, `${pin.id ?? pin.lineId}: original SHA256 differs`);
  return bytes;
}
export async function speechFixtureProvenance() {
  const entry = REACTION_VOICE_PILOT.find(
    ({ lineId, locale }) => lineId === AUDIO_SPEECH.lineId && locale === AUDIO_SPEECH.locale,
  );
  assert(entry, 'Pinned guide capture recording is absent');
  assert.equal(entry.sha256, AUDIO_SPEECH.sha256);
  assert.equal(entry.bytes, AUDIO_SPEECH.bytes);
  const path = `game/audio/reactions/${entry.file}`;
  verifyAudioFixtureBytes(await readFile(new URL(`../${path}`, import.meta.url)), AUDIO_SPEECH);
  return { ...entry, path, source: 'unchanged shipped reaction pilot original' };
}

async function downloadOriginal(url, pin, fetcher, receipt) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(60000) });
  receipt.responseURL = response.url;
  receipt.httpStatus = response.status;
  assert(response.ok, `${pin.id}: HTTP ${response.status}`);
  assert(response.body, `${pin.id}: download has no response body`);
  const reader = response.body.getReader(),
    chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      assert(total <= pin.bytes, `${pin.id}: download exceeds pinned original size`);
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally {
    reader.releaseLock();
  }
  return {
    bytes: verifyAudioFixtureBytes(Buffer.concat(chunks, total), pin),
    responseURL: response.url,
    status: response.status,
  };
}

// Preparation performs no playback and is never part of a measured browser run.
// Network intake is explicit; the regular qualification preparer is offline.
export async function prepareAudioFixtures(
  directory,
  { recordingsDirectory, download = false, downloadSource = 'archive', fetcher = fetch } = {},
) {
  assert(
    Boolean(recordingsDirectory) !== Boolean(download),
    'Choose exactly one of --download or --recordings=<directory>',
  );
  assert(['archive', 'creator'].includes(downloadSource), 'Unknown original source');
  const destination = resolve(directory);
  await mkdir(destination); // A previous attempt, including a failure, stays intact.
  const manifest = {
    format: AUDIO_FIXTURE_FORMAT,
    status: 'preparing',
    evidenceKind: 'exact published fixture bytes; no browser execution or listening approval',
    createdAt: new Date().toISOString(),
    catalogueModuleSha256: hash(
      await readFile(new URL('../game/content/soundtrack-catalogue.mjs', import.meta.url)),
    ),
    playlistId: AUDIO_PLAYLIST_ID,
    recordings: [],
    speech: null,
    bundle: null,
    limitations: [
      'Music uses exact published catalogue MP3 identities via public local .rlsound import; intake URLs distinguish archive and creator delivery. It does not prove remote network streaming availability.',
      'Speech is the unchanged macOS-generated pilot recording; listening qualification remains pending.',
      'Native decoding, actual recording starts, transport advancement and transitions require a separate audio-proof run.',
    ],
  };
  const save = () =>
    writeFile(resolve(destination, 'provenance.json'), JSON.stringify(manifest, null, 2) + '\n');
  await save();
  try {
    manifest.speech = await speechFixtureProvenance();
    const sourcePath = 'authoring/library/licensed-audio/provenance/expansion-downloads.json';
    const sourceBytes = await readFile(new URL(`../${sourcePath}`, import.meta.url));
    const sources = JSON.parse(sourceBytes);
    assert.equal(sources.format, 'revealline-licensed-intake.v1');
    manifest.sourceEvidence = { path: sourcePath, sha256: hash(sourceBytes) };
    const tracks = [],
      assets = [];
    for (const pin of AUDIO_RECORDINGS) {
      const track = SOUNDTRACK_CATALOGUE.tracks.find(({ id }) => id === pin.id);
      assert(track, `${pin.id}: trusted catalogue entry is absent`);
      assert.equal(track.asset.sha256, pin.sha256);
      assert.equal(track.asset.bytes, pin.bytes);
      assert.equal(track.rights.license, 'CC0 1.0 Universal');
      for (const right of ['webPlayback', 'offlineCache', 'redistribute', 'gameplayVideo'])
        assert.equal(track.policy[right], 'allowed');
      const archive = SOUNDTRACK_ARCHIVES.find(({ id }) => id === track.archiveId);
      assert(archive, `${pin.id}: trusted archive is absent`);
      const source = sources.tracks.find(({ id }) => `builtin.catalog.${id}` === pin.id);
      assert.equal(
        source?.downloadSha256,
        pin.sha256,
        'Creator download must have the exact published MP3 identity',
      );
      assert.equal(source.downloadBytes, pin.bytes);
      assert.equal(
        source.selectedMember,
        null,
        'Fixture intake never extracts or transcodes originals',
      );
      assert.equal(new URL(source.sourceURL).protocol, 'https:');
      const archiveURL = new URL(track.path, archive.baseURL).href;
      const url = downloadSource === 'creator' ? source.sourceURL : archiveURL;
      const file = `${pin.sha256}.mp3`;
      const receipt = {
        id: pin.id,
        file,
        sha256: pin.sha256,
        bytes: pin.bytes,
        asset: track.asset,
        title: track.title,
        artist: track.artist,
        rights: track.rights,
        policy: track.policy,
        archive,
        archiveURL,
        creatorSource: source,
        requestedURL: url,
        intake: download ? `explicit ${downloadSource} download` : 'exact cached original',
        status: 'pending',
      };
      manifest.recordings.push(receipt);
      await save();
      let bytes;
      if (download) {
        const result = await downloadOriginal(url, pin, fetcher, receipt);
        bytes = result.bytes;
        receipt.responseURL = result.responseURL;
        receipt.httpStatus = result.status;
      } else {
        receipt.sourcePath = resolve(recordingsDirectory, file);
        bytes = verifyAudioFixtureBytes(await readFile(receipt.sourcePath), pin);
      }
      await writeFile(resolve(destination, file), bytes, { flag: 'wx' });
      receipt.status = 'verified';
      tracks.push(track);
      assets.push({ sha256: pin.sha256, blob: new Blob([bytes], { type: 'audio/mpeg' }) });
      await save();
    }
    const base = setCatalogueTracks(emptySoundtrackLibrary({ catalogue: true }), tracks);
    const library = resolveSoundtrackLibrary({
      ...base,
      installedTrackIds: tracks.map(({ id }) => id),
      listening: { ...base.listening, installedOnly: true, recordingMode: true },
      playlists: [
        {
          id: AUDIO_PLAYLIST_ID,
          title: 'Qualification: exact archived recordings',
          trackIds: tracks.map(({ id }) => id),
          order: 'ordered',
          repeat: 'all',
        },
      ],
      selection: { playlistId: AUDIO_PLAYLIST_ID },
    });
    // The production exporter independently checks every MP3 frame, hash and
    // declared metadata. Browser media admission still occurs at public import.
    const blob = await exportSoundtrackBundle(library, assets, { catalogue: SOUNDTRACK_CATALOGUE });
    const bytes = Buffer.from(await blob.arrayBuffer());
    await writeFile(resolve(destination, AUDIO_BUNDLE_FILE), bytes, { flag: 'wx' });
    manifest.bundle = {
      file: AUDIO_BUNDLE_FILE,
      bytes: bytes.length,
      sha256: hash(bytes),
      mime: blob.type,
    };
    manifest.status = 'prepared-not-executed';
    await save();
    return manifest;
  } catch (error) {
    manifest.status = 'failed';
    manifest.failure = String(error?.message ?? error).slice(0, 2048);
    const pending = manifest.recordings.find(({ status }) => status === 'pending');
    if (pending) {
      pending.status = 'failed';
      pending.failure = manifest.failure;
    }
    await save();
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [directory, ...args] = process.argv.slice(2);
  assert(
    directory,
    'Usage: node scripts/prepare-solo-audio-fixtures.mjs <new-directory> (--download | --creator-download | --recordings=<directory>)',
  );
  assert(
    args.every(
      (arg) =>
        ['--download', '--creator-download'].includes(arg) || arg.startsWith('--recordings='),
    ),
    'Unknown preparation option',
  );
  assert(args.length === 1, 'Choose one original recording source');
  const manifest = await prepareAudioFixtures(directory, {
    download: args.some((arg) => ['--download', '--creator-download'].includes(arg)),
    downloadSource: args.includes('--creator-download') ? 'creator' : 'archive',
    recordingsDirectory: args
      .find((arg) => arg.startsWith('--recordings='))
      ?.slice('--recordings='.length),
  });
  console.log(
    JSON.stringify({
      directory: resolve(directory),
      status: manifest.status,
      recordings: manifest.recordings.length,
      bundle: manifest.bundle,
    }),
  );
}
