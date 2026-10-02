import test from 'node:test';
import assert from 'node:assert/strict';
import { downloadFiles, validateDownloadCatalogue } from '../download-catalogue.mjs';
import { MAX_OFFICIAL_FILE_BYTES } from '../official-downloads.mjs';
import { MAX_INSTALLED_PACKAGES, validateInstalledSelection } from '../installed-app.mjs';
import { gameplaySelection } from '../offline-download-session.mjs';
import { restoredGameplaySelection } from '../game-updates.mjs';

const file = (path, hash = 'a', kind = 'gameplay') => ({
  path,
  sha256: hash.repeat(64),
  bytes: 12,
  kind,
});
const group = (id, requires = [], files = [], extra = {}) => ({
  id,
  kind: 'gameplay',
  requires,
  files,
  ...extra,
});
const fixture = () => ({
  format: 'revealline-offline-content.v2',
  files: [file('game/runtime.mjs'), file('game/music.mp3', 'b', 'soundtrack')],
  groups: [
    group('base', [], ['game/runtime.mjs']),
    group('chapter', ['base']),
    group('optional:sim', ['base'], [], { current: false, category: 'extra' }),
    group('music:album', [], ['game/music.mp3'], { kind: 'soundtrack' }),
  ],
  missions: [{ id: 'opening', groups: ['chapter'] }],
});

test('catalogue growth resolves deep shared dependencies within the installed package budget', () => {
  const catalogue = fixture();
  catalogue.groups = Array.from({ length: MAX_INSTALLED_PACKAGES }, (_, i) =>
    group(`chapter:${i}`, i ? [`chapter:${i - 1}`] : [], ['game/runtime.mjs']),
  );
  // Start at the deepest dependency rather than letting earlier roots mask recursion depth.
  catalogue.groups.reverse();
  catalogue.missions = [{ id: 'last', groups: [`chapter:${MAX_INSTALLED_PACKAGES - 1}`] }];
  assert.equal(validateDownloadCatalogue(catalogue), catalogue);
  const ids = gameplaySelection(catalogue, { all: true });
  assert.equal(validateInstalledSelection(ids).length, MAX_INSTALLED_PACKAGES);
  assert.deepEqual(downloadFiles(catalogue, ids), [catalogue.files[0]]);
  catalogue.groups.at(-1).requires.push(`chapter:${MAX_INSTALLED_PACKAGES - 1}`);
  assert.throws(() => validateDownloadCatalogue(catalogue), /cycle/);
});

test('an update preserves selected packages and all-current intent without opting into new extras or music', () => {
  const catalogue = fixture();
  catalogue.groups.push(group('new:community', ['base']));
  const edition = 'https://example.test/revealline/';
  for (const allGameplay of [false, true]) {
    const active = { scope: edition, selection: ['base', 'chapter'], allGameplay };
    const restored = restoredGameplaySelection(catalogue, { active, edition, updating: true });
    const ids = gameplaySelection(catalogue, restored);
    assert.deepEqual(ids, allGameplay ? ['base', 'chapter', 'new:community'] : ['base', 'chapter']);
    assert.ok(downloadFiles(catalogue, ids).every((f) => f.kind === 'gameplay'));
  }
  assert.deepEqual(downloadFiles(catalogue, ['optional:sim']), [catalogue.files[0]]);
  assert.deepEqual(downloadFiles(catalogue, ['music:album']), [catalogue.files[1]]);
  const active = {
    scope: edition,
    selection: ['base', 'chapter', 'optional:sim'],
    allGameplay: true,
  };
  const retained = restoredGameplaySelection(catalogue, {
    active,
    edition,
    updating: true,
    saved: { selection: ['base', 'chapter'], complete: true, allGameplay: true },
  });
  assert.deepEqual(gameplaySelection(catalogue, retained), [
    'base',
    'chapter',
    'optional:sim',
    'new:community',
  ]);
  const explicitlySelected = {
    scope: edition,
    selection: ['base', 'chapter', 'new:community'],
    allGameplay: false,
  };
  assert.equal(
    restoredGameplaySelection(catalogue, { active: explicitlySelected, edition }).all,
    false,
  );
});

test('publication admission checks unselected packages, references and content identities', () => {
  const cases = [
    [(c) => c.groups.push({ ...c.groups[0] }), /Duplicate offline package/],
    [(c) => c.files.push({ ...c.files[0] }), /Duplicate offline file/],
    [(c) => c.groups[2].requires.push('missing'), /group dependency/],
    [(c) => c.groups[2].requires.push('optional:sim'), /cycle/],
    [(c) => c.groups[2].files.push('game/missing.json'), /file dependency/],
    [(c) => c.groups[2].requires.push('music:album'), /group dependency/],
    [(c) => c.groups[3].requires.push('base'), /group dependency/],
    [(c) => c.groups[2].files.push('game/music.mp3'), /file dependency/],
    [
      (c) => c.files.push({ ...c.files[0], path: 'game/alias.mjs', bytes: 13 }),
      /Conflicting content/,
    ],
    [(c) => (c.files[0].bytes = MAX_OFFICIAL_FILE_BYTES + 1), /game\/runtime.mjs.*descriptor/],
    [(c) => (c.files[0].sha256 = 'broken'), /descriptor/],
    [(c) => (c.files[0].bytes = -1), /descriptor/],
    [(c) => (c.groups[2].current = 'false'), /package descriptor/],
    [(c) => (c.missions[0].groups = ['missing']), /mission dependency/],
    [(c) => (c.missions[0].groups = ['music:album']), /mission dependency/],
    [(c) => (c.format = 'revealline-offline-content.v999'), /compatible downloader/],
  ];
  for (const [change, message] of cases) {
    const catalogue = fixture();
    change(catalogue);
    assert.throws(() => validateDownloadCatalogue(catalogue), message);
  }
  for (const path of [
    '../escape',
    '/root',
    'https://other.test/file',
    'game/%2e%2e/file',
    'game/a?b',
    'game/a#b',
    'game\\file',
  ]) {
    const catalogue = fixture();
    catalogue.files[0].path = path;
    assert.throws(() => validateDownloadCatalogue(catalogue), /file path/);
  }
});

test('both catalogue formats retain hash aliases, optional virtual recordings and additive metadata', () => {
  for (const format of ['revealline-offline-content.v1', 'revealline-offline-content.v2']) {
    const catalogue = fixture();
    catalogue.format = format;
    catalogue.futureDisplayMetadata = { title: 'Additive fields are compatible' };
    catalogue.files.push({ ...catalogue.files[0], path: 'game/alias.mjs' });
    catalogue.groups[1].files.push('game/alias.mjs');
    catalogue.files[1].path = 'soundtrack:optional-track';
    catalogue.files[1].trackId = 'optional-track';
    catalogue.groups[3].files = [catalogue.files[1].path];
    validateDownloadCatalogue(catalogue);
    assert.equal(downloadFiles(catalogue, ['chapter']).length, 1);
    assert.deepEqual(downloadFiles(catalogue, ['music:album']), [catalogue.files[1]]);
  }
});
