import assert from 'node:assert/strict';
import test from 'node:test';
import { mergeSoundtrackShare, soundtrackPlaylistShare } from '../soundtrack-share.mjs';
import { resolveSoundtrackLibrary, upgradeSoundtrackLibrary } from '../soundtrack.mjs';
import { prepareSoundtrackLibrary } from '../soundtrack-bundle.mjs';
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
