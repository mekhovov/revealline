// Reconcile retained recordings and completed receipts only. No fetch, encode or publication.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash, webcrypto } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { inspectMP3 } from '../../../../game/mp3.mjs';

globalThis.crypto ??= webcrypto;
const base = fileURLToPath(new URL('../', import.meta.url));
const research = fileURLToPath(
  new URL('../../../../docs/research/licensed-music-expansion-2026-09-21/', import.meta.url),
);
const readJSON = async (file) => JSON.parse(await readFile(file, 'utf8'));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sum = (items, project) => items.reduce((total, item) => total + project(item), 0);
const manifest = await readJSON(path.join(research, 'suggested-additions.json'));
const classification = await readJSON(path.join(research, 'classification-review.json'));
const intake = await readJSON(path.join(base, 'provenance/expansion-downloads.json'));
const derivatives = await readJSON(path.join(base, 'provenance/expansion-derivatives.json'));
const decoded = await readJSON(path.join(base, 'provenance/expansion-mp3-decode.json'));
const sources = await readJSON(path.join(base, 'sources.json'));
const register = await readJSON(path.join(base, 'production-register.json'));
const licenses = await readJSON(path.join(base, 'provenance/license-revalidation.json'));
const publicationBefore = await readFile(path.join(base, 'publication.json'));
const ids = new Set(manifest.tracks.map((track) => track.id));
assert.equal(ids.size, 40);
assert.equal(intake.tracks.length, 40);
assert.equal(derivatives.complete, true);
assert.equal(derivatives.allIntakeOriginalsUnchanged, true);
assert.equal(derivatives.tracks.length, 22);
assert.equal(decoded.completedTracks, 18);
assert.equal(decoded.failedTracks, 0);
assert.equal(decoded.deferredTracks, 0);
assert.equal(
  sha(await readFile(path.join(research, 'suggested-additions.json'))),
  classification.manifestSha256,
);
const byId = (rows) => new Map(rows.map((row) => [row.id, row]));
const downloads = byId(intake.tracks);
const converted = byId(derivatives.tracks);
const mp3Decoded = byId(decoded.tracks);
const oldSources = sources.tracks.filter((track) => !ids.has(track.id));
const oldRegister = register.tracks.filter((track) => !ids.has(track.id));
assert.equal(oldSources.length, 30);
assert.equal(oldRegister.length, 30);
const oldById = byId(oldRegister);
const label = {
  'CC0-1.0': 'CC0 1.0 Universal',
  'CC-BY-3.0': 'CC BY 3.0 Unported',
  'CC-BY-4.0': 'CC BY 4.0 International',
};
const explicitCrossStyle = {
  'peachtea.last-stand-lets-go': ['metal', 'electronic'],
  'congusbongus.the-demon-king': ['synth90s', 'metal'],
};
const groupTitles = {
  metal: 'Metal & Synth-Metal',
  rock: 'Instrumental Rock',
  synth90s: '90s Synth & FM',
  chiptune: 'Fakebit & Chiptune',
  electronic: 'Electronic & Dance',
  ambient: 'Ambient',
};
const newSources = [];
const newRegister = [];
const groups = new Map();
for (const track of manifest.tracks) {
  const downloaded = downloads.get(track.id);
  const mapped = classification.tracks[track.id];
  assert.equal(downloaded.sourcePage, track.sourcePage);
  assert.equal(mapped.sourcePage, track.sourcePage);
  const original = downloaded.original;
  const originalBytes = await readFile(path.join(base, original.path));
  assert.equal(originalBytes.length, original.bytes);
  assert.equal(sha(originalBytes), original.sha256);
  const derivative = converted.get(track.id) ?? null;
  const native = mp3Decoded.get(track.id);
  assert.equal(Boolean(derivative) !== Boolean(native), true);
  const runtime = derivative
    ? { path: `derivatives/${derivative.name}`, bytes: derivative.bytes, sha256: derivative.sha256 }
    : { ...original };
  if (derivative) {
    assert.equal(derivative.sourceBytes, original.bytes);
    assert.equal(derivative.sourceSha256, original.sha256);
  } else {
    assert.equal(native.status, 'complete');
    assert.equal(native.sourceUnchanged, true);
    assert.equal(native.sha256After, original.sha256);
    assert.equal(native.framesReadThroughEOF, native.decodedFrames);
  }
  const runtimeBytes = derivative ? await readFile(path.join(base, runtime.path)) : originalBytes;
  assert.equal(runtimeBytes.length, runtime.bytes);
  assert.equal(sha(runtimeBytes), runtime.sha256);
  const asset = await inspectMP3(new Blob([runtimeBytes]));
  assert.equal(asset.sha256, runtime.sha256);
  const durationSeconds = derivative?.mp3DecodedDurationSeconds ?? native.durationSeconds;
  const shortCue = durationSeconds < 90;
  const group = `${mapped.primaryGenre}${shortCue ? '-cues' : ''}`;
  const albumId = `preview.expansion-${group}`;
  const license = label[track.license];
  assert.ok(license);
  const credit = `${track.author} — ${track.title}. ${license}.${derivative ? ' Converted from OGG to MP3; no musical edits.' : ' Exact creator MP3.'}`;
  assert.ok(credit.length <= 280);
  const tags = {
    genres: explicitCrossStyle[track.id] ?? [mapped.primaryGenre],
    role: mapped.role,
    energy: mapped.energy,
    themes: [],
  };
  const websites = [
    { label: 'Creator source and recording license', url: track.sourcePage },
    { label: license, url: track.licenseUrl },
    ...(track.authorWebsite ? [{ label: 'Creator profile', url: track.authorWebsite }] : []),
  ];
  const source = {
    id: track.id,
    title: track.title,
    artist: track.author,
    albumId,
    source: track.sourcePage,
    credit,
    license,
    licenseURL: track.licenseUrl,
    original,
    runtime,
    derivative,
    fileName: path.basename(runtime.path),
    websites,
    tags,
    classification: {
      primaryGenre: mapped.primaryGenre,
      secondaryGenres: mapped.secondaryGenres,
      basis: mapped.basis,
      evidence:
        '../../../docs/research/licensed-music-expansion-2026-09-21/classification-review.json',
    },
    decodedDurationSeconds: durationSeconds,
    durationClass: shortCue ? 'short-cue-under-90-seconds' : 'recording-at-least-90-seconds',
  };
  newSources.push(source);
  if (!groups.has(group)) groups.set(group, []);
  groups.get(group).push(source);
  newRegister.push({
    ...source,
    status: 'licensed-candidate',
    asset,
    licenseReview: {
      status: 'verified-open-license',
      evidence: 'provenance/license-revalidation.json',
      publicationEligible: true,
      scope:
        'Permission status only; no endorsement, music-quality or sample-chain warranty claim.',
    },
    policy: {
      id: track.id,
      sha256: runtime.sha256,
      webPlayback: 'allowed',
      offlineCache: 'allowed',
      redistribute: 'allowed',
      modify: 'allowed',
      gameplayVideo: 'allowed',
      contentId: 'unknown',
    },
    tagBasis: `${mapped.basis} Secondary source classifications: ${mapped.secondaryGenres.join(', ') || 'none'}. ${explicitCrossStyle[track.id] ? 'Creator expressly describes the cross-style composition; both primary styles enter the Fusion selection.' : 'Runtime selection uses only the primary genre; secondary labels do not imply a Fusion selection.'} Roles and numeric energy are provisional editorial mappings from creator descriptions, not listening measurements.`,
    codecInspection: {
      codec: '.mp3',
      channels: asset.channels,
      sampleRateHz: asset.sampleRate,
      durationSeconds,
      method:
        'Complete macOS CoreAudio PCM16 decode through EOF, with original hashes unchanged; not musical audition.',
      evidence: derivative
        ? 'provenance/expansion-derivatives.json'
        : 'provenance/expansion-mp3-decode.json',
      trackId: track.id,
    },
    review: {
      listening: 'pending',
      inGameMix: 'pending',
      loopSeam: 'pending',
      regionalAuthenticity: 'not-applicable; no Ukrainian-style claim',
      musicalQuality: 'unreviewed',
    },
    transform: derivative ? derivatives.encoder.transform : 'none: exact creator MP3 retained',
  });
}
// Existing album identities, bytes and prior review evidence remain stable.
for (const source of oldSources) {
  const row = oldById.get(source.id);
  const tags = structuredClone(row.tags);
  let basis = row.tagBasis;
  let secondaryGenres = [];
  if (source.id.startsWith('holizna.')) {
    tags.genres = ['electronic'];
    basis =
      'Creator-described modern retro/synthwave, classified electronic; not presented as 1990s hardware synthesis. Role any and energy 3 are neutral provisional defaults, not audition measurements.';
  } else if (source.id.startsWith('3xblast.')) {
    tags.genres = ['chiptune'];
    secondaryGenres = ['rock'];
    basis =
      'Creator-described pop-punk/chiptune, classified primarily chiptune with rock as secondary source evidence; not metal or period-authentic 1990s music. Runtime selection keeps one primary genre. Role any and energy 3 are neutral provisional defaults, not audition measurements.';
  }
  Object.assign(source, {
    licenseURL: row.licenseURL,
    tags,
    fileName: path.basename(source.runtime.path),
    websites: row.websites,
    classification: { primaryGenre: tags.genres[0], secondaryGenres, basis },
  });
  Object.assign(row, {
    tags,
    fileName: source.fileName,
    classification: source.classification,
    tagBasis: basis,
  });
}
const newAlbums = [...groups.entries()].map(([group, tracks]) => {
  const primary = tracks[0].classification.primaryGenre;
  const short = group.endsWith('-cues');
  const bytes = sum(tracks, (track) => track.runtime.bytes);
  // Reserve at least 4 MiB of a 64 MiB bundle for metadata and its wrapper.
  assert.ok(bytes < 60 * 1024 * 1024);
  return {
    id: tracks[0].albumId,
    title: `${groupTitles[primary]}${short ? ' — Short Cues' : ''} — Preview`,
    genre: groupTitles[primary],
    description: `${tracks.length} creator-licensed ${short ? 'short cues, each under 90 seconds' : 'recordings, each at least 90 seconds'}. Listening, loop and in-game mix review pending; not quality-approved.`,
    credit: [...new Set(tracks.map((track) => track.artist))].join('; '),
    source: tracks[0].source,
    trackIds: tracks.map((track) => track.id),
  };
});
sources.tracks = [...oldSources, ...newSources];
sources.albums = [
  ...sources.albums.filter((album) => !album.id.startsWith('preview.expansion-')),
  ...newAlbums,
];
assert.equal(sources.tracks.length, 70);
assert.equal(sources.albums.length, 15);
sources.qualityStatus =
  '70 licensed third-party recordings; 37 exact MP3 originals and 33 documented OGG-to-MP3 derivatives. New preview groups distinguish short cues from longer recordings. Listening, native playback, loudness, mix and loop acceptance remain separate and pending. No original-composition or Ukrainian-style claim.';
register.tracks = [...oldRegister, ...newRegister];
register.reviewedAt = derivatives.at;
register.summary = {
  tracks: 70,
  albums: sources.albums.length,
  runtimeBytes: sum(sources.tracks, (track) => track.runtime.bytes),
  runtimeFrameDurationSeconds: sum(register.tracks, (track) => track.asset.durationSeconds),
  durationMeaning:
    'All-library duration sums inspected MPEG frames, including encoder padding. Expansion decoded duration below uses complete native PCM decode.',
  exactCreatorMP3s: 37,
  documentedOGGToMP3Derivatives: 33,
  earlierAdditionalIntake: { originalBytes: 20286781, derivativeBytes: 18787984 },
  expansion: {
    tracks: 40,
    originalBytes: sum(newSources, (track) => track.original.bytes),
    derivativeBytes: sum(newSources, (track) => track.derivative?.bytes ?? 0),
    runtimeBytes: sum(newSources, (track) => track.runtime.bytes),
    decodedDurationSeconds: sum(newSources, (track) => track.decodedDurationSeconds),
    shortCuesUnder90Seconds: newSources.filter((track) => track.decodedDurationSeconds < 90).length,
    recordingsAtLeast90Seconds: newSources.filter((track) => track.decodedDurationSeconds >= 90)
      .length,
    durationIsNotFullCompositionOrQualityApproval: true,
  },
  listeningApproved: 0,
};
const manifestById = byId(manifest.tracks);
const reviewId = 'licensed-expansion-20260921';
licenses.sources = licenses.sources.filter((source) => source.reviewId !== reviewId);
for (const check of classification.sourceChecks) {
  assert.deepEqual(check.declarationMismatches, []);
  const selected = [...new Set(check.trackIds.map((id) => manifestById.get(id).licenseUrl))];
  assert.equal(selected.length, 1);
  assert.ok(check.licenseUrls.includes(selected[0]));
  licenses.sources.push({
    reviewId,
    source: check.sourcePage,
    checkedAt: classification.checkedDate,
    responseBytes: check.htmlBytes,
    responseSha256: check.htmlSha256,
    licenseLinksOnCreatorSubmission: check.licenseUrls,
    selectedLicenseURL: selected[0],
    trackIds: check.trackIds,
    status: 'primary creator submission license declaration verified',
    auditioned: false,
    note: 'Submission recording-license link and every selected official attachment link were verified. This is the published grant, not an independent sample-chain warranty or listening approval.',
    evidence:
      '../../../../docs/research/licensed-music-expansion-2026-09-21/classification-review.json',
  });
}
for (const [file, value] of [
  ['sources.json', sources],
  ['production-register.json', register],
  ['provenance/license-revalidation.json', licenses],
]) {
  const encoded = JSON.stringify(value, null, 2) + '\n';
  assert.ok(Buffer.byteLength(encoded) < 512 * 1024);
  await writeFile(path.join(base, file), encoded);
}
assert.deepEqual(await readFile(path.join(base, 'publication.json')), publicationBefore);
console.log(
  JSON.stringify(
    {
      summary: register.summary,
      albums: sources.albums.map((album) => ({
        id: album.id,
        title: album.title,
        tracks: album.trackIds.length,
        runtimeBytes: sum(
          sources.tracks.filter((track) => album.trackIds.includes(track.id)),
          (track) => track.runtime.bytes,
        ),
      })),
      publicationUnchanged: true,
    },
    null,
    2,
  ),
);
