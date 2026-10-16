import { ONLINE_SOUNDTRACK_CATALOGUE_URL } from '../../online-soundtrack-catalogue.mjs';

export function publicCatalogueFixture() {
  const tracks = [
    ['1', 'Synth', ['synth']],
    ['2', 'FPV', ['ФПВ']],
    ['3', 'Fusion', ['fusion']],
    ['4', 'Ukrainian', ['ukrainian']],
  ].map(([hash, title, tags]) => ({
    id: `fixture-${hash}`,
    title,
    artist: 'Test artist',
    durationSeconds: 180,
    tags,
    source: `https://artists.example/${hash}`,
    license: 'CC0 1.0 Universal',
    licenseURL: 'https://creativecommons.org/publicdomain/zero/1.0/',
    credit: `${title} by Test artist`,
    fileName: `${title}.mp3`,
    archiveId: `fixture-${hash}`,
    collection: 'Test',
    collections: ['Test'],
    status: 'published-audition',
    listeningApproval: 'pending',
    gameCatalogueAdmission: false,
    contentId: false,
    recordingModeEligible: true,
    audio: {
      path: `https://github.com/mekhovov/revealline-soundtracks/releases/download/audio-test/${hash.repeat(64)}.mp3`,
      bytes: 1234,
      sha256: hash.repeat(64),
    },
    aliases: [],
  }));
  return {
    format: 'revealline-public-soundtrack-catalogue.v1',
    archive: {
      id: 'revealline-soundtracks',
      baseURL: 'https://mekhovov.github.io/revealline-soundtracks/',
    },
    sources: [],
    counts: {
      declaredTracks: tracks.length,
      uniqueRecordings: tracks.length,
      duplicateAliases: 0,
      audioBytes: tracks.reduce((sum, track) => sum + track.audio.bytes, 0),
    },
    tracks,
  };
}

export function publicCatalogueResponse(catalogue = publicCatalogueFixture()) {
  const body = new TextEncoder().encode(JSON.stringify(catalogue));
  return {
    status: 200,
    redirected: false,
    url: ONLINE_SOUNDTRACK_CATALOGUE_URL,
    headers: { get: () => String(body.byteLength) },
    body: new Response(body).body,
  };
}
