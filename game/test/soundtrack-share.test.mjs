import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../soundtrack-share.mjs';
import {
  SOUNDTRACK_GENRES,
  resolveSoundtrackLibrary,
  resolveSoundtrackSelection,
  soundtrackOrder,
  upgradeSoundtrackLibrary,
} from '../soundtrack.mjs';
import {
  exportSoundtrackBundle,
  importSoundtrackBundle,
  prepareSoundtrackLibrary,
} from '../soundtrack-bundle.mjs';
import { structuralProbe, fixture } from './helpers/soundtrack-fixtures.mjs';

const first = await fixture('first'),
  second = await fixture('second');
const incoming = {
  ...second.library,
  tracks: [{ ...second.track, id: 'track.second' }],
  playlists: [
    { ...second.library.playlists[0], id: 'playlist.second', trackIds: ['track.second'] },
  ],
  selection: { playlistId: 'playlist.second' },
};

const album = await prepareSoundtrackLibrary(incoming, second.assets, {
  probeMedia: structuralProbe,
});

test('additive creator albums preserve the applied choice and draft, are idempotent, and reject identity collisions', async () => {
  const current = upgradeSoundtrackLibrary(first.library);
  const merged = mergeSoundtrackShare(current, first.assets, album);
  assert.equal(merged.library.tracks.length, 2);
  assert.deepEqual(merged.library.selection, current.selection);
  assert.deepEqual(merged.library.listening, current.listening);
  assert.equal(mergeSoundtrackShare(merged.library, merged.assets, album).library.tracks.length, 2);
  assert.equal(current.tracks.length, 1);
  const collision = await prepareSoundtrackLibrary(
    { ...first.library, tracks: [{ ...first.track, title: 'Collision' }] },
    first.assets,
    { probeMedia: structuralProbe },
  );
  assert.throws(() => mergeSoundtrackShare(current, first.assets, collision), /conflicts/);
  assert.throws(
    () => mergeSoundtrackShare(current, first.assets, { library: incoming, assets: second.assets }),
    /validation/,
  );
});

test('sharing exports only the chosen playlist and requires declared recording permissions', () => {
  const merged = mergeSoundtrackShare(first.library, first.assets, album);
  const share = soundtrackPlaylistShare(merged.library, merged.library.playlists[0]);
  assert.equal(share.tracks.length, 1);
  assert.deepEqual(share.selection, { playlistId: null });
  assert.equal(share.assignments.length, 0);
  const personal = resolveSoundtrackLibrary({
    ...merged.library,
    tracks: merged.library.tracks.map((track) => ({
      ...track,
      rights: { ...track.rights, kind: 'personal' },
    })),
  });
  assert.throws(() => soundtrackPlaylistShare(personal, personal.playlists[0]), /permission/);
});

for (const genre of ['acoustic', 'chiptune']) {
  test(`${genre} playlist shares round-trip originals, tags and ordered entries into an eligible automatic queue`, async () => {
    const merged = mergeSoundtrackShare(first.library, first.assets, album);
    const draft = structuredClone(upgradeSoundtrackLibrary(merged.library));
    const ids = draft.tracks.map((track) => track.id);
    const playlist = {
      id: `playlist.${genre}`,
      title: `${genre} creator album`,
      trackIds: [ids[1], ids[0], ids[1]],
      order: 'ordered',
      repeat: 'all',
    };
    draft.playlists = [playlist];
    draft.selection.playlistId = playlist.id;
    draft.listening = {
      mode: 'mix',
      genres: ['synth90s', 'metal', 'ukrainian'],
      installedOnly: false,
      recordingMode: false,
    };
    draft.tags = Object.fromEntries(
      ids.map((id) => [id, { genres: [genre], role: 'any', energy: 3, themes: [] }]),
    );
    const source = resolveSoundtrackLibrary(draft);
    const share = soundtrackPlaylistShare(source, playlist);
    const restored = await importSoundtrackBundle(
      await exportSoundtrackBundle(share, merged.assets),
      { probeMedia: structuralProbe },
    );

    assert.deepEqual(restored.library.listening.genres, SOUNDTRACK_GENRES);
    assert.deepEqual(restored.library.tracks, source.tracks);
    assert.deepEqual(restored.library.tags, source.tags);
    assert.deepEqual(restored.library.playlists, [playlist]);
    assert.equal(restored.assets.length, merged.assets.length);
    for (const expected of merged.assets) {
      const actual = restored.assets.find((asset) => asset.sha256 === expected.sha256);
      assert.ok(actual, `Missing original ${expected.sha256}`);
      assert.deepEqual(await actual.blob.arrayBuffer(), await expected.blob.arrayBuffer());
    }

    const automatic = resolveSoundtrackSelection(restored.library, { scene: 'gameplay' });
    assert.equal(automatic.source, 'catalogue');
    assert.deepEqual(new Set(soundtrackOrder(automatic.playlist)), new Set(ids));
    const selected = resolveSoundtrackSelection({
      ...restored.library,
      selection: { playlistId: playlist.id },
    });
    assert.deepEqual(soundtrackOrder(selected.playlist), playlist.trackIds);
    assert.equal(selected.playlist.repeat, 'all');

    // Sharing does not broaden an existing listener's deliberately saved style mix.
    assert.deepEqual(source.listening, draft.listening);
    const recipient = resolveSoundtrackLibrary({
      ...upgradeSoundtrackLibrary(first.library),
      listening: draft.listening,
    });
    const added = mergeSoundtrackShare(recipient, first.assets, restored);
    assert.deepEqual(added.library.listening, recipient.listening);
    assert.deepEqual(added.library.selection, recipient.selection);
    assert.deepEqual(added.library.tags, restored.library.tags);
    assert.deepEqual(
      added.library.playlists.find((item) => item.id === playlist.id),
      playlist,
    );
  });
}
