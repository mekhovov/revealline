import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { musicCreatorLinks, renderMusicCreatorLinks } from '../ui/music-credits.mjs';

test('creator resolution favors artist resources, retains multiple credits and excludes legal/cultural references', () => {
  assert.deepEqual(
    musicCreatorLinks({
      artist: 'Artist A',
      rights: { source: 'https://license.example/terms' },
      websites: [
        { label: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
        { label: 'Shchedryk provenance', url: 'https://culture.example/history' },
        { label: 'Composer', url: 'https://artist.example/album' },
        { label: 'Creator source and recording license', url: 'https://artist.example/album' },
      ],
      sourceCredits: [{ artist: 'Artist B', rightsEvidenceURL: 'https://second.example/song' }],
    }),
    [
      { url: 'https://artist.example/album', label: 'Artist A' },
      { url: 'https://second.example/song', label: 'Artist B' },
    ],
  );
});

test('invalid, credential-bearing and script sources never become links', () => {
  for (const source of [
    'javascript:alert(1)',
    'data:text/html,x',
    'file:///tmp/song',
    'https://user:password@artist.example',
    'artist name only',
    '//artist.example',
  ]) {
    assert.deepEqual(musicCreatorLinks({ rights: { source }, websites: [{ url: source }] }), []);
  }
  assert.equal(
    musicCreatorLinks({ rights: { source: 'http://artist.example/' } })[0].url,
    'http://artist.example/',
  );
});

test('safe new-tab links keep focus on metadata ticks and clear when the next song has no source', () => {
  const doc = new Document(),
    container = doc.createElement('div');
  doc.body.append(container);
  const track = { artist: 'A <img>', rights: { source: 'https://artist.example/' } };
  renderMusicCreatorLinks(container, track, { document: doc });
  const link = container.querySelector('a');
  link.focus();
  assert.equal(link.getAttribute('target'), '_blank');
  assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  renderMusicCreatorLinks(
    container,
    { ...track, artist: 'Renamed artist' },
    { document: doc, label: 'Updated source' },
  );
  assert.equal(container.querySelector('a'), link);
  assert.equal(doc.activeElement, link);
  assert.equal(link.textContent, 'Updated source');
  assert.equal(container.querySelectorAll('img').length, 0);
  renderMusicCreatorLinks(
    container,
    { title: 'Personal MP3' },
    { document: doc, fallbackText: 'No source supplied' },
  );
  assert.equal(container.querySelectorAll('a').length, 0);
  assert.equal(container.textContent, 'No source supplied');
  assert.equal(container.hidden, false);
  renderMusicCreatorLinks(container, null, { document: doc });
  assert.equal(container.hidden, true);
});
