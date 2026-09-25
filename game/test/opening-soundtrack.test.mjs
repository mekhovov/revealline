import assert from 'node:assert/strict';
import test from 'node:test';
import {
  SOUNDTRACK_BUNDLED_ASSETS,
  SOUNDTRACK_CATALOGUE,
  SOUNDTRACK_COLLECTIONS,
} from '../content/soundtrack-catalogue.mjs';
import {
  OPENING_THEME_PLAYLIST_ID,
  OPENING_THEME_TRACK_ID,
  prepareOpeningTheme,
  usesOpeningThemeDefault,
} from '../opening-soundtrack.mjs';
import {
  emptySoundtrackLibrary,
  resolveSoundtrackSelection,
  setCatalogueTracks,
  soundtrackRights,
} from '../soundtrack.mjs';
import { resolveBundledSoundtrackAssets } from '../soundtrack-bundled.mjs';

const track = SOUNDTRACK_CATALOGUE.tracks.find((entry) => entry.id === OPENING_THEME_TRACK_ID);
const collection = SOUNDTRACK_COLLECTIONS.find((entry) => entry.id === OPENING_THEME_PLAYLIST_ID);

test('the exact core Shchedryk adaptation is admitted once with Ukrainian metal and Content ID policy', () => {
  assert(track);
  assert.deepEqual(track.tags.genres, ['ukrainian', 'metal']);
  assert.equal(track.tags.role, 'any');
  assert.equal(track.asset.bytes, 8_641_768);
  assert.equal(
    track.asset.sha256,
    'd4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58',
  );
  assert.match(track.rights.credit, /Alexander Nakarada/);
  assert.match(
    track.websites.find((website) => website.label === 'Shchedryk provenance').url,
    /ui\.org\.ua/,
  );
  const rights = soundtrackRights(track, { catalogue: SOUNDTRACK_CATALOGUE });
  assert.equal(rights.webPlayback, 'allowed');
  assert.equal(rights.offlineCache, 'allowed');
  assert.equal(rights.redistribute, 'allowed');
  assert.equal(rights.contentId, 'registered');
  assert.deepEqual(
    SOUNDTRACK_CATALOGUE.tracks
      .filter((entry) => entry.asset.sha256 === track.asset.sha256)
      .map((entry) => entry.id),
    [OPENING_THEME_TRACK_ID],
  );
});

test('the opening queue starts with Shchedryk and continues through each admitted Ukrainian recording once', () => {
  assert(collection);
  assert.equal(collection.order, 'ordered');
  assert.equal(collection.repeat, 'all');
  assert.equal(collection.trackIds[0], OPENING_THEME_TRACK_ID);
  assert.equal(new Set(collection.trackIds).size, collection.trackIds.length);
  assert.deepEqual(
    new Set(collection.trackIds),
    new Set(
      SOUNDTRACK_CATALOGUE.tracks
        .filter((entry) => entry.tags.genres.includes('ukrainian'))
        .map((entry) => entry.id),
    ),
  );
});

test('the bundled registration is exact, bounded and independent of installed media ownership', () => {
  const bundled = resolveBundledSoundtrackAssets(SOUNDTRACK_BUNDLED_ASSETS, SOUNDTRACK_CATALOGUE);
  assert.deepEqual(bundled, SOUNDTRACK_BUNDLED_ASSETS);
  assert.deepEqual(bundled, [
    {
      id: OPENING_THEME_TRACK_ID,
      sha256: track.asset.sha256,
      bytes: track.asset.bytes,
      path: `game/audio/soundtracks/${track.asset.sha256}.mp3`,
    },
  ]);
  assert(bundled.reduce((sum, entry) => sum + entry.bytes, 0) < 64 * 1024 * 1024);
});

test('only the new Ukrainian default prepares the opening theme; explicit choices and Recording mode survive', async () => {
  const fresh = setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks);
  assert.equal(fresh.listening.mode, 'ukrainian');
  assert.equal(usesOpeningThemeDefault(fresh, { fresh: true }), true);
  assert.equal(
    usesOpeningThemeDefault(fresh),
    false,
    'an already persisted Ukrainian choice is not treated as a fresh profile',
  );
  const calls = [];
  const player = {
    async selectPlaylist(id) {
      calls.push(['select', id]);
      return false;
    },
    async prepare(options) {
      calls.push(['prepare', options]);
      return true;
    },
  };
  assert.equal(await prepareOpeningTheme(player, fresh, { fresh: true }), true);
  assert.deepEqual(calls, [
    ['select', OPENING_THEME_PLAYLIST_ID],
    ['prepare', { allowNetwork: true }],
  ]);
  for (const library of [
    { ...fresh, listening: { ...fresh.listening, mode: 'metal' } },
    { ...fresh, listening: { ...fresh.listening, recordingMode: true } },
    { ...fresh, listening: { ...fresh.listening, installedOnly: true } },
    { ...fresh, selection: { playlistId: 'builtin.playlist.ukrainian' } },
  ])
    assert.equal(usesOpeningThemeDefault(library), false);
  calls.length = 0;
  await prepareOpeningTheme(player, {
    ...fresh,
    listening: { ...fresh.listening, mode: 'metal' },
  });
  assert.deepEqual(calls, [['prepare', { allowNetwork: false }]]);
});

test('Recording mode excludes the registered core theme and exposes its eligibility notice', () => {
  const fresh = setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks);
  const selected = resolveSoundtrackSelection(
    {
      ...fresh,
      listening: { ...fresh.listening, recordingMode: true },
    },
    { scene: 'menu' },
    { catalogue: SOUNDTRACK_CATALOGUE },
  );
  assert(!selected.playlist.trackIds.includes(OPENING_THEME_TRACK_ID));
  assert.match(selected.notice, /Recording mode excludes/);
});

test('Installed only includes the bundled opening theme without claiming downloaded ownership', () => {
  const fresh = setCatalogueTracks(emptySoundtrackLibrary(), SOUNDTRACK_CATALOGUE.tracks);
  const selected = resolveSoundtrackSelection(
    {
      ...fresh,
      listening: { ...fresh.listening, installedOnly: true },
    },
    { scene: 'menu', bundledTrackIds: [OPENING_THEME_TRACK_ID] },
    { catalogue: SOUNDTRACK_CATALOGUE },
  );
  assert(selected.playlist.trackIds.includes(OPENING_THEME_TRACK_ID));
  assert.deepEqual(fresh.installedTrackIds, []);
});
