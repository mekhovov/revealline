import test from 'node:test';
import assert from 'node:assert/strict';
import { applyPublicationProfile } from './game-cli.mjs';

const fixture = () => ({
  entries: [
    { name: 'game/index.html', bytes: Buffer.from('core') },
    { name: 'game/content-design/runtime/current.json', bytes: Buffer.from('current') },
    { name: 'game/content-design/runtime/archive.json', bytes: Buffer.from('archive') },
    { name: 'game/content-design/assets/shared.png', bytes: Buffer.from('shared') },
    { name: 'game/content-design/assets/unused.png', bytes: Buffer.from('unused') },
  ],
  catalogue: {
    files: [
      { path: 'game/content-design/runtime/current.json', sha256: 'current' },
      { path: 'game/content-design/runtime/archive.json', sha256: 'archive' },
      { path: 'game/content-design/assets/shared.png', sha256: 'shared' },
      { path: 'game/content-design/assets/unused.png', sha256: 'unused' },
    ],
    groups: [
      {
        id: 'shared',
        category: 'shared',
        requires: [],
        files: ['game/content-design/assets/shared.png'],
      },
      {
        id: 'chapter:current',
        category: 'chapter',
        requires: ['shared'],
        files: ['game/content-design/runtime/current.json'],
      },
      {
        id: 'archive:old',
        category: 'archive',
        requires: ['shared'],
        files: ['game/content-design/runtime/archive.json'],
      },
      {
        id: 'destination:archive',
        category: 'destination',
        requires: ['archive:old'],
        files: [],
      },
      {
        id: 'tooling:artwork',
        category: 'tooling',
        requires: [],
        files: [
          'game/content-design/assets/shared.png',
          'game/content-design/assets/unused.png',
        ],
      },
    ],
    missions: [{ groups: ['chapter:current'] }, { groups: ['archive:old'] }],
    destinations: [
      { routeId: 'current', groups: ['chapter:current'], runtimeGroups: ['shared'] },
      { routeId: 'old', groups: ['archive:old'], runtimeGroups: ['shared'] },
    ],
    navigationBootstraps: [
      { routeId: 'current', files: ['game/content-design/runtime/current.json'] },
      { routeId: 'old', files: ['game/content-design/runtime/archive.json'] },
    ],
    originals: [{ parent: 'current' }, { parent: 'archive' }],
  },
  artwork: { name: 'Journey candidate artwork', files: [] },
});

test('main Pages keeps current content and omits archive and exclusive unused artwork', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.equal(applyPublicationProfile(entries, catalogue, 'main-pages', artwork), null);
  assert.deepEqual(entries.map((entry) => entry.name), [
    'game/index.html',
    'game/content-design/runtime/current.json',
    'game/content-design/assets/shared.png',
  ]);
  assert.deepEqual(catalogue.files.map((file) => file.path), [
    'game/content-design/runtime/current.json',
    'game/content-design/assets/shared.png',
  ]);
  assert.deepEqual(catalogue.groups.map((group) => group.id), ['shared', 'chapter:current']);
  assert.deepEqual(catalogue.missions, [{ groups: ['chapter:current'] }]);
  assert.deepEqual(catalogue.destinations, [
    { routeId: 'current', groups: ['chapter:current'], runtimeGroups: ['shared'] },
  ]);
  assert.deepEqual(catalogue.navigationBootstraps, [
    { routeId: 'current', files: ['game/content-design/runtime/current.json'] },
  ]);
  assert.deepEqual(catalogue.originals, [{ parent: 'current' }]);
});

test('ordinary builds keep the full optional-artwork contract', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.equal(applyPublicationProfile(entries, catalogue, null, artwork), artwork);
  assert.equal(entries.length, 5);
  assert.equal(catalogue.groups.length, 5);
});

test('publication profiles fail closed', () => {
  const { entries, catalogue, artwork } = fixture();
  assert.throws(
    () => applyPublicationProfile(entries, catalogue, 'unknown', artwork),
    /Unknown publication profile/,
  );
});
