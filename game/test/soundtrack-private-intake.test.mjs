import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePrivateSoundtrackCollection } from '../soundtrack-private-intake.mjs';
import { emptySoundtrackLibrary } from '../soundtrack.mjs';
import { silenceBytes, structuralProbe } from './helpers/soundtrack-fixtures.mjs';

const file = (name, bytes = silenceBytes) => new File([bytes], name, { type: 'audio/mpeg' });

test('private folder intake creates a selected shuffle playlist and deduplicates exact audio bytes', async () => {
  let serial = 0;
  const result = await preparePrivateSoundtrackCollection(
    emptySoundtrackLibrary({ catalogue: true }),
    [],
    [file('First.mp3'), file('Alias.mp3')],
    {
      title: 'Night flights',
      genre: 'electronic',
      probeMedia: structuralProbe,
      makeId: (kind) => `${kind}.private-${++serial}`,
    },
  );

  assert.equal(result.library.playlists.length, 1);
  assert.deepEqual(result.library.playlists[0], {
    id: result.playlistId,
    title: 'Night flights',
    trackIds: result.trackIds,
    order: 'shuffle',
    repeat: 'all',
  });
  assert.equal(result.library.selection.playlistId, result.playlistId);
  assert.deepEqual(
    result.library.tracks.map((track) => [track.fileName, track.rights.kind]),
    [
      ['First.mp3', 'personal'],
      ['Alias.mp3', 'personal'],
    ],
  );
  assert.deepEqual(
    result.trackIds.map((id) => result.library.tags[id].genres),
    [['electronic'], ['electronic']],
  );
  assert.equal(result.assets.length, 1, 'duplicate aliases retain one exact stored recording');
  assert.equal(result.uniqueRecordings, 1);
});

test('private folder intake is transactional when a later MP3 is invalid', async () => {
  const library = emptySoundtrackLibrary({ catalogue: true });
  await assert.rejects(
    preparePrivateSoundtrackCollection(
      library,
      [],
      [file('Good.mp3'), file('Bad.mp3', 'not an mp3')],
      { title: 'Rejected folder', probeMedia: structuralProbe },
    ),
    /MPEG|MP3|audio/i,
  );
  assert.equal(library.tracks.length, 0);
  assert.equal(library.playlists.length, 0);
});

test('private folder intake requires a name and a supported style', async () => {
  const library = emptySoundtrackLibrary({ catalogue: true });
  await assert.rejects(
    preparePrivateSoundtrackCollection(library, [], [file('One.mp3')], {
      title: '',
      probeMedia: structuralProbe,
    }),
    /collection name/i,
  );
  await assert.rejects(
    preparePrivateSoundtrackCollection(library, [], [file('One.mp3')], {
      title: 'One',
      genre: 'unsupported',
      probeMedia: structuralProbe,
    }),
    /supported music style/i,
  );
});
