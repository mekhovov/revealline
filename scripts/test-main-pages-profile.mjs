import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPublicationProfile } from './game-cli.mjs';

const fixture = () => ({
  entries: [
    { name: 'game/index.html', bytes: Buffer.from('core') },
    { name: 'game/content-design/assets/shared.png', bytes: Buffer.from('shared') },
    { name: 'game/content-design/assets/unused.png', bytes: Buffer.from('unused') },
  ],
  catalogue: {
    files: [
      { path: 'game/content-design/assets/shared.png' },
      { path: 'game/content-design/assets/unused.png' },
    ],
    groups: [
      { id: 'shared', files: ['game/content-design/assets/shared.png'] },
      {
        id: 'tooling:artwork',
        files: [
          'game/content-design/assets/shared.png',
          'game/content-design/assets/unused.png',
        ],
      },
    ],
    missions: [{ groups: ['shared'] }],
  },
  artwork: { name: 'Journey candidate artwork', files: [] },
});

test('main Pages omits only exclusive unused authoring artwork', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.equal(applyPublicationProfile(entries, catalogue, 'main-pages', artwork), null);
  assert.deepEqual(entries.map((entry) => entry.name), [
    'game/index.html',
    'game/content-design/assets/shared.png',
  ]);
  assert.deepEqual(catalogue.files.map((file) => file.path), [
    'game/content-design/assets/shared.png',
  ]);
  assert.deepEqual(catalogue.groups.map((group) => group.id), ['shared']);
});

test('ordinary builds keep the full optional-artwork contract', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.equal(applyPublicationProfile(entries, catalogue, null, artwork), artwork);
  assert.equal(entries.length, 3);
  assert.equal(catalogue.groups.length, 2);
});

test('publication profiles fail closed', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.throws(
    () => applyPublicationProfile(entries, catalogue, 'unknown', artwork),
    /Unknown publication profile/,
  );
});
